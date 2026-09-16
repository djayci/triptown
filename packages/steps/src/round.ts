import { payoutMinor, resultKind, type ResultKind } from '@triptown/core';
import type { CryptoProvider, RoundSeeds } from '@triptown/fairness';
import { fenceCount, multiplierAfter, stepConfigById, type Difficulty, type StepConfig } from './config';
import { deriveFences, type StepOutcome } from './derive';

export type StepStatus = 'running' | 'collected' | 'finished' | 'lost' | 'void';
export type StepSettleReason = 'collect' | 'finish' | 'refused' | 'abandoned' | 'abandoned_void';

export interface StepAction {
  type: 'jump' | 'collect';
  /** Client action key; a repeated key returns the recorded result (hard rule 4). */
  key: string;
  /** Server time in epoch ms. */
  at: number;
  /** Fence taken by a jump, or fences cleared when collecting. */
  fence: number;
  result: 'cleared' | 'refused' | 'collected';
  multiplier: number | null;
}

export interface StepSettlement {
  status: Exclude<StepStatus, 'running'>;
  reason: StepSettleReason;
  at: number;
  cleared: number;
  multiplier: number | null;
  payoutMinor: number;
  netMinor: number;
  result: ResultKind;
}

export interface StepRoundRecord {
  id: string;
  /** Compare-and-set version; every stored change increments it. */
  version: number;
  sessionId: string;
  playerId: string;
  stakeMinor: number;
  currency: string;
  configId: string;
  /** `serverSeed` is stored as the session's ciphertext; the outcome below is already derived. */
  seeds: RoundSeeds;
  commit: string;
  startedAt: number;
  lastActionAt: number;
  abandonAfterMs: number;
  /** Secret until settlement; never sent to a client (hard rule 3). */
  outcome: StepOutcome;
  status: StepStatus;
  cleared: number;
  actions: StepAction[];
  settlement: StepSettlement | null;
  profileName?: string;
  balanceBeforeMinor?: number;
}

export interface NewStepRound {
  id: string;
  sessionId: string;
  playerId: string;
  stakeMinor: number;
  currency: string;
  config: StepConfig;
  /** Plain seeds: derivation happens here. The host swaps in the ciphertext before storing. */
  seeds: RoundSeeds;
  commit: string;
  startedAt: number;
  abandonAfterMs: number;
  profileName?: string;
  balanceBeforeMinor?: number;
  crypto?: CryptoProvider;
}

export function createStepRound(input: NewStepRound): StepRoundRecord {
  return {
    id: input.id,
    version: 0,
    sessionId: input.sessionId,
    playerId: input.playerId,
    stakeMinor: input.stakeMinor,
    currency: input.currency,
    configId: input.config.id,
    seeds: { ...input.seeds },
    commit: input.commit,
    startedAt: input.startedAt,
    lastActionAt: input.startedAt,
    abandonAfterMs: input.abandonAfterMs,
    outcome: deriveFences(input.seeds, input.config, input.crypto),
    status: 'running',
    cleared: 0,
    actions: [],
    settlement: null,
    ...(input.profileName !== undefined && { profileName: input.profileName }),
    ...(input.balanceBeforeMinor !== undefined && { balanceBeforeMinor: input.balanceBeforeMinor }),
  };
}

export function configOf(round: Pick<StepRoundRecord, 'configId'>): StepConfig {
  const c = stepConfigById(round.configId);
  if (!c) throw new Error(`Unknown step config ${round.configId}`);
  return c;
}

function settle(round: StepRoundRecord, at: number, status: StepSettlement['status'], reason: StepSettleReason): StepRoundRecord {
  const config = configOf(round);
  const multiplier = multiplierAfter(config, round.cleared);
  const payout =
    status === 'void' ? round.stakeMinor : status === 'lost' || multiplier === null ? 0 : payoutMinor(round.stakeMinor, multiplier);
  const settlement: StepSettlement = {
    status,
    reason,
    at,
    cleared: round.cleared,
    multiplier: status === 'void' ? null : multiplier,
    payoutMinor: payout,
    netMinor: payout - round.stakeMinor,
    result: status === 'void' ? 'even' : resultKind(round.stakeMinor, payout),
  };
  return { ...round, status, settlement };
}

export const isAbandoned = (round: StepRoundRecord, now: number) =>
  round.status === 'running' && now - round.lastActionAt >= round.abandonAfterMs;

/** Settles a round nobody touched for its abandonment time: collect if a fence is cleared, else refund (design D5). */
export function settleIfAbandoned(round: StepRoundRecord, now: number): StepRoundRecord | null {
  if (!isAbandoned(round, now)) return null;
  const at = round.lastActionAt + round.abandonAfterMs;
  return round.cleared > 0 ? settle(round, at, 'collected', 'abandoned') : settle(round, at, 'void', 'abandoned_void');
}

export type StepJudgement =
  | { kind: 'applied'; round: StepRoundRecord; action: StepAction }
  | { kind: 'duplicate'; round: StepRoundRecord; action: StepAction }
  | { kind: 'abandoned'; round: StepRoundRecord }
  | { kind: 'not_running'; round: StepRoundRecord }
  | { kind: 'nothing_to_collect'; round: StepRoundRecord };

const findKey = (round: StepRoundRecord, key: string) => round.actions.find((a) => a.key === key);

function precheck(round: StepRoundRecord, now: number, key: string): StepJudgement | null {
  const dup = findKey(round, key);
  if (dup) return { kind: 'duplicate', round, action: dup };
  const abandoned = settleIfAbandoned(round, now);
  if (abandoned) return { kind: 'abandoned', round: abandoned };
  if (round.status !== 'running') return { kind: 'not_running', round };
  return null;
}

/** Reveals the next fence only. Pure: the caller stores the result with compare-and-set. */
export function judgeJump(round: StepRoundRecord, now: number, key: string): StepJudgement {
  const early = precheck(round, now, key);
  if (early) return early;
  const config = configOf(round);
  const fence = round.cleared + 1;
  if (round.outcome.refusedAt === fence) {
    const action: StepAction = { type: 'jump', key, at: now, fence, result: 'refused', multiplier: null };
    const next = settle({ ...round, lastActionAt: now, actions: [...round.actions, action] }, now, 'lost', 'refused');
    return { kind: 'applied', round: next, action };
  }
  const cleared = fence;
  const action: StepAction = { type: 'jump', key, at: now, fence, result: 'cleared', multiplier: multiplierAfter(config, cleared) };
  let next: StepRoundRecord = { ...round, cleared, lastActionAt: now, actions: [...round.actions, action] };
  if (cleared === fenceCount(config)) next = settle(next, now, 'finished', 'finish');
  return { kind: 'applied', round: next, action };
}

export function judgeCollect(round: StepRoundRecord, now: number, key: string): StepJudgement {
  const early = precheck(round, now, key);
  if (early) return early;
  if (round.cleared === 0) return { kind: 'nothing_to_collect', round };
  const config = configOf(round);
  const action: StepAction = { type: 'collect', key, at: now, fence: round.cleared, result: 'collected', multiplier: multiplierAfter(config, round.cleared) };
  const next = settle({ ...round, lastActionAt: now, actions: [...round.actions, action] }, now, 'collected', 'collect');
  return { kind: 'applied', round: next, action };
}

export interface StepRoundSnapshot {
  id: string;
  status: StepStatus;
  stakeMinor: number;
  currency: string;
  configId: string;
  difficulty: Difficulty;
  paytable: readonly number[];
  fences: number;
  cleared: number;
  currentMultiplier: number | null;
  nextMultiplier: number | null;
  actions: StepAction[];
  settlement: StepSettlement | null;
  commit: string;
  clientSeed: string;
  nonce: number;
  startedAt: number;
  lastActionAt: number;
  /** When a running round will be settled as abandoned. */
  abandonAt: number | null;
}

/** Public view of a round. Carries no outcome and no server seed at any status. */
export function snapshotOf(round: StepRoundRecord): StepRoundSnapshot {
  const config = configOf(round);
  const fences = fenceCount(config);
  return {
    id: round.id,
    status: round.status,
    stakeMinor: round.stakeMinor,
    currency: round.currency,
    configId: round.configId,
    difficulty: config.difficulty,
    paytable: config.paytable,
    fences,
    cleared: round.cleared,
    currentMultiplier: multiplierAfter(config, round.cleared),
    nextMultiplier: round.status === 'running' && round.cleared < fences ? config.paytable[round.cleared]! : null,
    actions: round.actions.map((a) => ({ ...a })),
    settlement: round.settlement ? { ...round.settlement } : null,
    commit: round.commit,
    clientSeed: round.seeds.clientSeed,
    nonce: round.seeds.nonce,
    startedAt: round.startedAt,
    lastActionAt: round.lastActionAt,
    abandonAt: round.status === 'running' ? round.lastActionAt + round.abandonAfterMs : null,
  };
}
