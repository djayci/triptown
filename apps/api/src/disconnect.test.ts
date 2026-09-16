import { MemoryRoundStore, profileFromTemplate, type JurisdictionProfile } from '@triptown/core';
import { deriveRound, resolveConfigId } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { FakeTime, readSse } from './test-helpers';

function setup(policy: JurisdictionProfile['disconnectPolicy']) {
  const time = new FakeTime();
  const store = new MemoryRoundStore();
  const app = createApp({
    store,
    sessionSecret: 's',
    now: time.now,
    sleep: time.sleep,
    keepAliveMs: 60_000,
    profiles: { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0, disconnectPolicy: policy } },
  });
  const call = (method: string, path: string, token?: string, body?: unknown) =>
    app.request(path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const session = async (predicate: (o: { crashTime: number; setbacks: number[] }) => boolean) => {
    const { token, session: s } = (await (await call('POST', '/v1/sessions', undefined, {})).json()) as { token: string; session: { sessionId: string; config: { id: string } } };
    const rec = (await store.getSession(s.sessionId))!;
    const config = resolveConfigId(s.config.id)!;
    for (let i = 0; i < 5000; i++) {
      const o = deriveRound({ serverSeed: rec.serverSeed, clientSeed: `d-${i}`, nonce: rec.nonce }, config);
      if (predicate(o)) {
        await call('PUT', '/v1/session/client-seed', token, { clientSeed: `d-${i}` });
        return { token, outcome: o };
      }
    }
    throw new Error('no outcome');
  };
  return { time, store, call, session };
}

const noEarlySetback = (o: { setbacks: number[] }) => (o.setbacks[0] ?? 99) > 6;

describe('disconnect policies (3.7)', () => {
  it('cashout-at-disconnect settles at detection time when the stream closes before the crash', async () => {
    const { time, call, session } = setup('cashout-at-disconnect');
    const { token, outcome } = await session((o) => o.crashTime > 5 && noEarlySetback(o));
    const res = await call('POST', '/v1/rounds', token, { betMinor: 1_00 });
    const reader = res.body!.getReader();
    await reader.read(); // START delivered
    await time.advance(2_000);
    await reader.cancel(); // connection lost
    await time.advance(10);
    const roundId = ((await (await call('GET', '/v1/rounds', token)).json()) as { roundId: string }[])[0]!.roundId;
    const snap = (await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as { status: string; settlement: { reason: string; time: number; crashTime: number } };
    expect(snap.status).toBe('won');
    expect(snap.settlement.reason).toBe('disconnect');
    expect(snap.settlement.time).toBeGreaterThanOrEqual(2);
    expect(snap.settlement.time).toBeLessThan(2.1);
    expect(snap.settlement.crashTime).toBe(outcome.crashTime);
  });

  it('a round that crashed before the disconnect is lost', async () => {
    const { time, call, session } = setup('cashout-at-disconnect');
    const { token } = await session((o) => o.crashTime > 0.5 && o.crashTime < 1.5);
    const res = await call('POST', '/v1/rounds', token, { betMinor: 1_00 });
    const events = readSse(res);
    await time.advance(2_000);
    await events;
    const roundId = ((await (await call('GET', '/v1/rounds', token)).json()) as { roundId: string }[])[0]!.roundId;
    expect(((await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as { status: string }).status).toBe('lost');
  });

  it('lose policy is unchanged: a closed stream does not cash out', async () => {
    const { time, call, session } = setup('lose');
    const { token } = await session((o) => o.crashTime > 5 && o.crashTime < 10 && noEarlySetback(o));
    const res = await call('POST', '/v1/rounds', token, { betMinor: 1_00 });
    const reader = res.body!.getReader();
    await reader.read();
    await time.advance(2_000);
    await reader.cancel();
    await time.advance(15_000);
    const roundId = ((await (await call('GET', '/v1/rounds', token)).json()) as { roundId: string }[])[0]!.roundId;
    expect(((await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as { status: string }).status).toBe('lost');
  });

  it('heartbeat backstop cashes out 3 s after the last heartbeat when no stream close is seen', async () => {
    const { time, call, session } = setup('cashout-at-disconnect');
    const { token } = await session((o) => o.crashTime > 9 && (o.setbacks[0] ?? 99) > 9);
    const res = await call('POST', '/v1/rounds', token, { betMinor: 1_00 });
    const started = time.t;
    // Simulate a client whose stream died silently: stop reading without closing, send heartbeats.
    const roundId = ((await (await call('GET', '/v1/rounds', token)).json()) as { roundId: string }[])[0]!.roundId;
    void res; // stream left open but idle
    for (const at of [2_000, 4_000]) {
      time.t = started + at;
      expect((await call('POST', `/v1/rounds/${roundId}/heartbeat`, token)).status).toBe(204);
    }
    time.t = started + 5_000; // the open stream would poll too; freeze it by jumping without advancing sleepers
    const early = (await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as { status: string };
    expect(early.status).toBe('running');
    time.t = started + 7_500;
    const snap = (await (await call('GET', `/v1/rounds/${roundId}`, token)).json()) as { status: string; settlement: { reason: string; time: number } };
    expect(snap).toMatchObject({ status: 'won', settlement: { reason: 'disconnect' } });
    expect(snap.settlement.time).toBeCloseTo(7, 6);
  });
});
