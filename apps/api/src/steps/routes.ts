// Step game routes under /v1/steps (design D6). HTTP only: a JUMP or COLLECT is one request and one answer.
import { type AuditSink, type JurisdictionProfile, type RoundStore, type SeedCipher, passThroughCipher } from '@triptown/core';
import type { CryptoProvider } from '@triptown/fairness';
import { STEP_CONFIGS, StepError, StepHost, deriveFences, type Difficulty, type StepErrorCode, type StepRoundStore } from '@triptown/steps';
import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { signSession, verifySessionToken } from '../session-token';

const STATUS: Record<StepErrorCode, ContentfulStatusCode> = {
  session_not_found: 401,
  forbidden: 403,
  round_not_found: 404,
  insufficient_funds: 402,
  bet_limit: 422,
  invalid_bet: 422,
  invalid_difficulty: 422,
  invalid_action_key: 422,
  invalid_client_seed: 422,
  round_in_progress: 409,
  round_not_running: 409,
  nothing_to_collect: 409,
  game_disabled: 423,
  integrity_blocked: 423,
  cycle_too_soon: 429,
  conflict: 409,
};

export interface StepRoutesOptions {
  store: RoundStore;
  steps: StepRoundStore;
  sessionSecret: string;
  clock: { now(): number };
  profiles?: { defaultProfile: JurisdictionProfile; allowOverride?: boolean; operators?: Readonly<Record<string, JurisdictionProfile>> };
  seedCipher?: SeedCipher;
  audit?: AuditSink;
  crypto?: CryptoProvider;
  initialBalanceMinor?: number;
  abandonAfterMs?: number;
  /** Dev and test only: exposes POST /dev/force to pick the next round's refusal fence. Never set in production. */
  allowForce?: boolean;
}

export function createStepHost(opts: StepRoutesOptions) {
  return new StepHost({
    store: opts.store,
    steps: opts.steps,
    clock: opts.clock,
    ...(opts.profiles && { profiles: opts.profiles }),
    ...(opts.seedCipher && { seedCipher: opts.seedCipher }),
    ...(opts.audit && { audit: opts.audit }),
    ...(opts.crypto && { crypto: opts.crypto }),
    ...(opts.abandonAfterMs !== undefined && { abandonAfterMs: opts.abandonAfterMs }),
  });
}

export function createStepRoutes(opts: StepRoutesOptions, host = createStepHost(opts)) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof StepError) return c.json({ error: { code: err.code, message: err.message, ...err.details } }, STATUS[err.code]);
    console.error('[steps]', err instanceof Error ? err.message : err);
    return c.json({ error: { code: 'unknown', message: 'Unexpected error' } }, 500);
  });

  const sessionId = async (c: Context) => {
    const header = c.req.header('Authorization') ?? '';
    const id = await verifySessionToken(header.replace(/^Bearer\s+/i, ''), opts.sessionSecret);
    if (!id) throw new StepError('session_not_found', 'Missing or invalid session token');
    return id;
  };
  const body = async <T>(c: Context) => (await c.req.json().catch(() => ({}))) as T;

  app.post('/sessions', async (c) => {
    const b = await body<{ clientSeed?: string; clientVersion?: string }>(c);
    const session = await host.createSession(opts.initialBalanceMinor ?? 1_000_00, { clientSeed: b.clientSeed, clientVersion: b.clientVersion });
    return c.json({ token: await signSession(session.sessionId, opts.sessionSecret), session }, 201);
  });

  app.get('/session', async (c) => c.json(await host.sessionInfo(await sessionId(c))));

  app.put('/session/client-seed', async (c) => {
    const sid = await sessionId(c);
    const { clientSeed } = await body<{ clientSeed?: string }>(c);
    return c.json(await host.setClientSeed(sid, clientSeed ?? ''));
  });

  app.post('/session/rotate', async (c) => c.json(await host.rotateSeed(await sessionId(c))));

  app.get('/session/seeds', async (c) => c.json(await host.revealedSeeds(await sessionId(c))));

  app.post('/rounds', async (c) => {
    const sid = await sessionId(c);
    const b = await body<{ stakeMinor?: number; difficulty?: string }>(c);
    return c.json(await host.startRound(sid, { stakeMinor: Number(b.stakeMinor), difficulty: String(b.difficulty) as Difficulty }), 201);
  });

  app.post('/rounds/:id/jump', async (c) => {
    const sid = await sessionId(c);
    const { key } = await body<{ key?: string }>(c);
    return c.json(await host.jump(sid, c.req.param('id'), String(key ?? '')));
  });

  app.post('/rounds/:id/collect', async (c) => {
    const sid = await sessionId(c);
    const { key } = await body<{ key?: string }>(c);
    return c.json(await host.collect(sid, c.req.param('id'), String(key ?? '')));
  });

  app.get('/rounds/:id', async (c) => c.json(await host.getRound(await sessionId(c), c.req.param('id'))));

  app.get('/rounds', async (c) => {
    const limit = Math.min(50, Math.max(1, Math.floor(Number(c.req.query('limit') ?? 50)) || 50));
    return c.json(await host.history(await sessionId(c), limit));
  });

  app.get('/active', async (c) => c.json({ round: await host.activeRound(await sessionId(c)) }));

  if (opts.allowForce) {
    app.post('/dev/force', async (c) => {
      const sid = await sessionId(c);
      const { refuseAt = null, difficulty = 'medium' } = await body<{ refuseAt?: number | null; difficulty?: Difficulty }>(c);
      const session = await opts.store.getSession(sid);
      if (!session) throw new StepError('session_not_found', 'Session not found');
      const serverSeed = await (opts.seedCipher ?? passThroughCipher).decrypt(session.serverSeed);
      for (let i = 0; i < 50_000; i++) {
        const clientSeed = `dev-fence-${refuseAt ?? 'finish'}-${i}`;
        if (deriveFences({ serverSeed, clientSeed, nonce: session.nonce }, STEP_CONFIGS[difficulty], opts.crypto).refusedAt === refuseAt) {
          await opts.store.updateSession(sid, { clientSeed });
          return c.json({ clientSeed });
        }
      }
      return c.json({ error: { code: 'unknown', message: 'No seed found' } }, 500);
    });
  }

  return app;
}
