import { serve } from '@hono/node-server';
import { MemoryRoundStore, profileFromTemplate, registerGame, type RoundStore } from '@triptown/core';
import { deriveRound, resolveConfigId, type RoundOutcome } from '@triptown/fairness';

// Retired game config: resolvable for verification, no longer exported (design D2).
const PAPER_ROUTE_CONFIG = resolveConfigId('paper-route/v1')!;
import { RemoteRoundService } from '@triptown/rgs-client/remote';
import { paperRouteSuite } from '@triptown/rgs-client/testing';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { RedisRoundStore } from './redis-store';
import { FakeTime, mockRedis, readSse } from './test-helpers';

// The split-stake code path still ships, but its only config belongs to a retired game. Tests register
// that game explicitly to exercise the path; no shipped profile has it registered (design D1, D2).
registerGame('paper-route');


// Paper Route partial cash-out through the API: paper-route-mvp tasks 6.2–6.4.

const SECRET = 'test-secret';
// Paper Route keeps the unboosted maths: the good mole is a Whack Crash config (good-mole D6).
const UNPACED = { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0, boostsMode: 'off' as const } };

const stores: [string, () => RoundStore][] = [
  ['memory store', () => new MemoryRoundStore()],
  ['redis store', () => new RedisRoundStore(mockRedis())],
];

// ---------- 6.4: the shared paper suite against a real HTTP server ----------

const servers: { close: () => void }[] = [];
afterAll(() => servers.forEach((s) => s.close()));

async function liveService(store: RoundStore) {
  const app = createApp({ store, sessionSecret: SECRET, initialBalanceMinor: 500_00, profiles: UNPACED });
  const server = serve({ fetch: app.fetch, port: 0 });
  servers.push(server);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as AddressInfo;
  return new RemoteRoundService({ baseUrl: `http://127.0.0.1:${port}`, game: 'paper-route' });
}

for (const [name, makeStore] of stores) {
  paperRouteSuite(`RemoteRoundService over HTTP (${name})`, () => liveService(makeStore()));
}

// ---------- 6.2 / 6.3: throw endpoint and stream with a virtual clock ----------

describe.each(stores)('part collect API (%s)', (_name, makeStore) => {
  let time: FakeTime;
  let store: RoundStore;
  let app: ReturnType<typeof createApp>;

  const setup = (profile = UNPACED.defaultProfile) => {
    time = new FakeTime();
    store = makeStore();
    app = createApp({ store, sessionSecret: SECRET, initialBalanceMinor: 100_00, now: time.now, sleep: time.sleep, keepAliveMs: 60_000, profiles: { defaultProfile: profile } });
  };
  beforeEach(() => setup());

  const call = (method: string, path: string, token?: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function paperSession(predicate: (o: RoundOutcome) => boolean) {
    const res = await call('POST', '/v1/sessions', undefined, { game: 'paper-route' });
    expect(res.status).toBe(201);
    const { token, session } = (await res.json()) as { token: string; session: { sessionId: string; config: { id: string; stakeParts: number } } };
    expect(session.config).toMatchObject({ id: 'paper-route/v1', stakeParts: 5 });
    const s = (await store.getSession(session.sessionId))!;
    for (let i = 0; i < 50_000; i++) {
      const clientSeed = `p-${i}`;
      const outcome = deriveRound({ serverSeed: s.serverSeed, clientSeed, nonce: s.nonce }, PAPER_ROUTE_CONFIG);
      if (predicate(outcome)) {
        expect((await call('PUT', '/v1/session/client-seed', token, { clientSeed })).status).toBe(200);
        return { token, sessionId: session.sessionId, outcome };
      }
    }
    throw new Error('no outcome');
  }

  async function start(token: string) {
    const res = await call('POST', '/v1/rounds', token, { betMinor: 10_00 });
    expect(res.status).toBe(200);
    let roundId: string | null = null;
    const events = readSse(res, (e) => {
      if (e.type === 'START') roundId = e.roundId as string;
    });
    for (let i = 0; i < 50 && !roundId; i++) await time.advance(0);
    return { events, roundId: roundId! };
  }

  const throwReq = async (token: string, roundId: string, body: unknown) => {
    const res = await call('POST', `/v1/rounds/${roundId}/throws`, token, body);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> & { result?: string; remaining?: number; balanceMinor?: number } };
  };

  const noEarlySetback = (o: RoundOutcome, s: number) => o.setbacks.every((t) => t > s);

  it('collects one part, ignores a retried part id, and ends on collect-all', async () => {
    const { token, outcome } = await paperSession((o) => o.crashTime > 5 && noEarlySetback(o, 3));
    const { roundId, events } = await start(token);
    await time.advance(1000);
    const first = await throwReq(token, roundId, { partId: 'a', count: 1 });
    expect(first).toMatchObject({ status: 200, body: { result: 'thrown', remaining: 4 } });
    expect(JSON.stringify(first.body)).not.toContain('crashTime');
    const retry = await throwReq(token, roundId, { partId: 'a', count: 1 });
    expect(retry.body).toMatchObject({ result: 'duplicate', balanceMinor: first.body.balanceMinor });
    // No crash data while the round is running.
    const running = (await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as Record<string, unknown>;
    expect(running).toMatchObject({ status: 'running', settlement: null, crashMultiplier: null });
    expect((running.settledParts as unknown[]).length).toBe(1);
    await time.advance(2000);
    const all = await throwReq(token, roundId, { partId: 'b', count: 'all' });
    expect(all.body).toMatchObject({ result: 'cashed_out', remaining: 0 });
    const empty = await throwReq(token, roundId, { partId: 'c', count: 1 });
    expect(empty.body).toMatchObject({ result: 'already_settled' });
    // The stream polls the store once a second (virtual clock) and then sends the terminal event.
    await time.advance(1000);
    const seen = await events;
    expect(seen.filter((e) => e.type === 'PART_SETTLED').map((e) => e.partId)).toEqual(['a', 'b']);
    expect(seen.at(-1)).toMatchObject({ type: 'CASHED_OUT', partsSettled: 5, partsLost: 0, crashTime: outcome.crashTime });
  });

  it('refuses a throw below the minimum cash-out with 422', async () => {
    setup({ ...UNPACED.defaultProfile, minCashout: 1.2 });
    const { token } = await paperSession((o) => o.crashTime > 3);
    const { roundId } = await start(token);
    await time.advance(100);
    const low = await throwReq(token, roundId, { partId: 'low', count: 1 });
    expect(low.status).toBe(422);
    expect(low.body).toMatchObject({ error: { code: 'below_min_cashout', minCashout: 1.2 } });
  });

  it('lets only one of two concurrent collects take the last part', async () => {
    const { token, sessionId } = await paperSession((o) => o.crashTime > 5 && noEarlySetback(o, 2));
    const { roundId, events } = await start(token);
    await time.advance(1000);
    for (const id of ['a', 'b', 'c', 'd']) expect((await throwReq(token, roundId, { partId: id, count: 1 })).body.result).toBe('thrown');
    const [x, y] = await Promise.all([throwReq(token, roundId, { partId: 'x', count: 1 }), throwReq(token, roundId, { partId: 'y', count: 1 })]);
    const results = [x.body.result, y.body.result];
    expect(results.filter((r) => r === 'cashed_out')).toHaveLength(1);
    const snap = (await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as { returnMinor: number; settledParts: { parts: number }[] };
    expect(snap.settledParts.reduce((n, t) => n + t.parts, 0)).toBe(5);
    expect(await store.getBalance(sessionId)).toBe(100_00 - 10_00 + snap.returnMinor);
    await time.advance(1000);
    await events;
  });

  it('keeps a part settled before a disconnect when the round later crashes', async () => {
    const { token, sessionId, outcome } = await paperSession((o) => o.crashTime > 2 && o.crashTime < 30 && noEarlySetback(o, 1));
    const { roundId, events } = await start(token);
    await time.advance(1000);
    const out = await throwReq(token, roundId, { partId: 'kept', count: 1 });
    expect(out.body.result).toBe('thrown');
    await time.advance(Math.ceil(outcome.crashTime * 1000));
    const snap = (await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as Record<string, unknown> & { returnMinor: number };
    expect(snap).toMatchObject({ status: 'lost', settledParts: [{ partId: 'kept', parts: 1 }] });
    expect(snap.returnMinor).toBeGreaterThan(0);
    expect(await store.getBalance(sessionId)).toBe(100_00 - 10_00 + snap.returnMinor);
    const seen = await events;
    expect(seen.at(-1)).toMatchObject({ type: 'CRASH', partsSettled: 1, partsLost: 4, returnMinor: snap.returnMinor });
  });

  it('settles the remaining stakeParts at detection time under cashout-at-disconnect', async () => {
    setup({ ...UNPACED.defaultProfile, disconnectPolicy: 'cashout-at-disconnect' });
    const { token, outcome } = await paperSession((o) => o.crashTime > 5 && noEarlySetback(o, 3));
    const res = await call('POST', '/v1/rounds', token, { betMinor: 10_00 });
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    const roundId = /"roundId":"([^"]+)"/.exec(first)![1]!;
    await time.advance(1_000);
    expect((await throwReq(token, roundId, { partId: 'before', count: 1 })).body.result).toBe('thrown');
    await time.advance(1_500);
    await reader.cancel(); // connection lost with 4 stakeParts unthrown
    await time.advance(10);
    const snap = (await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as {
      status: string;
      settlement: { reason: string; time: number; crashTime: number };
      settledParts: { partId: string; parts: number; reason: string }[];
    };
    expect(snap.status).toBe('won');
    expect(snap.settlement.reason).toBe('disconnect');
    expect(snap.settlement.time).toBeGreaterThanOrEqual(2.5);
    expect(snap.settlement.time).toBeLessThan(2.6);
    expect(snap.settlement.crashTime).toBe(outcome.crashTime);
    expect(snap.settledParts.map((t) => [t.parts, t.reason])).toEqual([[1, 'manual'], [4, 'disconnect']]);
  });

  it('lists settled parts in history', async () => {
    const { token, outcome } = await paperSession((o) => o.crashTime > 2 && o.crashTime < 30 && noEarlySetback(o, 1));
    const { roundId, events } = await start(token);
    await time.advance(1000);
    await throwReq(token, roundId, { partId: 'h', count: 1 });
    await time.advance(Math.ceil(outcome.crashTime * 1000));
    await events;
    const history = (await (await call('GET', '/v1/rounds?limit=5', token)).json()) as { roundId: string; stakeParts: number; settledParts: unknown[] }[];
    expect(history[0]).toMatchObject({ roundId, stakeParts: 5, settledParts: [{ partId: 'h' }] });
  });
});
