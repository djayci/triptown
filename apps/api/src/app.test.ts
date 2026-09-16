import { serve } from '@hono/node-server';
import { MemoryRoundStore, effectiveConfig, profileFromTemplate, type RoundStore } from '@triptown/core';
import { DEFAULT_CONFIG, commitServerSeed, deriveRound, resolveConfigId, verifyRound, type RoundOutcome } from '@triptown/fairness';
import { RemoteRoundService } from '@triptown/rgs-client/remote';
import { roundServiceSuite } from '@triptown/rgs-client/testing';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, redisPing } from './app';
import { RedisRoundStore } from './redis-store';
import { FakeTime, mockRedis, readSse } from './test-helpers';

const SECRET = 'test-secret';

const stores: [string, () => RoundStore][] = [
  ['memory store', () => new MemoryRoundStore()],
  ['redis store', () => new RedisRoundStore(mockRedis())],
];

// ---------- 7.7: the shared RoundService suite against a real HTTP server ----------

const servers: { close: () => void }[] = [];
afterAll(() => servers.forEach((s) => s.close()));

/** Pacing is tested separately; the random-outcome suite plays rounds back to back. */
const UNPACED = { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } };

async function liveService(store: RoundStore, balance = 500_00, profiles = UNPACED) {
  const app = createApp({ store, sessionSecret: SECRET, initialBalanceMinor: balance, profiles });
  const server = serve({ fetch: app.fetch, port: 0 });
  servers.push(server);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as AddressInfo;
  return new RemoteRoundService({ baseUrl: `http://127.0.0.1:${port}` });
}

for (const [name, makeStore] of stores) {
  roundServiceSuite(`RemoteRoundService over HTTP (${name})`, () => liveService(makeStore()), 120, {
    makePacedService: () => liveService(makeStore(), 500_00, { defaultProfile: profileFromTemplate('light') }),
  });
}

// ---------- 7.2 - 7.6: API scenarios with a virtual clock ----------

describe.each(stores)('round API (%s)', (_name, makeStore) => {
  let time: FakeTime;
  let store: RoundStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    time = new FakeTime();
    store = makeStore();
    app = createApp({ store, sessionSecret: SECRET, initialBalanceMinor: 100_00, now: time.now, sleep: time.sleep, keepAliveMs: 60_000, profiles: UNPACED });
  });

  const call = (method: string, path: string, token?: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function newSession(balance?: number) {
    const res = await call('POST', '/v1/sessions', undefined, {});
    expect(res.status).toBe(201);
    const { token, session } = (await res.json()) as { token: string; session: { sessionId: string; balanceMinor: number } };
    if (balance !== undefined) await store.debit(session.sessionId, session.balanceMinor - balance);
    return { token, sessionId: session.sessionId };
  }

  /** Picks a client seed whose next round matches `predicate`. */
  async function seedFor(token: string, sessionId: string, predicate: (o: RoundOutcome) => boolean) {
    const s = (await store.getSession(sessionId))!;
    // The session's own config: the light profile plays the boosted maths (good-mole D6).
    const config = resolveConfigId(effectiveConfig('whack-crash', s.profile!).id)!;
    for (let i = 0; i < 50_000; i++) {
      const clientSeed = `t-${i}`;
      const outcome = deriveRound({ serverSeed: s.serverSeed, clientSeed, nonce: s.nonce }, config);
      if (predicate(outcome)) {
        expect((await call('PUT', '/v1/session/client-seed', token, { clientSeed })).status).toBe(200);
        return outcome;
      }
    }
    throw new Error('no outcome');
  }

  /** Starts a round and collects its events in the background. */
  async function start(token: string, body: unknown) {
    const res = await call('POST', '/v1/rounds', token, body);
    if (res.status !== 200) return { res, events: Promise.resolve([]), roundId: null as string | null };
    const seen: { type: string }[] = [];
    let roundId: string | null = null;
    const events = readSse(res, (e) => {
      seen.push(e);
      if (e.type === 'START') roundId = e.roundId as string;
    });
    for (let i = 0; i < 50 && !roundId; i++) await time.advance(0);
    return { res, events, roundId: roundId as string | null };
  }

  it('rejects requests without a valid token', async () => {
    expect((await call('GET', '/v1/session')).status).toBe(401);
    expect((await call('GET', '/v1/session', 'fake.token')).status).toBe(401);
  });

  it('7.2 publishes commit, client seed and nonce 0 before any bet', async () => {
    const { token } = await newSession();
    const info = (await (await call('GET', '/v1/session', token)).json()) as Record<string, unknown>;
    expect(info).toMatchObject({ nonce: 0, balanceMinor: 100_00 });
    expect(info.commit).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(info)).not.toContain('serverSeed');
  });

  it('7.2 keeps the nonce sequence across client seed changes and reveals on rotation', async () => {
    const { token, sessionId } = await newSession();
    await seedFor(token, sessionId, (o) => o.crashTime === 0);
    const first = await start(token, { betMinor: 1_00 });
    await time.advance(10);
    await first.events;
    const commit = ((await (await call('GET', '/v1/session', token)).json()) as { commit: string }).commit;
    expect((await call('PUT', '/v1/session/client-seed', token, { clientSeed: 'mine' })).status).toBe(200);
    const info = (await (await call('GET', '/v1/session', token)).json()) as { nonce: number; clientSeed: string };
    expect(info).toMatchObject({ nonce: 1, clientSeed: 'mine' });

    const rotation = (await (await call('POST', '/v1/session/rotate', token)).json()) as {
      previousServerSeed: string;
      previousCommit: string;
      session: { commit: string; nonce: number };
    };
    expect(commitServerSeed(rotation.previousServerSeed)).toBe(commit);
    expect(rotation.session.nonce).toBe(0);
    expect(rotation.session.commit).not.toBe(commit);

    const snap = ((await (await call('GET', `/v1/rounds/${first.roundId}`, token)).json()) as { clientSeed: string; nonce: number; settlement: { crashTime: number } });
    const v = verifyRound({ serverSeed: rotation.previousServerSeed, clientSeed: snap.clientSeed, nonce: snap.nonce, commit: rotation.previousCommit, config: DEFAULT_CONFIG });
    expect(v.verified).toBe(true);
    expect(v.crashTime).toBe(snap.settlement.crashTime);
  });

  it('7.3 debits on start and streams START with id, commit and start time', async () => {
    const { token, sessionId } = await newSession();
    await seedFor(token, sessionId, (o) => o.crashTime > 0.5 && o.crashTime < 3);
    const r = await start(token, { betMinor: 10_00 });
    expect(r.res.headers.get('content-type')).toContain('text/event-stream');
    expect(await store.getBalance(sessionId)).toBe(90_00);
    await time.advance(5000);
    const events = await r.events;
    expect(events[0]).toMatchObject({ type: 'START', roundId: r.roundId, betMinor: 10_00 });
    expect(events[0]).toHaveProperty('commit');
    expect(events[0]).toHaveProperty('startedAt');
    expect(events.at(-1)).toMatchObject({ type: 'CRASH', balanceMinor: 90_00 });
  });

  it('7.3 rejects insufficient funds, bad limits and a second active round', async () => {
    const poor = await newSession(5_00);
    const res = await call('POST', '/v1/rounds', poor.token, { betMinor: 10_00 });
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: { code: 'insufficient_funds' } });
    expect((await call('GET', '/v1/rounds', poor.token)).status).toBe(200);
    expect(await (await call('GET', '/v1/rounds', poor.token)).json()).toEqual([]);

    const { token, sessionId } = await newSession();
    expect((await call('POST', '/v1/rounds', token, { betMinor: 1 })).status).toBe(422);
    await seedFor(token, sessionId, (o) => o.crashTime > 5);
    const running = await start(token, { betMinor: 1_00 });
    const second = await call('POST', '/v1/rounds', token, { betMinor: 1_00 });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: { code: 'round_in_progress' } });
    await time.advance(60_000);
    await running.events;
  });

  it('7.4 pays a cash-out before the crash, rejects after, and is idempotent', async () => {
    const { token, sessionId } = await newSession();
    const outcome = await seedFor(token, sessionId, (o) => o.crashTime > 4 && o.setbacks.length === 0);
    const r = await start(token, { betMinor: 10_00 });
    await time.advance(2500);
    const won = (await (await call('POST', `/v1/rounds/${r.roundId}/cashout`, token)).json()) as { result: string; settlement: { payoutMinor: number; time: number; crashTime: number }; balanceMinor: number };
    expect(won.result).toBe('won');
    expect(won.settlement.time).toBeCloseTo(2.5, 6);
    expect(won.settlement.crashTime).toBe(outcome.crashTime);
    expect(won.balanceMinor).toBe(90_00 + won.settlement.payoutMinor);
    const again = (await (await call('POST', `/v1/rounds/${r.roundId}/cashout`, token)).json()) as { result: string; balanceMinor: number };
    expect(again).toMatchObject({ result: 'already_settled', balanceMinor: won.balanceMinor });
    await time.advance(1500);
    const events = await r.events;
    expect(events.at(-1)).toMatchObject({ type: 'CASHED_OUT', reason: 'manual', payoutMinor: won.settlement.payoutMinor, crashTime: outcome.crashTime });

    const late = await newSession();
    const lateOutcome = await seedFor(late.token, late.sessionId, (o) => o.crashTime > 0.5 && o.crashTime < 2);
    const r2 = await start(late.token, { betMinor: 10_00 });
    await time.advance(Math.ceil(lateOutcome.crashTime * 1000) + 1);
    const crashed = (await (await call('POST', `/v1/rounds/${r2.roundId}/cashout`, late.token)).json()) as { result: string; balanceMinor: number };
    expect(crashed).toMatchObject({ result: 'crashed', balanceMinor: 90_00 });
    await r2.events;
  });

  // Setback after 4 s keeps the halved value above the light profile's x1.01 minimum cash-out.
  it('7.4 a cash-out right at a setback gets the reduced value', async () => {
    const { token, sessionId } = await newSession();
    // No boost before the cash-out, so the expected value is exactly growth × 0.5.
    const outcome = await seedFor(
      token,
      sessionId,
      (o) => o.setbacks.length > 0 && o.setbacks[0]! > 4 && o.crashTime > o.setbacks[0]! + 1 && (o.boosts[0] ?? 99) > o.setbacks[0]!,
    );
    const r = await start(token, { betMinor: 10_00 });
    await time.advance(Math.ceil(outcome.setbacks[0]! * 1000));
    const res = (await (await call('POST', `/v1/rounds/${r.roundId}/cashout`, token)).json()) as { settlement: { time: number; multiplier: number } };
    const t = res.settlement.time;
    const growth = Math.exp(DEFAULT_CONFIG.r0 * t + ((DEFAULT_CONFIG.rmax - DEFAULT_CONFIG.r0) * t * t) / (2 * DEFAULT_CONFIG.tRamp));
    expect(res.settlement.multiplier).toBeCloseTo(growth * 0.5, 9);
    await time.advance(1000);
    const events = await r.events;
    expect(events.map((e) => e.type)).toEqual(['START', 'SETBACK', 'CASHED_OUT']);
  });

  it('7.5 settles auto cash-out and crashes while no stream is connected', async () => {
    const { token, sessionId } = await newSession();
    await seedFor(token, sessionId, (o) => o.crashTime > 12 && o.setbacks.length === 0);
    const res = await call('POST', '/v1/rounds', token, { betMinor: 10_00, autoCashout: 3 });
    await time.advance(0);
    const roundId = ((await (await call('GET', '/v1/rounds', token)).json()) as { roundId: string }[])[0]!.roundId;
    await res.body?.cancel(); // client disconnects
    await time.advance(40_000);
    const snap = (await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as { status: string; settlement: { reason: string; payoutMinor: number } };
    expect(snap).toMatchObject({ status: 'won', settlement: { reason: 'auto', payoutMinor: 30_00 } });
    expect(await store.getBalance(sessionId)).toBe(120_00);

    await seedFor(token, sessionId, (o) => o.crashTime > 1 && o.crashTime < 4);
    const res2 = await call('POST', '/v1/rounds', token, { betMinor: 10_00 });
    await res2.body?.cancel();
    await time.advance(10_000);
    const id2 = ((await (await call('GET', '/v1/rounds', token)).json()) as { roundId: string }[])[0]!.roundId;
    expect(((await (await call('GET', `/v1/rounds/${id2}`, token)).json()) as { status: string }).status).toBe('lost');
    expect((await call('POST', '/v1/rounds', token, { betMinor: 1_00 })).status).toBe(200);
  });

  it('7.6 never exposes the crash time or future setbacks while running', async () => {
    const { token, sessionId } = await newSession();
    const outcome = await seedFor(
      token,
      sessionId,
      (o) => o.setbacks.length >= 2 && o.setbacks[0]! < 3 && o.crashTime > o.setbacks[1]! + 1 && (o.boosts[0] ?? 99) > o.setbacks[0]!,
    );
    const r = await start(token, { betMinor: 1_00 });
    await time.advance(Math.ceil(outcome.setbacks[0]! * 1000) + 10);
    const running = await (await call('GET', `/v1/rounds/${r.roundId}`, token)).text();
    const snap = JSON.parse(running) as { status: string; setbacks: number[]; boosts: number[]; settlement: unknown };
    expect(snap.status).toBe('running');
    expect(snap.setbacks).toEqual([outcome.setbacks[0]]);
    // Boosts are hidden by the same rule: only those already past.
    expect(snap.boosts).toEqual(outcome.boosts.filter((t) => t <= outcome.setbacks[0]! + 0.02));
    for (const t of outcome.boosts.filter((b) => b > outcome.setbacks[0]! + 0.02)) expect(running).not.toContain(String(t));
    expect(snap.settlement).toBeNull();
    expect(running).not.toMatch(/crashTime|serverSeed/);
    expect(running).not.toContain(String(outcome.setbacks[1]));
    expect(running).not.toContain(String(outcome.crashTime));
    await time.advance(120_000);
    const settled = (await (await call('GET', `/v1/rounds/${r.roundId}`, token)).json()) as { settlement: { crashTime: number } };
    expect(settled.settlement.crashTime).toBe(outcome.crashTime);
    await r.events;
  });

  it('health reports store connectivity', async () => {
    const res = await call('GET', '/health');
    expect(res.status).toBe(200);
  });
});

describe('redisPing', () => {
  it('writes and reads a probe key', async () => {
    expect(await redisPing(mockRedis())).toBe(true);
  });
});
