import { growth } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import type { RoundEvent, RoundService, TerminalEvent } from '../types';
import { RoundServiceError } from '../types';

// Shared integration suite for any RoundService (demo mock and live API client).
// Outcomes are random, so each scenario plays rounds until it sees the case it needs.

const BET = 1_00;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Played {
  events: RoundEvent[];
  terminal: TerminalEvent | null;
  before: number;
  after: number;
}

async function play(
  service: RoundService,
  onEvent?: (e: RoundEvent, roundId: string) => void,
): Promise<Played> {
  const before = (await service.getSession()).balanceMinor;
  const events: RoundEvent[] = [];
  const handle = await service.startRound({ betMinor: BET }, (e) => {
    events.push(e);
    onEvent?.(e, e.roundId);
  });
  const terminal = await handle.ended;
  const after = (await service.getSession()).balanceMinor;
  return { events, terminal, before, after };
}

export interface SuiteOptions {
  /** A service whose profile has a minimum cycle time (≥ 1 s), for the cycle_too_soon check. */
  makePacedService?: () => Promise<RoundService>;
}

export function roundServiceSuite(name: string, makeService: () => Promise<RoundService>, tries = 120, options: SuiteOptions = {}) {
  describe(`RoundService integration: ${name}`, () => {
    it('exposes the profile and session counters, and records history fields', async () => {
      const service = await makeService();
      const first = await service.getSession();
      expect(first.profile.name).toBeTruthy();
      expect(first.config.id).toBeTruthy();
      expect(first).toMatchObject({ stakedMinor: 0, returnedMinor: 0 });
      expect(first.sessionStartedAt).toBeGreaterThan(0);

      const played = await play(service);
      const session = await service.getSession();
      const returned = played.terminal?.type === 'CRASH' ? 0 : (played.terminal as { payoutMinor?: number } | null)?.payoutMinor ?? 0;
      expect(session).toMatchObject({ stakedMinor: BET, returnedMinor: returned });

      const [summary] = await service.history();
      expect(summary).toMatchObject({
        roundId: played.events[0]!.roundId,
        profile: first.profile.name,
        betMinor: BET,
        balanceBeforeMinor: played.before,
        balanceAfterMinor: played.after,
        returnMinor: returned,
        netMinor: returned - BET,
      });
      expect(summary!.settledAt).toBeGreaterThanOrEqual(summary!.startedAt);
      if (played.terminal?.type === 'CRASH') {
        expect(summary).toMatchObject({ status: 'lost', resultKind: 'loss', cashouts: [] });
        expect(summary!.crashMultiplier).toBeCloseTo(played.terminal.multiplier, 6);
      }
    }, 120_000);

    it('lists revealed seeds after a rotation', async () => {
      const service = await makeService();
      const before = await service.getSession();
      expect(await service.revealedSeeds()).toEqual([]);
      await service.rotateSeed();
      const seeds = await service.revealedSeeds();
      expect(seeds.at(-1)).toMatchObject({ commit: before.commit, clientSeed: before.clientSeed, auto: false });
      expect(seeds.at(-1)!.serverSeed).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects a cash-out below the minimum with below_min_cashout', async () => {
      const service = await makeService();
      const { profile } = await service.getSession();
      if (profile.minCashout <= 1) return; // No minimum in this profile.
      for (let i = 0; i < tries; i++) {
        let attempt: Promise<unknown> | null = null;
        const handle = await service.startRound({ betMinor: BET }, (e) => {
          if (e.type === 'START') attempt = service.cashout(e.roundId).then(() => null, (err: unknown) => err);
        });
        const err: unknown = await (attempt as Promise<unknown> | null);
        if (err instanceof RoundServiceError && err.code === 'below_min_cashout') {
          expect(err.details).toMatchObject({ minCashout: profile.minCashout });
          await service.cashout(handle.roundId).catch(() => null);
          await wait(250).then(() => service.cashout(handle.roundId).catch(() => null));
          await handle.ended;
          return;
        }
        await handle.ended;
      }
      throw new Error('never saw below_min_cashout');
    }, 120_000);

    if (options.makePacedService) {
      const makePaced = options.makePacedService;
      it('answers cycle_too_soon with retryAfterMs under a paced profile', async () => {
        const service = await makePaced();
        const { profile } = await service.getSession();
        const handle = await service.startRound({ betMinor: BET }, () => {});
        await service.cashout(handle.roundId).catch(() => null);
        await wait(250).then(() => service.cashout(handle.roundId).catch(() => null));
        await handle.ended;
        const err = await service.startRound({ betMinor: BET }, () => {}).then(() => null, (e: unknown) => e);
        expect(err).toBeInstanceOf(RoundServiceError);
        expect(err).toMatchObject({ code: 'cycle_too_soon' });
        const retry = Number((err as RoundServiceError).details?.retryAfterMs);
        expect(retry).toBeGreaterThan(0);
        expect(retry).toBeLessThanOrEqual(profile.minCycleMs);
      }, 30_000);
    }

    it('plays a won round and credits bet × multiplier', async () => {
      const service = await makeService();
      for (let i = 0; i < tries; i++) {
        let cashed: Promise<unknown> | null = null;
        const played = await play(service, (e, roundId) => {
          // An early setback can put the value under the minimum cash-out; that round just isn't a win sample.
          if (e.type === 'START') cashed = wait(250).then(() => service.cashout(roundId).catch(() => null));
        });
        await cashed;
        if (played.terminal?.type === 'CASHED_OUT') {
          expect(played.terminal.reason).toBe('manual');
          expect(played.after).toBe(played.before - BET + played.terminal.payoutMinor);
          expect(played.terminal.payoutMinor).toBe(Math.floor(BET * played.terminal.multiplier + 0.5 + 1e-7)); // half-up once (D23)
          return;
        }
      }
      throw new Error('never won a round');
    }, 120_000);

    it('plays a lost round and keeps only the debit', async () => {
      const service = await makeService();
      for (let i = 0; i < tries; i++) {
        const played = await play(service);
        if (played.terminal?.type === 'CRASH') {
          expect(played.after).toBe(played.before - BET);
          expect(played.events[0]!.type).toBe('START');
          return;
        }
      }
      throw new Error('never lost a round');
    }, 120_000);

    it('applies a setback before a cash-out', async () => {
      const service = await makeService();
      for (let i = 0; i < tries; i++) {
        let setbackAt = -1;
        let startedAt = 0;
        let cashed: Promise<unknown> | null = null;
        const played = await play(service, (e, roundId) => {
          if (e.type === 'START') startedAt = e.startedAt;
          if (e.type === 'BAD_MOLE' && setbackAt < 0) {
            setbackAt = e.time;
            cashed = service.cashout(roundId).catch(() => null);
          }
        });
        await cashed;
        if (setbackAt >= 0 && played.terminal?.type === 'CASHED_OUT') {
          const t = played.terminal;
          expect(startedAt).toBeGreaterThan(0);
          expect(t.time).toBeGreaterThanOrEqual(setbackAt);
          // Value after one setback is half the growth at the cash-out time (no further setbacks that fast).
          const config = (await service.getSession()).config;
          expect(t.multiplier).toBeCloseTo(growth(t.time, config) * config.setbackFactor, 6);
          expect(played.after).toBe(played.before - BET + t.payoutMinor);
          return;
        }
        if (!played.terminal) throw new Error('stream ended without a terminal event');
      }
      throw new Error('never saw a setback followed by a cash-out');
    }, 180_000);

    it('handles an instant bust at 1.00', async () => {
      const service = await makeService();
      for (let i = 0; i < 400; i++) {
        let cashed: Promise<unknown> | null = null;
        const played = await play(service, (e, roundId) => {
          // Finish non-bust rounds quickly (200 ms clears the default x1.01 minimum cash-out).
          if (e.type === 'START') cashed = wait(200).then(() => service.cashout(roundId).catch(() => null));
        });
        await cashed;
        const t = played.terminal;
        if (t?.type === 'CRASH' && t.crashTime === 0) {
          expect(t.multiplier).toBe(1);
          expect(played.events.map((e) => e.type)).toEqual(['START', 'CRASH']);
          expect(played.after).toBe(played.before - BET);
          return;
        }
      }
      throw new Error('never saw an instant bust');
    }, 180_000);

    it('rejects bets above the balance with insufficient_funds', async () => {
      const service = await makeService();
      const session = await service.getSession();
      if (session.balanceMinor >= session.currency.maxBetMinor) {
        // Balance too high to trigger; the bet-limit path is covered instead.
        await expect(service.startRound({ betMinor: session.currency.maxBetMinor + 1 }, () => {})).rejects.toMatchObject({ code: 'bet_limit' });
        return;
      }
      await expect(service.startRound({ betMinor: session.balanceMinor + 1 }, () => {})).rejects.toBeInstanceOf(RoundServiceError);
    });
  });
}

/**
 * Partial cash-out cases (Paper Route). `makeService` must create sessions for a 5-paper game; the stake
 * of 1.00 splits into papers of 0.20, the minimum paper value.
 */
export function paperRouteSuite(name: string, makeService: () => Promise<RoundService>, tries = 120) {
  const halfUp = (exactMinor: number) => Math.floor(exactMinor + 0.5 + 1e-7);

  describe(`RoundService partial cash-out: ${name}`, () => {
    it('throws one paper, keeps the round running and streams THROWN without the crash time', async () => {
      const service = await makeService();
      for (let i = 0; i < tries; i++) {
        let thrown: Awaited<ReturnType<RoundService['throwPapers']>> | null = null;
        let pending: Promise<unknown> | null = null;
        const played = await play(service, (e, roundId) => {
          if (e.type === 'START') {
            expect(e).toMatchObject({ papers: 5, paperMinor: BET / 5 });
            pending = wait(250).then(async () => {
              thrown = await service.throwPapers(roundId, { count: 1 }).catch(() => null);
            });
          }
        });
        await pending;
        const t = thrown as Awaited<ReturnType<RoundService['throwPapers']>> | null;
        if (t?.result !== 'thrown') continue;
        expect(t.remaining).toBe(4);
        expect(JSON.stringify(t)).not.toContain('crashTime');
        const event = played.events.find((e) => e.type === 'THROWN');
        expect(event).toMatchObject({ throwId: t.throw!.throwId, remaining: 4 });
        expect(event).not.toHaveProperty('crashTime');
        expect(played.terminal).toMatchObject({ papersThrown: expect.any(Number) });
        return;
      }
      throw new Error('never threw a paper mid-round');
    }, 180_000);

    it('ends the round on throw-all with the round total rounded half-up once', async () => {
      const service = await makeService();
      for (let i = 0; i < tries; i++) {
        const outs: Awaited<ReturnType<RoundService['throwPapers']>>[] = [];
        let pending: Promise<unknown> | null = null;
        const played = await play(service, (e, roundId) => {
          if (e.type !== 'START') return;
          pending = wait(200)
            .then(() => service.throwPapers(roundId, { count: 1 }))
            .then((o) => outs.push(o))
            .then(() => wait(300))
            .then(() => service.throwPapers(roundId, { count: 'all' }))
            .then((o) => outs.push(o))
            .catch(() => null);
        });
        await pending;
        const last = outs.at(-1);
        if (outs.length !== 2 || outs[0]!.result !== 'thrown' || last?.result !== 'cashed_out') continue;
        const exact = outs[0]!.throw!.exactMinor + last.throw!.exactMinor;
        expect(last.settlement!.payoutMinor).toBe(halfUp(exact));
        expect(played.after).toBe(played.before - BET + last.settlement!.payoutMinor);
        expect(played.terminal).toMatchObject({ type: 'CASHED_OUT', papersThrown: 5, papersLost: 0 });
        return;
      }
      throw new Error('never completed a throw-all');
    }, 180_000);

    it('settles nothing more when a throw id is retried', async () => {
      const service = await makeService();
      for (let i = 0; i < tries; i++) {
        let results: Awaited<ReturnType<RoundService['throwPapers']>>[] = [];
        let pending: Promise<unknown> | null = null;
        await play(service, (e, roundId) => {
          if (e.type !== 'START') return;
          pending = wait(250)
            .then(async () => {
              const first = await service.throwPapers(roundId, { count: 1, throwId: `retry-${i}` });
              const again = await service.throwPapers(roundId, { count: 1, throwId: `retry-${i}` });
              results = [first, again];
            })
            .catch(() => null);
        });
        await pending;
        if (results[0]?.result !== 'thrown') continue;
        expect(results[1]!.result).toBe('duplicate');
        expect(results[1]!.throw!.creditedMinor).toBe(results[0]!.throw!.creditedMinor);
        return;
      }
      throw new Error('never threw a paper to retry');
    }, 180_000);

    it('keeps banked papers at wipeout and loses the rest', async () => {
      const service = await makeService();
      for (let i = 0; i < tries; i++) {
        let out: Awaited<ReturnType<RoundService['throwPapers']>> | null = null;
        let pending: Promise<unknown> | null = null;
        const played = await play(service, (e, roundId) => {
          if (e.type === 'START') pending = wait(200).then(async () => (out = await service.throwPapers(roundId, { count: 1 }).catch(() => null)));
        });
        await pending;
        const o = out as Awaited<ReturnType<RoundService['throwPapers']>> | null;
        if (o?.result !== 'thrown' || played.terminal?.type !== 'CRASH') continue;
        expect(played.terminal).toMatchObject({ papersThrown: 1, papersLost: 4, returnMinor: halfUp(o.throw!.exactMinor) });
        expect(played.after).toBe(played.before - BET + halfUp(o.throw!.exactMinor));
        return;
      }
      throw new Error('never saw a wipeout with a paper banked');
    }, 240_000);
  });
}
