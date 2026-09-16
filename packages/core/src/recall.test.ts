import { deriveRound } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { RoundHost } from './host';
import { resultKind } from './money';
import { profileFromTemplate } from './profiles';
import { MemoryRoundStore } from './store';

const unpaced = { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } };

function setup() {
  const clock = { t: 1_700_000_000_000, now() { return this.t; } };
  const store = new MemoryRoundStore();
  const host = new RoundHost({ store, clock, sleep: async () => {}, profiles: unpaced });
  return { clock, store, host };
}

/** Points the session's next round at an outcome matching the predicate. */
async function aim(
  { host, store }: ReturnType<typeof setup>,
  sessionId: string,
  predicate: (o: { crashTime: number; setbacks: number[] }) => boolean,
) {
  const session = (await store.getSession(sessionId))!;
  const config = host.configFor(session.profile!);
  for (let i = 0; i < 50_000; i++) {
    const clientSeed = `recall-${i}`;
    const outcome = deriveRound({ serverSeed: session.serverSeed, clientSeed, nonce: session.nonce }, config);
    if (predicate(outcome)) {
      await host.setClientSeed(sessionId, clientSeed);
      return outcome;
    }
  }
  throw new Error('no matching outcome');
}

describe('resultKind', () => {
  it('only calls a return above the stake a win', () => {
    expect(resultKind(1_00, 1_01)).toBe('win');
    expect(resultKind(1_00, 1_00)).toBe('even');
    expect(resultKind(1_00, 60)).toBe('loss');
    expect(resultKind(1_00, 0)).toBe('loss');
  });
});

describe('round recall (4.1)', () => {
  it('records player, profile, client version, balances, return and cash-outs', async () => {
    const ctx = setup();
    const { host, clock } = ctx;
    const info = await host.createSession(10_00, { playerId: 'op:p1', clientVersion: 'whack@1.2.3' });
    await aim(ctx, info.sessionId, (o) => o.crashTime > 3 && o.setbacks.every((t) => t > 3));
    const { round } = await host.startRound(info.sessionId, { betMinor: 2_00 });
    clock.t += 2_000;
    await host.cashout(info.sessionId, round.id, { clientTapAt: clock.t - 40, rttMs: 80 });

    const [summary] = await host.history(info.sessionId);
    expect(summary).toMatchObject({
      roundId: round.id,
      profile: 'light',
      clientVersion: 'whack@1.2.3',
      balanceBeforeMinor: 10_00,
      resultKind: 'win',
    });
    const payout = summary!.settlement!.payoutMinor;
    expect(summary!.returnMinor).toBe(payout);
    expect(summary!.netMinor).toBe(payout - 2_00);
    expect(summary!.balanceAfterMinor).toBe(8_00 + payout);
    expect(summary!.crashMultiplier).toBeGreaterThan(summary!.settlement!.multiplier);
    expect(summary!.cashouts).toEqual([
      expect.objectContaining({ reason: 'manual', share: 1, creditedMinor: payout, clientTapAt: clock.t - 40, rttMs: 80 }),
    ]);
  });

  it('keeps running session totals and a newest-first player index', async () => {
    const ctx = setup();
    const { host, clock } = ctx;
    const info = await host.createSession(10_00, { playerId: 'op:p2' });
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      await aim(ctx, info.sessionId, (o) => o.crashTime > 0 && o.crashTime < 1);
      const { round } = await host.startRound(info.sessionId, { betMinor: 1_00 });
      ids.push(round.id);
      clock.t += 5_000;
      await host.getRound(info.sessionId, round.id);
    }
    const s = await host.sessionInfo(info.sessionId);
    expect(s).toMatchObject({ stakedMinor: 3_00, returnedMinor: 0, balanceMinor: 7_00 });
    expect(s.sessionStartedAt).toBe(1_700_000_000_000);

    const history = await host.history(info.sessionId);
    expect(history.map((r) => r.roundId)).toEqual([...ids].reverse());
    expect(history.every((r) => r.resultKind === 'loss' && r.netMinor === -1_00 && r.cashouts.length === 0)).toBe(true);

    const start = history[2]!.startedAt;
    const page = await host.playerRounds('op:p2', { fromMs: start + 1, limit: 1, offset: 1 });
    expect(page.map((r) => r.roundId)).toEqual([ids[1]]);
  });

  it('shows no outcome fields while a round is running', async () => {
    const ctx = setup();
    const info = await ctx.host.createSession(10_00);
    await aim(ctx, info.sessionId, (o) => o.crashTime > 5);
    const { round } = await ctx.host.startRound(info.sessionId, { betMinor: 1_00 });
    const snap = await ctx.host.getRound(info.sessionId, round.id);
    expect(snap).toMatchObject({ returnMinor: null, resultKind: null, crashMultiplier: null, balanceAfterMinor: null, cashouts: [] });
  });
});
