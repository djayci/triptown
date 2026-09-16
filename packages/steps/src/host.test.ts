import { describe, expect, it } from 'vitest';
import { STEP_CONFIGS } from './config';
import { deriveFences } from './derive';
import { StepError } from './host';
import { key, makeHost } from './test-helpers';

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof StepError && e.code === code);
}

/** Starts rounds until one has at least `minCleared` fences before its refusal (or none). */
async function roundWithRoom(h: ReturnType<typeof makeHost>, sessionId: string, minCleared: number) {
  for (let i = 0; i < 200; i++) {
    const { round } = await h.host.startRound(sessionId, { stakeMinor: 50_000, difficulty: 'medium' });
    const stored = (await h.steps.getStepRound(round.id))!;
    const refusedAt = stored.outcome.refusedAt;
    if (refusedAt === null || refusedAt > minCleared) return { round, refusedAt };
    await h.host.jump(sessionId, round.id, key());
    while ((await h.host.getRound(sessionId, round.id)).status === 'running') await h.host.jump(sessionId, round.id, key());
    h.clock.advance(10);
  }
  throw new Error('no suitable round');
}

describe('StepHost', () => {
  it('debits the stake once and derives fences from the session seeds', async () => {
    const h = makeHost();
    const s = await h.host.createSession(1_000_000);
    const { round, balanceMinor } = await h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'medium' });
    expect(balanceMinor).toBe(950_000);
    const stored = (await h.steps.getStepRound(round.id))!;
    const session = (await h.store.getSession(s.sessionId))!;
    expect(stored.outcome).toEqual(deriveFences({ serverSeed: session.serverSeed, clientSeed: session.clientSeed, nonce: 0 }, STEP_CONFIGS.medium));
    expect(JSON.stringify(round)).not.toContain('refusedAt');
  });

  it('pays a collect once, even when repeated with the same key', async () => {
    const h = makeHost();
    const s = await h.host.createSession(1_000_000);
    const { round } = await roundWithRoom(h, s.sessionId, 2);
    const before = (await h.host.sessionInfo(s.sessionId)).balanceMinor;
    await h.host.jump(s.sessionId, round.id, key());
    await h.host.jump(s.sessionId, round.id, key());
    const k = key();
    const first = await h.host.collect(s.sessionId, round.id, k);
    const again = await h.host.collect(s.sessionId, round.id, k);
    expect(first.round.settlement?.payoutMinor).toBe(76_000);
    expect(again.balanceMinor).toBe(before + 76_000);
    await expectCode(h.host.collect(s.sessionId, round.id, key()), 'round_not_running');
  });

  it('settles concurrent jump and collect exactly once', async () => {
    const h = makeHost();
    const s = await h.host.createSession(1_000_000);
    const { round } = await roundWithRoom(h, s.sessionId, 2);
    await h.host.jump(s.sessionId, round.id, key());
    const before = (await h.host.sessionInfo(s.sessionId)).balanceMinor;
    const results = await Promise.allSettled([h.host.collect(s.sessionId, round.id, key()), h.host.collect(s.sessionId, round.id, key())]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await h.host.sessionInfo(s.sessionId)).balanceMinor).toBe(before + 60_500);
  });

  it('enforces one active round and the minimum gap between starts', async () => {
    const h = makeHost({ minCycleMs: 5_000 });
    const s = await h.host.createSession(1_000_000);
    const { round } = await h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'easy' });
    await expectCode(h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'easy' }), 'round_in_progress');
    const stored = (await h.steps.getStepRound(round.id))!;
    if (stored.outcome.refusedAt === 1) await h.host.jump(s.sessionId, round.id, key());
    else {
      await h.host.jump(s.sessionId, round.id, key());
      if ((await h.host.getRound(s.sessionId, round.id)).status === 'running') await h.host.collect(s.sessionId, round.id, key());
    }
    h.clock.advance(3_000);
    await expectCode(h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'easy' }), 'cycle_too_soon');
    h.clock.advance(2_000);
    await expect(h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'easy' })).resolves.toBeTruthy();
  });

  it('rejects bets outside limits, unknown difficulty and collect before a fence', async () => {
    const h = makeHost();
    const s = await h.host.createSession(1_000_000);
    await expectCode(h.host.startRound(s.sessionId, { stakeMinor: 5_000, difficulty: 'easy' }), 'bet_limit');
    await expectCode(h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'insane' as 'easy' }), 'invalid_difficulty');
    await expectCode(h.host.startRound(s.sessionId, { stakeMinor: 2_000_000, difficulty: 'easy' }), 'insufficient_funds');
    const { round } = await h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'easy' });
    await expectCode(h.host.collect(s.sessionId, round.id, key()), 'nothing_to_collect');
  });

  it('settles abandoned rounds: collect with fences, refund without', async () => {
    const h = makeHost({ abandonAfterMs: 60_000 });
    const s = await h.host.createSession(1_000_000);
    const { round } = await roundWithRoom(h, s.sessionId, 2);
    await h.host.jump(s.sessionId, round.id, key());
    await h.host.jump(s.sessionId, round.id, key());
    const before = (await h.host.sessionInfo(s.sessionId)).balanceMinor;
    h.clock.advance(60_000);
    expect(await h.host.sweepAbandoned()).toBe(1);
    expect((await h.host.getRound(s.sessionId, round.id)).settlement).toMatchObject({ reason: 'abandoned', payoutMinor: 76_000 });
    expect((await h.host.sessionInfo(s.sessionId)).balanceMinor).toBe(before + 76_000);

    const idle = await h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'easy' });
    h.clock.advance(60_000);
    const info = await h.host.sessionInfo(s.sessionId);
    expect((await h.host.getRound(s.sessionId, idle.round.id)).settlement).toMatchObject({ status: 'void', payoutMinor: 50_000 });
    expect(info.balanceMinor).toBe(before + 76_000);
  });

  it('lists history newest first and rotates seeds only when idle', async () => {
    const h = makeHost();
    const s = await h.host.createSession(1_000_000);
    const a = await h.host.startRound(s.sessionId, { stakeMinor: 50_000, difficulty: 'easy' });
    await expectCode(h.host.rotateSeed(s.sessionId), 'round_in_progress');
    await h.host.jump(s.sessionId, a.round.id, key());
    if ((await h.host.getRound(s.sessionId, a.round.id)).status === 'running') await h.host.collect(s.sessionId, a.round.id, key());
    h.clock.advance(10);
    const rotation = await h.host.rotateSeed(s.sessionId);
    expect(rotation.roundsPlayed).toBe(1);
    const history = await h.host.history(s.sessionId);
    expect(history[0]!.id).toBe(a.round.id);
  });
});
