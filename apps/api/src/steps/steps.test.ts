import { serve } from '@hono/node-server';
import { MemoryRoundStore, profileFromTemplate, type RoundStore } from '@triptown/core';
import { RemoteStepRoundService } from '@triptown/rgs-client/steps-remote';
import { stepServiceSuite } from '@triptown/rgs-client/steps-testing';
import type { TokenStorage } from '@triptown/rgs-client/remote';
import { MemoryStepRoundStore, createStepRound, STEP_CONFIGS, type StepRoundStore } from '@triptown/steps';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { RedisRoundStore } from '../redis-store';
import { mockRedis } from '../test-helpers';
import { RedisStepRoundStore } from './redis-step-store';

const SECRET = 'step-secret';
const servers: { close: () => void }[] = [];
afterAll(() => servers.forEach((s) => s.close()));

const origin = ['https://op.test'];
const UNPACED = { defaultProfile: { ...profileFromTemplate('regulated-uk', origin), minCycleMs: 0 } };
const PACED = { defaultProfile: profileFromTemplate('regulated-uk', origin) };

type Backend = () => { store: RoundStore; stepStore: StepRoundStore };
const backends: [string, Backend][] = [
  ['memory', () => ({ store: new MemoryRoundStore(), stepStore: new MemoryStepRoundStore() })],
  [
    'redis-mock',
    () => {
      const redis = mockRedis();
      return { store: new RedisRoundStore(redis), stepStore: new RedisStepRoundStore(redis) };
    },
  ],
];

const tokens = new WeakMap<RemoteStepRoundService, { base: string; storage: TokenStorage }>();

async function liveService(backend: Backend, profiles = UNPACED) {
  const { store, stepStore } = backend();
  const app = createApp({ store, stepStore, sessionSecret: SECRET, initialBalanceMinor: 500_00, profiles, allowStepForce: true });
  const server = serve({ fetch: app.fetch, port: 0 });
  servers.push(server);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  let token: string | null = null;
  const storage: TokenStorage = { get: () => token, set: (t) => void (token = t) };
  const service = new RemoteStepRoundService({ baseUrl: base, tokenStorage: storage });
  tokens.set(service, { base, storage });
  return service;
}

async function force(service: unknown, refuseAt: number | null) {
  const s = service as RemoteStepRoundService;
  await s.getSession();
  const { base, storage } = tokens.get(s)!;
  for (const difficulty of ['medium'] as const) {
    const res = await fetch(`${base}/v1/steps/dev/force`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storage.get()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refuseAt, difficulty }),
    });
    expect(res.status).toBe(200);
  }
}

for (const [name, backend] of backends) {
  stepServiceSuite(`RemoteStepRoundService over HTTP (${name})`, () => liveService(backend), {
    force: async (s, refuseAt) => {
      // The suite's finish test plays Easy; a Medium seed that clears all fences also clears all Easy fences.
      await force(s, refuseAt);
    },
    makePacedService: () => liveService(backend, PACED),
  });
}

describe('RedisStepRoundStore', () => {
  const round = () =>
    createStepRound({
      id: 'round-1', sessionId: 's', playerId: 'p', stakeMinor: 100, currency: 'USD', config: STEP_CONFIGS.medium,
      seeds: { serverSeed: 'ab'.repeat(32), clientSeed: 'c', nonce: 0 }, commit: 'x', startedAt: 1, abandonAfterMs: 1000,
    });

  it('creates once and applies only against the current version', async () => {
    const store = new RedisStepRoundStore(mockRedis());
    expect(await store.createStepRound(round())).toBe(true);
    expect(await store.createStepRound(round())).toBe(false);
    const v0 = (await store.getStepRound('round-1'))!;
    const applied = await store.applyStepRound({ ...v0, cleared: 1 }, 0);
    expect(applied?.version).toBe(1);
    expect(await store.applyStepRound({ ...v0, cleared: 2 }, 0)).toBeNull();
    expect((await store.getStepRound('round-1'))!.cleared).toBe(1);
  });

  it('lets exactly one of two concurrent changes win', async () => {
    const store = new RedisStepRoundStore(mockRedis());
    await store.createStepRound(round());
    const v0 = (await store.getStepRound('round-1'))!;
    const results = await Promise.all([store.applyStepRound({ ...v0, cleared: 1 }, 0), store.applyStepRound({ ...v0, cleared: 5 }, 0)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe('step routes', () => {
  it('returns step error codes as JSON and settles abandoned rounds from reconcile', async () => {
    let now = 1_700_000_000_000;
    const app = createApp({
      store: new MemoryRoundStore(), stepStore: new MemoryStepRoundStore(), sessionSecret: SECRET, initialBalanceMinor: 500_00,
      profiles: UNPACED, adminApiKey: 'admin', now: () => now, stepAbandonAfterMs: 120_000,
    });
    const created = await app.request('/v1/steps/sessions', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    expect(created.status).toBe(201);
    const { token } = (await created.json()) as { token: string };
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const bad = await app.request('/v1/steps/rounds', { method: 'POST', headers: auth, body: JSON.stringify({ stakeMinor: 100, difficulty: 'insane' }) });
    expect(bad.status).toBe(422);
    expect(await bad.json()).toMatchObject({ error: { code: 'invalid_difficulty' } });
    const started = await app.request('/v1/steps/rounds', { method: 'POST', headers: auth, body: JSON.stringify({ stakeMinor: 100, difficulty: 'easy' }) });
    const { round } = (await started.json()) as { round: { id: string } };
    const early = await app.request(`/v1/steps/rounds/${round.id}/collect`, { method: 'POST', headers: auth, body: JSON.stringify({ key: 'collect-early-1' }) });
    expect(early.status).toBe(409);
    now += 120_000;
    const sweep = await app.request('/v1/admin/reconcile', { method: 'POST', headers: { Authorization: 'Bearer admin' } });
    expect(sweep.status).toBe(200);
    const fetched = await app.request(`/v1/steps/rounds/${round.id}`, { headers: auth });
    expect(await fetched.json()).toMatchObject({ status: 'void', settlement: { reason: 'abandoned_void', payoutMinor: 100 } });
    const session = (await (await app.request('/v1/steps/session', { headers: auth })).json()) as { balanceMinor: number };
    expect(session.balanceMinor).toBe(500_00);
    const noForce = await app.request('/v1/steps/dev/force', { method: 'POST', headers: auth, body: '{}' });
    expect(noForce.status).toBe(404);
  });
});
