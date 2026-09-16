import { DEFAULT_CONFIG, commitServerSeed, growth, type GameConfig } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY, accrueCashout, emptyAccrual, formatMinor, payoutMinor, settleAccrual, validateBet } from './money';
import { growthAt, modifiersOfOutcome, multiplierAt } from './path';
import {
  cashout as judgeCashout,
  createRound,
  roundStatus,
  scheduledSettlement,
  modifierEvents,
  snapshot,
  startEvent,
  terminalEvent,
  validateAutoCashout,
  type RoundRecord,
} from './round';

const C = DEFAULT_CONFIG;

/** Judge a cash-out that is expected to settle (not refused for the minimum). */
function cashout(round: RoundRecord, nowMs: number) {
  const res = judgeCashout(round, nowMs);
  if (res.kind === 'below_min_cashout') throw new Error('unexpected below_min_cashout');
  return res;
}
const T0 = 1_700_000_000_000;
const SEED = 'ab'.repeat(32);

/** A round with a hand-picked outcome, so scenarios are exact. */
function fixedRound(opts: {
  crashTime: number;
  setbacks?: number[];
  boosts?: number[];
  betMinor?: number;
  autoCashout?: number | null;
  config?: Partial<GameConfig>;
}): RoundRecord {
  const round = createRound({
    id: 'r1',
    sessionId: 's1',
    betMinor: opts.betMinor ?? 10_00,
    currency: 'USD',
    autoCashout: opts.autoCashout ?? null,
    seeds: { serverSeed: SEED, clientSeed: 'c', nonce: 0 },
    commit: commitServerSeed(SEED),
    config: { ...C, ...opts.config },
    startedAt: T0,
  });
  return { ...round, outcome: { crashTime: opts.crashTime, setbacks: opts.setbacks ?? [], boosts: opts.boosts ?? [] } };
}

const at = (seconds: number) => T0 + seconds * 1000;
/** Time where growth hits a multiplier, found by bisection. */
function timeOfGrowth(m: number, config: GameConfig = C): number {
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (growth(mid, config) < m) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Modifier list for setback and boost times on a config. */
const mods = (setbacks: number[], boosts: number[] = [], config: GameConfig = C) =>
  modifiersOfOutcome({ setbacks, boosts }, config);

describe('path value (3.1)', () => {
  it('equals growth without modifiers', () => {
    expect(multiplierAt(5, [], C)).toBe(growthAt(5, C));
  });

  it('halves 4.20 to 2.10 after one setback', () => {
    const t = timeOfGrowth(4.2);
    expect(multiplierAt(t, mods([t - 1]), C)).toBeCloseTo(2.1, 9);
  });

  it('applies a setback on the exact tie', () => {
    expect(multiplierAt(3, mods([3]), C)).toBeCloseTo(growthAt(3, C) / 2, 12);
  });

  it('lifts the value by the boost factor, setback first on a tie', () => {
    const boosted = { ...C, boostRate: 0.08, boostFactor: 1.25 };
    const t = timeOfGrowth(4.2, boosted);
    expect(multiplierAt(t, mods([], [t - 1], boosted), boosted)).toBeCloseTo(4.2 * 1.25, 9);
    expect(multiplierAt(t, mods([t - 1], [t - 1], boosted), boosted)).toBeCloseTo(4.2 * 0.5 * 1.25, 9);
    expect(multiplierAt(t, mods([], [t + 1], boosted), boosted)).toBeCloseTo(4.2, 9);
  });

  it('grows at most rmax per second after the ramp', () => {
    const t = C.tRamp + 1;
    expect(growthAt(t + 0.1, C) / growthAt(t, C)).toBeCloseTo(Math.exp(C.rmax * 0.1), 9);
    expect(growthAt(t + 0.1, C) / growthAt(t, C)).toBeLessThanOrEqual(1.1);
  });

  it('starts at 1.00 and never decreases', () => {
    expect(growthAt(0, C)).toBe(1);
    for (let t = 0; t < 30; t += 0.25) expect(growthAt(t + 0.25, C)).toBeGreaterThan(growthAt(t, C));
  });
});

describe('money (3.3)', () => {
  it('rounds 10.00 × 4.2037 half-up to 42.04 and 4.2032 to 42.03', () => {
    expect(payoutMinor(10_00, 4.2037)).toBe(42_04);
    expect(payoutMinor(10_00, 4.2032)).toBe(42_03);
    expect(payoutMinor(20, 1.025)).toBe(21);
  });

  it('accrues several cash-outs and rounds the round total once (3.8)', () => {
    let acc = emptyAccrual;
    const a = accrueCashout(acc, 4, 1.6); // 6.4
    acc = a.state;
    const b = accrueCashout(acc, 4, 2.7); // +10.8 = 17.2
    acc = b.state;
    expect(a.creditNowMinor + b.creditNowMinor).toBe(17);
    const settled = settleAccrual(acc);
    expect(settled.totalMinor).toBe(17);
    expect(a.creditNowMinor + b.creditNowMinor + settled.creditNowMinor).toBe(17);
    // Separately rounded down would have been 6 + 10 = 16.
    const up = settleAccrual(accrueCashout(emptyAccrual, 3, 2.5).state); // 7.5 -> 8
    expect(up.totalMinor).toBe(8);
    expect(accrueCashout(emptyAccrual, 20, 1.03).creditNowMinor + settleAccrual(accrueCashout(emptyAccrual, 20, 1.03).state).creditNowMinor).toBe(payoutMinor(20, 1.03));
  });

  it('is robust to float noise', () => {
    expect(payoutMinor(10_00, 4.35)).toBe(43_50);
    expect(payoutMinor(10_00, 2.1)).toBe(21_00);
  });

  it('formats minor units', () => {
    expect(formatMinor(124850, DEFAULT_CURRENCY)).toBe('1,248.50');
    expect(formatMinor(-1000, DEFAULT_CURRENCY)).toBe('-10.00');
  });

  it('enforces bet limits', () => {
    expect(validateBet(10_00, DEFAULT_CURRENCY)).toEqual({ ok: true });
    expect(validateBet(5, DEFAULT_CURRENCY)).toMatchObject({ ok: false, code: 'bet_limit' });
    expect(validateBet(10, DEFAULT_CURRENCY)).toMatchObject({ ok: false, code: 'bet_limit' });
    expect(validateBet(20, DEFAULT_CURRENCY)).toEqual({ ok: true });
    expect(validateBet(1_000_00, DEFAULT_CURRENCY)).toMatchObject({ ok: false, code: 'bet_limit' });
    expect(validateBet(1.5, DEFAULT_CURRENCY)).toMatchObject({ ok: false, code: 'invalid_bet' });
  });
});

describe('round state machine (3.2)', () => {
  it('derives the outcome from seeds on creation', () => {
    const r = createRound({
      id: 'x', sessionId: 's', betMinor: 100, currency: 'USD',
      seeds: { serverSeed: SEED, clientSeed: 'c', nonce: 1 }, commit: commitServerSeed(SEED),
      config: C, startedAt: T0,
    });
    expect(r.outcome.crashTime).toBeGreaterThanOrEqual(0);
    expect(r.settlement).toBeNull();
  });

  it('cash-out before crash credits bet × m(t)', () => {
    const t = timeOfGrowth(4.2037);
    const round = fixedRound({ crashTime: t + 1 });
    const result = cashout(round, T0 + Math.ceil(t * 1000));
    expect(result.kind).toBe('won');
    expect(result.settlement).toMatchObject({ status: 'won', reason: 'manual' });
    expect(result.settlement.payoutMinor).toBe(payoutMinor(10_00, result.settlement.multiplier));
    expect(result.settlement.payoutMinor).toBeGreaterThanOrEqual(42_03);
  });

  it('cash-out after crash is rejected as crashed', () => {
    const round = fixedRound({ crashTime: 2 });
    const result = cashout(round, at(2.5));
    expect(result.kind).toBe('crashed');
    expect(result.settlement.payoutMinor).toBe(0);
  });

  it('cash-out at exactly the crash time loses', () => {
    expect(cashout(fixedRound({ crashTime: 2 }), at(2)).kind).toBe('crashed');
  });

  it('setback tied with a cash-out applies first', () => {
    const round = fixedRound({ crashTime: 10, setbacks: [3] });
    const result = cashout(round, at(3));
    expect(result.kind).toBe('won');
    expect(result.settlement.multiplier).toBeCloseTo(growthAt(3, C) / 2, 12);
  });

  it('duplicate cash-out returns the existing settlement', () => {
    const round = fixedRound({ crashTime: 10 });
    const first = cashout(round, at(1));
    const settled = { ...round, settlement: first.settlement };
    const second = cashout(settled, at(1.5));
    expect(second).toEqual({ kind: 'already_settled', settlement: first.settlement });
  });

  it('crash settles lost with m(T)', () => {
    const round = fixedRound({ crashTime: 4, setbacks: [1] });
    const s = scheduledSettlement(round);
    expect(s).toMatchObject({ status: 'lost', reason: 'crash', time: 4, payoutMinor: 0 });
    expect(s.multiplier).toBeCloseTo(growthAt(4, C) / 2, 12);
    expect(roundStatus(round, at(3.9))).toBe('running');
    expect(roundStatus(round, at(4))).toBe('lost');
  });

  it('instant bust is lost at 1.00', () => {
    const round = fixedRound({ crashTime: 0 });
    expect(scheduledSettlement(round)).toMatchObject({ status: 'lost', multiplier: 1, time: 0 });
    expect(cashout(round, at(0)).kind).toBe('crashed');
  });

  it('auto cash-out settles at the target when reached before the crash', () => {
    const t5 = timeOfGrowth(5);
    const round = fixedRound({ crashTime: t5 + 1, autoCashout: 5 });
    const s = scheduledSettlement(round);
    expect(s).toMatchObject({ status: 'won', reason: 'auto', payoutMinor: 50_00 });
    expect(s.time).toBeCloseTo(t5, 9);
    // A manual whack after the auto point returns the auto settlement.
    expect(cashout(round, at(t5 + 0.5))).toMatchObject({ kind: 'already_settled' });
  });

  it('auto cash-out is not reached when the crash comes first', () => {
    const round = fixedRound({ crashTime: timeOfGrowth(4), autoCashout: 5 });
    expect(scheduledSettlement(round).status).toBe('lost');
  });

  it('max win caps the payout exactly', () => {
    const config = { maxWinMultiplier: 50 };
    const round = fixedRound({ crashTime: 59, config });
    const s = scheduledSettlement(round);
    expect(s).toMatchObject({ status: 'won', reason: 'maxWin', multiplier: 50, payoutMinor: 500_00 });
  });

  it('max duration forces a cash-out at tMax', () => {
    const config = { tMax: 5 };
    const round = fixedRound({ crashTime: 30, config });
    const s = scheduledSettlement(round);
    expect(s).toMatchObject({ status: 'won', reason: 'maxDuration', time: 5 });
    expect(s.multiplier).toBeCloseTo(growthAt(5, C), 12);
  });

  it('a round that settles by schedule keeps its result for late fetches (disconnect)', () => {
    const round = fixedRound({ crashTime: timeOfGrowth(3) + 2, autoCashout: 3 });
    const snap = snapshot(round, at(40));
    expect(snap.status).toBe('won');
    expect(snap.settlement?.payoutMinor).toBe(30_00);
  });

  it('validates auto cash-out targets', () => {
    expect(validateAutoCashout(null, C).ok).toBe(true);
    expect(validateAutoCashout(1, C).ok).toBe(false);
    expect(validateAutoCashout(2, C).ok).toBe(true);
    expect(validateAutoCashout(C.maxWinMultiplier + 1, C).ok).toBe(false);
  });
});

describe('events and snapshots (3.4)', () => {
  it('never exposes the crash time or future setbacks while running', () => {
    const round = fixedRound({ crashTime: 9, setbacks: [2, 6] });
    const snap = snapshot(round, at(3));
    expect(snap.status).toBe('running');
    expect(snap.setbacks).toEqual([2]);
    expect(snap.settlement).toBeNull();
    expect(JSON.stringify(snap)).not.toContain('"crashTime"');
    expect(JSON.stringify(startEvent(round, at(0)))).not.toMatch(/crashTime|"setbacks"|serverSeed/);
  });

  it('emits setbacks up to the settlement then a terminal event', () => {
    const round = fixedRound({ crashTime: 9, setbacks: [2, 6] });
    const won = cashout(round, at(6)).settlement;
    expect(modifierEvents(round, won).map((e) => e.time)).toEqual([2, 6]);
    expect(terminalEvent(round, won, 123)).toMatchObject({ type: 'CASHED_OUT', reason: 'manual', crashTime: 9 });
    const lost = scheduledSettlement(round);
    expect(terminalEvent(round, lost, 0)).toMatchObject({ type: 'CRASH', crashTime: 9 });
  });
});

describe('minimum cash-out (1.6)', () => {
  const timeOf = (m: number) => {
    let lo = 0;
    let hi = 60;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (growth(mid, C) < m) lo = mid;
      else hi = mid;
    }
    return hi;
  };

  it('refuses a cash-out below the minimum and settles at or above it', () => {
    const round = { ...fixedRound({ crashTime: 20 }), minCashout: 1.1 };
    const early = judgeCashout(round, at(timeOf(1.05)));
    expect(early).toMatchObject({ kind: 'below_min_cashout', minCashout: 1.1 });
    const ok = judgeCashout(round, T0 + Math.ceil(timeOf(1.1) * 1000));
    expect(ok.kind).toBe('won');
  });

  it('rejects auto cash-out targets below the profile minimum', () => {
    expect(validateAutoCashout(1.05, C, 1.1).ok).toBe(false);
    expect(validateAutoCashout(1.1, C, 1.1).ok).toBe(true);
  });
});
