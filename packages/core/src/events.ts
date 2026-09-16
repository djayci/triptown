export type CashoutReason = 'manual' | 'auto' | 'maxWin' | 'maxDuration' | 'disconnect';

export interface Settlement {
  /** `void`: a system failure voided the round and the stake was refunded (`payoutMinor` = stake). */
  status: 'won' | 'lost' | 'void';
  reason: CashoutReason | 'crash' | 'system_failure';
  /** Seconds after start when the round ended. */
  time: number;
  /** Multiplier at `time`: the cash-out value when won, the crash value when lost. */
  multiplier: number;
  payoutMinor: number;
  /** The round's crash time, public once settled. */
  crashTime: number;
  /** Client-reported timing for a manual cash-out. Evidence only; settlement uses server receive time. */
  evidence?: CashoutEvidence;
  /** Every cash-out in the round (one for single cash-out games, several for partial cash-out games). */
  cashouts?: CashoutEntry[];
}

/** One cash-out within a round, as kept for recall and audit. */
export interface CashoutEntry {
  reason: CashoutReason;
  /** Seconds after round start. */
  time: number;
  multiplier: number;
  /** Fraction of the stake cashed out (1 for a single cash-out). */
  share: number;
  /** Exact value before rounding, in minor units. */
  exactMinor: number;
  /** Whole minor units credited for this cash-out. */
  creditedMinor: number;
  clientTapAt: number | null;
  rttMs: number | null;
}

/** One paper throw in a partial cash-out round (a cash-out entry plus its idempotency key and paper count). */
export interface ThrowEntry extends CashoutEntry {
  throwId: string;
  papers: number;
}

export type ResultKind = 'win' | 'even' | 'loss';

export interface CashoutEvidence {
  /** Client's tap time converted to server-clock ms, if sent. */
  clientTapAt: number | null;
  /** Client's latest measured round-trip time in ms, if sent. */
  rttMs: number | null;
  /** Server receive time in epoch ms. */
  receivedAt: number;
}

export interface StartEvent {
  type: 'START';
  roundId: string;
  /** Server epoch ms when the round clock started. */
  startedAt: number;
  /** Server epoch ms when this event was produced, for client clock offset. */
  serverNow: number;
  betMinor: number;
  currency: string;
  autoCashout: number | null;
  commit: string;
  clientSeed: string;
  nonce: number;
  configId: string;
  /** Partial cash-out rounds only: papers in the round and the stake of each. */
  papers?: number;
  paperMinor?: number;
}

export interface BadMoleEvent {
  type: 'BAD_MOLE';
  roundId: string;
  time: number;
  factor: number;
}

/** A paper settled mid-round (partial cash-out rounds only). Never carries the crash time. */
export interface ThrownEvent {
  type: 'THROWN';
  roundId: string;
  throwId: string;
  papers: number;
  reason: CashoutReason;
  time: number;
  multiplier: number;
  exactMinor: number;
  creditedMinor: number;
  remaining: number;
  balanceMinor: number;
}

export interface CashedOutEvent {
  type: 'CASHED_OUT';
  roundId: string;
  reason: CashoutReason;
  time: number;
  multiplier: number;
  payoutMinor: number;
  crashTime: number;
  balanceMinor: number;
  /** Partial cash-out rounds: papers settled and lost. */
  papersThrown?: number;
  papersLost?: number;
}

export interface CrashEvent {
  type: 'CRASH';
  roundId: string;
  time: number;
  multiplier: number;
  crashTime: number;
  balanceMinor: number;
  /** Partial cash-out rounds: total already returned from thrown papers, and the paper counts. */
  returnMinor?: number;
  papersThrown?: number;
  papersLost?: number;
}

export interface VoidEvent {
  type: 'VOID';
  roundId: string;
  reason: string;
  refundMinor: number;
  balanceMinor: number;
}

export type RoundEvent = StartEvent | BadMoleEvent | ThrownEvent | CashedOutEvent | CrashEvent | VoidEvent;
export type TerminalEvent = CashedOutEvent | CrashEvent | VoidEvent;

export function isTerminal(event: RoundEvent): event is TerminalEvent {
  return event.type === 'CASHED_OUT' || event.type === 'CRASH' || event.type === 'VOID';
}

/** Public view of a round. Never contains the crash time or future setbacks while running. */
export interface RoundSnapshot {
  roundId: string;
  sessionId: string;
  playerId: string;
  gameId: string;
  status: 'running' | 'won' | 'lost' | 'void';
  startedAt: number;
  /** Server time the round settled; null while running. */
  settledAt: number | null;
  serverNow: number;
  elapsed: number;
  betMinor: number;
  currency: string;
  autoCashout: number | null;
  commit: string;
  clientSeed: string;
  nonce: number;
  configId: string;
  /** Setbacks that have already happened. */
  setbacks: number[];
  settlement: Settlement | null;
  /** Recall fields (GLI-19 §4.14). Outcome-related values are null while the round is running. */
  profile: string | null;
  clientVersion: string | null;
  balanceBeforeMinor: number | null;
  balanceAfterMinor: number | null;
  returnMinor: number | null;
  netMinor: number | null;
  resultKind: ResultKind | null;
  crashMultiplier: number | null;
  cashouts: CashoutEntry[];
  /** Papers in the round (1 for single cash-out games) and the stake of each. */
  papers: number;
  paperMinor: number;
  /** Papers thrown so far, including while the round is running. */
  throws: ThrowEntry[];
}

/** Public round record for history views and exports (same shape as a snapshot). */
export type RoundSummary = RoundSnapshot;
