import { MemoryRoundStore, profileFromTemplate, verifyAuditChain, type AuditEntry } from '@triptown/core';
import { describe, expect, it } from 'vitest';
import { RedisAuditLog } from './audit-log';
import { createApp } from './app';
import { nodeCrypto } from './node-crypto';
import { FakeTime, mockRedisWithRaw } from './test-helpers';

describe('audit log (3.4)', () => {
  it('records a full round as a verifiable chain and detects tampering', async () => {
    const { redis, raw } = mockRedisWithRaw();
    const time = new FakeTime();
    const audit = new RedisAuditLog(redis, { now: time.now });
    const app = createApp({
      store: new MemoryRoundStore(),
      sessionSecret: 's',
      now: time.now,
      sleep: time.sleep,
      keepAliveMs: 60_000,
      audit,
      adminApiKey: 'admin',
      profiles: { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } },
    });
    const call = (method: string, path: string, token?: string, body?: unknown) =>
      app.request(path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const { token } = (await (await call('POST', '/v1/sessions', undefined, {})).json()) as { token: string };
    const res = await call('POST', '/v1/rounds', token, { betMinor: 1_00 });
    await time.advance(300);
    const roundId = ((await (await call('GET', '/v1/rounds', token)).json()) as { roundId: string }[])[0]!.roundId;
    await call('POST', `/v1/rounds/${roundId}/cashout`, token, { clientTapAt: time.t - 50, rttMs: 90 });
    await time.advance(61_000);
    await res.body?.cancel();
    await call('GET', `/v1/rounds/${roundId}`, token);
    await call('POST', '/v1/session/rotate', token);
    await call('PUT', '/v1/admin/kill-switch', 'admin', { key: 'game:whack-crash', enabled: true });

    const entries = await audit.readAll();
    const types = entries.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['session_created', 'seed_committed', 'round_started', 'cashout_received', 'round_settled', 'seed_revealed', 'kill_switch_changed']),
    );
    expect(types.indexOf('round_started')).toBeLessThan(types.indexOf('round_settled'));
    expect(entries.find((e) => e.type === 'cashout_received')?.data).toMatchObject({ rttMs: 90 });
    expect(verifyAuditChain(entries, nodeCrypto)).toEqual({ ok: true, entries: entries.length });

    // Altered entry.
    const altered = structuredClone(entries) as AuditEntry[];
    (altered[3]!.data as Record<string, unknown>).betMinor = 999;
    expect(verifyAuditChain(altered, nodeCrypto)).toMatchObject({ ok: false, brokenAt: 4, reason: 'entry content altered' });
    // Removed entry.
    expect(verifyAuditChain([...entries.slice(0, 2), ...entries.slice(3)], nodeCrypto)).toMatchObject({ ok: false, brokenAt: 3 });
    // Reordered entries.
    const swapped = [...entries];
    [swapped[1], swapped[2]] = [swapped[2]!, swapped[1]!];
    expect(verifyAuditChain(swapped, nodeCrypto).ok).toBe(false);

    // Tampering directly in Redis is detected on read-back.
    const stored = JSON.parse(String(await raw.get('wc:audit:2'))) as AuditEntry;
    stored.data = { ...stored.data, clientSeed: 'forged' };
    await raw.set('wc:audit:2', JSON.stringify(stored));
    expect(verifyAuditChain(await audit.readAll(), nodeCrypto)).toMatchObject({ ok: false, brokenAt: 2 });
  });

  it('serializes appends within an instance and retries when another instance moved the head', async () => {
    const { redis } = mockRedisWithRaw();
    const a = new RedisAuditLog(redis, { now: () => Date.now() });
    await Promise.all(Array.from({ length: 30 }, (_, i) => a.append('time_drift', { i })));
    expect(await a.readAll()).toHaveLength(30);

    // A second instance appends between this instance's head read and its compare-and-set.
    const other = new RedisAuditLog(redis, { now: () => Date.now() });
    let injected = false;
    const racing = {
      ...redis,
      eval: async (script: string, keys: string[], args: string[]) => {
        if (!injected && keys[0] === 'wc:audit:last') {
          injected = true;
          await other.append('time_drift', { from: 'other-instance' });
        }
        return redis.eval(script, keys, args);
      },
    };
    const b = new RedisAuditLog(racing, { now: () => Date.now() });
    await b.append('time_drift', { from: 'this-instance' });
    const entries = await a.readAll();
    expect(entries).toHaveLength(32);
    expect(entries.slice(-2).map((e) => e.data.from)).toEqual(['other-instance', 'this-instance']);
    expect(verifyAuditChain(entries, nodeCrypto).ok).toBe(true);
  });
});
