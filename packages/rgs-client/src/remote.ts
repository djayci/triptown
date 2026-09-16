import { isTerminal, type GameId, type RoundEvent, type TerminalEvent } from '@triptown/core';
import {
  RoundServiceError,
  newPartId,
  type CashoutOutcome,
  type ClientTiming,
  type PartOutcome,
  type PartRequest,
  type RoundHandle,
  type RoundListener,
  type RoundService,
  type RoundServiceErrorCode,
  type RevealedSeed,
  type RoundSnapshot,
  type RoundSummary,
  type SeedRotation,
  type SessionInfo,
  type StartRoundInput,
} from './types';

export interface TokenStorage {
  get(): string | null;
  set(token: string | null): void;
}

export interface RemoteRoundServiceOptions {
  /** API base URL, e.g. https://api.triptown.games */
  baseUrl: string;
  fetch?: typeof fetch;
  /** Where the session token is kept between reloads. Defaults to memory only. */
  tokenStorage?: TokenStorage;
  /** Build id recorded on new sessions for recall. */
  clientVersion?: string;
  /** Game the session is created for; defaults to Whack Crash on the server. */
  game?: GameId;
}

/** Browser storage for the session token that falls back to memory when storage is blocked. */
export function browserTokenStorage(key = 'triptown.session.v1'): TokenStorage {
  let memory: string | null = null;
  return {
    get() {
      try {
        return globalThis.localStorage?.getItem(key) ?? memory;
      } catch {
        return memory;
      }
    },
    set(token) {
      memory = token;
      try {
        if (token) globalThis.localStorage?.setItem(key, token);
        else globalThis.localStorage?.removeItem(key);
      } catch {
        // Sandboxed iframes can block storage; memory keeps this page working.
      }
    },
  };
}

const memoryStorage = (): TokenStorage => {
  let t: string | null = null;
  return { get: () => t, set: (v) => void (t = v) };
};

/** RoundService backed by the Triptown round API over HTTP + SSE. */
export class RemoteRoundService implements RoundService {
  readonly mode = 'live' as const;
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: TokenStorage;
  private creating: Promise<string> | null = null;
  private readonly clientVersion: string | undefined;
  private readonly game: RemoteRoundServiceOptions['game'];

  constructor(opts: RemoteRoundServiceOptions) {
    this.game = opts.game;
    this.base = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.storage = opts.tokenStorage ?? memoryStorage();
    this.clientVersion = opts.clientVersion;
  }

  getSession() {
    return this.json<SessionInfo>('GET', '/v1/session');
  }

  async startRound(input: StartRoundInput, listener: RoundListener): Promise<RoundHandle> {
    const res = await this.send('POST', '/v1/rounds', { betMinor: input.betMinor, autoCashout: input.autoCashout ?? null });
    return this.attach(res, listener);
  }

  async watchRound(roundId: string, listener: RoundListener): Promise<RoundHandle> {
    const res = await this.send('GET', `/v1/rounds/${encodeURIComponent(roundId)}/events`);
    return this.attach(res, listener);
  }

  cashout(roundId: string, timing: ClientTiming = {}) {
    return this.json<CashoutOutcome>('POST', `/v1/rounds/${encodeURIComponent(roundId)}/cashout`, timing);
  }

  async settleParts(roundId: string, request: PartRequest, timing: ClientTiming = {}) {
    // The same throw id is reused on a retry, so a throw that reached the server before a network error
    // is never settled twice.
    const body = { partId: request.partId ?? newPartId(), count: request.count, ...timing };
    const path = `/v1/rounds/${encodeURIComponent(roundId)}/throws`;
    try {
      return await this.json<PartOutcome>('POST', path, body);
    } catch (err) {
      if (err instanceof RoundServiceError && err.code === 'network') return this.json<PartOutcome>('POST', path, body);
      throw err;
    }
  }

  getRound(roundId: string) {
    return this.json<RoundSnapshot>('GET', `/v1/rounds/${encodeURIComponent(roundId)}`);
  }

  history(limit = 50) {
    return this.json<RoundSummary[]>('GET', `/v1/rounds?limit=${limit}`);
  }

  revealedSeeds() {
    return this.json<RevealedSeed[]>('GET', '/v1/session/seeds');
  }

  setClientSeed(clientSeed: string) {
    return this.json<SessionInfo>('PUT', '/v1/session/client-seed', { clientSeed });
  }

  rotateSeed() {
    return this.json<SeedRotation>('POST', '/v1/session/rotate');
  }

  // ---------- transport ----------

  private async token(): Promise<string> {
    const existing = this.storage.get();
    if (existing) return existing;
    this.creating ??= (async () => {
      const res = await this.raw(
        'POST',
        '/v1/sessions',
        { ...(this.clientVersion && { clientVersion: this.clientVersion }), ...(this.game && { game: this.game }) },
        null,
      );
      if (!res.ok) throw await toError(res);
      const { token } = (await res.json()) as { token: string };
      this.storage.set(token);
      return token;
    })().finally(() => {
      this.creating = null;
    });
    return this.creating;
  }

  private async raw(method: string, path: string, body: unknown, token: string | null, signal?: AbortSignal) {
    try {
      return await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') throw err;
      throw new RoundServiceError('network', 'Network error');
    }
  }

  /** Sends with the session token; a rejected or expired session is replaced once. */
  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    let res = await this.raw(method, path, body, await this.token());
    if (res.status === 401) {
      this.storage.set(null);
      res = await this.raw(method, path, body, await this.token());
    }
    if (!res.ok) throw await toError(res);
    return res;
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.send(method, path, body);
    return (await res.json()) as T;
  }

  private async attach(res: Response, listener: RoundListener): Promise<RoundHandle> {
    if (!res.body) throw new RoundServiceError('network', 'Stream not supported');
    const reader = res.body.getReader();
    let resolveEnded!: (e: TerminalEvent | null) => void;
    const ended = new Promise<TerminalEvent | null>((r) => (resolveEnded = r));
    let resolveStart!: (roundId: string) => void;
    let rejectStart!: (err: Error) => void;
    const started = new Promise<string>((res2, rej) => {
      resolveStart = res2;
      rejectStart = rej;
    });
    let open = true;
    let gotStart = false;

    const pump = async () => {
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.search(/\r?\n\r?\n/)) >= 0) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, '');
            const event = parseSse(block);
            if (!event || !open) continue;
            listener(event);
            if (event.type === 'START' && !gotStart) {
              gotStart = true;
              resolveStart(event.roundId);
            }
            if (isTerminal(event)) {
              open = false;
              resolveEnded(event);
              void reader.cancel().catch(() => {});
              return;
            }
          }
        }
      } catch {
        // Dropped connection: the caller recovers via getRound/watchRound.
      }
      open = false;
      resolveEnded(null);
      if (!gotStart) rejectStart(new RoundServiceError('network', 'Stream closed before START'));
    };
    void pump();
    const roundId = await started;
    return {
      roundId,
      ended,
      close: () => {
        if (!open) return;
        open = false;
        void reader.cancel().catch(() => {});
        resolveEnded(null);
      },
    };
  }
}

function parseSse(block: string): RoundEvent | null {
  let data = '';
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('data:')) data += line.slice(5).trimStart();
  }
  if (!data) return null;
  try {
    return JSON.parse(data) as RoundEvent;
  } catch {
    return null;
  }
}

async function toError(res: Response): Promise<RoundServiceError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } & Record<string, unknown> };
    const { code = 'unknown', message, ...details } = body.error ?? {};
    return new RoundServiceError(code as RoundServiceErrorCode, message ?? `HTTP ${res.status}`, details);
  } catch {
    return new RoundServiceError(res.status >= 500 ? 'network' : 'unknown', `HTTP ${res.status}`);
  }
}
