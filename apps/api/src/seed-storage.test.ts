import { profileFromTemplate } from '@triptown/core';
import { commitServerSeed } from '@triptown/fairness';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appFromEnv, createApp } from './app';
import { RedisRoundStore } from './redis-store';
import { aesGcmSeedCipher } from './seed-cipher';
import { FakeTime, mockRedisWithRaw } from './test-helpers';

describe('encrypted seed storage (3.3)', () => {
  it('never stores an unencrypted server seed, yet reveals and verifies correctly', async () => {
    const { redis, raw } = mockRedisWithRaw();
    const time = new FakeTime();
    const app = createApp({
      store: new RedisRoundStore(redis),
      sessionSecret: 's',
      now: time.now,
      sleep: time.sleep,
      keepAliveMs: 60_000,
      seedCipher: await aesGcmSeedCipher(randomBytes(32).toString('base64')),
      profiles: { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } },
    });
    const call = (method: string, path: string, token?: string, body?: unknown) =>
      app.request(path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const { token, session } = (await (await call('POST', '/v1/sessions', undefined, {})).json()) as { token: string; session: { commit: string } };
    for (let i = 0; i < 5; i++) {
      const res = await call('POST', '/v1/rounds', token, { betMinor: 20 });
      await res.body?.cancel();
      await time.advance(61_000);
      await call('GET', '/v1/session', token);
    }
    const seeds: string[] = [];
    // Scan every stored value before any reveal.
    const scan = async () => {
      const keys = await raw.keys('*');
      const values: string[] = [];
      for (const k of keys) {
        const type = await raw.type(k);
        if (type === 'string') values.push(String(await raw.get(k)));
        if (type === 'list') values.push(...(await raw.lrange(k, 0, -1)));
      }
      return values.join('\n');
    };
    const before = await scan();
    const rotation = (await (await call('POST', '/v1/session/rotate', token)).json()) as { previousServerSeed: string };
    seeds.push(rotation.previousServerSeed);
    expect(commitServerSeed(rotation.previousServerSeed)).toBe(session.commit);
    expect(before).not.toContain(rotation.previousServerSeed);
    expect(before).toContain('enc:v1:');
    // The current (unrevealed) seed is also only stored encrypted.
    const after = await scan();
    const revealedList = (await (await call('GET', '/v1/session/seeds', token)).json()) as { serverSeed: string }[];
    expect(revealedList[0]!.serverSeed).toBe(rotation.previousServerSeed);
    const hexSeeds = after.match(/"serverSeed":"([0-9a-f]{64})"/g) ?? [];
    // Only revealed seeds may appear in plain text.
    for (const m of hexSeeds) expect(seeds.some((s) => m.includes(s))).toBe(true);
  });

  it('fails startup without a key when deployed', async () => {
    await expect(
      appFromEnv({ VERCEL_ENV: 'preview', UPSTASH_REDIS_REST_URL: 'https://x.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't', SESSION_SECRET: 's' }),
    ).rejects.toThrow(/SEED_ENCRYPTION_KEY/);
  });

  it('round-trips and rejects foreign ciphertext', async () => {
    const c = await aesGcmSeedCipher(randomBytes(32).toString('base64'));
    const seed = randomBytes(32).toString('hex');
    const enc = await c.encrypt(seed);
    expect(enc).not.toContain(seed);
    expect(await c.decrypt(enc)).toBe(seed);
    const other = await aesGcmSeedCipher(randomBytes(32).toString('base64'));
    await expect(other.decrypt(enc)).rejects.toBeTruthy();
    await expect(aesGcmSeedCipher('short')).rejects.toThrow(/32 bytes/);
  });
});
