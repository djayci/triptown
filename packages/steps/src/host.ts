// Server-side step rounds over core's session, wallet and pacing store (design D4). Every money path is
// once-only: settlement is stored with compare-and-set, credit uses creditOnce per round.
import {
  DEFAULT_CURRENCY,
  nullAuditSink,
  passThroughCipher,
  profileFromTemplate,
  validateBet,
  type AuditSink,
  type CurrencyRules,
  type JurisdictionProfile,
  type RevealedSeed,
  type RoundStore,
  type SeedCipher,
  type SessionRecord,
} from '@triptown/core';
import { commitServerSeed, generateClientSeed, generateServerSeed, type CryptoProvider } from '@triptown/fairness';
import { DIFFICULTIES, STEP_CONFIGS, assertValidStepConfig, type Difficulty, type StepConfig } from './config';
import {
  createStepRound,
  judgeCollect,
  judgeJump,
  settleIfAbandoned,
  snapshotOf,
  type StepAction,
  type StepJudgement,
  type StepRoundRecord,
  type StepRoundSnapshot,
} from './round';
import type { StepRoundStore } from './store';

export type StepErrorCode =
  | 'session_not_found'
  | 'round_not_found'
  | 'forbidden'
  | 'insufficient_funds'
  | 'bet_limit'
  | 'invalid_bet'
  | 'invalid_difficulty'
  | 'invalid_action_key'
  | 'round_in_progress'
  | 'round_not_running'
  | 'nothing_to_collect'
  | 'invalid_client_seed'
  | 'game_disabled'
  | 'cycle_too_soon'
  | 'integrity_blocked'
  | 'conflict';

export class StepError extends Error {
  constructor(
    readonly code: StepErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'StepError';
  }
}

export const STEP_GAME = 'night-gallop';
export const DEFAULT_ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;
const INTEGRITY_BLOCK = 'integrity:blocked';
const CLIENT_SEED_RE = /^[\x20-\x7e]{1,64}$/;
const ACTION_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface StepSessionInfo {
  sessionId: string;
  sessionStartedAt: number;
  stakedMinor: number;
  returnedMinor: number;
  balanceMinor: number;
  currency: CurrencyRules;
  commit: string;
  clientSeed: string;
  nonce: number;
  profile: JurisdictionProfile;
  configs: readonly StepConfig[];
  abandonAfterMs: number;
}

export interface StepResult {
  round: StepRoundSnapshot;
  balanceMinor: number;
  /** The recorded action (jump or collect); absent for starts and abandoned settlements. */
  action?: StepAction;
}

export interface StepSeedRotation {
  previousServerSeed: string;
  previousCommit: string;
  previousClientSeed: string;
  roundsPlayed: number;
  session: StepSessionInfo;
}

export interface StepHostOptions {
  store: RoundStore;
  steps: StepRoundStore;
  clock: { now(): number };
  profiles?: { defaultProfile: JurisdictionProfile; allowOverride?: boolean; operators?: Readonly<Record<string, JurisdictionProfile>> };
  currency?: CurrencyRules;
  seedCipher?: SeedCipher;
  audit?: AuditSink;
  crypto?: CryptoProvider;
  newId?: () => string;
  abandonAfterMs?: number;
  seedRotation?: { maxRounds?: number; maxAgeMs?: number };
}

const playerOf = (session: SessionRecord) => session.playerId ?? session.id;

export class StepHost {
  readonly currency: CurrencyRules;
  private readonly store: RoundStore;
  private readonly steps: StepRoundStore;
  private readonly clock: { now(): number };
  private readonly profiles: NonNullable<StepHostOptions['profiles']>;
  private readonly cipher: SeedCipher;
  private readonly audit: AuditSink;
  private readonly crypto: CryptoProvider | undefined;
  private readonly newId: () => string;
  private readonly abandonAfterMs: number;
  private readonly maxSeedRounds: number;
  private readonly maxSeedAgeMs: number;

  constructor(opts: StepHostOptions) {
    for (const d of DIFFICULTIES) assertValidStepConfig(STEP_CONFIGS[d]);
    this.store = opts.store;
    this.steps = opts.steps;
    this.clock = opts.clock;
    this.profiles = opts.profiles ?? { defaultProfile: profileFromTemplate('regulated-uk') };
    this.currency = opts.currency ?? DEFAULT_CURRENCY;
    this.cipher = opts.seedCipher ?? passThroughCipher;
    this.audit = opts.audit ?? nullAuditSink;
    this.crypto = opts.crypto;
    this.newId = opts.newId ?? (() => generateServerSeed().slice(0, 24));
    this.abandonAfterMs = opts.abandonAfterMs ?? DEFAULT_ABANDON_AFTER_MS;
    this.maxSeedRounds = opts.seedRotation?.maxRounds ?? 1_000;
    this.maxSeedAgeMs = opts.seedRotation?.maxAgeMs ?? 24 * 60 * 60 * 1000;
  }

  now() {
    return this.clock.now();
  }

  // ---------- sessions and seeds ----------

  async createSession(
    initialBalanceMinor: number,
    opts: { clientSeed?: string; playerId?: string; operatorId?: string; profile?: string; clientVersion?: string } = {},
  ): Promise<StepSessionInfo> {
    const profile = this.resolveProfile(opts);
    const clientSeed = opts.clientSeed ?? generateClientSeed();
    if (!CLIENT_SEED_RE.test(clientSeed)) throw new StepError('invalid_client_seed', 'Client seed must be 1-64 printable characters');
    const serverSeed = generateServerSeed();
    const id = this.newId();
    const now = this.clock.now();
    const session: SessionRecord = {
      id,
      playerId: opts.operatorId && opts.playerId ? `${opts.operatorId}:${opts.playerId}` : (opts.playerId ?? id),
      clientVersion: typeof opts.clientVersion === 'string' ? opts.clientVersion.slice(0, 40) : null,
      currency: this.currency.code,
      serverSeed: await this.cipher.encrypt(serverSeed),
      seedCreatedAt: now,
      revealedSeeds: [],
      commit: commitServerSeed(serverSeed, this.crypto),
      clientSeed,
      nonce: 0,
      createdAt: now,
      profile,
      game: STEP_GAME,
    };
    await this.store.createSession(session, initialBalanceMinor);
    await this.audit.append('session_created', { sessionId: id, playerId: session.playerId, profile: profile.name, game: STEP_GAME, balanceMinor: initialBalanceMinor });
    await this.audit.append('seed_committed', { sessionId: id, commit: session.commit, clientSeed });
    return this.sessionInfo(id);
  }

  async sessionInfo(sessionId: string): Promise<StepSessionInfo> {
    const session = await this.requireSession(sessionId);
    await this.settleActiveIfAbandoned(playerOf(session));
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
      profile: this.profileOf(session),
      configs: DIFFICULTIES.map((d) => STEP_CONFIGS[d]),
      abandonAfterMs: this.abandonAfterMs,
    };
  }

  async setClientSeed(sessionId: string, clientSeed: string): Promise<StepSessionInfo> {
    if (!CLIENT_SEED_RE.test(clientSeed)) throw new StepError('invalid_client_seed', 'Client seed must be 1-64 printable characters');
    await this.requireIdle(sessionId);
    await this.store.updateSession(sessionId, { clientSeed });
    const s = await this.requireSession(sessionId);
    await this.audit.append('seed_committed', { sessionId, commit: s.commit, clientSeed, nonce: s.nonce });
    return this.sessionInfo(sessionId);
  }

  async rotateSeed(sessionId: string): Promise<StepSeedRotation> {
    await this.requireIdle(sessionId);
    const revealed = await this.rotate(await this.requireSession(sessionId), false);
    return {
      previousServerSeed: revealed.serverSeed,
      previousCommit: revealed.commit,
      previousClientSeed: revealed.clientSeed,
      roundsPlayed: revealed.roundsPlayed,
      session: await this.sessionInfo(sessionId),
    };
  }

  async revealedSeeds(sessionId: string): Promise<RevealedSeed[]> {
    return (await this.requireSession(sessionId)).revealedSeeds ?? [];
  }

  // ---------- rounds ----------

  async startRound(sessionId: string, input: { stakeMinor: number; difficulty: Difficulty }): Promise<StepResult> {
    let session = await this.requireSession(sessionId);
    const profile = this.profileOf(session);
    if (!DIFFICULTIES.includes(input.difficulty)) throw new StepError('invalid_difficulty', 'Unknown difficulty');
    const config = STEP_CONFIGS[input.difficulty];
    const bet = validateBet(input.stakeMinor, this.currency);
    if (!bet.ok) throw new StepError(bet.code, bet.message);
    const kills = await this.store.getKillSwitches();
    const disabledBy = [`game:${STEP_GAME}`, `config:${config.id}`, `profile:${profile.name}`].find((k) => kills.includes(k));
    if (disabledBy) throw new StepError('game_disabled', `New rounds are disabled (${disabledBy})`);
    if (kills.includes(INTEGRITY_BLOCK)) throw new StepError('integrity_blocked', 'New rounds are paused pending a software integrity review');

    const playerId = playerOf(session);
    await this.settleActiveIfAbandoned(playerId);
    const roundId = this.newId();
    const claim = await this.store.claimRoundStart(playerId, roundId, this.clock.now(), profile.minCycleMs);
    if (!claim.ok) {
      if (claim.reason === 'too_soon') throw new StepError('cycle_too_soon', 'Please wait before starting the next round', { retryAfterMs: claim.retryAfterMs });
      throw new StepError('round_in_progress', 'Finish the current round first');
    }
    const debit = await this.store.debit(sessionId, input.stakeMinor);
    if (!debit.ok) {
      await this.store.releaseActiveRound(playerId, roundId, claim.previousStartAt);
      throw new StepError('insufficient_funds', 'Balance is too low for this bet');
    }
    if (this.seedRotationDue(session)) {
      await this.rotate(session, true);
      session = await this.requireSession(sessionId);
    }
    const startedAt = this.clock.now();
    try {
      await this.store.addPending(roundId);
      const nonce = await this.store.takeNonce(sessionId);
      const serverSeed = await this.cipher.decrypt(session.serverSeed);
      const derived = createStepRound({
        id: roundId,
        sessionId,
        playerId,
        stakeMinor: input.stakeMinor,
        currency: this.currency.code,
        config,
        seeds: { serverSeed, clientSeed: session.clientSeed, nonce },
        commit: session.commit,
        startedAt,
        abandonAfterMs: this.abandonAfterMs,
        profileName: profile.name,
        balanceBeforeMinor: debit.balanceMinor + input.stakeMinor,
        ...(this.crypto && { crypto: this.crypto }),
      });
      // Only the ciphertext is persisted; the outcome is already derived.
      const round: StepRoundRecord = { ...derived, seeds: { ...derived.seeds, serverSeed: session.serverSeed } };
      await this.steps.createStepRound(round);
      await this.store.indexPlayerRound(playerId, roundId, startedAt);
      await this.store.addSessionTotals(sessionId, input.stakeMinor, 0);
      await this.audit.append('round_started', {
        roundId, sessionId, playerId, game: STEP_GAME, configId: config.id, profile: profile.name, betMinor: input.stakeMinor,
        commit: session.commit, clientSeed: session.clientSeed, nonce, startedAt, balanceAfterDebitMinor: debit.balanceMinor,
      });
      return { round: snapshotOf(round), balanceMinor: debit.balanceMinor };
    } catch (err) {
      // The stake is refunded if the round could not be recorded.
      await this.store.creditOnce(sessionId, roundId, input.stakeMinor);
      await this.store.removePending(roundId);
      await this.store.releaseActiveRound(playerId, roundId, claim.previousStartAt);
      await this.audit.append('round_voided', { roundId, sessionId, reason: err instanceof Error ? err.message : String(err), refundMinor: input.stakeMinor });
      throw err;
    }
  }

  jump(sessionId: string, roundId: string, key: string): Promise<StepResult> {
    return this.act(sessionId, roundId, key, judgeJump);
  }

  collect(sessionId: string, roundId: string, key: string): Promise<StepResult> {
    return this.act(sessionId, roundId, key, judgeCollect);
  }

  async getRound(sessionId: string, roundId: string): Promise<StepRoundSnapshot> {
    const round = await this.requireRound(sessionId, roundId);
    return snapshotOf(await this.settleAbandoned(round));
  }

  async activeRound(sessionId: string): Promise<StepRoundSnapshot | null> {
    const session = await this.requireSession(sessionId);
    await this.settleActiveIfAbandoned(playerOf(session));
    const id = await this.store.getActiveRound(playerOf(session));
    if (!id) return null;
    const round = await this.steps.getStepRound(id);
    return round && round.status === 'running' ? snapshotOf(round) : null;
  }

  async history(sessionId: string, limit = 50): Promise<StepRoundSnapshot[]> {
    const session = await this.requireSession(sessionId);
    const ids = await this.store.listPlayerRounds(playerOf(session), { limit: Math.max(1, Math.min(50, limit)) });
    const out: StepRoundSnapshot[] = [];
    for (const id of ids) {
      const r = await this.steps.getStepRound(id);
      if (r) out.push(snapshotOf(await this.settleAbandoned(r)));
    }
    return out;
  }

  /** Settles abandoned rounds among the pending set; run from a cron (design D5). */
  async sweepAbandoned(limit = 200): Promise<number> {
    let settled = 0;
    for (const id of await this.store.listPending(limit)) {
      const r = await this.steps.getStepRound(id);
      if (!r) continue;
      const after = await this.settleAbandoned(r);
      if (after.status !== 'running' && r.status === 'running') settled++;
      else if (after.status !== 'running') await this.finishSettlement(after);
    }
    return settled;
  }

  // ---------- internals ----------

  private async act(
    sessionId: string,
    roundId: string,
    key: string,
    judge: (round: StepRoundRecord, now: number, key: string) => StepJudgement,
  ): Promise<StepResult> {
    if (!ACTION_KEY_RE.test(key)) throw new StepError('invalid_action_key', 'Action key must be 8-64 letters, digits, "-" or "_"');
    for (let attempt = 0; attempt < 3; attempt++) {
      const round = await this.requireRound(sessionId, roundId);
      const j = judge(round, this.clock.now(), key);
      if (j.kind === 'duplicate') return { round: snapshotOf(j.round), balanceMinor: await this.store.getBalance(sessionId), action: j.action };
      if (j.kind === 'not_running') throw new StepError('round_not_running', 'The round is already settled', { round: snapshotOf(j.round) });
      if (j.kind === 'nothing_to_collect') throw new StepError('nothing_to_collect', 'Clear a fence before collecting');
      const stored = await this.steps.applyStepRound(j.round, round.version);
      if (!stored) continue; // Another request changed the round first; judge again against the fresh record.
      if (stored.status !== 'running') await this.finishSettlement(stored);
      if (j.kind === 'abandoned') throw new StepError('round_not_running', 'The round was settled after no action', { round: snapshotOf(stored) });
      return { round: snapshotOf(stored), balanceMinor: await this.store.getBalance(sessionId), action: j.action };
    }
    throw new StepError('conflict', 'The round changed while processing; fetch it and try again');
  }

  private async settleAbandoned(round: StepRoundRecord): Promise<StepRoundRecord> {
    const settled = settleIfAbandoned(round, this.clock.now());
    if (!settled) return round;
    const stored = await this.steps.applyStepRound(settled, round.version);
    if (!stored) return (await this.steps.getStepRound(round.id)) ?? round;
    await this.finishSettlement(stored);
    return stored;
  }

  private async settleActiveIfAbandoned(playerId: string) {
    const id = await this.store.getActiveRound(playerId);
    if (!id) return;
    const r = await this.steps.getStepRound(id);
    if (!r) return;
    const after = await this.settleAbandoned(r);
    // A settled round whose follow-up was interrupted still holds the slot; finish it again (idempotent).
    if (after.status !== 'running') await this.finishSettlement(after);
  }

  /** Credit once, totals, release the player slot, drop from pending. Safe to repeat. */
  private async finishSettlement(round: StepRoundRecord) {
    const s = round.settlement;
    if (!s) return;
    if (s.payoutMinor > 0 && (await this.store.creditOnce(round.sessionId, round.id, s.payoutMinor))) {
      await this.store.addSessionTotals(round.sessionId, s.status === 'void' ? -round.stakeMinor : 0, s.status === 'void' ? 0 : s.payoutMinor);
      await this.audit.append(s.status === 'void' ? 'round_voided' : 'round_settled', {
        roundId: round.id, sessionId: round.sessionId, status: s.status, reason: s.reason, cleared: s.cleared, multiplier: s.multiplier, payoutMinor: s.payoutMinor,
      });
    } else if (s.payoutMinor === 0 && (await this.store.creditOnce(round.sessionId, round.id, 0))) {
      await this.audit.append('round_settled', { roundId: round.id, sessionId: round.sessionId, status: s.status, reason: s.reason, cleared: s.cleared, payoutMinor: 0 });
    }
    await this.store.setRoundBalanceAfter(round.id, await this.store.getBalance(round.sessionId));
    await this.store.releaseActiveRound(round.playerId, round.id);
    await this.store.removePending(round.id);
  }

  private resolveProfile(opts: { profile?: string; operatorId?: string }): JurisdictionProfile {
    const { defaultProfile, operators = {}, allowOverride } = this.profiles;
    if (opts.profile) {
      if (!allowOverride) throw new StepError('forbidden', 'Profile override is disabled');
      return profileFromTemplate(opts.profile, defaultProfile.operatorOrigins);
    }
    if (opts.operatorId) {
      const p = operators[opts.operatorId];
      if (!p) throw new StepError('forbidden', 'Unknown operator');
      return p;
    }
    return defaultProfile;
  }

  private profileOf(session: SessionRecord): JurisdictionProfile {
    return session.profile ?? this.profiles.defaultProfile;
  }

  private async requireSession(id: string): Promise<SessionRecord> {
    const s = await this.store.getSession(id);
    if (!s) throw new StepError('session_not_found', 'Session not found');
    return s;
  }

  private async requireRound(sessionId: string, roundId: string): Promise<StepRoundRecord> {
    const r = await this.steps.getStepRound(roundId);
    if (!r) throw new StepError('round_not_found', 'Round not found');
    if (r.sessionId !== sessionId) throw new StepError('forbidden', 'Round belongs to another session');
    return r;
  }

  private async requireIdle(sessionId: string) {
    const session = await this.requireSession(sessionId);
    await this.settleActiveIfAbandoned(playerOf(session));
    if (await this.activeRound(sessionId)) throw new StepError('round_in_progress', 'Finish the current round first');
  }

  private seedRotationDue(session: SessionRecord): boolean {
    const age = this.clock.now() - (session.seedCreatedAt ?? session.createdAt);
    return session.nonce >= this.maxSeedRounds || age >= this.maxSeedAgeMs;
  }

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
    return revealed;
  }
}
