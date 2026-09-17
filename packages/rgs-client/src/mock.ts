import {
  HostError,
  MemoryRoundStore,
  RoundHost,
  isTerminal,
  type GameId,
  type ProfileSettings,
  type RoundEvent,
  type RoundStore,
  type TerminalEvent,
} from '@triptown/core';
import { deriveRound, type GameConfig, type RoundOutcome } from '@triptown/fairness';
import {
  RoundServiceError,
  newPartId,
  type ClientTiming,
  type PartRequest,
  type RoundHandle,
  type RoundListener,
  type RoundService,
  type StartRoundInput,
} from './types';

export type MockScenario = 'instantBust' | 'setback' | 'boost' | 'longRound' | 'quickCrash' | 'bigWin';

const SCENARIOS: Record<MockScenario, (o: RoundOutcome) => boolean> = {
  instantBust: (o) => o.crashTime === 0,
  setback: (o) => o.setbacks.length > 0 && o.setbacks[0]! > 1 && o.setbacks[0]! < 5 && o.crashTime > o.setbacks[0]! + 3,
  boost: (o) => o.boosts.length > 0 && o.boosts[0]! > 1 && o.crashTime > o.boosts[0]! + 3,
  longRound: (o) => o.crashTime > 8,
  quickCrash: (o) => o.crashTime > 1 && o.crashTime < 2.5,
  bigWin: (o) => o.crashTime > 10 && (o.setbacks[0] ?? Infinity) > 10,
};

export interface MockRoundServiceOptions {
  initialBalanceMinor?: number;
  config?: GameConfig;
  /** Jurisdiction profile settings; defaults to the `light` profile. */
  profiles?: ProfileSettings;
  /** Simulated network delay per request. */
  latencyMs?: number;
  /** Build id recorded on the session for recall. */
  clientVersion?: string;
  /** Player region the fake operator sends (ISO 3166-2), for profiles that block regions. */
  playerRegion?: string;
  /** Game to run; defaults to Whack Crash. */
  game?: GameId;
  /** Test hooks: a custom store and clock. */
  store?: RoundStore;
  clock?: { now(): number };
}

/** Present in any bundle that includes the mock; production builds are checked for it. */
export const MOCK_BUILD_MARKER = '__triptown_mock_round_service__';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * DEMO ONLY. Runs the real round rules in the browser, so the secret outcome lives in page memory.
 * Never ship this in a production build.
 */
export class MockRoundService implements RoundService {
  readonly mode = 'demo' as const;
  private readonly store: RoundStore;
  private readonly clientVersion: string | undefined;
  private readonly playerRegion: string | undefined;
  private readonly host: RoundHost;
  private readonly latencyMs: number;
  private readonly initialBalance: number;
  private sessionId: Promise<string> | null = null;
  private forced: MockScenario | null = null;

  constructor(opts: MockRoundServiceOptions = {}) {
    this.playerRegion = opts.playerRegion;
    (globalThis as Record<string, unknown>)[MOCK_BUILD_MARKER] = true;
    this.latencyMs = opts.latencyMs ?? 0;
    this.initialBalance = opts.initialBalanceMinor ?? 1_000_00;
    this.clientVersion = opts.clientVersion;
    this.store = opts.store ?? new MemoryRoundStore();
    this.host = new RoundHost({
      store: this.store,
      clock: opts.clock ?? { now: () => Date.now() },
      sleep,
      ...(opts.config ? { config: opts.config } : {}),
      profiles: opts.profiles,
      settlementPollMs: 50,
      game: opts.game ?? 'whack-crash',
    });
  }

  /** Makes the next round match a scenario by picking a suitable client seed. Dev tooling only. */
  forceNext(scenario: MockScenario | null) {
    this.forced = scenario;
  }

  async getSession() {
    return this.call(async (id) => this.host.sessionInfo(id));
  }

  async startRound(input: StartRoundInput, listener: RoundListener): Promise<RoundHandle> {
    return this.call(async (id) => {
      if (this.forced) {
        await this.applyScenario(id, this.forced);
        this.forced = null;
      }
      const { round } = await this.host.startRound(id, input);
      return this.attach(id, round.id, listener);
    });
  }

  async watchRound(roundId: string, listener: RoundListener) {
    return this.call(async (id) => this.attach(id, roundId, listener));
  }

  async cashout(roundId: string, timing: ClientTiming = {}) {
    return this.call(async (id) => this.host.cashout(id, roundId, timing));
  }

  async settleParts(roundId: string, request: PartRequest, timing: ClientTiming = {}) {
    const partId = request.partId ?? newPartId();
    return this.call(async (id) => this.host.settleParts(id, roundId, { partId, count: request.count, ...timing }));
  }

  async getRound(roundId: string) {
    return this.call(async (id) => this.host.getRound(id, roundId));
  }

  async history(limit = 50) {
    return this.call(async (id) => this.host.history(id, limit));
  }

  async setClientSeed(clientSeed: string) {
    return this.call(async (id) => this.host.setClientSeed(id, clientSeed));
  }

  async rotateSeed() {
    return this.call(async (id) => this.host.rotateSeed(id));
  }

  async revealedSeeds() {
    return this.call(async (id) => this.host.revealedSeeds(id));
  }

  async ping() {
    if (this.latencyMs) await sleep(this.latencyMs);
  }

  /** Runs the server's reconciliation pass (settle, credit or void stuck rounds). Dev tooling only. */
  async reconcile() {
    return this.host.reconcile();
  }

  private async attach(sessionId: string, roundId: string, listener: RoundListener): Promise<RoundHandle> {
    let resolveEnded!: (e: TerminalEvent | null) => void;
    const ended = new Promise<TerminalEvent | null>((r) => (resolveEnded = r));
    let open = true;
    let resolveStarted!: () => void;
    const started = new Promise<void>((r) => (resolveStarted = r));

    const deliver = (event: RoundEvent) => {
      if (!open) return;
      // Each event crosses the simulated network.
      const send = () => {
        if (!open) return;
        listener(event);
        if (event.type === 'START') resolveStarted();
        if (isTerminal(event)) {
          open = false;
          resolveEnded(event);
        }
      };
      if (this.latencyMs) setTimeout(send, this.latencyMs);
      else send();
    };
    const stream = this.host.streamRound(sessionId, roundId, deliver);
    stream.done.catch(() => resolveEnded(null));
    await started;
    return {
      roundId,
      ended,
      close: () => {
        open = false;
        stream.stop();
        resolveEnded(null);
      },
    };
  }

  private async applyScenario(sessionId: string, scenario: MockScenario) {
    const session = await this.store.getSession(sessionId);
    if (!session) return;
    for (let i = 0; i < 20_000; i++) {
      const clientSeed = `demo-${scenario}-${i}`;
      const config = session.profile ? this.host.configFor(session.profile) : this.host.config;
      const outcome = deriveRound({ serverSeed: session.serverSeed, clientSeed, nonce: session.nonce }, config);
      if (SCENARIOS[scenario](outcome)) {
        await this.store.updateSession(sessionId, { clientSeed });
        return;
      }
    }
  }

  private async call<T>(fn: (sessionId: string) => Promise<T>): Promise<T> {
    if (this.latencyMs) await sleep(this.latencyMs);
    try {
      this.sessionId ??= this.host.createSession(this.initialBalance, {
        clientVersion: this.clientVersion,
        ...(this.playerRegion && { playerRegion: this.playerRegion }),
      }).then((s) => s.sessionId);
      return await fn(await this.sessionId);
    } catch (err) {
      if (err instanceof HostError) throw new RoundServiceError(err.code, err.message, err.details);
      throw err;
    }
  }
}
