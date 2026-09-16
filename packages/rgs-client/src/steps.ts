import type { RevealedSeed } from '@triptown/core';
import type { Difficulty, StepAction, StepErrorCode, StepRoundSnapshot, StepSeedRotation, StepSessionInfo } from '@triptown/steps';

export type { Difficulty, RevealedSeed, StepAction, StepRoundSnapshot, StepSeedRotation, StepSessionInfo };

export type StepServiceErrorCode = StepErrorCode | 'network' | 'unknown';

export class StepServiceError extends Error {
  constructor(
    readonly code: StepServiceErrorCode,
    message: string,
    /** Extra data from the server, e.g. `{ retryAfterMs }` for `cycle_too_soon` or `{ round }` when settled. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'StepServiceError';
  }
}

export interface StepActionResult {
  round: StepRoundSnapshot;
  balanceMinor: number;
  action?: StepAction;
}

/** Random action key: a retried JUMP or COLLECT reuses it, so it is never applied twice. */
export function newActionKey(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Everything a step game needs from a round backend. Implemented by the demo mock and the live API client. */
export interface StepRoundService {
  readonly mode: 'demo' | 'live';
  getSession(): Promise<StepSessionInfo>;
  startStepRound(input: { stakeMinor: number; difficulty: Difficulty }): Promise<StepActionResult>;
  /** `key` defaults to a new action key; pass the same key to retry a request whose response was lost. */
  jump(roundId: string, key?: string): Promise<StepActionResult>;
  collect(roundId: string, key?: string): Promise<StepActionResult>;
  getStepRound(roundId: string): Promise<StepRoundSnapshot>;
  /** The player's running round, if any (resume after reload). */
  activeStepRound(): Promise<StepRoundSnapshot | null>;
  /** Newest first, at most 50. */
  stepHistory(limit?: number): Promise<StepRoundSnapshot[]>;
  setClientSeed(clientSeed: string): Promise<StepSessionInfo>;
  rotateSeed(): Promise<StepSeedRotation>;
  revealedSeeds(): Promise<RevealedSeed[]>;
}
