import { DEFAULT_CONFIG, commitServerSeed, deriveRound, verifyRound } from '@triptown/fairness';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RoundEvent } from './events';
import { HostError, RoundHost } from './host';
import { MemoryRoundStore } from './store';

/** Virtual time: sleeps resolve only when the test advances the clock. */
class FakeTime {
  t = 1_700_000_000_000;
  private waiters: { at: number; resolve: () => void }[] = [];
  now = () => this.t;
  sleep = (ms: number) =>
    new Promise<void>((resolve) => this.waiters.push({ at: this.t + ms, resolve }));

  async advance(ms: number) {
    const target = this.t + ms;
    for (;;) {
      await flush();
      this.waiters.sort((a, b) => a.at - b.at);
      const next = this.waiters[0];
      if (!next || next.at > target) break;
      this.waiters.shift();
      this.t = next.at;
      next.resolve();
    }
    this.t = target;
    await flush();
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0));

let time: FakeTime;
let store: MemoryRoundStore;
let host: RoundHost;
let ids = 0;

beforeEach(() => {
  time = new FakeTime();
  store = new MemoryRoundStore();
  ids = 0;
  host = new RoundHost({
    store,
    clock: time,
    sleep: time.sleep,
    config: DEFAULT_CONFIG,
    newId: () => `id${++ids}`,
    settlementPollMs: 200,
  });
});

/** Finds a nonce (by rotating client seeds) whose outcome satisfies a predicate. */
async function sessionWhere(
  predicate: (o: { crashTime: number; setbacks: number[] }) => boolean,
  balance = 100_00,
) {
  const s = await host.createSession(balance, 'probe');
  const session = (await store.getSession(s.sessionId))!;
  for (let i = 0; i < 50_000; i++) {
    const clientSeed = `probe-${i}`;
    const outcome = deriveRound({ serverSeed: session.serverSeed, clientSeed, nonce: 0 }, DEFAULT_CONFIG);
    if (predicate(outcome)) {
      await host.setClientSeed(s.sessionId, clientSeed);
      return { sessionId: s.sessionId, outcome };
    }
  }
  throw new Error('no matching outcome');
}

async function expectHostError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(HostError);
  await expect(p).rejects.toMatchObject({ code });
}

describe('RoundHost sessions and seeds (provably fair)', () => {
  it('publishes the commit, client seed and nonce 0 before any bet', async () => {
    const info = await host.createSession(50_00, 'mine');
    expect(info).toMatchObject({ balanceMinor: 50_00, clientSeed: 'mine', nonce: 0 });
    expect(info.commit).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(info)).not.toMatch(/serverSeed/);
  });

  it('increments the nonce per round and keeps it across client seed changes', async () => {
    const { sessionId } = await sessionWhere((o) => o.crashTime === 0);
    await host.startRound(sessionId, { betMinor: 100 });
    expect((await host.sessionInfo(sessionId)).nonce).toBe(1);
    await host.setClientSeed(sessionId, 'new-seed');
    expect((await host.sessionInfo(sessionId)).nonce).toBe(1);
    await time.advance(5000); // respect the profile's minimum game cycle
    const { round } = await host.startRound(sessionId, { betMinor: 100 });
    expect(round.seeds).toMatchObject({ clientSeed: 'new-seed', nonce: 1 });
  });

  it('reveals the previous seed on rotation and it verifies played rounds', async () => {
    const info = await host.createSession(100_00, 'c');
    await host.startRound(info.sessionId, { betMinor: 100 });
    await time.advance(120_000);
    const snap = (await host.history(info.sessionId))[0]!;
    const rotation = await host.rotateSeed(info.sessionId);
    expect(commitServerSeed(rotation.previousServerSeed)).toBe(info.commit);
    expect(rotation.session.commit).not.toBe(info.commit);
    expect(rotation.session.nonce).toBe(0);
    const verified = verifyRound({
      serverSeed: rotation.previousServerSeed,
      clientSeed: snap.clientSeed,
      nonce: snap.nonce,
      commit: snap.commit,
      config: DEFAULT_CONFIG,
    });
    expect(verified.verified).toBe(true);
    expect(verified.crashTime).toBe(snap.settlement!.crashTime);
  });

  it('rejects bad client seeds and changes during a running round', async () => {
    const { sessionId } = await sessionWhere((o) => o.crashTime > 5);
    await expectHostError(host.setClientSeed(sessionId, ''), 'invalid_client_seed');
    await host.startRound(sessionId, { betMinor: 100 });
    await expectHostError(host.setClientSeed(sessionId, 'x'), 'round_in_progress');
    await expectHostError(host.rotateSeed(sessionId), 'round_in_progress');
  });
});

describe('RoundHost rounds (round engine)', () => {
  it('debits on start', async () => {
    const info = await host.createSession(100_00);
    const { balanceMinor } = await host.startRound(info.sessionId, { betMinor: 10_00 });
    expect(balanceMinor).toBe(90_00);
    expect((await host.sessionInfo(info.sessionId)).balanceMinor).toBe(90_00);
  });

  it('rejects insufficient funds without creating a round', async () => {
    const info = await host.createSession(5_00);
    await expectHostError(host.startRound(info.sessionId, { betMinor: 10_00 }), 'insufficient_funds');
    expect(await store.getActiveRound(info.sessionId)).toBeNull(); // player id defaults to the session id
    expect(await host.history(info.sessionId)).toEqual([]);
    expect((await host.sessionInfo(info.sessionId)).balanceMinor).toBe(5_00);
  });

  it('rejects bets outside limits and invalid auto cash-out', async () => {
    const info = await host.createSession(1_000_00);
    await expectHostError(host.startRound(info.sessionId, { betMinor: 1 }), 'bet_limit');
    await expectHostError(host.startRound(info.sessionId, { betMinor: 500_00 }), 'bet_limit');
    await expectHostError(host.startRound(info.sessionId, { betMinor: 100, autoCashout: 1 }), 'invalid_auto_cashout');
  });

  it('allows one active round per session', async () => {
    const { sessionId } = await sessionWhere((o) => o.crashTime > 5);
    await host.startRound(sessionId, { betMinor: 100 });
    await expectHostError(host.startRound(sessionId, { betMinor: 100 }), 'round_in_progress');
  });

  it('pays a manual cash-out before the crash and rejects duplicates', async () => {
    const { sessionId, outcome } = await sessionWhere((o) => o.crashTime > 4 && o.setbacks.length === 0);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    await time.advance(3000);
    const first = await host.cashout(sessionId, round.id);
    expect(first.result).toBe('won');
    expect(first.settlement.crashTime).toBe(outcome.crashTime);
    expect(first.balanceMinor).toBe(90_00 + first.settlement.payoutMinor);
    const second = await host.cashout(sessionId, round.id);
    expect(second.result).toBe('already_settled');
    expect(second.balanceMinor).toBe(first.balanceMinor);
  });

  it('rejects a cash-out after the crash', async () => {
    const { sessionId, outcome } = await sessionWhere((o) => o.crashTime > 0.5 && o.crashTime < 3);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    await time.advance(Math.ceil(outcome.crashTime * 1000) + 10);
    const result = await host.cashout(sessionId, round.id);
    expect(result.result).toBe('crashed');
    expect(result.balanceMinor).toBe(90_00);
  });

  it('settles auto cash-out while disconnected', async () => {
    const { sessionId } = await sessionWhere((o) => o.crashTime > 12 && o.setbacks.length === 0);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00, autoCashout: 3 });
    await time.advance(60_000);
    const snap = await host.getRound(sessionId, round.id);
    expect(snap.settlement).toMatchObject({ status: 'won', reason: 'auto', payoutMinor: 30_00 });
    expect((await host.sessionInfo(sessionId)).balanceMinor).toBe(120_00);
  });

  it('settles a crash while disconnected and frees the session', async () => {
    const { sessionId } = await sessionWhere((o) => o.crashTime > 1 && o.crashTime < 5);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    await time.advance(10_000);
    expect((await host.getRound(sessionId, round.id)).status).toBe('lost');
    await expect(host.startRound(sessionId, { betMinor: 100 })).resolves.toBeTruthy();
  });

  it('forbids reading another session’s round', async () => {
    const a = await host.createSession(100_00);
    const b = await host.createSession(100_00);
    const { round } = await host.startRound(a.sessionId, { betMinor: 100 });
    await expectHostError(host.getRound(b.sessionId, round.id), 'forbidden');
  });
});

describe('RoundHost streaming', () => {
  it('streams START, setbacks at their time, then CRASH', async () => {
    const { sessionId, outcome } = await sessionWhere((o) => o.setbacks.length >= 2 && o.crashTime < 20);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    const events: { e: RoundEvent; at: number }[] = [];
    const stream = host.streamRound(sessionId, round.id, (e) => events.push({ e, at: time.now() }));
    await time.advance(Math.ceil(outcome.crashTime * 1000) + 500);
    await stream.done;

    expect(events[0]!.e.type).toBe('START');
    const setbacks = events.filter((x) => x.e.type === 'BAD_MOLE');
    expect(setbacks.map((x) => (x.e as { time: number }).time)).toEqual(outcome.setbacks);
    setbacks.forEach((x) => {
      const t = (x.e as { time: number }).time;
      // Emitted at (or just after) its scheduled time, never before.
      expect(x.at - round.startedAt).toBeGreaterThanOrEqual(t * 1000 - 1);
    });
    const last = events.at(-1)!.e;
    expect(last).toMatchObject({ type: 'CRASH', crashTime: outcome.crashTime, balanceMinor: 90_00 });
  });

  it('emits START then CRASH at 1.00 for an instant bust', async () => {
    const { sessionId } = await sessionWhere((o) => o.crashTime === 0);
    const { round } = await host.startRound(sessionId, { betMinor: 100 });
    const events: RoundEvent[] = [];
    await host.streamRound(sessionId, round.id, (e) => events.push(e)).done;
    expect(events.map((e) => e.type)).toEqual(['START', 'CRASH']);
    expect(events[1]).toMatchObject({ multiplier: 1 });
  });

  it('ends with CASHED_OUT after a manual cash-out from another request', async () => {
    const { sessionId } = await sessionWhere((o) => o.crashTime > 8 && o.setbacks.length === 0);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    const events: RoundEvent[] = [];
    const stream = host.streamRound(sessionId, round.id, (e) => events.push(e));
    await time.advance(2000);
    const result = await host.cashout(sessionId, round.id);
    await time.advance(1000);
    await stream.done;
    expect(events.at(-1)).toMatchObject({
      type: 'CASHED_OUT',
      reason: 'manual',
      payoutMinor: result.settlement.payoutMinor,
    });
  });

  it('catches up on past setbacks when reconnecting', async () => {
    const { sessionId, outcome } = await sessionWhere((o) => o.setbacks.length >= 1 && o.setbacks[0]! < 3 && o.crashTime > 6);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    await time.advance(4000);
    const events: RoundEvent[] = [];
    const stream = host.streamRound(sessionId, round.id, (e) => events.push(e));
    await time.advance(0);
    expect(events.slice(0, 2).map((e) => e.type)).toEqual(['START', 'BAD_MOLE']);
    expect(events[1]).toMatchObject({ time: outcome.setbacks[0] });
    stream.stop();
  });
});
