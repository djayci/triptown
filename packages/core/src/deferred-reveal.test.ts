import { deriveRound, type GameConfig } from '@triptown/fairness';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RoundEvent } from './events';
import { RoundHost } from './host';
import { effectiveConfig, effectiveReveal, profileFromTemplate, registerGame, revealModesOf, validateProfile, type JurisdictionProfile } from './profiles';
import { cashout, createRound, scheduledSettlement, settlementDue, type RoundRecord } from './round';
import { modifiersOfOutcome, timeToReach } from './path';
import { MemoryRoundStore } from './store';

// gate-odds-mvp: deferred reveal is the certified round with the crash made known only at the player's
// reveal. Payouts must equal the live round's, and nothing observable may change at the hidden crash.

registerGame('deferred-probe', 'whack-crash', { reveal: ['onCollect'] });
registerGame('live-probe', 'whack-crash');

const ORIGINS = ['https://operator.example'];
const deferredProfile: JurisdictionProfile = { ...profileFromTemplate('regulated-uk', ORIGINS), name: 'deferred-test', crashReveal: 'onCollect' };
const CONFIG: GameConfig = effectiveConfig('deferred-probe', deferredProfile);

function roundWhere(predicate: (crashTime: number) => boolean, reveal: 'live' | 'onCollect', autoCashout: number | null = null): RoundRecord {
  for (let i = 0; i < 20_000; i++) {
    const seeds = { serverSeed: 'ab'.repeat(32), clientSeed: `probe-${i}`, nonce: 0 };
    if (!predicate(deriveRound(seeds, CONFIG).crashTime)) continue;
    return createRound({
      id: `r${i}`,
      sessionId: 's',
      betMinor: 10_00,
      currency: 'USD',
      autoCashout,
      seeds,
      commit: 'c',
      config: CONFIG,
      minCashout: 1.01,
      startedAt: 0,
      reveal,
    });
  }
  throw new Error('no matching round');
}

describe('deferred reveal: opt-in and validation', () => {
  it('needs both the game and the profile, and an exact-odds config', () => {
    expect(revealModesOf('deferred-probe')).toEqual(['live', 'onCollect']);
    expect(revealModesOf('live-probe')).toEqual(['live']);
    expect(effectiveReveal('deferred-probe', deferredProfile, CONFIG)).toBe('onCollect');
    expect(effectiveReveal('live-probe', deferredProfile, CONFIG)).toBe('live');
    expect(effectiveReveal('deferred-probe', { crashReveal: 'live' }, CONFIG)).toBe('live');
    expect(effectiveReveal('deferred-probe', {}, CONFIG)).toBe('live');
    expect(effectiveReveal('deferred-probe', deferredProfile, { ...CONFIG, boostRate: 0.4 })).toBe('live');
    expect(effectiveReveal('deferred-probe', deferredProfile, { ...CONFIG, lambda: 0.1 })).toBe('live');
  });

  it('rejects onCollect with setbacks or boosts, and accepts it with both off', () => {
    expect(validateProfile(deferredProfile).ok).toBe(true);
    expect(validateProfile({ ...deferredProfile, setbacksMode: 'halve' }).ok).toBe(false);
    expect(validateProfile({ ...deferredProfile, boostsMode: 'boost' }).ok).toBe(false);
    expect(validateProfile({ ...deferredProfile, crashReveal: 'later' as never }).ok).toBe(false);
  });
});

describe('deferred reveal: settlement', () => {
  it('keeps a round running past its hidden crash', () => {
    const r = roundWhere((t) => t > 2 && t < 6, 'onCollect');
    const justAfter = (r.outcome.crashTime + 0.05) * 1000;
    expect(settlementDue(r, justAfter)).toBeNull();
    const live = { ...r, reveal: undefined };
    expect(settlementDue(live, justAfter)?.status).toBe('lost');
  });

  it('reveals a cash-out after the hidden crash as a loss at the cash-out value, not the crash value', () => {
    const r = roundWhere((t) => t > 2 && t < 6, 'onCollect');
    const at = r.outcome.crashTime + 1;
    const judged = cashout(r, at * 1000);
    expect(judged.kind).toBe('crashed');
    if (judged.kind !== 'crashed') return;
    expect(judged.settlement).toMatchObject({ status: 'lost', time: at, payoutMinor: 0, crashTime: r.outcome.crashTime });
    expect(judged.settlement.multiplier).toBeGreaterThan(1);
  });

  it('reveals at the auto target when the hidden crash came first', () => {
    const r = roundWhere((t) => t > 1 && t < 4, 'onCollect', 50);
    const autoAt = timeToReach(50, modifiersOfOutcome(r.outcome, CONFIG), CONFIG)!;
    const s = scheduledSettlement(r);
    expect(s.status).toBe('lost');
    expect(s.time).toBeCloseTo(autoAt, 9);
    expect(settlementDue(r, (autoAt - 0.01) * 1000)).toBeNull();
    expect(settlementDue(r, (autoAt + 0.01) * 1000)?.status).toBe('lost');
  });

  it('reveals at the cap or max duration when nothing else comes first', () => {
    const r = roundWhere((t) => t > 1 && t < 4, 'onCollect');
    const s = scheduledSettlement(r);
    expect(s.status).toBe('lost');
    expect(s.time).toBeGreaterThan(r.outcome.crashTime);
    expect(s.time).toBeLessThanOrEqual(CONFIG.tMax);
  });

  it('refuses a cash-out below the minimum the same way before and after the hidden crash', () => {
    const r = roundWhere((t) => t === 0, 'onCollect');
    expect(cashout(r, 0).kind).toBe('below_min_cashout');
  });

  it('pays exactly what the live round pays for every cash-out time', () => {
    let compared = 0;
    for (let i = 0; i < 300; i++) {
      const seeds = { serverSeed: 'cd'.repeat(32), clientSeed: `eq-${i}`, nonce: 0 };
      const base = { id: `e${i}`, sessionId: 's', betMinor: 5_00, currency: 'USD', seeds, commit: 'c', config: CONFIG, minCashout: 1.01, startedAt: 0 };
      const live = createRound({ ...base, reveal: 'live' });
      const deferred = createRound({ ...base, reveal: 'onCollect' });
      for (const t of [0.5, 2, 5, 9, 15]) {
        const a = cashout(live, t * 1000);
        const b = cashout(deferred, t * 1000);
        const status = (x: typeof a) => (x.kind === 'won' ? 'won' : x.kind === 'below_min_cashout' ? 'refused' : x.settlement.status === 'won' ? 'won' : 'lost');
        const paid = (x: typeof a) => (x.kind === 'below_min_cashout' ? 0 : x.settlement.payoutMinor);
        expect(status(b), `round ${i} at ${t}s`).toBe(status(a));
        expect(paid(b), `round ${i} at ${t}s`).toBe(paid(a));
        compared++;
      }
      // With no cash-out at all, both settle with the same status and credit.
      expect(scheduledSettlement(deferred).status).toBe(scheduledSettlement(live).status);
      expect(scheduledSettlement(deferred).payoutMinor).toBe(scheduledSettlement(live).payoutMinor);
    }
    expect(compared).toBe(1500);
  });
});

// ---------- host: nothing observable changes at the hidden crash ----------

class FakeTime {
  t = 1_700_000_000_000;
  private waiters: { at: number; resolve: () => void }[] = [];
  now = () => this.t;
  sleep = (ms: number) => new Promise<void>((resolve) => this.waiters.push({ at: this.t + ms, resolve }));
  async advance(ms: number) {
    const target = this.t + ms;
    for (;;) {
      await flush();
      this.waiters.sort((a, b) => a.at - b.at);
      const next = this.waiters[0];
      if (!next || next.at > target) break;
      this.waiters.shift();
      this.t = next.at;
      next.resolve();
    }
    this.t = target;
    await flush();
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('deferred reveal: host', () => {
  let time: FakeTime;
  let store: MemoryRoundStore;
  let host: RoundHost;

  beforeEach(() => {
    time = new FakeTime();
    store = new MemoryRoundStore();
    let ids = 0;
    host = new RoundHost({
      store,
      clock: time,
      sleep: time.sleep,
      game: 'deferred-probe',
      profiles: { defaultProfile: deferredProfile },
      newId: () => `id${++ids}`,
      settlementPollMs: 200,
    });
  });

  async function sessionWithCrashBetween(lo: number, hi: number) {
    const s = await host.createSession(100_00, 'probe');
    const session = (await store.getSession(s.sessionId))!;
    for (let i = 0; i < 20_000; i++) {
      const clientSeed = `probe-${i}`;
      const outcome = deriveRound({ serverSeed: session.serverSeed, clientSeed, nonce: 0 }, CONFIG);
      if (outcome.crashTime > lo && outcome.crashTime < hi) {
        await host.setClientSeed(s.sessionId, clientSeed);
        return { sessionId: s.sessionId, crashTime: outcome.crashTime };
      }
    }
    throw new Error('no matching outcome');
  }

  it('shows the same stream, state, balance and history just before and just after the hidden crash', async () => {
    const { sessionId, crashTime } = await sessionWithCrashBetween(3, 8);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    expect(round.reveal).toBe('onCollect');
    const events: RoundEvent[] = [];
    host.streamRound(sessionId, round.id, (e) => events.push(e));

    const observe = async () => {
      const snap = await host.getRound(sessionId, round.id);
      return {
        events: events.map((e) => e.type),
        status: snap.status,
        settlement: snap.settlement,
        returnMinor: snap.returnMinor,
        crashMultiplier: snap.crashMultiplier,
        balance: (await host.sessionInfo(sessionId)).balanceMinor,
        history: (await host.history(sessionId)).map((h) => [h.roundId, h.status, h.settlement]),
      };
    };

    await time.advance(Math.floor(crashTime * 1000) - 50);
    const before = await observe();
    await time.advance(150);
    const after = await observe();
    expect(after).toEqual(before);
    expect(after.status).toBe('running');
    expect(after.events).toEqual(['START']);
  });

  it('reveals the loss in the cash-out response and the stream, then settles', async () => {
    const { sessionId, crashTime } = await sessionWithCrashBetween(3, 8);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    const events: RoundEvent[] = [];
    const stream = host.streamRound(sessionId, round.id, (e) => events.push(e));
    await time.advance(Math.ceil(crashTime * 1000) + 1000);
    const out = await host.cashout(sessionId, round.id);
    expect(out.result).toBe('crashed');
    expect(out.settlement).toMatchObject({ status: 'lost', payoutMinor: 0, crashTime });
    expect(out.settlement.time).toBeGreaterThan(crashTime);
    await time.advance(500);
    await stream.done;
    expect(events.at(-1)).toMatchObject({ type: 'CRASH', crashTime });
    expect(out.balanceMinor).toBe(90_00);
  });

  it('pays a cash-out before the hidden crash exactly as live', async () => {
    const { sessionId, crashTime } = await sessionWithCrashBetween(6, 12);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00 });
    await time.advance(Math.floor((crashTime - 2) * 1000));
    const out = await host.cashout(sessionId, round.id);
    expect(out.result).toBe('won');
    expect(out.settlement.payoutMinor).toBeGreaterThan(10_00);
  });

  it('settles a disconnected round at its automatic reveal, not at the crash', async () => {
    const { sessionId, crashTime } = await sessionWithCrashBetween(2, 5);
    const { round } = await host.startRound(sessionId, { betMinor: 10_00, autoCashout: 100 });
    await time.advance(Math.ceil(crashTime * 1000) + 200);
    expect((await host.getRound(sessionId, round.id)).status).toBe('running');
    await time.advance(CONFIG.tMax * 1000);
    const snap = await host.getRound(sessionId, round.id);
    expect(snap.status).toBe('lost');
    expect(snap.settlement!.time).toBeGreaterThan(crashTime);
  });
});
