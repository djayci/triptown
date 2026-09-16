import { MemoryRoundStore, profileFromTemplate, type CurrencyRules, type JurisdictionProfile, type RoundStore } from '@triptown/core';
import { MemoryStepRoundStore, STEP_CONFIGS, StepError, StepHost, deriveFences, type Difficulty } from '@triptown/steps';
import { MOCK_BUILD_MARKER } from './mock';
import { StepServiceError, newActionKey, type StepRoundService } from './steps';

export interface MockStepRoundServiceOptions {
  initialBalanceMinor?: number;
  profile?: JurisdictionProfile;
  currency?: CurrencyRules;
  latencyMs?: number;
  abandonAfterMs?: number;
  store?: RoundStore;
  clock?: { now(): number };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * DEMO ONLY. Runs the real step rules in the browser, so the secret fence results live in page memory.
 * Never ship this in a production build (hard rule 7).
 */
export class MockStepRoundService implements StepRoundService {
  readonly mode = 'demo' as const;
  private readonly store: RoundStore;
  private readonly host: StepHost;
  private readonly latencyMs: number;
  private readonly initialBalance: number;
  private sessionId: Promise<string> | null = null;
  private forced: { refuseAt: number | null; difficulty?: Difficulty } | null = null;

  constructor(opts: MockStepRoundServiceOptions = {}) {
    (globalThis as Record<string, unknown>)[MOCK_BUILD_MARKER] = true;
    this.store = opts.store ?? new MemoryRoundStore();
    this.latencyMs = opts.latencyMs ?? 0;
    this.initialBalance = opts.initialBalanceMinor ?? 1_000_00;
    this.host = new StepHost({
      store: this.store,
      steps: new MemoryStepRoundStore(),
      clock: opts.clock ?? { now: () => Date.now() },
      profiles: { defaultProfile: opts.profile ?? profileFromTemplate('regulated-uk') },
      ...(opts.currency && { currency: opts.currency }),
      ...(opts.abandonAfterMs !== undefined && { abandonAfterMs: opts.abandonAfterMs }),
    });
  }

  /** Makes the next round refuse at `refuseAt` (null = clear every fence) by picking a client seed. Dev tooling only. */
  forceNext(scenario: { refuseAt: number | null; difficulty?: Difficulty } | null) {
    this.forced = scenario;
  }

  getSession() {
    return this.call((id) => this.host.sessionInfo(id));
  }

  startStepRound(input: { stakeMinor: number; difficulty: Difficulty }) {
    return this.call(async (id) => {
      if (this.forced) {
        await this.applyForced(id, { ...this.forced, difficulty: this.forced.difficulty ?? input.difficulty });
        this.forced = null;
      }
      return this.host.startRound(id, input);
    });
  }

  jump(roundId: string, key = newActionKey()) {
    return this.call((id) => this.host.jump(id, roundId, key));
  }

  collect(roundId: string, key = newActionKey()) {
    return this.call((id) => this.host.collect(id, roundId, key));
  }

  getStepRound(roundId: string) {
    return this.call((id) => this.host.getRound(id, roundId));
  }

  activeStepRound() {
    return this.call((id) => this.host.activeRound(id));
  }

  stepHistory(limit = 50) {
    return this.call((id) => this.host.history(id, limit));
  }

  setClientSeed(clientSeed: string) {
    return this.call((id) => this.host.setClientSeed(id, clientSeed));
  }

  rotateSeed() {
    return this.call((id) => this.host.rotateSeed(id));
  }

  revealedSeeds() {
    return this.call((id) => this.host.revealedSeeds(id));
  }

  /** Settles abandoned rounds, as the server cron does. Dev tooling only. */
  sweepAbandoned() {
    return this.host.sweepAbandoned();
  }

  private async applyForced(sessionId: string, scenario: { refuseAt: number | null; difficulty: Difficulty }) {
    const session = await this.store.getSession(sessionId);
    if (!session) return;
    for (let i = 0; i < 50_000; i++) {
      const clientSeed = `demo-fence-${scenario.refuseAt ?? 'finish'}-${i}`;
      const outcome = deriveFences({ serverSeed: session.serverSeed, clientSeed, nonce: session.nonce }, STEP_CONFIGS[scenario.difficulty]);
      if (outcome.refusedAt === scenario.refuseAt) {
        await this.store.updateSession(sessionId, { clientSeed });
        return;
      }
    }
  }

  private async call<T>(fn: (sessionId: string) => Promise<T>): Promise<T> {
    if (this.latencyMs) await sleep(this.latencyMs);
    try {
      this.sessionId ??= this.host.createSession(this.initialBalance).then((s) => s.sessionId);
      return await fn(await this.sessionId);
    } catch (err) {
      if (err instanceof StepError) throw new StepServiceError(err.code, err.message, err.details);
      throw err;
    }
  }
}
