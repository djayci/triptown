import { GAME_CONFIGS, deriveRound } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { RoundHost } from './host';
import { modifierEvents } from './round';
import { profileFromTemplate, registerGame } from './profiles';
import { describeRules } from './rules';
import { DEFAULT_CURRENCY } from './money';
import { effectiveConfig } from './profiles';
import { MemoryRoundStore } from './store';

// The split-stake code path still ships, but its only config belongs to a retired game. Tests register
// that game explicitly to exercise the path; no shipped profile has it registered (design D1, D2).
registerGame('paper-route');


// Good mole (good-mole change): boosts in the path, the stream and the rules.

const BOOSTED = GAME_CONFIGS['whack-crash/v4']!;
const boostedProfile = { ...profileFromTemplate('light'), minCycleMs: 0 };

function setup() {
  const clock = { t: 1_700_000_000_000, now() { return this.t; } };
  const store = new MemoryRoundStore();
  const host = new RoundHost({ store, clock, sleep: async () => {}, profiles: { defaultProfile: boostedProfile } });
  return { clock, store, host };
}

/** Points the session's next round at an outcome matching the predicate. */
async function aim(
  s: ReturnType<typeof setup>,
  sessionId: string,
  predicate: (o: { crashTime: number; setbacks: number[]; boosts: number[] }) => boolean,
) {
  const session = (await s.store.getSession(sessionId))!;
  for (let i = 0; i < 50_000; i++) {
    const clientSeed = `boost-${i}`;
    const outcome = deriveRound({ serverSeed: session.serverSeed, clientSeed, nonce: session.nonce }, BOOSTED);
    if (predicate(outcome)) {
      await s.host.setClientSeed(sessionId, clientSeed);
      return outcome;
    }
  }
  throw new Error('no matching outcome');
}

describe('good mole rounds (3.1-3.3)', () => {
  it('plays the boosted config under a profile with boostsMode boost', () => {
    expect(effectiveConfig('whack-crash', boostedProfile).id).toBe('whack-crash/v4');
    expect(BOOSTED).toMatchObject({ boostFactor: 1.05, boostRate: 0.4 / 2.5 });
    // A game with no boosted variant registered keeps the unboosted maths.
    expect(effectiveConfig('paper-route', boostedProfile).id).toBe('paper-route/v1');
  });

  it('emits BOOST events in time order with the setbacks, and hides later ones while running', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);
    const outcome = await aim(s, info.sessionId, (o) => o.crashTime > 6 && o.boosts.length >= 2 && o.boosts[0]! > 1);
    const { round } = await s.host.startRound(info.sessionId, { betMinor: 1_00 });

    // Nothing about any boost before its time.
    expect((await s.host.getRound(info.sessionId, round.id)).boosts).toEqual([]);
    s.clock.t += Math.ceil(outcome.boosts[0]! * 1000) + 5;
    const mid = await s.host.getRound(info.sessionId, round.id);
    expect(mid.status).toBe('running');
    expect(mid.boosts).toEqual(outcome.boosts.filter((t) => t <= mid.elapsed));
    expect(mid.boosts.length).toBeLessThan(outcome.boosts.length);

    // Settled: every modifier before the end, in time order, setback first on a tie.
    s.clock.t += 120_000;
    const settled = await s.host.getRound(info.sessionId, round.id);
    const events = modifierEvents((await s.store.getRound(round.id))!, settled.settlement!);
    expect(events.map((e) => e.time)).toEqual([...events.map((e) => e.time)].sort((a, b) => a - b));
    expect(events.filter((e) => e.type === 'BOOST').map((e) => e.factor)).toEqual(settled.boosts.map(() => 1.05));
    expect(events.filter((e) => e.type === 'BOOST').map((e) => e.time)).toEqual(settled.boosts);
  });

  it('values the round with the boosts that happened at or before the cash-out', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);
    const outcome = await aim(s, info.sessionId, (o) => o.crashTime > 5 && o.boosts.length >= 1 && o.boosts[0]! < 2 && (o.setbacks[0] ?? 9) > 5);
    const { round } = await s.host.startRound(info.sessionId, { betMinor: 1_00 });
    s.clock.t += 3_000;
    const out = await s.host.cashout(info.sessionId, round.id);
    expect(out.result).toBe('won');
    const applied = outcome.boosts.filter((t) => t <= out.settlement.time).length;
    expect(applied).toBeGreaterThan(0);
    // The settled multiplier carries one factor per boost before the cash-out.
    const snap = await s.host.getRound(info.sessionId, round.id);
    expect(snap.boosts).toEqual(outcome.boosts.filter((t) => t <= out.settlement.time));
    expect(snap.settlement!.multiplier).toBeGreaterThan(1);
  });

  it('never records a boost after the crash', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);
    const outcome = await aim(s, info.sessionId, (o) => o.crashTime > 0.5 && o.crashTime < 3);
    const { round } = await s.host.startRound(info.sessionId, { betMinor: 1_00 });
    s.clock.t += 10_000;
    const snap = await s.host.getRound(info.sessionId, round.id);
    expect(snap.status).toBe('lost');
    expect(snap.boosts.every((t) => t < outcome.crashTime)).toBe(true);
  });
});

describe('good mole rules (3.5)', () => {
  it('lists the boost right after the setbacks, and omits it when boosts are off', () => {
    const boosted = describeRules(BOOSTED, boostedProfile, DEFAULT_CURRENCY).map((i) => i.key);
    expect(boosted.indexOf('boosts')).toBe(boosted.indexOf('setbacks') + 1);
    const item = describeRules(BOOSTED, boostedProfile, DEFAULT_CURRENCY).find((i) => i.key === 'boosts');
    expect(item!.params).toEqual({ ratePerSecond: 0.4 / 2.5, factor: 1.05, warning: false });

    const plain = describeRules(GAME_CONFIGS['whack-crash/v3']!, { ...boostedProfile, boostsMode: 'off' }, DEFAULT_CURRENCY);
    expect(plain.some((i) => i.key === 'boosts')).toBe(false);
  });
});
