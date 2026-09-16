import RedisMock from 'ioredis-mock';
import type { RedisLike } from './redis-store';

/** RedisLike over ioredis-mock (supports Lua), for tests without a Redis server. */
export function mockRedis(): RedisLike {
  return mockRedisWithRaw().redis;
}

/** Mock Redis adapter plus the raw client, for tests that inspect stored bytes. */
export function mockRedisWithRaw(): { redis: RedisLike; raw: InstanceType<typeof RedisMock> } {
  // ioredis-mock shares data between instances with the same host:port, so give each test its own.
  const r = new RedisMock({ port: 20_000 + Math.floor(Math.random() * 40_000), host: `mock-${Math.random().toString(36).slice(2)}` });
  const redis: RedisLike = {
    get: (k) => r.get(k),
    mget: (keys) => r.mget(...keys),
    set: async (k, v, o) => {
      const res = o?.nx
        ? o.exSeconds
          ? await r.set(k, v, 'EX', o.exSeconds, 'NX')
          : await r.set(k, v, 'NX')
        : o?.exSeconds
          ? await r.set(k, v, 'EX', o.exSeconds)
          : await r.set(k, v);
      return res === 'OK';
    },
    incr: (k) => r.incr(k),
    incrby: (k, n) => r.incrby(k, n),
    expire: async (k, s) => void (await r.expire(k, s)),
    eval: (script, keys, args) => r.eval(script, keys.length, ...keys, ...args),
    sadd: async (k, m) => void (await r.sadd(k, m)),
    srem: async (k, m) => void (await r.srem(k, m)),
    smembers: (k) => r.smembers(k),
    time: async () => {
      const [sec, micro] = await r.time();
      return Number(sec) * 1000 + Math.floor(Number(micro) / 1000);
    },
  };
  return { redis, raw: r };
}

/** Virtual clock: sleeps resolve only when the test advances time. */
export class FakeTime {
  t = 1_700_000_000_000;
  private waiters: { at: number; resolve: () => void }[] = [];
  now = () => this.t;
  sleep = (ms: number) => new Promise<void>((resolve) => this.waiters.push({ at: this.t + ms, resolve }));

  async advance(ms: number) {
    const target = this.t + ms;
    for (;;) {
      await flush();
      this.waiters.sort((a, b) => a.at - b.at);
      const next = this.waiters[0];
      if (!next || next.at > target) break;
      this.waiters.shift();
      this.t = next.at;
      next.resolve();
    }
    this.t = target;
    await flush();
  }
}

export const flush = () => new Promise((r) => setTimeout(r, 2));

/** Reads SSE events from a streaming response until it ends. */
export async function readSse(res: Response, onEvent?: (e: { type: string } & Record<string, unknown>) => void) {
  const events: ({ type: string } & Record<string, unknown>)[] = [];
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      const data = block.split('\n').find((l) => l.startsWith('data:'));
      if (!data) continue;
      const event = JSON.parse(data.slice(5).trim());
      events.push(event);
      onEvent?.(event);
    }
  }
  return events;
}
