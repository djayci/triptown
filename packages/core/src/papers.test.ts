import { describe, expect, it } from 'vitest';
import type { RoundEvent, ThrowEntry } from './events';
import { HostError, RoundHost, type ProfileSettings } from './host';
import { accrueCashout, emptyAccrual, settleAccrual } from './money';
import { profileFromTemplate, type JurisdictionProfile } from './profiles';
import { multiplierAtRound, paperSettlementAt, type RoundRecord } from './round';
import { MemoryRoundStore } from './store';

// Partial cash-out (Paper Route papers), paper-route-mvp tasks 5.1–5.7.

const ORIGIN = ['https://casino.example'];

function setup(profile: JurisdictionProfile = profileFromTemplate('light')) {
  const clock = { t: 1_700_000_000_000, now() { return this.t; } };
  const store = new MemoryRoundStore();
  const profiles: ProfileSettings = { defaultProfile: profile, allowOverride: true };
  const host = new RoundHost({ store, clock, sleep: async () => {}, profiles, game: 'paper-route' });
  return { clock, store, host };
}

/** Starts rounds (settling each) until one whose outcome satisfies `ok`; the clock is left at its start. */
async function roundWhere(s: ReturnType<typeof setup>, sessionId: string, ok: (r: RoundRecord) => boolean, bet = 10_00, auto?: number) {
  for (let i = 0; i < 400; i++) {
    const { round } = await s.host.startRound(sessionId, { betMinor: bet, autoCashout: auto ?? null });
    if (ok(round)) return round;
    s.clock.t += 120_000;
    await s.host.getRound(sessionId, round.id);
    s.clock.t += 10_000;
  }
  throw new Error('no matching round found');
}

/** No setback before `seconds`, so fixed-time throws stay above the minimum cash-out. */
const clean = (r: RoundRecord, seconds: number) => r.outcome.setbacks.every((t) => t > seconds);

const at = (s: ReturnType<typeof setup>, round: RoundRecord, seconds: number) => {
  s.clock.t = round.startedAt + Math.round(seconds * 1000);
};

describe('bets split into papers (5.1)', () => {
  it('accepts 10.00 as 5 papers of 2.00 and rejects stakes that do not split', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const { round } = await s.host.startRound(sessionId, { betMinor: 10_00 });
    expect(round.papers).toBe(5);
    s.clock.t += 120_000;
    await s.host.getRound(sessionId, round.id);
    s.clock.t += 10_000;
    await expect(s.host.startRound(sessionId, { betMinor: 10_01 })).rejects.toMatchObject({ code: 'bet_limit' });
    await expect(s.host.startRound(sessionId, { betMinor: 50 })).rejects.toMatchObject({ code: 'bet_limit' });
  });

  it('starts single-paper rounds when the profile turns partial cash-out off', async () => {
    const s = setup({ ...profileFromTemplate('light'), partialCashout: 'off' });
    const { sessionId } = await s.host.createSession(1_000_00);
    const { round } = await s.host.startRound(sessionId, { betMinor: 10_01 });
    expect(round.papers).toBeUndefined();
  });
});

describe('exact accrual, one rounding per round (5.3)', () => {
  it('credits whole units as they are earned and tops up to the half-up total at settlement', () => {
    let a = accrueCashout(emptyAccrual, 200, 3.4012);
    expect(a.creditNowMinor).toBe(680);
    a = accrueCashout(a.state, 200, 1.2345);
    expect(a.state.creditedMinor).toBe(927);
    expect(settleAccrual(a.state)).toEqual({ totalMinor: 927, creditNowMinor: 0 });
    const up = accrueCashout(accrueCashout(emptyAccrual, 200, 3.4012).state, 200, 1.2365);
    expect(settleAccrual(up.state)).toEqual({ totalMinor: 928, creditNowMinor: 1 });
  });

  it('matches a single half-up rounding when there is one paper left to settle', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 4 && r.outcome.setbacks.every((t) => t > 4));
    const settlement = paperSettlementAt(round, 3, 'manual');
    expect(settlement.payoutMinor).toBe(Math.floor(10_00 * multiplierAtRound(round, 3) + 0.5 + 1e-7));
  });

  it('stores throw credits in the memory store with the same floor-of-cumulative rule', async () => {
    const store = new MemoryRoundStore();
    await store.createSession({ id: 's', currency: 'USD', serverSeed: 'x', commit: 'c', clientSeed: 'k', nonce: 0, createdAt: 0 }, 0);
    await store.putRound({ id: 'r', sessionId: 's', betMinor: 1000, papers: 5, throws: [], settlement: null } as unknown as RoundRecord);
    const base = { reason: 'manual' as const, time: 1, share: 0.2, clientTapAt: null, rttMs: null, papers: 1 };
    const a = await store.recordThrow('s', 'r', { ...base, throwId: 'a', multiplier: 3.4012, exactMinor: 680.24 }, 5);
    const b = await store.recordThrow('s', 'r', { ...base, throwId: 'b', multiplier: 1.2345, exactMinor: 246.9 }, 5);
    expect(a).toMatchObject({ kind: 'recorded', entry: { creditedMinor: 680 } });
    expect(b).toMatchObject({ kind: 'recorded', entry: { creditedMinor: 247 }, balanceMinor: 927 });
  });
});

describe('throws (5.4)', () => {
  it('banks one paper, keeps the round running, and ignores a retried throw id', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 6 && clean(r, 2));
    at(s, round, 2);
    const first = await s.host.throwPapers(sessionId, round.id, { throwId: 't1', count: 1 });
    expect(first).toMatchObject({ result: 'thrown', remaining: 4, settlement: null });
    expect(first.throw!.exactMinor).toBeCloseTo(200 * multiplierAtRound(round, 2), 6);
    const balance = first.balanceMinor;
    const again = await s.host.throwPapers(sessionId, round.id, { throwId: 't1', count: 1 });
    expect(again).toMatchObject({ result: 'duplicate', remaining: 4 });
    expect(again.balanceMinor).toBe(balance);
  });

  it('refuses a throw below the profile minimum without settling a paper', async () => {
    const s = setup({ ...profileFromTemplate('light'), minCashout: 1.1 });
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 1);
    at(s, round, 0.05);
    const err = await s.host.throwPapers(sessionId, round.id, { throwId: 'low', count: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(HostError);
    expect(err).toMatchObject({ code: 'below_min_cashout' });
    expect((await s.store.getRound(round.id))!.throws).toEqual([]);
  });

  it('reports a throw after the crash as crashed and credits nothing for it', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 0.5 && r.outcome.crashTime < 5);
    const before = await s.store.getBalance(sessionId);
    at(s, round, round.outcome.crashTime + 0.2);
    const late = await s.host.throwPapers(sessionId, round.id, { throwId: 'late', count: 1 });
    expect(late).toMatchObject({ result: 'crashed', throw: null });
    expect(late.balanceMinor).toBe(before);
  });

  it('throw-all ends the round as cashed out with the rounded total', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 6 && clean(r, 3));
    at(s, round, 1);
    await s.host.throwPapers(sessionId, round.id, { throwId: 'a', count: 1 });
    at(s, round, 3);
    const all = await s.host.throwPapers(sessionId, round.id, { throwId: 'b', count: 'all' });
    expect(all.result).toBe('cashed_out');
    const exact = 200 * multiplierAtRound(round, 1) + 800 * multiplierAtRound(round, 3);
    expect(all.settlement!.payoutMinor).toBe(Math.floor(exact + 0.5 + 1e-7));
    const snap = await s.host.getRound(sessionId, round.id);
    expect(snap.returnMinor).toBe(all.settlement!.payoutMinor);
    expect(snap.throws.map((t) => t.papers)).toEqual([1, 4]);
    // Credits add up to exactly the rounded total.
    expect(await s.store.getBalance(sessionId)).toBe(all.balanceMinor);
    await expect(s.host.throwPapers(sessionId, round.id, { throwId: 'c', count: 1 })).resolves.toMatchObject({ result: 'already_settled' });
  });

  it('treats a single-paper round exactly like a cash-out', async () => {
    const s = setup({ ...profileFromTemplate('light'), partialCashout: 'off' });
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 3 && r.outcome.setbacks.every((t) => t > 2));
    at(s, round, 2);
    const out = await s.host.throwPapers(sessionId, round.id, { throwId: 'x', count: 1 });
    expect(out.result).toBe('cashed_out');
    expect(out.settlement!.payoutMinor).toBe(Math.floor(10_00 * multiplierAtRound(round, 2) + 0.5 + 1e-7));
  });
});

describe('scheduled settlement of remaining papers (5.5)', () => {
  it('settles remaining papers at the auto target after a manual throw', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 8 && r.outcome.setbacks.every((t) => t > 8), 10_00, 2);
    at(s, round, 0.5);
    await s.host.throwPapers(sessionId, round.id, { throwId: 'early', count: 1 });
    at(s, round, 30);
    const snap = await s.host.getRound(sessionId, round.id);
    expect(snap.settlement).toMatchObject({ status: 'won', reason: 'auto' });
    expect(snap.throws.map((t) => [t.papers, t.reason])).toEqual([[1, 'manual'], [4, 'auto']]);
    expect(snap.throws[1]!.multiplier).toBeCloseTo(2, 6);
  });

  it('settles remaining papers at detection time under cashout-at-disconnect', async () => {
    const s = setup({ ...profileFromTemplate('light'), disconnectPolicy: 'cashout-at-disconnect' });
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 5 && clean(r, 2.5));
    at(s, round, 1);
    await s.host.throwPapers(sessionId, round.id, { throwId: 'one', count: 1 });
    at(s, round, 2.5);
    const settlement = await s.host.disconnect(sessionId, round.id);
    expect(settlement).toMatchObject({ status: 'won', reason: 'disconnect', time: 2.5 });
    expect((settlement!.cashouts as ThrowEntry[]).map((t) => t.papers)).toEqual([1, 4]);
  });

  it('keeps thrown papers at wipeout and loses the rest', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 2.5 && r.outcome.crashTime < 20 && clean(r, 2));
    at(s, round, 1);
    await s.host.throwPapers(sessionId, round.id, { throwId: 'a', count: 1 });
    at(s, round, 2);
    await s.host.throwPapers(sessionId, round.id, { throwId: 'b', count: 1 });
    at(s, round, round.outcome.crashTime + 1);
    const snap = await s.host.getRound(sessionId, round.id);
    const exact = 200 * (multiplierAtRound(round, 1) + multiplierAtRound(round, 2));
    expect(snap.settlement).toMatchObject({ status: 'lost', reason: 'crash', payoutMinor: Math.floor(exact + 0.5 + 1e-7) });
    expect(snap.returnMinor).toBe(snap.settlement!.payoutMinor);
    expect(snap.resultKind).toBe(snap.returnMinor! > 10_00 ? 'win' : snap.returnMinor === 10_00 ? 'even' : 'loss');
    expect(snap.throws).toHaveLength(2);
  });
});

describe('events and secrecy (5.6)', () => {
  it('streams THROWN without the crash time and ends with paper counts', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 3 && r.outcome.crashTime < 30 && clean(r, 1.5));
    at(s, round, 1.5);
    const out = await s.host.throwPapers(sessionId, round.id, { throwId: 'a', count: 1 });
    expect(JSON.stringify(out)).not.toContain('crashTime');
    const running = await s.host.getRound(sessionId, round.id);
    expect(running.settlement).toBeNull();
    expect(running.crashMultiplier).toBeNull();
    expect(JSON.stringify(running.throws)).not.toContain('crash');
    at(s, round, round.outcome.crashTime + 0.5);
    const events: RoundEvent[] = [];
    await s.host.streamRound(sessionId, round.id, (e) => events.push(e)).done;
    const thrown = events.filter((e) => e.type === 'THROWN');
    expect(thrown).toHaveLength(1);
    expect(thrown[0]).not.toHaveProperty('crashTime');
    expect(thrown[0]).toMatchObject({ throwId: 'a', remaining: 4 });
    expect(events.at(-1)).toMatchObject({ type: 'CRASH', papersThrown: 1, papersLost: 4 });
    expect(events[0]).toMatchObject({ type: 'START', papers: 5, paperMinor: 200 });
  });

  it('never emits THROWN for single-paper rounds', async () => {
    const s = setup({ ...profileFromTemplate('regulated-uk', ORIGIN), partialCashout: 'off' });
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 2);
    at(s, round, 1);
    await s.host.throwPapers(sessionId, round.id, { throwId: 'x', count: 1 });
    const events: RoundEvent[] = [];
    await s.host.streamRound(sessionId, round.id, (e) => events.push(e)).done;
    expect(events.map((e) => e.type)).toEqual(['START', 'CASHED_OUT']);
    expect(events[1]).not.toHaveProperty('papersThrown');
  });
});

describe('atomic throws (5.7)', () => {
  it('lets only one of two concurrent throws take the last paper', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 5 && r.outcome.setbacks.every((t) => t > 1));
    const afterStake = await s.store.getBalance(sessionId);
    at(s, round, 1);
    await s.host.throwPapers(sessionId, round.id, { throwId: 'four', count: 1 });
    for (const id of ['b', 'c', 'd']) await s.host.throwPapers(sessionId, round.id, { throwId: id, count: 1 });
    const results = await Promise.allSettled([
      s.host.throwPapers(sessionId, round.id, { throwId: 'last1', count: 1 }),
      s.host.throwPapers(sessionId, round.id, { throwId: 'last2', count: 1 }),
    ]);
    const outcomes = results.map((r) => (r.status === 'fulfilled' ? r.value.result : (r.reason as HostError).code));
    expect(outcomes.filter((o) => o === 'cashed_out')).toHaveLength(1);
    expect(outcomes.filter((o) => o !== 'cashed_out').every((o) => o === 'already_settled' || o === 'no_papers_left')).toBe(true);
    const snap = await s.host.getRound(sessionId, round.id);
    expect(snap.throws.reduce((n, t) => n + t.papers, 0)).toBe(5);
    // Balance = balance after the stake + exactly the rounded total, no double credit.
    expect(await s.store.getBalance(sessionId)).toBe(afterStake + snap.returnMinor!);
  });

  it('refuses a stale settlement and rebuilds it with the throw that landed first', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 3 && r.outcome.crashTime < 30 && r.outcome.setbacks.every((t) => t > 1));
    const afterStake = await s.store.getBalance(sessionId);
    const stale = paperSettlementAt(round, 2, 'maxDuration');
    at(s, round, 1);
    await s.host.throwPapers(sessionId, round.id, { throwId: 'raced', count: 1 });
    expect(await s.store.settleOnce(round.id, stale, 0)).toBe(false);
    at(s, round, round.outcome.crashTime + 1);
    const snap = await s.host.getRound(sessionId, round.id);
    expect(snap.throws.map((t) => t.throwId)).toContain('raced');
    expect(await s.store.getBalance(sessionId)).toBe(afterStake + snap.returnMinor!);
  });

  it('loses a throw that races the lazy crash settlement', async () => {
    const s = setup();
    const { sessionId } = await s.host.createSession(1_000_00);
    const round = await roundWhere(s, sessionId, (r) => r.outcome.crashTime > 0.5 && r.outcome.crashTime < 10);
    const afterStake = await s.store.getBalance(sessionId);
    at(s, round, round.outcome.crashTime + 0.01);
    const [snap, late] = await Promise.all([
      s.host.getRound(sessionId, round.id),
      s.host.throwPapers(sessionId, round.id, { throwId: 'late', count: 1 }),
    ]);
    expect(snap.status).toBe('lost');
    expect(late.result).toBe('crashed');
    expect(await s.store.getBalance(sessionId)).toBe(afterStake);
  });
});
