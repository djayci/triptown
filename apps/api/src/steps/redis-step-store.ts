import type { StepRoundRecord, StepRoundStore } from '@triptown/steps';
import { DEFAULT_RETENTION_DAYS, type RedisLike } from '../redis-store';

const DAY = 24 * 60 * 60;

// Compare-and-set on a separate version key: write the record and bump the version only if unchanged.
const CAS = `
local v = redis.call('GET', KEYS[2])
if not v or tonumber(v) ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
redis.call('SET', KEYS[2], tostring(tonumber(ARGV[1]) + 1), 'EX', tonumber(ARGV[3]))
return 1
`;

const CREATE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]))
redis.call('SET', KEYS[2], '0', 'EX', tonumber(ARGV[2]))
return 1
`;

/** Step round records in Redis. Each action is stored atomically with compare-and-set (design D4). */
export class RedisStepRoundStore implements StepRoundStore {
  private readonly ttl: number;

  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'wc:',
    retentionDays = DEFAULT_RETENTION_DAYS,
  ) {
    this.ttl = Math.round(retentionDays * DAY);
  }

  private keys(id: string) {
    return [`${this.prefix}step:round:${id}`, `${this.prefix}step:round:${id}:v`];
  }

  async createStepRound(round: StepRoundRecord) {
    const ok = await this.redis.eval(CREATE, this.keys(round.id), [JSON.stringify({ ...round, version: 0 }), String(this.ttl)]);
    return Number(ok) === 1;
  }

  async getStepRound(id: string) {
    const [raw, v] = await this.redis.mget(this.keys(id));
    if (!raw) return null;
    const round = JSON.parse(raw) as StepRoundRecord;
    return { ...round, version: Number(v ?? round.version) };
  }

  async applyStepRound(next: StepRoundRecord, expectedVersion: number) {
    const stored = { ...next, version: expectedVersion + 1 };
    const ok = await this.redis.eval(CAS, this.keys(next.id), [String(expectedVersion), JSON.stringify(stored), String(this.ttl)]);
    return Number(ok) === 1 ? stored : null;
  }
}
