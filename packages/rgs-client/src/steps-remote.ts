import type { RevealedSeed } from '@triptown/core';
import type { Difficulty, StepRoundSnapshot, StepSeedRotation, StepSessionInfo } from '@triptown/steps';
import type { TokenStorage } from './remote';
import { StepServiceError, newActionKey, type StepActionResult, type StepRoundService, type StepServiceErrorCode } from './steps';

export interface RemoteStepRoundServiceOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  tokenStorage?: TokenStorage;
  clientVersion?: string;
}

const memoryStorage = (): TokenStorage => {
  let t: string | null = null;
  return { get: () => t, set: (v) => void (t = v) };
};

/** StepRoundService over the Triptown step API (HTTP only, design D6). */
export class RemoteStepRoundService implements StepRoundService {
  readonly mode = 'live' as const;
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: TokenStorage;
  private readonly clientVersion: string | undefined;
  private creating: Promise<string> | null = null;

  constructor(opts: RemoteStepRoundServiceOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.storage = opts.tokenStorage ?? memoryStorage();
    this.clientVersion = opts.clientVersion;
  }

  getSession() {
    return this.json<StepSessionInfo>('GET', '/v1/steps/session');
  }

  startStepRound(input: { stakeMinor: number; difficulty: Difficulty }) {
    return this.json<StepActionResult>('POST', '/v1/steps/rounds', input);
  }

  jump(roundId: string, key = newActionKey()) {
    return this.action(`/v1/steps/rounds/${encodeURIComponent(roundId)}/jump`, key);
  }

  collect(roundId: string, key = newActionKey()) {
    return this.action(`/v1/steps/rounds/${encodeURIComponent(roundId)}/collect`, key);
  }

  getStepRound(roundId: string) {
    return this.json<StepRoundSnapshot>('GET', `/v1/steps/rounds/${encodeURIComponent(roundId)}`);
  }

  async activeStepRound() {
    return (await this.json<{ round: StepRoundSnapshot | null }>('GET', '/v1/steps/active')).round;
  }

  stepHistory(limit = 50) {
    return this.json<StepRoundSnapshot[]>('GET', `/v1/steps/rounds?limit=${limit}`);
  }

  setClientSeed(clientSeed: string) {
    return this.json<StepSessionInfo>('PUT', '/v1/steps/session/client-seed', { clientSeed });
  }

  rotateSeed() {
    return this.json<StepSeedRotation>('POST', '/v1/steps/session/rotate');
  }

  revealedSeeds() {
    return this.json<RevealedSeed[]>('GET', '/v1/steps/session/seeds');
  }

  /** A JUMP or COLLECT whose response was lost is retried once with the same key, so it applies at most once. */
  private async action(path: string, key: string) {
    try {
      return await this.json<StepActionResult>('POST', path, { key });
    } catch (err) {
      if (err instanceof StepServiceError && err.code === 'network') return this.json<StepActionResult>('POST', path, { key });
      throw err;
    }
  }

  private async token(): Promise<string> {
    const existing = this.storage.get();
    if (existing) return existing;
    this.creating ??= (async () => {
      const res = await this.raw('POST', '/v1/steps/sessions', { ...(this.clientVersion && { clientVersion: this.clientVersion }) }, null);
      if (!res.ok) throw await toError(res);
      const { token } = (await res.json()) as { token: string };
      this.storage.set(token);
      return token;
    })().finally(() => {
      this.creating = null;
    });
    return this.creating;
  }

  private async raw(method: string, path: string, body: unknown, token: string | null) {
    try {
      return await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new StepServiceError('network', 'Network error');
    }
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res = await this.raw(method, path, body, await this.token());
    if (res.status === 401) {
      this.storage.set(null);
      res = await this.raw(method, path, body, await this.token());
    }
    if (!res.ok) throw await toError(res);
    return (await res.json()) as T;
  }
}

async function toError(res: Response): Promise<StepServiceError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } & Record<string, unknown> };
    const { code = 'unknown', message, ...details } = body.error ?? {};
    return new StepServiceError(code as StepServiceErrorCode, message ?? `HTTP ${res.status}`, details);
  } catch {
    return new StepServiceError(res.status >= 500 ? 'network' : 'unknown', `HTTP ${res.status}`);
  }
}
