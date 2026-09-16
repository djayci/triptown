import { buildEntry, type AuditEntry, type AuditEventType, type AuditSink } from '@triptown/core';
import { nodeCrypto } from './node-crypto';
import type { RedisLike } from './redis-store';

// Writes an entry and advances the chain head only if the head is unchanged (compare-and-set).
const APPEND = `
local cur = redis.call('GET', KEYS[1]) or ''
if cur ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[3], 'EX', tonumber(ARGV[4]))
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

export interface RedisAuditLogOptions {
  now: () => number;
  prefix?: string;
  retentionDays?: number;
}

/** Hash-chained audit log in Redis. Concurrent writers retry on head conflicts. */
export class RedisAuditLog implements AuditSink {
  private readonly prefix: string;
  private readonly ttl: number;

  constructor(
    private readonly redis: RedisLike,
    private readonly opts: RedisAuditLogOptions,
  ) {
    this.prefix = opts.prefix ?? 'wc:audit:';
    this.ttl = (opts.retentionDays ?? 1825) * 24 * 60 * 60;
  }

  private queue: Promise<void> = Promise.resolve();

  /** Appends serialize within this instance; other instances are handled by compare-and-set retries. */
  append(type: AuditEventType, data: Record<string, unknown>): Promise<void> {
    const run = this.queue.then(() => this.appendOnce(type, data));
    this.queue = run.catch(() => {});
    return run;
  }

  private async appendOnce(type: AuditEventType, data: Record<string, unknown>): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const head = await this.redis.get(`${this.prefix}last`);
      const prev = head ? (JSON.parse(head) as { seq: number; hash: string }) : null;
      const entry = buildEntry(prev, this.opts.now(), type, data, nodeCrypto);
      const nextHead = JSON.stringify({ seq: entry.seq, hash: entry.hash });
      const ok = await this.redis.eval(
        APPEND,
        [`${this.prefix}last`, `${this.prefix}${entry.seq}`],
        [head ?? '', nextHead, JSON.stringify(entry), String(this.ttl)],
      );
      if (Number(ok) === 1) return;
      await new Promise((r) => setTimeout(r, Math.random() * Math.min(200, 5 * 2 ** attempt)));
    }
    throw new Error('Audit log append failed after repeated conflicts');
  }

  /** Reads entries 1..head in order (for verification and export). */
  async readAll(): Promise<AuditEntry[]> {
    const head = await this.redis.get(`${this.prefix}last`);
    if (!head) return [];
    const { seq } = JSON.parse(head) as { seq: number };
    const out: AuditEntry[] = [];
    for (let from = 1; from <= seq; from += 500) {
      const keys = Array.from({ length: Math.min(500, seq - from + 1) }, (_, i) => `${this.prefix}${from + i}`);
      const values = await this.redis.mget(keys);
      values.forEach((v) => {
        if (v) out.push(JSON.parse(v) as AuditEntry);
      });
    }
    return out;
  }
}
