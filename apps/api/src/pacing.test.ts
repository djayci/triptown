import { MemoryRoundStore, profileFromTemplate, type RoundStore } from '@triptown/core';
import { deriveRound } from '@triptown/fairness';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { RedisRoundStore } from './redis-store';
import { FakeTime, mockRedis } from './test-helpers';

const stores: [string, () => RoundStore][] = [
  ['memory store', () => new MemoryRoundStore()],
  ['redis store', () => new RedisRoundStore(mockRedis())],
];

describe.each(stores)('player lock and pacing over the API (%s)', (_name, makeStore) => {
  const setup = () => {
    const time = new FakeTime();
    const store = makeStore();
    const app = createApp({
      store,
      sessionSecret: 's',
      now: time.now,
      sleep: time.sleep,
      keepAliveMs: 60_000,
      profiles: {
        defaultProfile: profileFromTemplate('light'),
        operators: { acme: profileFromTemplate('regulated-uk', ['https://acme.example']) },
      },
      operatorKeys: { acme: createHash('sha256').update('acme-key').digest('hex') },
    });
    const call = (method: string, path: string, token?: string, body?: unknown, extra: Record<string, string> = {}) =>
      app.request(path, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...extra },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const session = async (player: string) => {
      const res = await call('POST', '/v1/sessions', undefined, { operator: 'acme', player }, { 'X-Operator-Key': 'acme-key' });
      return (await res.json()) as { token: string; session: { sessionId: string; config: { id: string } } };
    };
    return { time, store, call, session };
  };

  it('2.1 rejects a second session of the same player while a round runs', async () => {
    const { store, call, session, time } = setup();
    const phone = await session('p-9');
    const laptop = await session('p-9');
    const s = (await store.getSession(phone.session.sessionId))!;
    const { resolveConfigId } = await import('@triptown/fairness');
    const config = resolveConfigId(phone.session.config.id)!;
    for (let i = 0; i < 5000; i++) {
      if (deriveRound({ serverSeed: s.serverSeed, clientSeed: `long-${i}`, nonce: s.nonce }, config).crashTime > 5) {
        await call('PUT', '/v1/session/client-seed', phone.token, { clientSeed: `long-${i}` });
        break;
      }
    }
    const running = await call('POST', '/v1/rounds', phone.token, { betMinor: 1_00 });
    expect(running.status).toBe(200);
    await time.advance(0);
    const second = await call('POST', '/v1/rounds', laptop.token, { betMinor: 1_00 });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: { code: 'round_in_progress' } });
    await running.body?.cancel();
  });

  it('2.2 answers 429 cycle_too_soon with retryAfterMs under a 5 s profile', async () => {
    const { store, call, session, time } = setup();
    const p = await session('p-1');
    const s = (await store.getSession(p.session.sessionId))!;
    const { resolveConfigId } = await import('@triptown/fairness');
    const config = resolveConfigId(p.session.config.id)!;
    for (let i = 0; i < 5000; i++) {
      if (deriveRound({ serverSeed: s.serverSeed, clientSeed: `bust-${i}`, nonce: s.nonce }, config).crashTime === 0) {
        await call('PUT', '/v1/session/client-seed', p.token, { clientSeed: `bust-${i}` });
        break;
      }
    }
    const first = await call('POST', '/v1/rounds', p.token, { betMinor: 1_00 });
    expect(first.status).toBe(200);
    await first.body?.cancel();
    await time.advance(1200);
    const early = await call('POST', '/v1/rounds', p.token, { betMinor: 1_00 });
    expect(early.status).toBe(429);
    expect(await early.json()).toMatchObject({ error: { code: 'cycle_too_soon', retryAfterMs: 3800 } });
    await time.advance(3800);
    const later = await call('POST', '/v1/rounds', p.token, { betMinor: 1_00 });
    expect(later.status).toBe(200);
    await later.body?.cancel();
  });
});

describe('cash-out evidence (2.4)', () => {
  it('stores client tap time and RTT without changing the judged time', async () => {
    const time = new FakeTime();
    const store = new MemoryRoundStore();
    const app = createApp({ store, sessionSecret: 's', now: time.now, sleep: time.sleep, keepAliveMs: 60_000, profiles: { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } } });
    const call = (method: string, path: string, token?: string, body?: unknown) =>
      app.request(path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const { token, session } = (await (await call('POST', '/v1/sessions', undefined, {})).json()) as { token: string; session: { sessionId: string; config: { id: string } } };
    const s = (await store.getSession(session.sessionId))!;
    const { resolveConfigId } = await import('@triptown/fairness');
    const config = resolveConfigId(session.config.id)!;
    for (let i = 0; i < 5000; i++) {
      const o = deriveRound({ serverSeed: s.serverSeed, clientSeed: `ev-${i}`, nonce: s.nonce }, config);
      if (o.crashTime > 5 && o.setbacks.length === 0) {
        await call('PUT', '/v1/session/client-seed', token, { clientSeed: `ev-${i}` });
        break;
      }
    }
    const started = time.t;
    const res = await call('POST', '/v1/rounds', token, { betMinor: 10_00 });
    await time.advance(2_000);
    const roundId = ((await (await call('GET', '/v1/rounds', token)).json()) as { roundId: string }[])[0]!.roundId;
    const out = (await (await call('POST', `/v1/rounds/${roundId}/cashout`, token, { clientTapAt: started + 1_700, rttMs: 180 })).json()) as {
      settlement: { time: number; evidence: { clientTapAt: number; rttMs: number; receivedAt: number } };
    };
    expect(out.settlement.time).toBeCloseTo(2, 6);
    expect(out.settlement.evidence).toEqual({ clientTapAt: started + 1_700, rttMs: 180, receivedAt: started + 2_000 });
    const stored = await store.getRound(roundId);
    expect(stored?.settlement?.evidence?.rttMs).toBe(180);
    await res.body?.cancel();
  });
});
