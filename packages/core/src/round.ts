import { deriveRound, type CryptoProvider, type GameConfig, type RoundOutcome, type RoundSeeds } from '@triptown/fairness';
import type {
  SetbackEvent,
  BoostEvent,
  CashoutEntry,
  CashoutReason,
  RoundSnapshot,
  Settlement,
  StartEvent,
  TerminalEvent,
  PartEntry,
} from './events';
import { accrueCashout, emptyAccrual, payoutMinor, resultKind, settleAccrual, type Accrual } from './money';
import { modifiersOfOutcome, multiplierAt, setbacksUpTo, timeToReach } from './path';

export interface RoundRecord {
  id: string;
  sessionId: string;
  /** Player the round belongs to (locks and pacing are per player). */
  playerId?: string;
  betMinor: number;
  currency: string;
  autoCashout: number | null;
  seeds: RoundSeeds;
  commit: string;
  config: GameConfig;
  /** Manual cash-outs below this multiplier are refused (profile setting). */
  minCashout?: number;
  /** Profile disconnect policy captured at start. */
  disconnectPolicy?: 'lose' | 'cashout-at-disconnect';
  /** Last sign of life from the player (heartbeat or open stream), server epoch ms. */
  lastHeartbeatAt?: number;
  /** Recall metadata. */
  profileName?: string;
  clientVersion?: string | null;
  balanceBeforeMinor?: number;
  /** Written after settlement credit. */
  balanceAfterMinor?: number;
  /** Server epoch ms. */
  startedAt: number;
  outcome: RoundOutcome;
  settlement: Settlement | null;
  /** Papers the stake is split into (partial cash-out games); absent or 1 = single cash-out. */
  stakeParts?: number;
  /** Papers thrown so far, in order (partial cash-out games). Stored atomically by the round store. */
  settledParts?: PartEntry[];
}

export interface NewRound {
  id: string;
  sessionId: string;
  playerId?: string;
  betMinor: number;
  currency: string;
  autoCashout?: number | null;
  seeds: RoundSeeds;
  commit: string;
  config: GameConfig;
  minCashout?: number;
  disconnectPolicy?: 'lose' | 'cashout-at-disconnect';
  startedAt: number;
  /** Hash implementation for outcome derivation; defaults to the pure one. */
  crypto?: CryptoProvider;
  profileName?: string;
  clientVersion?: string | null;
  balanceBeforeMinor?: number;
  /** Split stake: number of parts (the bet must divide evenly). */
  stakeParts?: number;
}

/** A player counts as disconnected this long after their last heartbeat or stream poll. */
export const HEARTBEAT_GRACE_MS = 3_000;

export type AutoCashoutValidation = { ok: true } | { ok: false; message: string };

export function validateAutoCashout(
  target: number | null | undefined,
  config: GameConfig,
  minCashout = 1.01,
): AutoCashoutValidation {
  if (target === null || target === undefined) return { ok: true };
  const min = Math.max(1.01, minCashout);
  if (!Number.isFinite(target) || target < min) {
    return { ok: false, message: `Auto cash-out must be at least ${min}` };
  }
  if (target > config.maxWinMultiplier) {
    return { ok: false, message: `Auto cash-out cannot exceed ${config.maxWinMultiplier}` };
  }
  return { ok: true };
}

/** Creates a round with its outcome derived from the seeds. */
export function createRound(input: NewRound): RoundRecord {
  return {
    id: input.id,
    sessionId: input.sessionId,
    playerId: input.playerId ?? input.sessionId,
    betMinor: input.betMinor,
    currency: input.currency,
    autoCashout: input.autoCashout ?? null,
    seeds: input.seeds,
    commit: input.commit,
    config: input.config,
    // No minimum unless a profile sets one; setback rounds may legitimately cash out below x1.00.
    minCashout: input.minCashout ?? 0,
    disconnectPolicy: input.disconnectPolicy ?? 'lose',
    lastHeartbeatAt: input.startedAt,
    startedAt: input.startedAt,
    ...(input.profileName !== undefined && { profileName: input.profileName }),
    ...(input.clientVersion !== undefined && { clientVersion: input.clientVersion }),
    ...(input.balanceBeforeMinor !== undefined && { balanceBeforeMinor: input.balanceBeforeMinor }),
    outcome: deriveRound(input.seeds, input.config, input.crypto),
    settlement: null,
    ...((input.stakeParts ?? 1) > 1 && { stakeParts: input.stakeParts, settledParts: [] }),
  };
}

// ---------- partial cash-out (stake parts) ----------

/** Multiplier at `time` seconds after start for this round's path (uncapped). */
export const multiplierAtRound = (round: RoundRecord, time: number): number => multiplierAt(time, modifiersOfOutcome(round.outcome, round.config), round.config);

export const stakePartCount = (round: Pick<RoundRecord, 'stakeParts'>): number => round.stakeParts ?? 1;
export const isSplitRound = (round: Pick<RoundRecord, 'stakeParts'>): boolean => stakePartCount(round) > 1;
export const partMinorOf = (round: Pick<RoundRecord, 'stakeParts' | 'betMinor'>): number => round.betMinor / stakePartCount(round);
export const settledPartCount = (round: Pick<RoundRecord, 'settledParts'>): number => (round.settledParts ?? []).reduce((n, t) => n + t.parts, 0);

/** Accrual state implied by the stored throws. */
export function accrualOf(throws: readonly PartEntry[]): Accrual {
  return throws.reduce((a, t) => ({ exactMinor: a.exactMinor + t.exactMinor, creditedMinor: a.creditedMinor + t.creditedMinor }), emptyAccrual);
}

const cappedMultiplier = (round: RoundRecord, time: number, reason: CashoutReason) =>
  reason === 'maxWin'
    ? round.config.maxWinMultiplier
    : Math.min(multiplierAt(time, modifiersOfOutcome(round.outcome, round.config), round.config), round.config.maxWinMultiplier);

/**
 * Settlement of a paper round at `time` for `reason`: every unthrown paper settles there, and the round
 * total is the half-up rounding of the exact total (design D23). `evidence` belongs to a manual action.
 */
export function paperSettlementAt(
  round: RoundRecord,
  time: number,
  reason: CashoutReason,
  extra?: { partId?: string; clientTapAt?: number | null; rttMs?: number | null },
): Settlement {
  const throws = [...(round.settledParts ?? [])];
  const remaining = stakePartCount(round) - settledPartCount(round);
  const multiplier = cappedMultiplier(round, time, reason);
  let accrual = accrualOf(throws);
  if (remaining > 0) {
    const step = accrueCashout(accrual, partMinorOf(round) * remaining, multiplier);
    accrual = step.state;
    throws.push({
      partId: extra?.partId ?? `${reason}@${time.toFixed(3)}`,
      parts: remaining,
      reason,
      time,
      multiplier,
      share: remaining / stakePartCount(round),
      exactMinor: partMinorOf(round) * remaining * multiplier,
      creditedMinor: step.creditNowMinor,
      clientTapAt: extra?.clientTapAt ?? null,
      rttMs: extra?.rttMs ?? null,
    });
  }
  const payout = settleAccrual(accrual).totalMinor;
  if (remaining > 0) {
    // The last entry receives everything not already credited by earlier throws, rounding included.
    const earlier = (round.settledParts ?? []).reduce((n, t) => n + t.creditedMinor, 0);
    throws[throws.length - 1] = { ...throws[throws.length - 1]!, creditedMinor: payout - earlier };
  }
  return {
    status: 'won',
    reason,
    time,
    multiplier,
    payoutMinor: payout,
    crashTime: round.outcome.crashTime,
    cashouts: throws,
  };
}

/** Wipeout of a split-stake round: unsettled parts are lost, settled parts keep their (rounded) total. */
function paperCrashSettlement(round: RoundRecord): Settlement {
  const throws = round.settledParts ?? [];
  return {
    status: 'lost',
    reason: 'crash',
    time: round.outcome.crashTime,
    multiplier: multiplierAt(round.outcome.crashTime, modifiersOfOutcome(round.outcome, round.config), round.config),
    payoutMinor: settleAccrual(accrualOf(throws)).totalMinor,
    crashTime: round.outcome.crashTime,
    ...(throws.length && { cashouts: [...throws] }),
  };
}

/** Rebuilds a paper settlement against fresher throws (after a store refused a stale settlement). */
export function rebuildPaperSettlement(fresh: RoundRecord, stale: Settlement): Settlement {
  if (stale.status === 'lost') return paperCrashSettlement(fresh);
  return paperSettlementAt(fresh, stale.time, stale.reason as CashoutReason);
}

export type ThrowJudgement =
  | { kind: 'thrown'; entry: Omit<PartEntry, 'creditedMinor'>; remainingAfter: number }
  | { kind: 'duplicate'; entry: PartEntry }
  | { kind: 'crashed'; settlement: Settlement }
  | { kind: 'already_settled'; settlement: Settlement }
  | { kind: 'no_parts' }
  | { kind: 'below_min_cashout'; multiplier: number; minCashout: number };

/**
 * Judges a collect of one or all remaining parts at server receive time. Pure: the caller records the
 * throw atomically (which fixes its credit) and finalizes the round when the bag is empty.
 */
export function judgeThrow(
  round: RoundRecord,
  nowMs: number,
  request: { partId: string; count: 1 | 'all'; clientTapAt?: number | null; rttMs?: number | null },
): ThrowJudgement {
  const existing = (round.settledParts ?? []).find((t) => t.partId === request.partId) ?? round.settlement?.cashouts?.find((t) => (t as PartEntry).partId === request.partId);
  if (existing) return { kind: 'duplicate', entry: existing as PartEntry };
  const due = round.settlement ?? settlementDue(round, nowMs);
  if (due) return due.status === 'lost' ? { kind: 'crashed', settlement: due } : { kind: 'already_settled', settlement: due };
  const remaining = stakePartCount(round) - settledPartCount(round);
  if (remaining <= 0) return { kind: 'no_parts' };
  const time = elapsedSeconds(round, nowMs);
  const multiplier = cappedMultiplier(round, time, 'manual');
  const min = round.minCashout ?? 0;
  if (multiplier < min) return { kind: 'below_min_cashout', multiplier, minCashout: min };
  const parts = request.count === 'all' ? remaining : 1;
  return {
    kind: 'thrown',
    remainingAfter: remaining - parts,
    entry: {
      partId: request.partId,
      parts,
      reason: 'manual',
      time,
      multiplier,
      share: parts / stakePartCount(round),
      exactMinor: partMinorOf(round) * parts * multiplier,
      clientTapAt: request.clientTapAt ?? null,
      rttMs: request.rttMs ?? null,
    },
  };
}

function wonAt(round: RoundRecord, time: number, reason: CashoutReason): Settlement {
  const { config, outcome, betMinor } = round;
  const capPayout = payoutMinor(betMinor, config.maxWinMultiplier);
  const multiplier =
    reason === 'maxWin'
      ? config.maxWinMultiplier
      : Math.min(multiplierAt(time, modifiersOfOutcome(outcome, config), config), config.maxWinMultiplier);
  return {
    status: 'won',
    reason,
    time,
    multiplier,
    payoutMinor: Math.min(payoutMinor(betMinor, multiplier), capPayout),
    crashTime: outcome.crashTime,
  };
}

/**
 * How the round ends if the player never whacks: the earliest of auto cash-out,
 * max win, max duration, or the crash. Deterministic, so it can be settled lazily.
 */
export function scheduledSettlement(round: RoundRecord): Settlement {
  const { config, outcome, autoCashout } = round;
  const candidates: { time: number; reason: CashoutReason }[] = [];
  const cap = timeToReach(config.maxWinMultiplier, modifiersOfOutcome(outcome, config), config);
  if (cap !== null) candidates.push({ time: cap, reason: 'maxWin' });
  if (autoCashout !== null) {
    const auto = timeToReach(autoCashout, modifiersOfOutcome(outcome, config), config);
    // When auto and cap coincide the cap label wins because the payout is capped.
    if (auto !== null && (cap === null || auto < cap)) candidates.push({ time: auto, reason: 'auto' });
  }
  candidates.push({ time: config.tMax, reason: 'maxDuration' });
  if (round.disconnectPolicy === 'cashout-at-disconnect' && round.lastHeartbeatAt !== undefined) {
    // Backstop when no stream close was seen: treat the player as gone 3 s after the last sign of life,
    // and cash out then if the value is at or above the minimum.
    const gone = (round.lastHeartbeatAt + HEARTBEAT_GRACE_MS - round.startedAt) / 1000;
    const value = multiplierAt(gone, modifiersOfOutcome(outcome, config), config);
    if (gone >= 0 && value >= (round.minCashout ?? 0)) candidates.push({ time: gone, reason: 'disconnect' });
  }
  const first = candidates.reduce((a, b) => (b.time < a.time ? b : a));

  if (isSplitRound(round)) {
    return first.time < outcome.crashTime ? paperSettlementAt(round, first.time, first.reason) : paperCrashSettlement(round);
  }
  if (first.time < outcome.crashTime) return wonAt(round, first.time, first.reason);
  return {
    status: 'lost',
    reason: 'crash',
    time: outcome.crashTime,
    multiplier: multiplierAt(outcome.crashTime, modifiersOfOutcome(outcome, config), config),
    payoutMinor: 0,
    crashTime: outcome.crashTime,
  };
}

export function elapsedSeconds(round: RoundRecord, nowMs: number): number {
  return Math.max(0, (nowMs - round.startedAt) / 1000);
}

/** The settlement if the round has ended by `nowMs` without a manual cash-out, otherwise null. */
export function settlementDue(round: RoundRecord, nowMs: number): Settlement | null {
  if (round.settlement) return round.settlement;
  const scheduled = scheduledSettlement(round);
  return scheduled.time <= elapsedSeconds(round, nowMs) ? scheduled : null;
}

export type CashoutResult =
  | { kind: 'won'; settlement: Settlement }
  | { kind: 'crashed'; settlement: Settlement }
  | { kind: 'already_settled'; settlement: Settlement }
  | { kind: 'below_min_cashout'; multiplier: number; minCashout: number };

/**
 * Judges a manual cash-out at server receive time. Pure: the caller persists the
 * settlement and credits the payout only for `won`.
 */
export function cashout(round: RoundRecord, nowMs: number): CashoutResult {
  if (round.settlement) return { kind: 'already_settled', settlement: round.settlement };
  const due = settlementDue(round, nowMs);
  if (due) {
    return due.status === 'lost'
      ? { kind: 'crashed', settlement: due }
      : { kind: 'already_settled', settlement: due };
  }
  const settlement = wonAt(round, elapsedSeconds(round, nowMs), 'manual');
  const min = round.minCashout ?? 0;
  // Refused, not settled: the round keeps running until the player tries again at or above the minimum.
  if (settlement.multiplier < min) return { kind: 'below_min_cashout', multiplier: settlement.multiplier, minCashout: min };
  return { kind: 'won', settlement };
}

export function roundStatus(round: RoundRecord, nowMs: number): 'running' | 'won' | 'lost' | 'void' {
  return settlementDue(round, nowMs)?.status ?? 'running';
}

export function startEvent(round: RoundRecord, serverNow: number): StartEvent {
  return {
    type: 'START',
    roundId: round.id,
    startedAt: round.startedAt,
    serverNow,
    betMinor: round.betMinor,
    currency: round.currency,
    autoCashout: round.autoCashout,
    commit: round.commit,
    clientSeed: round.seeds.clientSeed,
    nonce: round.seeds.nonce,
    configId: round.config.id,
    ...(isSplitRound(round) && { stakeParts: stakePartCount(round), partMinor: partMinorOf(round) }),
  };
}

/** Settlement for a round voided by a system failure: the stake is refunded. */
export function voidSettlement(round: Pick<RoundRecord, 'betMinor' | 'outcome' | 'startedAt'>, nowMs: number): Settlement {
  return {
    status: 'void',
    reason: 'system_failure',
    time: Math.max(0, (nowMs - round.startedAt) / 1000),
    multiplier: 1,
    payoutMinor: round.betMinor,
    // -1 when the outcome could not be read (the reason the round was voided).
    crashTime: round.outcome?.crashTime ?? -1,
  };
}

/** Modifier events that happen before the round ends (one tied with a cash-out still counts). */
export function modifierEvents(round: RoundRecord, settlement: Settlement): (SetbackEvent | BoostEvent)[] {
  if (settlement.status === 'void') return [];
  const before = (t: number) => (settlement.status === 'won' ? t <= settlement.time : t < settlement.time);
  const bad: (SetbackEvent | BoostEvent)[] = round.outcome.setbacks
    .filter(before)
    .map((time) => ({ type: 'SETBACK', roundId: round.id, time, factor: round.config.setbackFactor }));
  const good: (SetbackEvent | BoostEvent)[] = (round.outcome.boosts ?? [])
    .filter(before)
    .map((time) => ({ type: 'BOOST', roundId: round.id, time, factor: round.config.boostFactor }));
  // Setback first when a boost shares its time (design D5).
  return [...bad, ...good].sort((a, b) => a.time - b.time || a.factor - b.factor);
}

export function terminalEvent(round: RoundRecord, settlement: Settlement, balanceMinor: number): TerminalEvent {
  if (settlement.status === 'void') {
    return { type: 'VOID', roundId: round.id, reason: settlement.reason, refundMinor: settlement.payoutMinor, balanceMinor };
  }
  const paperCounts = () => {
    const thrown = (settlement.cashouts as PartEntry[] | undefined)?.reduce((n, t) => n + (t.parts ?? 0), 0) ?? 0;
    return { partsSettled: thrown, partsLost: stakePartCount(round) - thrown };
  };
  if (settlement.status === 'won') {
    return {
      type: 'CASHED_OUT',
      roundId: round.id,
      reason: settlement.reason as CashoutReason,
      time: settlement.time,
      multiplier: settlement.multiplier,
      payoutMinor: settlement.payoutMinor,
      crashTime: settlement.crashTime,
      balanceMinor,
      ...(isSplitRound(round) && paperCounts()),
    };
  }
  return {
    type: 'CRASH',
    roundId: round.id,
    time: settlement.time,
    multiplier: settlement.multiplier,
    crashTime: settlement.crashTime,
    balanceMinor,
    ...(isSplitRound(round) && { returnMinor: settlement.payoutMinor, ...paperCounts() }),
  };
}

/** Cash-outs of a settled round; single cash-out rounds derive theirs from the settlement. */
export function cashoutEntries(round: RoundRecord, settlement: Settlement | null): CashoutEntry[] {
  if (settlement?.cashouts?.length) return settlement.cashouts;
  if (!settlement || settlement.status !== 'won') return [];
  return [
    {
      reason: settlement.reason as CashoutReason,
      time: settlement.time,
      multiplier: settlement.multiplier,
      share: 1,
      exactMinor: round.betMinor * settlement.multiplier,
      creditedMinor: settlement.payoutMinor,
      clientTapAt: settlement.evidence?.clientTapAt ?? null,
      rttMs: settlement.evidence?.rttMs ?? null,
    },
  ];
}

export function snapshot(round: RoundRecord, nowMs: number): RoundSnapshot {
  const settlement = round.settlement?.status === 'void' ? round.settlement : settlementDue(round, nowMs);
  const elapsed = elapsedSeconds(round, nowMs);
  const visibleUntil = settlement ? settlement.time : elapsed;
  // Lost single cash-out rounds pay 0; a split-stake wipeout still returns the parts settled before it.
  const returnMinor = settlement ? settlement.payoutMinor : null;
  const readable = !!round.outcome;
  return {
    roundId: round.id,
    sessionId: round.sessionId,
    playerId: round.playerId ?? round.sessionId,
    gameId: round.config.id.split('/')[0]!,
    status: settlement?.status ?? 'running',
    startedAt: round.startedAt,
    settledAt: settlement ? round.startedAt + Math.round(Math.max(0, settlement.time) * 1000) : null,
    serverNow: nowMs,
    elapsed,
    betMinor: round.betMinor,
    currency: round.currency,
    autoCashout: round.autoCashout,
    commit: round.commit,
    clientSeed: round.seeds.clientSeed,
    nonce: round.seeds.nonce,
    configId: round.config.id,
    setbacks: readable
      ? setbacksUpTo(visibleUntil, round.outcome.setbacks).filter((t) => (settlement?.status === 'lost' ? t < settlement.time : true))
      : [],
    boosts: readable
      ? setbacksUpTo(visibleUntil, round.outcome.boosts ?? []).filter((t) => (settlement?.status === 'lost' ? t < settlement.time : true))
      : [],
    settlement,
    profile: round.profileName ?? null,
    clientVersion: round.clientVersion ?? null,
    balanceBeforeMinor: round.balanceBeforeMinor ?? null,
    balanceAfterMinor: settlement ? (round.balanceAfterMinor ?? null) : null,
    returnMinor,
    netMinor: returnMinor === null ? null : returnMinor - round.betMinor,
    resultKind: returnMinor === null || settlement?.status === 'void' ? null : resultKind(round.betMinor, returnMinor),
    crashMultiplier:
      settlement && readable && settlement.crashTime >= 0 ? multiplierAt(settlement.crashTime, modifiersOfOutcome(round.outcome, round.config), round.config) : null,
    cashouts: cashoutEntries(round, settlement),
    stakeParts: stakePartCount(round),
    partMinor: partMinorOf(round),
    settledParts: (settlement?.cashouts as PartEntry[] | undefined)?.filter((t) => typeof t.partId === 'string') ?? round.settledParts ?? [],
  };
}
