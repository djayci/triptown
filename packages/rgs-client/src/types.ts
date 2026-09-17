import type {
  CashoutOutcome,
  ClientTiming,
  HostErrorCode,
  RevealedSeed,
  RoundEvent,
  RoundSnapshot,
  RoundSummary,
  SeedRotation,
  SessionInfo,
  TerminalEvent,
  PartOutcome,
} from '@triptown/core';

export type { CashoutOutcome, ClientTiming, RevealedSeed, RoundEvent, RoundSnapshot, RoundSummary, SeedRotation, SessionInfo, TerminalEvent, PartOutcome };

export interface PartRequest {
  count: 1 | 'all';
  partId?: string;
}

/** Random throw id for idempotent retries (letters, digits, "-"). */
export function newPartId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type RoundServiceErrorCode = HostErrorCode | 'network' | 'unknown';

export class RoundServiceError extends Error {
  constructor(
    readonly code: RoundServiceErrorCode,
    message: string,
    /** Extra data from the server, e.g. `{ retryAfterMs }` for `cycle_too_soon`. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RoundServiceError';
  }
}

export interface StartRoundInput {
  betMinor: number;
  autoCashout?: number | null;
  /**
   * A stake-free practice round (practice-rounds). `betMinor` must be 0. The server refuses it unless
   * the session's profile permits practice rounds, whatever the client offered.
   */
  practice?: boolean;
}

export type RoundListener = (event: RoundEvent) => void;

export interface RoundHandle {
  roundId: string;
  /** Resolves with the terminal event, or null if the stream closed without one (e.g. network drop). */
  ended: Promise<TerminalEvent | null>;
  /** Stops listening. The round keeps running on the server. */
  close(): void;
}

/** Everything the game needs from a round backend. Implemented by the demo mock and the live API client. */
export interface RoundService {
  readonly mode: 'demo' | 'live';
  getSession(): Promise<SessionInfo>;
  /** Starts a round; resolves once START has been received. */
  startRound(input: StartRoundInput, listener: RoundListener): Promise<RoundHandle>;
  /** Re-attaches to a round's event stream, e.g. after a connection drop. Replays START and past setbacks. */
  watchRound(roundId: string, listener: RoundListener): Promise<RoundHandle>;
  /** `timing` is evidence for disputes; settlement always uses server receive time. */
  cashout(roundId: string, timing?: ClientTiming): Promise<CashoutOutcome>;
  /**
   * Partial cash-out: throws one or all remaining papers. The throw id makes retries safe; one is generated
   * when omitted and reused if the request has to be retried. Single-paper rounds behave like `cashout`.
   */
  settleParts(roundId: string, request: PartRequest, timing?: ClientTiming): Promise<PartOutcome>;
  getRound(roundId: string): Promise<RoundSnapshot>;
  /** The player's rounds, newest first, at most 50. Running rounds carry no outcome data. */
  history(limit?: number): Promise<RoundSummary[]>;
  setClientSeed(clientSeed: string): Promise<SessionInfo>;
  rotateSeed(): Promise<SeedRotation>;
  /** Previously used server seeds, revealed on rotation (newest last, at most 20). */
  revealedSeeds(): Promise<RevealedSeed[]>;
  /** Round-trip probe for the latency notice. Resolves when the server has answered. */
  ping(): Promise<void>;
}
