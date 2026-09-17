import {
  HostError,
  MemoryRoundStore,
  RoundHost,
  profileFromTemplate,
  registerGame,
  registeredGames,
  type GameId,
  type HostErrorCode,
  type JurisdictionProfile,
  type ProfileSettings,
  type ReportIndex,
  type RoundEvent,
  type RoundStore,
  type AuditSink,
  type SeedCipher,
  redactSeeds,
} from '@triptown/core';
import reportIndex from '@triptown/fairness/reports/index.json';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { upstashRedis } from './redis-clients';
import { DEFAULT_RETENTION_DAYS, RedisRoundStore, type RedisLike } from './redis-store';
import { RedisAuditLog } from './audit-log';
import { checkIntegrity, MANIFEST_FILE } from './integrity';
import { nodeCrypto } from './node-crypto';
import { roundsCsv } from './round-csv';
import { aesGcmSeedCipher } from './seed-cipher';
import { signSession, verifySessionToken } from './session-token';
import { TimeSource } from './time-source';

export interface AppOptions {
  store: RoundStore;
  sessionSecret: string;
  initialBalanceMinor?: number;
  allowedOrigins?: string[];
  now?: () => number;
  /** Shared time authority; awaited on cold start before any settlement-relevant request. */
  timeSource?: TimeSource;
  sleep?: (ms: number) => Promise<void>;
  keepAliveMs?: number;
  /** Store connectivity probe for /health. */
  ping?: () => Promise<boolean>;
  profiles?: ProfileSettings;
  seedCipher?: SeedCipher;
  audit?: AuditSink;
  /** Bearer key for /v1/admin endpoints; admin routes are disabled when unset. */
  adminApiKey?: string;
  /** Operator id → SHA-256 hex of its API key. Needed to bind a player id and to read round records. */
  operatorKeys?: Record<string, string>;
  /** Software integrity check of the running bundle. */
  integrity?: { dir: string; publicKeyPem: string; cronSecret?: string };
  /** Region this deployment runs in, checked against profiles' `hostingRegions`. */
  deploymentRegion?: string;
}

const STATUS: Record<HostErrorCode, ContentfulStatusCode> = {
  session_not_found: 401,
  forbidden: 403,
  round_not_found: 404,
  insufficient_funds: 402,
  round_in_progress: 409,
  bet_limit: 422,
  invalid_bet: 422,
  invalid_auto_cashout: 422,
  invalid_client_seed: 422,
  below_min_cashout: 422,
  game_disabled: 423,
  profile_not_allowed: 403,
  cycle_too_soon: 429,
  integrity_blocked: 423,
  round_voided: 503,
  no_parts_left: 409,
  region_blocked: 403,
  region_required: 422,
  profile_unavailable: 503,
};

export function createApp(opts: AppOptions) {
  // Games that are skins on an existing engine register here: same certified config ids, same
  // committed RTP reports, nothing to recertify. The Lift plays the Whack Crash engine.
  registerGame('the-lift', 'whack-crash');
  // Beat the Gate plays the same engine (beat-the-gate-mvp D1).
  registerGame('beat-the-gate', 'whack-crash', { reveal: ['onCollect'] });

  const makeHost = (game: GameId) =>
    new RoundHost({
      store: opts.store,
      clock: opts.timeSource ?? { now: opts.now ?? (() => Date.now()) },
      sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      profiles: opts.profiles,
      crypto: nodeCrypto,
      seedCipher: opts.seedCipher,
      audit: opts.audit,
      settlementPollMs: 1000,
      game,
    });
  // One host per game over the same store; a session is bound to the game it was created for.
  // One host per registered game. A new game registers itself and gets a host here without a core edit.
  const hosts: Record<GameId, RoundHost> = Object.fromEntries(registeredGames().map((g) => [g, makeHost(g)]));
  // The registry is open, so a lookup can miss: refuse an unregistered game rather than silently
  // falling back to another game's maths, which would settle a round under the wrong config id.
  const gameHost = (game: GameId): RoundHost => {
    const h = hosts[game];
    if (!h) throw new Error(`Unregistered game: ${game}`);
    return h;
  };
  const host = gameHost('whack-crash');
  const hostFor = async (sid: string) => {
    const session = await opts.store.getSession(sid);
    return session?.game ? gameHost(session.game) : host;
  };
  const keepAliveMs = opts.keepAliveMs ?? 10_000;
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origin) => (!opts.allowedOrigins?.length || opts.allowedOrigins.includes(origin) ? origin || '*' : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      maxAge: 600,
    }),
  );

  if (opts.timeSource) {
    const ts = opts.timeSource;
    app.use('/v1/*', async (_c, next) => {
      await ts.ensureFresh();
      await next();
    });
  }

  app.onError((err, c) => {
    if (err instanceof HostError) return c.json({ error: { code: err.code, message: err.message, ...err.details } }, STATUS[err.code]);
    console.error('[api]', redactSeeds(err instanceof Error ? { message: err.message, stack: err.stack } : err));
    return c.json({ error: { code: 'unknown', message: 'Unexpected error' } }, 500);
  });

  const sessionId = async (c: Context) => {
    const header = c.req.header('Authorization') ?? '';
    const id = await verifySessionToken(header.replace(/^Bearer\s+/i, ''), opts.sessionSecret);
    if (!id) throw new HostError('session_not_found', 'Missing or invalid session token');
    return id;
  };

  const sse = (c: Context, h: RoundHost, sid: string, roundId: string) =>
    streamSSE(c, async (stream) => {
      let chain = Promise.resolve();
      const handle = h.streamRound(sid, roundId, (event: RoundEvent) => {
        chain = chain.then(() => stream.writeSSE({ event: event.type, data: JSON.stringify(event) }));
      });
      stream.onAbort(() => {
        handle.stop();
        // Under cashout-at-disconnect this settles at detection time; otherwise it's a no-op.
        void h.disconnect(sid, roundId).catch((err) => console.error('[disconnect]', redactSeeds(String(err))));
      });
      const ping = setInterval(() => {
        chain = chain.then(() => stream.write(': ping\n\n')).then(() => undefined);
      }, keepAliveMs);
      try {
        await handle.done;
        await chain;
      } finally {
        clearInterval(ping);
      }
    });

  // Latency probe for the client's RTT estimate. Deliberately touches no store (design D20).
  app.get('/v1/ping', (c) => c.json({ now: host.now() }));

  app.get('/health', async (c) => {
    const ok = opts.ping ? await opts.ping().catch(() => false) : true;
    return c.json({ ok, store: opts.store.constructor.name }, ok ? 200 : 503);
  });

  const requireAdmin = (c: Context) => {
    const given = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!opts.adminApiKey || !safeEqual(given, opts.adminApiKey)) {
      throw new HostError('forbidden', 'Admin access required');
    }
  };

  /** The operator whose API key is presented (Bearer or X-Operator-Key), or null. */
  const operatorFromKey = (given: string): string | null => {
    if (!given) return null;
    const hash = createHash('sha256').update(given).digest('hex');
    for (const [id, expected] of Object.entries(opts.operatorKeys ?? {})) if (safeEqual(hash, expected.toLowerCase())) return id;
    return null;
  };

  const runIntegrity = async (trigger: string) => {
    if (!opts.integrity) return null;
    const result = checkIntegrity(opts.integrity.dir, opts.integrity.publicKeyPem);
    // A failure blocks new rounds; a pass never clears an existing block (that needs an admin).
    await host.setIntegrityBlocked(!result.ok || (await host.isIntegrityBlocked()), { trigger, ...result });
    return result;
  };

  app.get('/v1/admin/integrity', async (c) => {
    requireAdmin(c);
    const result = await runIntegrity('on-demand');
    if (!result) return c.json({ error: { code: 'not_configured', message: 'No integrity manifest in this deployment' } }, 404);
    return c.json({ ...result, blocked: await host.isIntegrityBlocked() });
  });

  app.get('/v1/admin/integrity/cron', async (c) => {
    const given = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!opts.integrity?.cronSecret || !safeEqual(given, opts.integrity.cronSecret)) throw new HostError('forbidden', 'Cron access required');
    const result = await runIntegrity('daily');
    return c.json({ ok: result?.ok ?? false });
  });

  // Repairs rounds left behind by failures (credit-once, settle due rounds, void and refund stuck ones).
  app.get('/v1/admin/reconcile/cron', async (c) => {
    const given = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!opts.integrity?.cronSecret || !safeEqual(given, opts.integrity.cronSecret)) throw new HostError('forbidden', 'Cron access required');
    return c.json(await host.reconcile());
  });

  app.post('/v1/admin/reconcile', async (c) => {
    requireAdmin(c);
    return c.json(await host.reconcile());
  });

  app.post('/v1/admin/integrity/clear', async (c) => {
    requireAdmin(c);
    await host.setIntegrityBlocked(false, { trigger: 'admin-clear' });
    return c.json({ blocked: false });
  });

  if (opts.integrity) {
    // Cold start check; a failure blocks new rounds but never crashes the function.
    void runIntegrity('cold-start').catch((err) => console.error('[integrity]', err));
  }

  app.put('/v1/admin/kill-switch', async (c) => {
    requireAdmin(c);
    const { key, enabled } = (await c.req.json().catch(() => ({}))) as { key?: string; enabled?: boolean };
    try {
      return c.json({ active: await host.setKillSwitch(String(key), enabled === true) });
    } catch (err) {
      return c.json({ error: { code: 'invalid_request', message: (err as Error).message } }, 400);
    }
  });

  app.post('/v1/sessions', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      clientSeed?: string;
      operator?: string;
      profile?: string;
      player?: string;
      clientVersion?: string;
      game?: string;
      region?: string;
    };
    // Binding a player id locks, paces and exposes that player's history, so only the operator may do it.
    if (body.player !== undefined && (!body.operator || operatorFromKey(c.req.header('X-Operator-Key') ?? '') !== body.operator)) {
      return c.json({ error: { code: 'operator_unauthorized', message: 'A player id needs the operator API key' } }, 401);
    }
    const game = (body.game ?? 'whack-crash') as GameId;
    if (!(game in hosts)) return c.json({ error: { code: 'invalid_request', message: `Unknown game: ${String(body.game)}` } }, 400);
    const session = await gameHost(game).createSession(opts.initialBalanceMinor ?? 1_000_00, {
      clientSeed: body.clientSeed,
      operatorId: body.operator,
      // Without a player id (fake wallet) the session id is the player.
      playerId: body.player === undefined ? undefined : String(body.player).slice(0, 128),
      profile: body.profile,
      clientVersion: body.clientVersion,
      // The player region binds market rules, so like the player id it is only taken from the operator.
      playerRegion: body.operator && operatorFromKey(c.req.header('X-Operator-Key') ?? '') === body.operator ? body.region : undefined,
      deploymentRegion: opts.deploymentRegion,
    });
    return c.json({ token: await signSession(session.sessionId, opts.sessionSecret), session }, 201);
  });

  app.get('/v1/session', async (c) => {
    const sid = await sessionId(c);
    return c.json(await (await hostFor(sid)).sessionInfo(sid));
  });

  app.put('/v1/session/client-seed', async (c) => {
    const { clientSeed } = (await c.req.json().catch(() => ({}))) as { clientSeed?: string };
    const sid = await sessionId(c);
    return c.json(await (await hostFor(sid)).setClientSeed(sid, clientSeed ?? ''));
  });

  app.post('/v1/session/rotate', async (c) => {
    const sid = await sessionId(c);
    return c.json(await (await hostFor(sid)).rotateSeed(sid));
  });

  app.get('/v1/session/seeds', async (c) => {
    const sid = await sessionId(c);
    return c.json(await (await hostFor(sid)).revealedSeeds(sid));
  });

  app.post('/v1/rounds', async (c) => {
    const sid = await sessionId(c);
    const body = (await c.req.json().catch(() => ({}))) as { betMinor?: number; autoCashout?: number | null; practice?: boolean };
    // Validation and debit happen before the stream opens, so errors come back as JSON.
    const h = await hostFor(sid);
    const practice = body.practice === true;
    const { round } = await h.startRound(sid, {
      // A practice round carries no stake; the host refuses one that does rather than coercing it.
      betMinor: practice ? 0 : Number(body.betMinor),
      autoCashout: body.autoCashout ?? null,
      ...(practice && { practice: true as const }),
    });
    return sse(c, h, sid, round.id);
  });

  app.get('/v1/rounds/:id/events', async (c) => {
    const sid = await sessionId(c);
    const h = await hostFor(sid);
    await h.getRound(sid, c.req.param('id'));
    return sse(c, h, sid, c.req.param('id'));
  });

  app.post('/v1/rounds/:id/heartbeat', async (c) => {
    const sid = await sessionId(c);
    await (await hostFor(sid)).heartbeat(sid, c.req.param('id'));
    return c.body(null, 204);
  });

  app.post('/v1/rounds/:id/cashout', async (c) => {
    // Capture receive time first so authentication and body parsing never delay the judged moment.
    const receivedAt = host.now();
    const sid = await sessionId(c);
    const body = (await c.req.json().catch(() => ({}))) as { clientTapAt?: number; rttMs?: number };
    return c.json(await (await hostFor(sid)).cashout(sid, c.req.param('id'), { clientTapAt: body.clientTapAt, rttMs: body.rttMs }, receivedAt));
  });

  app.post('/v1/rounds/:id/throws', async (c) => {
    // Receive time is captured before anything else, as for cash-outs.
    const receivedAt = host.now();
    const sid = await sessionId(c);
    const body = (await c.req.json().catch(() => ({}))) as { partId?: string; count?: number | 'all'; clientTapAt?: number; rttMs?: number };
    const count = body.count === 'all' ? 'all' : 1;
    return c.json(
      await (await hostFor(sid)).settleParts(sid, c.req.param('id'), { partId: String(body.partId ?? ''), count, clientTapAt: body.clientTapAt, rttMs: body.rttMs }, receivedAt),
    );
  });

  app.get('/v1/rounds/:id', async (c) => {
    const sid = await sessionId(c);
    return c.json(await (await hostFor(sid)).getRound(sid, c.req.param('id')));
  });

  app.get('/v1/rounds', async (c) => {
    const limit = Math.min(50, Math.max(1, Math.floor(Number(c.req.query('limit') ?? 50)) || 50));
    const sid = await sessionId(c);
    return c.json(await (await hostFor(sid)).history(sid, limit));
  });

  app.get('/v1/operator/rounds', async (c) => {
    const operatorId = operatorFromKey((c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, ''));
    if (!operatorId) return c.json({ error: { code: 'operator_unauthorized', message: 'Valid operator API key required' } }, 401);
    const q = parseRoundQuery(c.req.query(), host.now());
    if ('error' in q) return c.json({ error: { code: 'invalid_request', message: q.error } }, 400);
    const page = await host.playerRounds(`${operatorId}:${q.player}`, { fromMs: q.fromMs, toMs: q.toMs, offset: q.offset, limit: q.limit + 1 });
    const nextCursor = page.length > q.limit ? `${q.toMs}:${q.offset + q.limit}` : null;
    // Records are for settled rounds; a running round has no result to export yet.
    const rounds = page.slice(0, q.limit).filter((r) => r.status !== 'running');
    if (q.format === 'csv') {
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', `attachment; filename="rounds-${operatorId}.csv"`);
      if (nextCursor) c.header('X-Next-Cursor', nextCursor);
      return c.body(roundsCsv(rounds));
    }
    return c.json({ rounds, nextCursor });
  });

  return app;
}

/** Builds the app from environment variables (Vercel or local). */
export async function appFromEnv(env: Record<string, string | undefined> = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  const deployed = !!env.VERCEL_ENV;
  if (deployed && (!url || !token)) throw new Error('Redis is required when deployed: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  const secret = env.SESSION_SECRET ?? (deployed ? undefined : 'local-dev-secret');
  if (!secret) throw new Error('SESSION_SECRET is required when deployed');
  if (deployed && !env.SEED_ENCRYPTION_KEY) throw new Error('SEED_ENCRYPTION_KEY is required when deployed');
  const seedCipher = env.SEED_ENCRYPTION_KEY ? await aesGcmSeedCipher(env.SEED_ENCRYPTION_KEY) : undefined;
  const redis = url && token ? upstashRedis(url, token) : null;
  const retentionDays = Number(env.ROUND_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
  if (!Number.isFinite(retentionDays) || retentionDays < 1) throw new Error('ROUND_RETENTION_DAYS must be a positive number of days');
  const store = redis ? new RedisRoundStore(redis, 'wc:', retentionDays) : new MemoryRoundStore();
  const auditRef: { current?: RedisAuditLog } = {};
  const timeSource = redis
    ? new TimeSource({
        fetchTime: () => redis.time(),
        onDrift: (e) => {
          console.warn('[time] clock drift against Redis TIME', e);
          void auditRef.current?.append('time_drift', { ...e }).catch(() => {});
        },
      })
    : undefined;
  auditRef.current = redis && timeSource ? new RedisAuditLog(redis, { now: () => timeSource.now(), retentionDays }) : undefined;
  const audit = auditRef.current;
  return createApp({
    store,
    timeSource,
    seedCipher,
    audit,
    profiles: profilesFromEnv(env),
    adminApiKey: env.ADMIN_API_KEY,
    operatorKeys: operatorKeysFromEnv(env),
    integrity: integrityFromEnv(env),
    ping: redis ? () => redisPing(redis) : undefined,
    sessionSecret: secret,
    deploymentRegion: env.DEPLOYMENT_REGION ?? env.VERCEL_REGION,
    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
  });
}

/** Writes and reads back a short-lived key. */
export async function redisPing(redis: RedisLike): Promise<boolean> {
  const key = `wc:health:${Date.now()}`;
  const value = String(Math.random());
  await redis.set(key, value, { exSeconds: 60 });
  return (await redis.get(key)) === value;
}

interface OperatorEnvEntry {
  profile: string;
  origins: string[];
  /** SHA-256 hex of the operator's API key. */
  apiKeyHash?: string;
}

const MAX_OPERATOR_PAGE = 500;

type RoundQuery = { player: string; fromMs?: number; toMs: number; offset: number; limit: number; format: 'json' | 'csv' };

/** Parses operator round-list parameters. The cursor pins `to` so new rounds don't shift later pages. */
export function parseRoundQuery(query: Record<string, string>, nowMs: number): RoundQuery | { error: string } {
  const player = query.player;
  if (!player) return { error: 'player is required' };
  const time = (v: string | undefined) => (v === undefined ? undefined : /^\d+$/.test(v) ? Number(v) : Date.parse(v));
  const fromMs = time(query.from);
  let toMs = time(query.to) ?? nowMs;
  let offset = 0;
  if (query.cursor) {
    const m = /^(\d+):(\d+)$/.exec(query.cursor);
    if (!m) return { error: 'invalid cursor' };
    toMs = Number(m[1]);
    offset = Number(m[2]);
  }
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return { error: 'from and to must be epoch ms or ISO dates' };
  const limit = query.limit === undefined ? 100 : Math.floor(Number(query.limit));
  if (!(limit >= 1 && limit <= MAX_OPERATOR_PAGE)) return { error: `limit must be 1-${MAX_OPERATOR_PAGE}` };
  const format = query.format ?? 'json';
  if (format !== 'json' && format !== 'csv') return { error: 'format must be json or csv' };
  return { player, fromMs, toMs, offset, limit, format };
}

/**
 * DEFAULT_PROFILE (template name), DEFAULT_ORIGINS (comma list), OPERATORS (JSON: id -> {profile, origins}),
 * ALLOW_PROFILE_OVERRIDE ('true' only on dev/preview). Profiles are validated against the RTP report index.
 */
export function profilesFromEnv(env: Record<string, string | undefined>): ProfileSettings {
  const deployed = env.VERCEL_ENV === 'production';
  const allowOverride = env.ALLOW_PROFILE_OVERRIDE === 'true';
  if (deployed && allowOverride) throw new Error('ALLOW_PROFILE_OVERRIDE must not be enabled in production');
  const origins = (env.DEFAULT_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const defaultProfile = profileFromTemplate(env.DEFAULT_PROFILE ?? 'light', origins);
  const operators: Record<string, JurisdictionProfile> = {};
  if (env.OPERATORS) {
    const parsed = JSON.parse(env.OPERATORS) as Record<string, OperatorEnvEntry>;
    for (const [id, entry] of Object.entries(parsed)) operators[id] = profileFromTemplate(entry.profile, entry.origins);
  }
  return { defaultProfile, operators, allowOverride, reportIndex: reportIndex as ReportIndex };
}

export function operatorKeysFromEnv(env: Record<string, string | undefined>): Record<string, string> {
  if (!env.OPERATORS) return {};
  const keys: Record<string, string> = {};
  for (const [id, entry] of Object.entries(JSON.parse(env.OPERATORS) as Record<string, OperatorEnvEntry>)) {
    if (entry.apiKeyHash && /^[0-9a-f]{64}$/i.test(entry.apiKeyHash)) keys[id] = entry.apiKeyHash;
  }
  return keys;
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** The deployed function directory holds the manifest; the verification key comes from RELEASE_PUBLIC_KEY. */
function integrityFromEnv(env: Record<string, string | undefined>) {
  const dir = dirname(fileURLToPath(import.meta.url));
  if (!existsSync(join(dir, MANIFEST_FILE))) return undefined;
  const publicKeyPem = env.RELEASE_PUBLIC_KEY?.replace(/\\n/g, '\n');
  if (!publicKeyPem) {
    console.warn('[integrity] RELEASE_PUBLIC_KEY not set; integrity checks disabled');
    return undefined;
  }
  return { dir, publicKeyPem, cronSecret: env.CRON_SECRET };
}
