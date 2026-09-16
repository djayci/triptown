import type { ClaimResult, RecordThrowResult, RoundRecord, RoundStore, SessionRecord, Settlement, ThrowEntry } from '@triptown/core';

/** The handful of Redis commands the store needs, so Upstash (REST) and test clients can both back it. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  mget(keys: string[]): Promise<(string | null)[]>;
  /** Returns true when the value was written. */
  set(key: string, value: string, opts?: { nx?: boolean; exSeconds?: number }): Promise<boolean>;
  incr(key: string): Promise<number>;
  incrby(key: string, amount: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  /** Server time in epoch ms (Redis TIME). */
  time(): Promise<number>;
}

const DAY = 24 * 60 * 60;
const SESSION_TTL = 30 * DAY;
/** Round records are kept 5 years by default (game-recall retention); set per deployment. */
export const DEFAULT_RETENTION_DAYS = 1825;

// Atomic check-and-decrement: returns {1, newBalance} or {0, balance}.
const DEBIT = `
local b = tonumber(redis.call('GET', KEYS[1]) or '0')
local a = tonumber(ARGV[1])
if b < a then return {0, b} end
return {1, redis.call('DECRBY', KEYS[1], a)}
`;

// Claim the player's active slot and pacing clock together: {1, previousStart|-1}, {0, 0} in progress, {2, waitMs} too soon.
const CLAIM = `
if redis.call('EXISTS', KEYS[1]) == 1 then return {0, 0} end
local last = redis.call('GET', KEYS[2])
if last then
  local wait = tonumber(last) + tonumber(ARGV[3]) - tonumber(ARGV[2])
  if wait > 0 then return {2, wait} end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', 3600)
redis.call('SET', KEYS[2], ARGV[2], 'EX', 86400)
if last then return {1, tonumber(last)} end
return {1, -1}
`;

// Deletes the active-round key only if it still points at this round; optionally restores the pacing clock.
const RELEASE = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
if ARGV[2] == 'clear' then redis.call('DEL', KEYS[2])
elseif ARGV[2] ~= 'keep' then redis.call('SET', KEYS[2], ARGV[2], 'EX', 86400) end
return 1
`;

// Credit a round's payout or refund exactly once: marks the round then increments the balance atomically.
const CREDIT_ONCE = `
if redis.call('SET', KEYS[1], '1', 'NX', 'EX', tonumber(ARGV[2])) then
  redis.call('INCRBY', KEYS[2], tonumber(ARGV[1]))
  return 1
end
return 0
`;

// Add a round to the player's index and drop entries past retention.
const INDEX_ROUND = `
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
`;

// Newest first within [from, to], offset + limit.
const LIST_ROUNDS = `
return redis.call('ZREVRANGEBYSCORE', KEYS[1], ARGV[2], ARGV[1], 'LIMIT', tonumber(ARGV[3]), tonumber(ARGV[4]))
`;

// Paper throw, atomically: refuse if settled, return the index of a repeated throw id, refuse if the bag is
// full, otherwise append the entry and credit the whole minor units newly earned by the running exact total.
// KEYS: settle, throws, throw credits, throw ids, thrown papers, exact total, credited total, balance.
// Returns {1, credit, thrownPapers, balance} | {0} settled | {2, index} duplicate | {3} full.
const RECORD_THROW = `
if redis.call('EXISTS', KEYS[1]) == 1 then return {0} end
local idx = redis.call('HGET', KEYS[4], ARGV[1])
if idx then return {2, tonumber(idx)} end
local thrown = tonumber(redis.call('GET', KEYS[5]) or '0')
local count = tonumber(ARGV[3])
if thrown + count > tonumber(ARGV[4]) then return {3} end
local exact = tonumber(redis.call('GET', KEYS[6]) or '0') + tonumber(ARGV[5])
local credited = tonumber(redis.call('GET', KEYS[7]) or '0')
local credit = math.floor(exact + 0.0000001) - credited
if credit < 0 then credit = 0 end
local ttl = tonumber(ARGV[6])
local n = redis.call('RPUSH', KEYS[2], ARGV[2])
redis.call('RPUSH', KEYS[3], tostring(credit))
redis.call('HSET', KEYS[4], ARGV[1], tostring(n - 1))
redis.call('SET', KEYS[5], tostring(thrown + count), 'EX', ttl)
redis.call('SET', KEYS[6], string.format('%.17g', exact), 'EX', ttl)
redis.call('SET', KEYS[7], tostring(credited + credit), 'EX', ttl)
for i = 2, 4 do redis.call('EXPIRE', KEYS[i], ttl) end
local balance = redis.call('INCRBY', KEYS[8], credit)
return {1, credit, thrown + count, balance}
`;

const READ_THROWS = `
return {redis.call('LRANGE', KEYS[1], 0, -1), redis.call('LRANGE', KEYS[2], 0, -1)}
`;

// Settle a paper round only if it was computed from the papers thrown so far.
const SETTLE_IF_THROWN = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
if tonumber(redis.call('GET', KEYS[2]) or '0') ~= tonumber(ARGV[2]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[3]))
return 1
`;

type StoredSession = Omit<SessionRecord, 'nonce'>;

export class RedisRoundStore implements RoundStore {
  private readonly roundTtl: number;

  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'wc:',
    retentionDays = DEFAULT_RETENTION_DAYS,
  ) {
    this.roundTtl = Math.max(1, Math.floor(retentionDays)) * DAY;
  }

  private k = {
    session: (id: string) => `${this.prefix}s:${id}`,
    nonce: (id: string) => `${this.prefix}s:${id}:nonce`,
    balance: (id: string) => `${this.prefix}s:${id}:bal`,
    active: (playerId: string) => `${this.prefix}p:${playerId}:active`,
    lastStart: (playerId: string) => `${this.prefix}p:${playerId}:lastStart`,
    playerRounds: (playerId: string) => `${this.prefix}p:${playerId}:rounds`,
    staked: (id: string) => `${this.prefix}s:${id}:staked`,
    returned: (id: string) => `${this.prefix}s:${id}:returned`,
    balanceAfter: (id: string) => `${this.prefix}r:${id}:after`,
    round: (id: string) => `${this.prefix}r:${id}`,
    settlement: (id: string) => `${this.prefix}r:${id}:settle`,
    credited: (id: string) => `${this.prefix}r:${id}:credited`,
    heartbeat: (id: string) => `${this.prefix}r:${id}:hb`,
    throws: (id: string) => `${this.prefix}r:${id}:throws`,
    throwCredits: (id: string) => `${this.prefix}r:${id}:tcred`,
    throwIds: (id: string) => `${this.prefix}r:${id}:tids`,
    thrownPapers: (id: string) => `${this.prefix}r:${id}:tpapers`,
    throwExact: (id: string) => `${this.prefix}r:${id}:texact`,
    throwCredited: (id: string) => `${this.prefix}r:${id}:tcredited`,
    pending: () => `${this.prefix}pending`,
  };

  async createSession(session: SessionRecord, balanceMinor: number) {
    const { nonce, ...rest } = session;
    await this.redis.set(this.k.session(session.id), JSON.stringify(rest), { exSeconds: SESSION_TTL });
    await this.redis.set(this.k.nonce(session.id), String(nonce), { exSeconds: SESSION_TTL });
    await this.redis.set(this.k.balance(session.id), String(balanceMinor), { exSeconds: SESSION_TTL });
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const [raw, nonce] = await this.redis.mget([this.k.session(id), this.k.nonce(id)]);
    if (!raw) return null;
    return { ...(JSON.parse(raw) as StoredSession), nonce: Number(nonce ?? 0) };
  }

  async updateSession(
    id: string,
    patch: Partial<Pick<SessionRecord, 'serverSeed' | 'commit' | 'clientSeed' | 'seedCreatedAt' | 'revealedSeeds'>> & { resetNonce?: boolean },
  ) {
    const raw = await this.redis.get(this.k.session(id));
    if (!raw) return;
    const { resetNonce, ...fields } = patch;
    await this.redis.set(this.k.session(id), JSON.stringify({ ...(JSON.parse(raw) as StoredSession), ...fields }), { exSeconds: SESSION_TTL });
    if (resetNonce) await this.redis.set(this.k.nonce(id), '0', { exSeconds: SESSION_TTL });
  }

  async takeNonce(sessionId: string) {
    return (await this.redis.incr(this.k.nonce(sessionId))) - 1;
  }

  async getBalance(sessionId: string) {
    return Number((await this.redis.get(this.k.balance(sessionId))) ?? 0);
  }

  async debit(sessionId: string, amountMinor: number) {
    const [ok, balance] = (await this.redis.eval(DEBIT, [this.k.balance(sessionId)], [String(amountMinor)])) as [number, number];
    return { ok: Number(ok) === 1, balanceMinor: Number(balance) };
  }

  async credit(sessionId: string, amountMinor: number) {
    return this.redis.incrby(this.k.balance(sessionId), amountMinor);
  }

  async creditOnce(sessionId: string, roundId: string, amountMinor: number) {
    const ok = await this.redis.eval(CREDIT_ONCE, [this.k.credited(roundId), this.k.balance(sessionId)], [String(amountMinor), String(this.roundTtl)]);
    return Number(ok) === 1;
  }

  async addPending(roundId: string) {
    await this.redis.sadd(this.k.pending(), roundId);
  }

  async removePending(roundId: string) {
    await this.redis.srem(this.k.pending(), roundId);
  }

  async listPending(limit: number) {
    return (await this.redis.smembers(this.k.pending())).slice(0, limit);
  }

  async putRound(round: RoundRecord) {
    // Throws live in their own keys so they can be appended atomically.
    const { settlement, throws: _throws, ...rest } = round;
    await this.redis.set(this.k.round(round.id), JSON.stringify(rest), { exSeconds: this.roundTtl });
    if (settlement) await this.settleOnce(round.id, settlement);
  }

  async getRound(id: string): Promise<RoundRecord | null> {
    const [raw, settlement, heartbeat, after] = await this.redis.mget([
      this.k.round(id),
      this.k.settlement(id),
      this.k.heartbeat(id),
      this.k.balanceAfter(id),
    ]);
    if (!raw) return null;
    const round = JSON.parse(raw) as Omit<RoundRecord, 'settlement'>;
    const throws = (round.papers ?? 1) > 1 ? await this.readThrows(id) : undefined;
    return {
      ...round,
      ...(throws && { throws }),
      ...(after ? { balanceAfterMinor: Number(after) } : {}),
      ...(heartbeat ? { lastHeartbeatAt: Math.max(round.lastHeartbeatAt ?? 0, Number(heartbeat)) } : {}),
      settlement: settlement ? (JSON.parse(settlement) as Settlement) : null,
    };
  }

  async setHeartbeat(roundId: string, atMs: number) {
    await this.redis.set(this.k.heartbeat(roundId), String(atMs), { exSeconds: 3600 });
  }

  async settleOnce(roundId: string, settlement: Settlement, expectedThrownPapers?: number) {
    if (expectedThrownPapers === undefined) {
      return this.redis.set(this.k.settlement(roundId), JSON.stringify(settlement), { nx: true, exSeconds: this.roundTtl });
    }
    const ok = await this.redis.eval(
      SETTLE_IF_THROWN,
      [this.k.settlement(roundId), this.k.thrownPapers(roundId)],
      [JSON.stringify(settlement), String(expectedThrownPapers), String(this.roundTtl)],
    );
    return Number(ok) === 1;
  }

  private async readThrows(roundId: string): Promise<ThrowEntry[]> {
    const [entries, credits] = (await this.redis.eval(READ_THROWS, [this.k.throws(roundId), this.k.throwCredits(roundId)], [])) as [string[], string[]];
    return (entries ?? []).map((raw, i) => ({ ...(JSON.parse(raw) as Omit<ThrowEntry, 'creditedMinor'>), creditedMinor: Number(credits?.[i] ?? 0) }));
  }

  async recordThrow(sessionId: string, roundId: string, entry: Omit<ThrowEntry, 'creditedMinor'>, papers: number): Promise<RecordThrowResult> {
    const res = (await this.redis.eval(
      RECORD_THROW,
      [
        this.k.settlement(roundId),
        this.k.throws(roundId),
        this.k.throwCredits(roundId),
        this.k.throwIds(roundId),
        this.k.thrownPapers(roundId),
        this.k.throwExact(roundId),
        this.k.throwCredited(roundId),
        this.k.balance(sessionId),
      ],
      [entry.throwId, JSON.stringify(entry), String(entry.papers), String(papers), String(entry.exactMinor), String(this.roundTtl)],
    )) as number[];
    const code = Number(res[0]);
    if (code === 0) return { kind: 'settled' };
    if (code === 3) return { kind: 'full' };
    if (code === 2) {
      const existing = (await this.readThrows(roundId))[Number(res[1])];
      return existing ? { kind: 'duplicate', entry: existing } : { kind: 'settled' };
    }
    return { kind: 'recorded', entry: { ...entry, creditedMinor: Number(res[1]) }, thrownPapers: Number(res[2]), balanceMinor: Number(res[3]) };
  }

  async claimRoundStart(playerId: string, roundId: string, nowMs: number, minCycleMs: number): Promise<ClaimResult> {
    // The active key expires as a safety net; rounds are capped far below an hour.
    const [code, value] = (await this.redis.eval(
      CLAIM,
      [this.k.active(playerId), this.k.lastStart(playerId)],
      [roundId, String(nowMs), String(minCycleMs)],
    )) as [number, number];
    if (Number(code) === 0) return { ok: false, reason: 'in_progress' };
    if (Number(code) === 2) return { ok: false, reason: 'too_soon', retryAfterMs: Number(value) };
    return { ok: true, previousStartAt: Number(value) < 0 ? null : Number(value) };
  }

  async getActiveRound(playerId: string) {
    return this.redis.get(this.k.active(playerId));
  }

  async releaseActiveRound(playerId: string, roundId: string, restoreLastStartAt?: number | null) {
    const restore = restoreLastStartAt === undefined ? 'keep' : restoreLastStartAt === null ? 'clear' : String(restoreLastStartAt);
    await this.redis.eval(RELEASE, [this.k.active(playerId), this.k.lastStart(playerId)], [roundId, restore]);
  }

  async indexPlayerRound(playerId: string, roundId: string, startedAt: number) {
    await this.redis.eval(INDEX_ROUND, [this.k.playerRounds(playerId)], [roundId, String(startedAt), String(this.roundTtl), `(${startedAt - this.roundTtl * 1000}`]);
  }

  async listPlayerRounds(playerId: string, q: { fromMs?: number; toMs?: number; offset?: number; limit: number }) {
    const ids = (await this.redis.eval(
      LIST_ROUNDS,
      [this.k.playerRounds(playerId)],
      [q.fromMs === undefined ? '-inf' : String(q.fromMs), q.toMs === undefined ? '+inf' : String(q.toMs), String(q.offset ?? 0), String(q.limit)],
    )) as string[] | null;
    return ids ?? [];
  }

  async setRoundBalanceAfter(roundId: string, balanceMinor: number) {
    await this.redis.set(this.k.balanceAfter(roundId), String(balanceMinor), { exSeconds: this.roundTtl });
  }

  async addSessionTotals(sessionId: string, stakedMinor: number, returnedMinor: number) {
    if (stakedMinor) await this.redis.incrby(this.k.staked(sessionId), stakedMinor);
    if (returnedMinor) await this.redis.incrby(this.k.returned(sessionId), returnedMinor);
    await this.redis.expire(this.k.staked(sessionId), SESSION_TTL);
    await this.redis.expire(this.k.returned(sessionId), SESSION_TTL);
  }

  async getSessionTotals(sessionId: string) {
    const [staked, returned] = await this.redis.mget([this.k.staked(sessionId), this.k.returned(sessionId)]);
    return { stakedMinor: Number(staked ?? 0), returnedMinor: Number(returned ?? 0) };
  }

  async getKillSwitches() {
    const raw = await this.redis.get(`${this.prefix}kill`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  }

  async setKillSwitch(key: string, enabled: boolean) {
    // Rare admin action; last write wins is acceptable here.
    const current = new Set(await this.getKillSwitches());
    if (enabled) current.add(key);
    else current.delete(key);
    await this.redis.set(`${this.prefix}kill`, JSON.stringify([...current].sort()));
  }
}
