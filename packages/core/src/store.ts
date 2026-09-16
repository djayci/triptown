import type { Settlement, PartEntry } from './events';
import type { GameId, JurisdictionProfile } from './profiles';
import type { RoundRecord } from './round';

export interface RevealedSeed {
  serverSeed: string;
  commit: string;
  clientSeed: string;
  /** Rounds on this seed used nonces 0..roundsPlayed-1. */
  roundsPlayed: number;
  revealedAt: number;
  auto: boolean;
}

export interface SessionRecord {
  id: string;
  currency: string;
  /** Encrypted at rest through the host's SeedCipher. */
  serverSeed: string;
  commit: string;
  clientSeed: string;
  /** Nonce the next round will use. */
  nonce: number;
  createdAt: number;
  /** When the current server seed was created (for automatic rotation). */
  seedCreatedAt?: number;
  /** Most recent revealed seeds, newest first. */
  revealedSeeds?: RevealedSeed[];
  /** Operator's player id; the session id for the fake wallet. Round locks and pacing are per player. */
  playerId?: string;
  /** Client build that opened the session (recall). */
  clientVersion?: string | null;
  /** Jurisdiction profile bound when the session was created. Older records fall back to the host default. */
  profile?: JurisdictionProfile;
  /** Game the session plays; older records are Whack Crash. */
  game?: GameId;
}

/**
 * Persistence used by RoundHost. Implementations must make the marked operations atomic
 * so concurrent requests (e.g. a cash-out racing the stream) cannot double-credit.
 */
export interface RoundStore {
  createSession(session: SessionRecord, balanceMinor: number): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  updateSession(
    id: string,
    patch: Partial<Pick<SessionRecord, 'serverSeed' | 'commit' | 'clientSeed' | 'seedCreatedAt' | 'revealedSeeds'>> & { resetNonce?: boolean },
  ): Promise<void>;
  /** Atomic: returns the nonce to use and advances the counter. */
  takeNonce(sessionId: string): Promise<number>;

  getBalance(sessionId: string): Promise<number>;
  /** Atomic check-and-decrement. */
  debit(sessionId: string, amountMinor: number): Promise<{ ok: boolean; balanceMinor: number }>;
  /** Atomic increment. */
  credit(sessionId: string, amountMinor: number): Promise<number>;
  /** Atomic credit-once per round: true only for the call that applied it (payouts and refunds). */
  creditOnce(sessionId: string, roundId: string, amountMinor: number): Promise<boolean>;

  /** Rounds that still need settlement or credit; used by reconciliation after crashes. */
  addPending(roundId: string): Promise<void>;
  removePending(roundId: string): Promise<void>;
  listPending(limit: number): Promise<string[]>;

  putRound(round: RoundRecord): Promise<void>;
  getRound(id: string): Promise<RoundRecord | null>;
  /** Records the latest sign of life for a round (heartbeat or open stream). */
  setHeartbeat(roundId: string, atMs: number): Promise<void>;
  /**
   * Atomic set-if-absent. True only for the call that stored the settlement. For paper rounds pass the
   * number of parts the settlement was computed from; the store refuses it if more have settled since.
   */
  settleOnce(roundId: string, settlement: Settlement, expectedSettledParts?: number): Promise<boolean>;
  /**
   * Atomic: appends a throw if the round is unsettled, the throw id is new and the bag has room, then credits
   * the whole minor units newly earned by the running exact total (design D23) to the session balance.
   */
  recordPartSettlement(sessionId: string, roundId: string, entry: Omit<PartEntry, 'creditedMinor'>, stakeParts: number): Promise<RecordPartResult>;

  /**
   * Atomic: claims the player's active-round slot and records the start time, unless a round is
   * already active or fewer than `minCycleMs` have passed since the previous start.
   */
  claimRoundStart(playerId: string, roundId: string, nowMs: number, minCycleMs: number): Promise<ClaimResult>;
  getActiveRound(playerId: string): Promise<string | null>;
  /** Clears the active round only if it is still `roundId`. `restoreLastStartAt` undoes a claim whose round never started. */
  releaseActiveRound(playerId: string, roundId: string, restoreLastStartAt?: number | null): Promise<void>;

  /** Player round index ordered by start time (recall). */
  indexPlayerRound(playerId: string, roundId: string, startedAt: number): Promise<void>;
  /** Newest first, within [fromMs, toMs], skipping `offset` entries. */
  listPlayerRounds(playerId: string, query: { fromMs?: number; toMs?: number; offset?: number; limit: number }): Promise<string[]>;
  setRoundBalanceAfter(roundId: string, balanceMinor: number): Promise<void>;
  /** Atomic session running totals for net position. */
  addSessionTotals(sessionId: string, stakedMinor: number, returnedMinor: number): Promise<void>;
  getSessionTotals(sessionId: string): Promise<{ stakedMinor: number; returnedMinor: number }>;

  /** Active kill switches, e.g. `game:whack-crash`, `config:whack-crash/v1`, `profile:light`. */
  getKillSwitches(): Promise<string[]>;
  setKillSwitch(key: string, enabled: boolean): Promise<void>;
}

export type RecordPartResult =
  | { kind: 'recorded'; entry: PartEntry; settledPartCount: number; balanceMinor: number }
  | { kind: 'duplicate'; entry: PartEntry }
  | { kind: 'settled' }
  | { kind: 'full' };

// Same float guard as money.ts, so store credits match the pure accrual.
const EPSILON = 1e-7;

export type ClaimResult =
  | { ok: true; previousStartAt: number | null }
  | { ok: false; reason: 'in_progress' }
  | { ok: false; reason: 'too_soon'; retryAfterMs: number };

const cloneRound = (r: RoundRecord): RoundRecord => JSON.parse(JSON.stringify(r)) as RoundRecord;

/** In-memory store for tests, local development and the browser mock. */
export class MemoryRoundStore implements RoundStore {
  private sessions = new Map<string, SessionRecord>();
  private balances = new Map<string, number>();
  private rounds = new Map<string, RoundRecord>();
  private active = new Map<string, string>();
  private playerRounds = new Map<string, { id: string; at: number }[]>();
  private totals = new Map<string, { stakedMinor: number; returnedMinor: number }>();
  private kills = new Set<string>();
  private lastStart = new Map<string, number>();
  private credited = new Set<string>();
  private pending = new Set<string>();

  async createSession(session: SessionRecord, balanceMinor: number) {
    this.sessions.set(session.id, { ...session });
    this.balances.set(session.id, balanceMinor);
  }

  async getSession(id: string) {
    const s = this.sessions.get(id);
    return s ? { ...s } : null;
  }

  async updateSession(
    id: string,
    patch: Partial<Pick<SessionRecord, 'serverSeed' | 'commit' | 'clientSeed' | 'seedCreatedAt' | 'revealedSeeds'>> & { resetNonce?: boolean },
  ) {
    const s = this.sessions.get(id);
    if (!s) return;
    const { resetNonce, ...fields } = patch;
    Object.assign(s, fields);
    if (resetNonce) s.nonce = 0;
  }

  async takeNonce(sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error('session not found');
    return s.nonce++;
  }

  async getBalance(sessionId: string) {
    return this.balances.get(sessionId) ?? 0;
  }

  async debit(sessionId: string, amountMinor: number) {
    const balance = this.balances.get(sessionId) ?? 0;
    if (balance < amountMinor) return { ok: false, balanceMinor: balance };
    this.balances.set(sessionId, balance - amountMinor);
    return { ok: true, balanceMinor: balance - amountMinor };
  }

  async credit(sessionId: string, amountMinor: number) {
    const balance = (this.balances.get(sessionId) ?? 0) + amountMinor;
    this.balances.set(sessionId, balance);
    return balance;
  }

  async creditOnce(sessionId: string, roundId: string, amountMinor: number) {
    if (this.credited.has(roundId)) return false;
    this.credited.add(roundId);
    await this.credit(sessionId, amountMinor);
    return true;
  }

  async addPending(roundId: string) {
    this.pending.add(roundId);
  }

  async removePending(roundId: string) {
    this.pending.delete(roundId);
  }

  async listPending(limit: number) {
    return [...this.pending].slice(0, limit);
  }

  async putRound(round: RoundRecord) {
    this.rounds.set(round.id, cloneRound(round));
  }

  async getRound(id: string) {
    const r = this.rounds.get(id);
    return r ? cloneRound(r) : null;
  }

  async setHeartbeat(roundId: string, atMs: number) {
    const r = this.rounds.get(roundId);
    if (r) r.lastHeartbeatAt = Math.max(r.lastHeartbeatAt ?? 0, atMs);
  }

  async settleOnce(roundId: string, settlement: Settlement, expectedSettledParts?: number) {
    const r = this.rounds.get(roundId);
    if (!r || r.settlement) return false;
    if (expectedSettledParts !== undefined && (r.settledParts ?? []).reduce((n, t) => n + t.parts, 0) !== expectedSettledParts) return false;
    r.settlement = { ...settlement };
    return true;
  }

  async recordPartSettlement(sessionId: string, roundId: string, entry: Omit<PartEntry, 'creditedMinor'>, stakeParts: number): Promise<RecordPartResult> {
    const r = this.rounds.get(roundId);
    if (!r || r.settlement) return { kind: 'settled' };
    const throws = (r.settledParts ??= []);
    const dup = throws.find((t) => t.partId === entry.partId);
    if (dup) return { kind: 'duplicate', entry: { ...dup } };
    const thrown = throws.reduce((n, t) => n + t.parts, 0);
    if (thrown + entry.parts > stakeParts) return { kind: 'full' };
    const exact = throws.reduce((n, t) => n + t.exactMinor, 0) + entry.exactMinor;
    const credited = throws.reduce((n, t) => n + t.creditedMinor, 0);
    const creditedMinor = Math.max(0, Math.floor(exact + EPSILON) - credited);
    const stored: PartEntry = { ...entry, creditedMinor };
    throws.push(stored);
    const balanceMinor = await this.credit(sessionId, creditedMinor);
    return { kind: 'recorded', entry: { ...stored }, settledPartCount: thrown + entry.parts, balanceMinor };
  }

  async claimRoundStart(playerId: string, roundId: string, nowMs: number, minCycleMs: number): Promise<ClaimResult> {
    if (this.active.has(playerId)) return { ok: false, reason: 'in_progress' };
    const last = this.lastStart.get(playerId) ?? null;
    if (last !== null && nowMs - last < minCycleMs) return { ok: false, reason: 'too_soon', retryAfterMs: last + minCycleMs - nowMs };
    this.active.set(playerId, roundId);
    this.lastStart.set(playerId, nowMs);
    return { ok: true, previousStartAt: last };
  }

  async getActiveRound(playerId: string) {
    return this.active.get(playerId) ?? null;
  }

  async releaseActiveRound(playerId: string, roundId: string, restoreLastStartAt?: number | null) {
    if (this.active.get(playerId) !== roundId) return;
    this.active.delete(playerId);
    if (restoreLastStartAt === null) this.lastStart.delete(playerId);
    else if (restoreLastStartAt !== undefined) this.lastStart.set(playerId, restoreLastStartAt);
  }

  async indexPlayerRound(playerId: string, roundId: string, startedAt: number) {
    const list = this.playerRounds.get(playerId) ?? [];
    list.push({ id: roundId, at: startedAt });
    this.playerRounds.set(playerId, list);
  }

  async listPlayerRounds(playerId: string, q: { fromMs?: number; toMs?: number; offset?: number; limit: number }) {
    return (this.playerRounds.get(playerId) ?? [])
      .filter((r) => r.at >= (q.fromMs ?? -Infinity) && r.at <= (q.toMs ?? Infinity))
      .sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1))
      .slice(q.offset ?? 0, (q.offset ?? 0) + q.limit)
      .map((r) => r.id);
  }

  async setRoundBalanceAfter(roundId: string, balanceMinor: number) {
    const r = this.rounds.get(roundId);
    if (r) r.balanceAfterMinor = balanceMinor;
  }

  async addSessionTotals(sessionId: string, stakedMinor: number, returnedMinor: number) {
    const t = this.totals.get(sessionId) ?? { stakedMinor: 0, returnedMinor: 0 };
    this.totals.set(sessionId, { stakedMinor: t.stakedMinor + stakedMinor, returnedMinor: t.returnedMinor + returnedMinor });
  }

  async getSessionTotals(sessionId: string) {
    return this.totals.get(sessionId) ?? { stakedMinor: 0, returnedMinor: 0 };
  }

  async getKillSwitches() {
    return [...this.kills];
  }

  async setKillSwitch(key: string, enabled: boolean) {
    if (enabled) this.kills.add(key);
    else this.kills.delete(key);
  }
}
