import { MemoryRoundStore, profileFromTemplate, type RoundStore, type RoundSummary } from '@triptown/core';
import { deriveRound, resolveConfigId } from '@triptown/fairness';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createApp, parseRoundQuery } from './app';
import { RedisRoundStore } from './redis-store';
import { roundsCsv } from './round-csv';
import { FakeTime, mockRedis } from './test-helpers';

const stores: [string, () => RoundStore][] = [
  ['memory store', () => new MemoryRoundStore()],
  ['redis store', () => new RedisRoundStore(mockRedis())],
];

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe.each(stores)('round recall over the API (%s)', (_name, makeStore) => {
  const setup = () => {
    const time = new FakeTime();
    const store = makeStore();
    const unpaced = { ...profileFromTemplate('light'), minCycleMs: 0 };
    const app = createApp({
      store,
      sessionSecret: 's',
      now: time.now,
      sleep: time.sleep,
      keepAliveMs: 60_000,
      profiles: { defaultProfile: unpaced, operators: { acme: unpaced, other: unpaced } },
      operatorKeys: { acme: sha('acme-key'), other: sha('other-key') },
    });
    const call = (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) =>
      app.request(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

    const session = async (body: Record<string, unknown> = {}, headers: Record<string, string> = {}) => {
      const res = await call('POST', '/v1/sessions', headers, body);
      expect(res.status).toBe(201);
      return (await res.json()) as { token: string; session: { sessionId: string; config: { id: string } } };
    };

    /** Plays one round that crashes quickly and lets it settle. */
    const playLoss = async (token: string, sessionId: string) => {
      const s = (await store.getSession(sessionId))!;
      const config = resolveConfigId('whack-crash/v1')!;
      for (let i = 0; i < 50_000; i++) {
        if (deriveRound({ serverSeed: s.serverSeed, clientSeed: `l-${i}`, nonce: s.nonce }, config).crashTime < 1) {
          await call('PUT', '/v1/session/client-seed', bearer(token), { clientSeed: `l-${i}` });
          break;
        }
      }
      const res = await call('POST', '/v1/rounds', bearer(token), { betMinor: 1_00 });
      expect(res.status).toBe(200);
      await res.body?.cancel();
      await time.advance(2_000);
    };

    return { time, store, call, bearer, session, playLoss };
  };

  it('4.2 lists the player’s rounds newest first and hides running outcomes', async () => {
    const { call, bearer, session, playLoss, time, store } = setup();
    const { token, session: info } = await session({ clientVersion: 'whack@9.9.9' });
    for (let i = 0; i < 3; i++) await playLoss(token, info.sessionId);

    const res = await call('GET', '/v1/rounds?limit=500', bearer(token));
    const list = (await res.json()) as RoundSummary[];
    expect(list).toHaveLength(3);
    expect(list.map((r) => r.startedAt)).toEqual([...list.map((r) => r.startedAt)].sort((a, b) => b - a));
    expect(list[0]).toMatchObject({ status: 'lost', resultKind: 'loss', netMinor: -1_00, clientVersion: 'whack@9.9.9', profile: 'light' });

    // Running round: listed, but no crash time, crash multiplier or future setbacks.
    const s = (await store.getSession(info.sessionId))!;
    const config = resolveConfigId('whack-crash/v1')!;
    let outcome;
    for (let i = 0; i < 50_000 && !outcome; i++) {
      const o = deriveRound({ serverSeed: s.serverSeed, clientSeed: `r-${i}`, nonce: s.nonce }, config);
      if (o.crashTime > 4 && o.setbacks.length > 0 && o.setbacks[0]! > 2) {
        await call('PUT', '/v1/session/client-seed', bearer(token), { clientSeed: `r-${i}` });
        outcome = o;
      }
    }
    if (!outcome) throw new Error('no matching outcome');
    const running = await call('POST', '/v1/rounds', bearer(token), { betMinor: 1_00 });
    await time.advance(1_000);
    const text = await (await call('GET', '/v1/rounds', bearer(token))).text();
    const [top] = JSON.parse(text) as RoundSummary[];
    expect(top).toMatchObject({ status: 'running', settlement: null, crashMultiplier: null, returnMinor: null, setbacks: [] });
    expect(text).not.toContain(String(outcome.crashTime));
    expect(text).not.toContain(String(outcome.setbacks[0]));
    await running.body?.cancel();
  });

  it('4.2 caps in-game history at 50 rounds', async () => {
    const { call, bearer, session, time } = setup();
    const { token } = await session();
    for (let i = 0; i < 51; i++) {
      const res = await call('POST', '/v1/rounds', bearer(token), { betMinor: 20 });
      expect(res.status).toBe(200);
      await res.body?.cancel();
      await time.advance(61_000);
    }
    const list = (await (await call('GET', '/v1/rounds?limit=100', bearer(token))).json()) as RoundSummary[];
    expect(list).toHaveLength(50);
  }, 60_000);

  it('4.3 binds a player only with the operator key and serves records to that operator', async () => {
    const { call, session, playLoss, time } = setup();
    expect((await call('POST', '/v1/sessions', {}, { operator: 'acme', player: 'p1' })).status).toBe(401);
    expect((await call('POST', '/v1/sessions', { 'X-Operator-Key': 'other-key' }, { operator: 'acme', player: 'p1' })).status).toBe(401);

    const { token, session: info } = await session({ operator: 'acme', player: 'p1' }, { 'X-Operator-Key': 'acme-key' });
    const t0 = time.t;
    for (let i = 0; i < 3; i++) await playLoss(token, info.sessionId);

    expect((await call('GET', '/v1/operator/rounds?player=p1')).status).toBe(401);
    expect((await call('GET', '/v1/operator/rounds?player=p1', { Authorization: 'Bearer wrong' })).status).toBe(401);

    const acme = { Authorization: 'Bearer acme-key' };
    const page1 = (await (await call('GET', '/v1/operator/rounds?player=p1&limit=2', acme)).json()) as { rounds: RoundSummary[]; nextCursor: string | null };
    expect(page1.rounds).toHaveLength(2);
    expect(page1.rounds[0]).toMatchObject({ playerId: 'acme:p1', sessionId: info.sessionId });
    expect(page1.nextCursor).toBeTruthy();
    // A round started after the first page must not shift the second page.
    await time.advance(1);
    await playLoss(token, info.sessionId);
    const page2 = (await (await call('GET', `/v1/operator/rounds?player=p1&limit=2&cursor=${page1.nextCursor}`, acme)).json()) as {
      rounds: RoundSummary[];
      nextCursor: string | null;
    };
    expect(page2.rounds).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    expect(new Set([...page1.rounds, ...page2.rounds].map((r) => r.roundId)).size).toBe(3);

    // Other operators see nothing for the same player id.
    const other = (await (await call('GET', '/v1/operator/rounds?player=p1', { Authorization: 'Bearer other-key' })).json()) as { rounds: unknown[] };
    expect(other.rounds).toEqual([]);

    // CSV: header plus one row per settled round in range (the first round is excluded by `from`).
    const secondStart = page2.rounds[0]!.startedAt + 1;
    const csvRes = await call('GET', `/v1/operator/rounds?player=p1&format=csv&from=${secondStart}&to=${new Date(time.t).toISOString()}`, acme);
    expect(csvRes.headers.get('Content-Type')).toContain('text/csv');
    const lines = (await csvRes.text()).trim().split('\r\n');
    expect(lines[0]).toMatch(/^round_id,session_id,player_id,game_id,config_id,profile,client_version,started_at,settled_at/);
    expect(lines).toHaveLength(1 + 3);
    expect(lines[1]).toContain(',lost,');
    expect(t0).toBeLessThan(secondStart);
  });
});

describe('parseRoundQuery', () => {
  it('validates parameters and pins the cursor window', () => {
    expect(parseRoundQuery({}, 5)).toEqual({ error: 'player is required' });
    expect(parseRoundQuery({ player: 'p', limit: '0' }, 5)).toHaveProperty('error');
    expect(parseRoundQuery({ player: 'p', format: 'xml' }, 5)).toHaveProperty('error');
    expect(parseRoundQuery({ player: 'p', cursor: 'nope' }, 5)).toHaveProperty('error');
    expect(parseRoundQuery({ player: 'p', from: '2026-01-01T00:00:00Z', cursor: '900:40' }, 5)).toEqual({
      player: 'p',
      fromMs: Date.parse('2026-01-01T00:00:00Z'),
      toMs: 900,
      offset: 40,
      limit: 100,
      format: 'json',
    });
  });
});

describe('roundsCsv', () => {
  it('quotes separators and neutralises spreadsheet formulas', () => {
    const row = { roundId: 'r1', clientVersion: '=HYPERLINK("x")', cashouts: [], setbacks: [1.5, 2], status: 'lost', settlement: null } as unknown as RoundSummary;
    const [, line] = roundsCsv([row]).trim().split('\r\n');
    expect(line).toContain(`"'=HYPERLINK(""x"")"`);
    expect(line).toContain(',1.5;2,');
  });
});
