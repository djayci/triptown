import {
  assertValidConfig,
  commitServerSeed,
  generateClientSeed,
  generateServerSeed,
  type CryptoProvider,
  type GameConfig,
} from '@triptown/fairness';
import type {
  SetbackEvent,
  CashoutEvidence,
  BoostEvent,
  RoundEvent,
  RoundSnapshot,
  RoundSummary,
  Settlement,
  PartEntry,
  PartSettledEvent,
} from './events';
import { DEFAULT_CURRENCY, validateBet, type CurrencyRules } from './money';
import {
  cashout as judgeCashout,
  createRound,
  isSplitRound,
  judgeThrow,
  multiplierAtRound,
  stakePartCount,
  paperSettlementAt,
  rebuildPaperSettlement,
  settledPartCount,
  scheduledSettlement,
  modifierEvents,
  settlementDue,
  snapshot,
  startEvent,
  terminalEvent,
  validateAutoCashout,
  voidSettlement,
  type RoundRecord,
} from './round';
import {
  assertValidProfile,
  checkSessionRegion,
  effectiveConfig,
  profileFromTemplate,
  type GameId,
  type JurisdictionProfile,
  type ReportIndex,
} from './profiles';
import { nullAuditSink, type AuditSink } from './audit';
import { passThroughCipher, redactSeeds, type SeedCipher } from './seed-cipher';
import type { RevealedSeed, RoundStore, SessionRecord } from './store';

// RoundHost runs the server-side rules on top of a RoundStore. The API uses it with Redis,
// the browser mock uses it with the in-memory store, so both follow identical rules.

export type HostErrorCode =
  | 'session_not_found'
  | 'round_not_found'
  | 'forbidden'
  | 'insufficient_funds'
  | 'bet_limit'
  | 'invalid_bet'
  | 'invalid_auto_cashout'
  | 'round_in_progress'
  | 'invalid_client_seed'
  | 'below_min_cashout'
  | 'game_disabled'
  | 'cycle_too_soon'
  | 'integrity_blocked'
  | 'round_voided'
  | 'profile_not_allowed'
  | 'no_parts_left'
  | 'region_blocked'
  | 'region_required'
  | 'profile_unavailable';

export class HostError extends Error {
  constructor(
    readonly code: HostErrorCode,
    message: string,
    /** Extra machine-readable data, e.g. `{ retryAfterMs }` for `cycle_too_soon`. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HostError';
  }
}

export interface Clock {
  now(): number;
}

/** Resolves after `ms`. Injected so the host stays free of platform timer types. */
export type Sleep = (ms: number) => Promise<void>;

export interface SessionInfo {
  sessionId: string;
  /** Session start (server ms) and running totals, for session clock and net position. */
  sessionStartedAt: number;
  stakedMinor: number;
  returnedMinor: number;
  balanceMinor: number;
  currency: CurrencyRules;
  commit: string;
  clientSeed: string;
  nonce: number;
  /** Effective math config for this session's rounds. */
  config: GameConfig;
  profile: JurisdictionProfile;
}

export interface StartResult {
  round: RoundRecord;
  balanceMinor: number;
}

export interface CashoutOutcome {
  result: 'won' | 'crashed' | 'already_settled';
  settlement: Settlement;
  balanceMinor: number;
}

export interface PartOutcome {
  /** `thrown`: parts settled and the round continues; `cashed_out`: the last parts ended the round. */
  result: 'thrown' | 'cashed_out' | 'crashed' | 'already_settled' | 'duplicate';
  throw: PartEntry | null;
  remaining: number;
  /** Present once the round has ended. */
  settlement: Settlement | null;
  balanceMinor: number;
}

export interface SeedRotation {
  /** True when the server rotated on its own (round or age limit). */
  auto?: boolean;
  previousServerSeed: string;
  previousCommit: string;
  previousClientSeed: string;
  /** Rounds that used the revealed seed had nonces 0..roundsPlayed-1. */
  roundsPlayed: number;
  session: SessionInfo;
}

export interface ProfileSettings {
  /** Used when a session names no operator. */
  defaultProfile: JurisdictionProfile;
  /** Operator id -> bound profile (with that operator's origins). */
  operators?: Readonly<Record<string, JurisdictionProfile>>;
  /** Dev/preview only: lets a session request any template by name, including drafts. */
  allowOverride?: boolean;
  /** When given, every profile must reference configs with passing RTP reports. */
  reportIndex?: ReportIndex;
}

export interface CreateSessionOptions {
  clientSeed?: string;
  clientVersion?: string;
  /** Operator player id; defaults to the session id. */
  playerId?: string;
  operatorId?: string;
  /** Template name; honoured only when `allowOverride` is on. */
  profile?: string;
  /** Player region from the operator (ISO 3166-2), checked against the profile's blocked regions. */
  playerRegion?: string;
  /** Region this deployment runs in, checked against the profile's hosting regions. */
  deploymentRegion?: string;
}

export interface RoundHostOptions {
  store: RoundStore;
  clock: Clock;
  sleep: Sleep;
  /** Which game this host runs; picks the config family per profile. Defaults to whack-crash. */
  game?: GameId;
  profiles?: ProfileSettings;
  /** Tamper-evident audit trail; defaults to no-op. */
  audit?: AuditSink;
  /** Encrypts server seeds at rest; defaults to pass-through (tests, dev, mock). */
  seedCipher?: SeedCipher;
  /** Automatic rotation limits (GLI-19 §3.3.2c). Defaults: 1,000 rounds or 24 h. */
  seedRotation?: { maxRounds?: number; maxAgeMs?: number };
  /** Platform hash implementation (server); defaults to the pure TypeScript one. */
  crypto?: CryptoProvider;
  /** Test override: use this math config for every session regardless of profile. */
  config?: GameConfig;
  currency?: CurrencyRules;
  newId?: () => string;
  /** How often a running stream re-checks the store for a cash-out made elsewhere. */
  settlementPollMs?: number;
  historySize?: number;
}

export interface StreamHandle {
  done: Promise<void>;
  stop(): void;
}

/** Optional client timing sent with a cash-out. */
export interface ClientTiming {
  clientTapAt?: number | null;
  rttMs?: number | null;
}

const finiteOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const INTEGRITY_BLOCK = 'integrity:blocked';

const playerOf = (session: SessionRecord) => session.playerId ?? session.id;

const CLIENT_SEED_RE = /^[\x20-\x7e]{1,64}$/;

export class RoundHost {
  readonly game: GameId;
  private readonly fixedConfig: GameConfig | null;
  private readonly profiles: ProfileSettings;
  private readonly crypto: CryptoProvider | undefined;
  private readonly cipher: SeedCipher;
  private readonly audit: AuditSink;
  private readonly maxSeedRounds: number;
  private readonly maxSeedAgeMs: number;
  readonly currency: CurrencyRules;
  private readonly store: RoundStore;
  private readonly clock: Clock;
  private readonly sleep: Sleep;
  private readonly newId: () => string;
  private readonly pollMs: number;
  private readonly historySize: number;

  constructor(opts: RoundHostOptions) {
    this.game = opts.game ?? 'whack-crash';
    this.crypto = opts.crypto;
    this.cipher = opts.seedCipher ?? passThroughCipher;
    this.audit = opts.audit ?? nullAuditSink;
    this.maxSeedRounds = opts.seedRotation?.maxRounds ?? 1_000;
    this.maxSeedAgeMs = opts.seedRotation?.maxAgeMs ?? 24 * 60 * 60 * 1000;
    this.fixedConfig = opts.config ? assertValidConfig(opts.config) : null;
    this.profiles = opts.profiles ?? { defaultProfile: profileFromTemplate('light') };
    const { defaultProfile, operators = {}, reportIndex } = this.profiles;
    for (const p of [defaultProfile, ...Object.values(operators)]) {
      // Operator profiles must carry origins; the default may be origin-less only in override (dev) mode.
      const requireOrigins = p !== defaultProfile || !this.profiles.allowOverride;
      assertValidProfile(p, { requireOrigins, reportIndex, games: [this.game] });
      if (p.status === 'draft' && !this.profiles.allowOverride) {
        throw new Error(`Profile ${p.name} is a draft and cannot be used without the dev override`);
      }
    }
    this.currency = opts.currency ?? DEFAULT_CURRENCY;
    this.store = opts.store;
    this.clock = opts.clock;
    this.sleep = opts.sleep;
    this.newId = opts.newId ?? (() => generateServerSeed().slice(0, 24));
    this.pollMs = opts.settlementPollMs ?? 1000;
    this.historySize = opts.historySize ?? 50;
  }

  /** Current time from the host's time authority. */
  now(): number {
    return this.clock.now();
  }

  /** Config the host uses when no session is involved (default profile). */
  get config(): GameConfig {
    return this.configFor(this.profiles.defaultProfile);
  }

  configFor(profile: JurisdictionProfile): GameConfig {
    return this.fixedConfig ?? effectiveConfig(this.game, profile);
  }

  private resolveProfile(opts: CreateSessionOptions): JurisdictionProfile {
    const { defaultProfile, operators = {}, allowOverride, reportIndex } = this.profiles;
    if (opts.profile) {
      if (!allowOverride) throw new HostError('profile_not_allowed', 'Profile override is disabled');
      const p = profileFromTemplate(opts.profile, defaultProfile.operatorOrigins);
      assertValidProfile(p, { requireOrigins: false, reportIndex, games: [this.game] });
      return p;
    }
    if (opts.operatorId) {
      const p = operators[opts.operatorId];
      if (!p) throw new HostError('forbidden', 'Unknown operator');
      return p;
    }
    return defaultProfile;
  }

  private sessionProfile(session: SessionRecord): JurisdictionProfile {
    return session.profile ?? this.profiles.defaultProfile;
  }

  async createSession(initialBalanceMinor: number, options: CreateSessionOptions | string = {}): Promise<SessionInfo> {
    const opts = typeof options === 'string' ? { clientSeed: options } : options;
    const profile = this.resolveProfile(opts);
    const region = checkSessionRegion(profile, opts.playerRegion, opts.deploymentRegion);
    if (!region.ok) throw new HostError(region.code, region.message);
    const seed = opts.clientSeed ?? generateClientSeed();
    if (!CLIENT_SEED_RE.test(seed)) throw new HostError('invalid_client_seed', 'Client seed must be 1-64 printable characters');
    const serverSeed = generateServerSeed();
    const id = this.newId();
    const session: SessionRecord = {
      id,
      // Operator player ids are namespaced so two operators can't share a lock, pacing clock or history.
      playerId: opts.operatorId && opts.playerId ? `${opts.operatorId}:${opts.playerId}` : (opts.playerId ?? id),
      clientVersion: typeof opts.clientVersion === 'string' ? opts.clientVersion.slice(0, 40) : null,
      currency: this.currency.code,
      serverSeed: await this.cipher.encrypt(serverSeed),
      seedCreatedAt: this.clock.now(),
      revealedSeeds: [],
      commit: commitServerSeed(serverSeed, this.crypto),
      clientSeed: seed,
      nonce: 0,
      createdAt: this.clock.now(),
      profile,
      game: this.game,
    };
    await this.store.createSession(session, initialBalanceMinor);
    await this.audit.append('session_created', {
      sessionId: id,
      playerId: session.playerId,
      profile: profile.name,
      operatorId: opts.operatorId ?? null,
      balanceMinor: initialBalanceMinor,
    });
    await this.audit.append('seed_committed', { sessionId: id, commit: session.commit, clientSeed: seed });
    return this.sessionInfo(session.id);
  }

  async sessionInfo(sessionId: string): Promise<SessionInfo> {
    let session = await this.requireSession(sessionId);
    if ((await this.settleActiveIfDue(playerOf(session))) && this.seedRotationDue(session)) {
      await this.rotate(session, true);
      session = await this.requireSession(sessionId);
    }
    const totals = await this.store.getSessionTotals(sessionId);
    return {
      sessionId: session.id,
      sessionStartedAt: session.createdAt,
      stakedMinor: totals.stakedMinor,
      returnedMinor: totals.returnedMinor,
      balanceMinor: await this.store.getBalance(sessionId),
      currency: this.currency,
      commit: session.commit,
      clientSeed: session.clientSeed,
      nonce: session.nonce,
      config: this.configFor(this.sessionProfile(session)),
      profile: this.sessionProfile(session),
    };
  }

  async startRound(
    sessionId: string,
    input: { betMinor: number; autoCashout?: number | null },
  ): Promise<StartResult> {
    let session = await this.requireSession(sessionId);
    const profile = this.sessionProfile(session);
    const config = this.configFor(profile);
    const bet = validateBet(input.betMinor, this.currency);
    if (!bet.ok) throw new HostError(bet.code, bet.message);
    const stakeParts = profile.partialCashout === 'parts' ? config.stakeParts : 1;
    if (stakeParts > 1 && (input.betMinor % stakeParts !== 0 || input.betMinor / stakeParts < this.currency.minBetMinor)) {
      // Each paper is a stake of its own size, so it must be whole and at least the minimum stake (0.20).
      throw new HostError('bet_limit', `The stake must split into ${stakeParts} equal stakeParts of at least ${this.currency.minBetMinor} minor units`);
    }
    const kills = await this.store.getKillSwitches();
    const disabledBy = [`game:${this.game}`, `config:${config.id}`, `profile:${profile.name}`].find((k) => kills.includes(k));
    // Running rounds are unaffected; only new rounds are blocked.
    if (disabledBy) throw new HostError('game_disabled', `New rounds are disabled (${disabledBy})`);
    if (kills.includes(INTEGRITY_BLOCK)) throw new HostError('integrity_blocked', 'New rounds are paused pending a software integrity review');
    const auto = validateAutoCashout(input.autoCashout, config, profile.minCashout);
    if (!auto.ok) throw new HostError('invalid_auto_cashout', auto.message);

    const playerId = playerOf(session);
    if (!(await this.settleActiveIfDue(playerId))) {
      throw new HostError('round_in_progress', 'Finish the current round first');
    }
    const roundId = this.newId();
    const claim = await this.store.claimRoundStart(playerId, roundId, this.clock.now(), profile.minCycleMs);
    if (!claim.ok) {
      if (claim.reason === 'too_soon') {
        throw new HostError('cycle_too_soon', 'Please wait before starting the next round', { retryAfterMs: claim.retryAfterMs });
      }
      throw new HostError('round_in_progress', 'Finish the current round first');
    }
    const debit = await this.store.debit(sessionId, input.betMinor);
    if (!debit.ok) {
      // No round started, so the pacing clock goes back to the previous start.
      await this.store.releaseActiveRound(playerId, roundId, claim.previousStartAt);
      throw new HostError('insufficient_funds', 'Balance is too low for this bet');
    }
    // Normally rotation already happened at the previous settlement; this covers an age limit reached while idle.
    if (this.seedRotationDue(session)) {
      await this.rotate(session, true);
      session = await this.requireSession(sessionId);
    }
    const startedAt = this.clock.now();
    try {
      // Tracked first, so a crash between debit and record write is found by reconciliation.
      await this.store.addPending(roundId);
      const nonce = await this.store.takeNonce(sessionId);
      return await this.recordStart(session, profile, config, playerId, roundId, nonce, startedAt, input, debit.balanceMinor, stakeParts);
    } catch (err) {
      if (err instanceof HostError) throw err;
      await this.voidAfterDebit({ sessionId, playerId, roundId, betMinor: input.betMinor, startedAt, previousStartAt: claim.previousStartAt }, err);
      throw new HostError('round_voided', 'The round could not start and your stake was refunded', { refundMinor: input.betMinor });
    }
  }

  private async recordStart(
    session: SessionRecord,
    profile: JurisdictionProfile,
    config: GameConfig,
    playerId: string,
    roundId: string,
    nonce: number,
    startedAt: number,
    input: { betMinor: number; autoCashout?: number | null },
    balanceAfterDebitMinor: number,
    stakeParts = 1,
  ): Promise<StartResult> {
    const sessionId = session.id;
    const serverSeed = await this.cipher.decrypt(session.serverSeed);
    const derived = createRound({
      id: roundId,
      sessionId,
      playerId,
      betMinor: input.betMinor,
      currency: this.currency.code,
      autoCashout: input.autoCashout ?? null,
      seeds: { serverSeed, clientSeed: session.clientSeed, nonce },
      commit: session.commit,
      config,
      minCashout: profile.minCashout,
      disconnectPolicy: profile.disconnectPolicy,
      startedAt,
      profileName: profile.name,
      clientVersion: session.clientVersion ?? null,
      balanceBeforeMinor: balanceAfterDebitMinor + input.betMinor,
      crypto: this.crypto,
      stakeParts,
    });
    // Only the ciphertext is persisted; the outcome is already derived.
    const round: RoundRecord = { ...derived, seeds: { ...derived.seeds, serverSeed: session.serverSeed } };
    await this.store.putRound(round);
    await this.audit.append('round_started', {
      roundId,
      sessionId,
      playerId,
      configId: config.id,
      profile: profile.name,
      betMinor: input.betMinor,
      autoCashout: input.autoCashout ?? null,
      stakeParts,
      commit: session.commit,
      clientSeed: session.clientSeed,
      nonce,
      startedAt: round.startedAt,
      balanceAfterDebitMinor,
    });
    await this.store.indexPlayerRound(playerId, roundId, startedAt);
    await this.store.addSessionTotals(sessionId, input.betMinor, 0);
    return { round, balanceMinor: balanceAfterDebitMinor };
  }

  /** Refunds a debited stake whose round could not be recorded, and records why. */
  private async voidAfterDebit(
    r: { sessionId: string; playerId: string; roundId: string; betMinor: number; startedAt: number; previousStartAt: number | null },
    cause: unknown,
  ) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    await this.store.creditOnce(r.sessionId, r.roundId, r.betMinor);
    await this.store.releaseActiveRound(r.playerId, r.roundId, r.previousStartAt);
    await this.store.removePending(r.roundId).catch(() => {});
    await this.audit.append('round_voided', { roundId: r.roundId, sessionId: r.sessionId, refundMinor: r.betMinor, reason: redactSeeds(reason), stage: 'start' }).catch(() => {});
  }

  /**
   * Repairs rounds left behind by failures: credits settled rounds that were never credited, settles rounds
   * that are due, and voids (refunding the stake) rounds that can no longer be settled correctly.
   * Safe to run repeatedly and concurrently: settlement and credit are both once-only.
   */
  async reconcile(limit = 200): Promise<{ credited: number; settled: number; voided: number }> {
    const now = this.clock.now();
    const stats = { credited: 0, settled: 0, voided: 0 };
    for (const id of await this.store.listPending(limit)) {
      const round = await this.store.getRound(id);
      if (!round) {
        // Pending but never recorded: the start failed before the void path completed.
        if (await this.isStale(id)) await this.store.removePending(id);
        continue;
      }
      try {
        if (round.settlement) {
          if (round.settlement.status !== 'lost' && (await this.store.creditOnce(round.sessionId, round.id, round.settlement.payoutMinor))) {
            await this.store.setRoundBalanceAfter(round.id, await this.store.getBalance(round.sessionId));
            stats.credited++;
          }
          await this.store.releaseActiveRound(round.playerId ?? round.sessionId, round.id);
          await this.store.removePending(round.id);
          continue;
        }
        const due = settlementDue(round, now);
        if (due) {
          await this.finalize(round, due);
          stats.settled++;
        } else if (now > round.startedAt + ((Number.isFinite(round.config?.tMax) ? round.config.tMax : 60) + 120) * 1000) {
          throw new Error('round past tMax without a derivable settlement');
        }
      } catch (err) {
        await this.voidRound(round, err);
        stats.voided++;
      }
    }
    return stats;
  }

  private async isStale(_roundId: string) {
    // Without a record there is no start time; leave it for the next pass unless the store says otherwise.
    return false;
  }

  private async voidRound(round: RoundRecord, cause: unknown) {
    const settlement = voidSettlement(round, this.clock.now());
    const first = await this.store.settleOnce(round.id, settlement);
    const stored = first ? settlement : ((await this.store.getRound(round.id))?.settlement ?? settlement);
    if (stored.status === 'void' && (await this.store.creditOnce(round.sessionId, round.id, stored.payoutMinor))) {
      await this.store.addSessionTotals(round.sessionId, 0, stored.payoutMinor);
      await this.store.setRoundBalanceAfter(round.id, await this.store.getBalance(round.sessionId));
    }
    await this.store.releaseActiveRound(round.playerId ?? round.sessionId, round.id);
    await this.store.removePending(round.id);
    if (first) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      await this.audit.append('round_voided', { roundId: round.id, sessionId: round.sessionId, refundMinor: settlement.payoutMinor, reason: redactSeeds(reason), stage: 'settlement' });
    }
  }

  /** Manual cash-out judged at the moment this call runs (server receive time). */
  async cashout(sessionId: string, roundId: string, client: ClientTiming = {}, receivedAt?: number): Promise<CashoutOutcome> {
    const now = receivedAt ?? this.clock.now();
    const round = await this.requireRound(sessionId, roundId);
    const judged = judgeCashout(round, now);
    const evidence: CashoutEvidence = { clientTapAt: finiteOrNull(client.clientTapAt), rttMs: finiteOrNull(client.rttMs), receivedAt: now };
    await this.audit.append('cashout_received', { roundId, sessionId, judged: judged.kind, ...evidence });
    if (judged.kind === 'won') judged.settlement.evidence = evidence;
    if (judged.kind === 'below_min_cashout') {
      throw new HostError('below_min_cashout', `Cash-out is available from x${judged.minCashout.toFixed(2)}`, {
        minCashout: judged.minCashout,
        multiplier: judged.multiplier,
      });
    }
    if (judged.kind === 'won') {
      const stored = await this.finalize(round, judged.settlement);
      const result = stored === judged.settlement ? 'won' : 'already_settled';
      return { result, settlement: stored, balanceMinor: await this.store.getBalance(sessionId) };
    }
    const stored = await this.finalize(round, judged.settlement);
    return {
      // A lost round always answers "crashed", even if the stream settled it first.
      result: stored.status === 'lost' ? 'crashed' : 'already_settled',
      settlement: stored,
      balanceMinor: await this.store.getBalance(sessionId),
    };
  }

  /**
   * Collects one or all remaining parts (partial cash-out), judged at server receive time. Single-part
   * rounds behave exactly like `cashout`. Repeating a throw id returns the first result.
   */
  async settleParts(
    sessionId: string,
    roundId: string,
    request: { partId: string; count: 1 | 'all' } & ClientTiming,
    receivedAt?: number,
  ): Promise<PartOutcome> {
    const now = receivedAt ?? this.clock.now();
    let round = await this.requireRound(sessionId, roundId);
    if (!isSplitRound(round)) {
      const out = await this.cashout(sessionId, roundId, request, now);
      return {
        result: out.result === 'won' ? 'cashed_out' : out.result,
        throw: null,
        remaining: 0,
        settlement: out.settlement,
        balanceMinor: out.balanceMinor,
      };
    }
    if (typeof request.partId !== 'string' || !/^[\w-]{1,64}$/.test(request.partId)) {
      throw new HostError('invalid_bet', 'partId must be 1-64 letters, digits, "-" or "_"');
    }
    const clientTapAt = finiteOrNull(request.clientTapAt);
    const rttMs = finiteOrNull(request.rttMs);
    const judged = judgeThrow(round, now, { partId: request.partId, count: request.count === 'all' ? 'all' : 1, clientTapAt, rttMs });
    await this.audit.append('cashout_received', { roundId, sessionId, partId: request.partId, count: request.count, judged: judged.kind, clientTapAt, rttMs, receivedAt: now });
    const balance = () => this.store.getBalance(sessionId);
    const remainingOf = (r: typeof round) => stakePartCount(r) - settledPartCount(r);
    switch (judged.kind) {
      case 'below_min_cashout':
        throw new HostError('below_min_cashout', `Throws are available from x${judged.minCashout.toFixed(2)}`, {
          minCashout: judged.minCashout,
          multiplier: judged.multiplier,
        });
      case 'no_parts':
        throw new HostError('no_parts_left', 'All parts have been settled');
      case 'duplicate':
        return { result: 'duplicate', throw: judged.entry, remaining: remainingOf(round), settlement: round.settlement, balanceMinor: await balance() };
      case 'crashed':
      case 'already_settled': {
        const stored = await this.finalize(round, judged.settlement);
        return { result: stored.status === 'lost' ? 'crashed' : 'already_settled', throw: null, remaining: 0, settlement: stored, balanceMinor: await balance() };
      }
    }
    const recorded = await this.store.recordPartSettlement(sessionId, roundId, judged.entry, stakePartCount(round));
    if (recorded.kind === 'duplicate') {
      return { result: 'duplicate', throw: recorded.entry, remaining: remainingOf(round), settlement: round.settlement, balanceMinor: await balance() };
    }
    if (recorded.kind !== 'recorded') {
      // Settled (or filled) by another request in the meantime; report what the round holds now.
      round = (await this.store.getRound(roundId)) ?? round;
      const settled = round.settlement ?? settlementDue(round, now);
      if (settled) {
        const stored = await this.finalize(round, settled);
        return { result: stored.status === 'lost' ? 'crashed' : 'already_settled', throw: null, remaining: 0, settlement: stored, balanceMinor: await balance() };
      }
      throw new HostError('no_parts_left', 'All parts have been settled');
    }
    await this.audit.append('paper_thrown', { roundId, sessionId, ...recorded.entry, balanceMinor: recorded.balanceMinor });
    const remaining = stakePartCount(round) - recorded.settledPartCount;
    if (remaining > 0) return { result: 'thrown', throw: recorded.entry, remaining, settlement: null, balanceMinor: recorded.balanceMinor };
    // Last paper: the round ends now with the half-up rounded total.
    const fresh = (await this.store.getRound(roundId)) ?? round;
    const settlement = paperSettlementAt(fresh, recorded.entry.time, 'manual');
    const stored = await this.finalize(fresh, { ...settlement, evidence: { clientTapAt, rttMs, receivedAt: now } });
    return { result: stored.status === 'won' ? 'cashed_out' : 'crashed', throw: recorded.entry, remaining: 0, settlement: stored, balanceMinor: await balance() };
  }

  /** Client heartbeat for `cashout-at-disconnect` rounds. */
  async heartbeat(sessionId: string, roundId: string): Promise<void> {
    const round = await this.requireRound(sessionId, roundId);
    if (!round.settlement) await this.store.setHeartbeat(roundId, this.clock.now());
  }

  /**
   * Called when the server sees the player's event stream close. Under `cashout-at-disconnect` the round
   * is cashed out at the detection time if it hasn't crashed and the value meets the minimum.
   */
  async disconnect(sessionId: string, roundId: string): Promise<Settlement | null> {
    const now = this.clock.now();
    const round = await this.requireRound(sessionId, roundId);
    if (round.settlement || round.disconnectPolicy !== 'cashout-at-disconnect') return round.settlement;
    if (isSplitRound(round)) {
      const due = settlementDue(round, now);
      if (due) return this.finalize(round, due);
      const time = Math.max(0, (now - round.startedAt) / 1000);
      if (multiplierAtRound(round, time) < (round.minCashout ?? 0)) return null;
      return this.finalize(round, paperSettlementAt(round, time, 'disconnect'));
    }
    const judged = judgeCashout(round, now);
    if (judged.kind === 'below_min_cashout') return null;
    if (judged.kind !== 'won') return this.finalize(round, judged.settlement);
    return this.finalize(round, { ...judged.settlement, reason: 'disconnect' });
  }

  async getRound(sessionId: string, roundId: string): Promise<RoundSnapshot> {
    const round = await this.requireRound(sessionId, roundId);
    const due = settlementDue(round, this.clock.now());
    if (due && !round.settlement) round.settlement = await this.finalize(round, due);
    return snapshot(round, this.clock.now());
  }

  /** The player's recent rounds, newest first (in-game history; at most 50). */
  async history(sessionId: string, limit = 20): Promise<RoundSummary[]> {
    const session = await this.requireSession(sessionId);
    const ids = await this.store.listPlayerRounds(playerOf(session), { limit: Math.min(this.historySize, Math.max(1, limit)) });
    return this.summaries(ids);
  }

  /** Operator recall: a player's rounds in a time range, newest first, paginated by offset. */
  async playerRounds(playerId: string, query: { fromMs?: number; toMs?: number; offset?: number; limit: number }): Promise<RoundSummary[]> {
    return this.summaries(await this.store.listPlayerRounds(playerId, query));
  }

  private async summaries(ids: string[]): Promise<RoundSummary[]> {
    const out: RoundSummary[] = [];
    for (const id of ids) {
      const round = await this.store.getRound(id);
      if (!round) continue;
      const due = round.settlement ? null : settlementDue(round, this.clock.now());
      if (due) round.settlement = await this.finalize(round, due);
      out.push(snapshot((await this.store.getRound(id)) ?? round, this.clock.now()));
    }
    return out;
  }

  /** Operator control: block new rounds for a game, config id or profile. */
  async setKillSwitch(key: string, enabled: boolean): Promise<string[]> {
    if (!/^(game|config|profile):[\w./+-]+$/.test(key)) throw new Error(`Invalid kill switch key: ${key}`);
    await this.store.setKillSwitch(key, enabled);
    await this.audit.append('kill_switch_changed', { key, enabled });
    return this.store.getKillSwitches();
  }

  /** Blocks or unblocks new rounds after an integrity check result (cleared only by an admin). */
  async setIntegrityBlocked(blocked: boolean, detail: Record<string, unknown> = {}): Promise<void> {
    await this.store.setKillSwitch(INTEGRITY_BLOCK, blocked);
    await this.audit.append('integrity_check', { blocked, ...detail });
  }

  async isIntegrityBlocked(): Promise<boolean> {
    return (await this.store.getKillSwitches()).includes(INTEGRITY_BLOCK);
  }

  async setClientSeed(sessionId: string, clientSeed: string): Promise<SessionInfo> {
    if (!CLIENT_SEED_RE.test(clientSeed)) {
      throw new HostError('invalid_client_seed', 'Client seed must be 1-64 printable characters');
    }
    await this.requireIdle(sessionId);
    await this.store.updateSession(sessionId, { clientSeed });
    const updated = await this.requireSession(sessionId);
    await this.audit.append('seed_committed', { sessionId, commit: updated.commit, clientSeed, nonce: updated.nonce });
    return this.sessionInfo(sessionId);
  }

  async rotateSeed(sessionId: string): Promise<SeedRotation> {
    await this.requireIdle(sessionId);
    const previous = await this.requireSession(sessionId);
    const revealed = await this.rotate(previous, false);
    return {
      previousServerSeed: revealed.serverSeed,
      previousCommit: revealed.commit,
      previousClientSeed: revealed.clientSeed,
      roundsPlayed: revealed.roundsPlayed,
      session: await this.sessionInfo(sessionId),
    };
  }

  /** Seeds revealed by manual or automatic rotation, newest first. */
  async revealedSeeds(sessionId: string): Promise<RevealedSeed[]> {
    return (await this.requireSession(sessionId)).revealedSeeds ?? [];
  }

  private seedRotationDue(session: SessionRecord): boolean {
    const age = this.clock.now() - (session.seedCreatedAt ?? session.createdAt);
    return session.nonce >= this.maxSeedRounds || age >= this.maxSeedAgeMs;
  }

  /** Reveals the current seed and commits a new one. The caller ensures no round is running. */
  private async rotate(previous: SessionRecord, auto: boolean): Promise<RevealedSeed> {
    const revealed: RevealedSeed = {
      serverSeed: await this.cipher.decrypt(previous.serverSeed),
      commit: previous.commit,
      clientSeed: previous.clientSeed,
      roundsPlayed: previous.nonce,
      revealedAt: this.clock.now(),
      auto,
    };
    const serverSeed = generateServerSeed();
    await this.store.updateSession(previous.id, {
      serverSeed: await this.cipher.encrypt(serverSeed),
      commit: commitServerSeed(serverSeed, this.crypto),
      seedCreatedAt: this.clock.now(),
      revealedSeeds: [revealed, ...(previous.revealedSeeds ?? [])].slice(0, 20),
      resetNonce: true,
    });
    await this.audit.append('seed_revealed', { sessionId: previous.id, commit: revealed.commit, roundsPlayed: revealed.roundsPlayed, auto });
    const updated = await this.store.getSession(previous.id);
    await this.audit.append('seed_committed', { sessionId: previous.id, commit: updated?.commit ?? null, clientSeed: previous.clientSeed });
    return revealed;
  }

  /**
   * Streams a round's events in server time: START, setbacks as they happen, then CASHED_OUT or CRASH.
   * Setbacks that already happened are sent right after START, so reconnecting clients catch up.
   */
  streamRound(sessionId: string, roundId: string, emit: (event: RoundEvent) => void): StreamHandle {
    let stopped = false;
    const done = (async () => {
      let round = await this.requireRound(sessionId, roundId);
      emit(startEvent(round, this.clock.now()));
      if (round.settlement?.status === 'void') {
        // Voided rounds may have unreadable outcome data; report the refund and stop.
        emit(terminalEvent(round, round.settlement, await this.store.getBalance(sessionId)));
        return;
      }
      let scheduled = scheduledSettlement(round);
      // All setbacks the round could reach; each is sent when its time passes, or at the terminal event.
      const horizon = Math.min(round.outcome.crashTime, round.config.tMax);
      const pending: (SetbackEvent | BoostEvent)[] = [
        ...round.outcome.setbacks
          .filter((t) => t < horizon)
          .map((time) => ({ type: 'SETBACK' as const, roundId: round.id, time, factor: round.config.setbackFactor })),
        ...(round.outcome.boosts ?? [])
          .filter((t) => t < horizon)
          .map((time) => ({ type: 'BOOST' as const, roundId: round.id, time, factor: round.config.boostFactor })),
      ].sort((a, b) => a.time - b.time || a.factor - b.factor);

      // Throws already made (e.g. before a reconnect) are replayed, later ones are sent as they are stored.
      let sentSettledParts = 0;
      const emitSettledParts = async (throws: readonly PartEntry[]) => {
        if (sentSettledParts >= throws.length) return;
        const balanceMinor = await this.store.getBalance(sessionId);
        let thrown = throws.slice(0, sentSettledParts).reduce((n, t) => n + t.parts, 0);
        for (const t of throws.slice(sentSettledParts)) {
          thrown += t.parts;
          const event: PartSettledEvent = {
            type: 'PART_SETTLED',
            roundId: round.id,
            partId: t.partId,
            parts: t.parts,
            reason: t.reason,
            time: t.time,
            multiplier: t.multiplier,
            exactMinor: t.exactMinor,
            creditedMinor: t.creditedMinor,
            remaining: stakePartCount(round) - thrown,
            balanceMinor,
          };
          emit(event);
        }
        sentSettledParts = throws.length;
      };

      while (!stopped) {
        const now = this.clock.now();
        const elapsed = (now - round.startedAt) / 1000;
        if (isSplitRound(round)) await emitSettledParts(round.settledParts ?? []);

        const settled = round.settlement ?? settlementDue(round, now);
        if (settled) {
          const stored = round.settlement ?? (await this.finalize(round, settled));
          if (isSplitRound(round)) {
            // Player throws not yet sent; the automatic final settlement entry is part of the terminal event.
            const manual = ((stored.cashouts as PartEntry[] | undefined) ?? round.settledParts ?? []).filter((t) => t.reason === 'manual');
            await emitSettledParts(manual);
          }
          const unsent = new Set(pending.map((p) => p.time));
          for (const e of modifierEvents(round, stored)) if (unsent.has(e.time)) emit(e);
          emit(terminalEvent(round, stored, await this.store.getBalance(sessionId)));
          return;
        }

        while (pending.length && pending[0]!.time <= elapsed) emit(pending.shift()!);

        const nextAt = Math.min(pending[0]?.time ?? Infinity, scheduled.time);
        const waitMs = Math.max(0, Math.min(this.pollMs, Math.ceil((nextAt - elapsed) * 1000)));
        await this.sleep(waitMs);
        if (stopped) return;
        // An open stream is a sign of life for the disconnect policy.
        if (round.disconnectPolicy === 'cashout-at-disconnect') await this.store.setHeartbeat(roundId, this.clock.now());
        // Pick up a manual cash-out stored by another request.
        const fresh = await this.store.getRound(roundId);
        if (fresh) {
          round = fresh;
          // Heartbeats move the disconnect backstop, so the next wake-up time must be recomputed.
          if (!round.settlement) scheduled = scheduledSettlement(round);
        }
      }
    })();
    return {
      done,
      stop: () => {
        stopped = true;
      },
    };
  }

  private async requireSession(sessionId: string): Promise<SessionRecord> {
    const session = await this.store.getSession(sessionId);
    if (!session) throw new HostError('session_not_found', 'Unknown session');
    if ((session.game ?? 'whack-crash') !== this.game) throw new HostError('forbidden', 'Session belongs to another game');
    return session;
  }

  private async requireRound(sessionId: string, roundId: string): Promise<RoundRecord> {
    const round = await this.store.getRound(roundId);
    if (!round) throw new HostError('round_not_found', 'Unknown round');
    if (round.sessionId !== sessionId) throw new HostError('forbidden', 'Round belongs to another session');
    return round;
  }

  private async requireIdle(sessionId: string) {
    const session = await this.requireSession(sessionId);
    if (!(await this.settleActiveIfDue(playerOf(session)))) {
      throw new HostError('round_in_progress', 'Finish the current round first');
    }
  }

  /** Settles the player's active round if it has ended. Returns true when the player has no running round. */
  private async settleActiveIfDue(playerId: string): Promise<boolean> {
    const activeId = await this.store.getActiveRound(playerId);
    if (!activeId) return true;
    const round = await this.store.getRound(activeId);
    if (!round) {
      await this.store.releaseActiveRound(playerId, activeId);
      return true;
    }
    const due = settlementDue(round, this.clock.now());
    if (!due) return false;
    await this.finalize(round, due);
    return true;
  }

  /** Stores the settlement once, credits a win once, and releases the active slot. Returns the stored settlement. */
  private async finalize(round: RoundRecord, settlement: Settlement): Promise<Settlement> {
    let first: boolean;
    if (isSplitRound(round) && settlement.status !== 'void') {
      // A throw may land between computing this settlement and storing it; the store refuses stale ones,
      // so rebuild against the fresh throws and try again.
      let current = round;
      let candidate = settlement;
      first = await this.store.settleOnce(round.id, candidate, settledPartCount(current));
      for (let attempt = 0; !first && attempt < 5; attempt++) {
        const fresh = await this.store.getRound(round.id);
        if (!fresh || fresh.settlement) break;
        current = fresh;
        candidate = rebuildPaperSettlement(fresh, settlement);
        first = await this.store.settleOnce(round.id, candidate, settledPartCount(current));
      }
      if (first) {
        settlement = candidate;
        // Throws already credited their whole units; only the rounding top-up is left.
        const alreadyCredited = (current.settledParts ?? []).reduce((n, t) => n + t.creditedMinor, 0);
        const topUp = settlement.payoutMinor - alreadyCredited;
        if (topUp > 0) await this.store.creditOnce(round.sessionId, round.id, topUp);
      }
    } else {
      first = await this.store.settleOnce(round.id, settlement);
      if (first && settlement.status !== 'lost') await this.store.creditOnce(round.sessionId, round.id, settlement.payoutMinor);
    }
    if (first) {
      await this.store.addSessionTotals(round.sessionId, 0, settlement.status === 'lost' ? 0 : settlement.payoutMinor);
      await this.store.setRoundBalanceAfter(round.id, await this.store.getBalance(round.sessionId));
    }
    // Losses need no credit; settled-and-credited rounds leave the pending set.
    if (first) await this.store.removePending(round.id);
    if (first) {
      await this.audit.append('round_settled', {
        roundId: round.id,
        sessionId: round.sessionId,
        status: settlement.status,
        reason: settlement.reason,
        time: settlement.time,
        multiplier: settlement.multiplier,
        payoutMinor: settlement.payoutMinor,
        crashTime: settlement.crashTime,
      });
    }
    await this.store.releaseActiveRound(round.playerId ?? round.sessionId, round.id);
    if (first) {
      // Rotate right after the limit round settles, so the new commit is public before the next bet.
      const session = await this.store.getSession(round.sessionId);
      if (session && this.seedRotationDue(session) && !(await this.store.getActiveRound(playerOf(session)))) {
        await this.rotate(session, true);
      }
      return settlement;
    }
    const stored = await this.store.getRound(round.id);
    return stored?.settlement ?? settlement;
  }
}
