import { Redis } from '@upstash/redis';
import type { RedisLike } from './redis-store';

/** Upstash REST client adapter. */
export function upstashRedis(url: string, token: string): RedisLike {
  const r = new Redis({ url, token, automaticDeserialization: false });
  return {
    get: (k) => r.get<string>(k),
    mget: (keys) => r.mget<(string | null)[]>(...keys),
    set: async (k, v, o) => {
      const res = o?.nx
        ? o.exSeconds
          ? await r.set(k, v, { nx: true, ex: o.exSeconds })
          : await r.set(k, v, { nx: true })
        : o?.exSeconds
          ? await r.set(k, v, { ex: o.exSeconds })
          : await r.set(k, v);
      return res === 'OK';
    },
    incr: (k) => r.incr(k),
    incrby: (k, n) => r.incrby(k, n),
    expire: async (k, s) => void (await r.expire(k, s)),
    eval: (script, keys, args) => r.eval(script, keys, args),
    sadd: async (k, m) => void (await r.sadd(k, m)),
    srem: async (k, m) => void (await r.srem(k, m)),
    smembers: (k) => r.smembers(k),
    time: async () => {
      const [sec, micro] = await r.time();
      return Number(sec) * 1000 + Math.floor(Number(micro) / 1000);
    },
  };
}
