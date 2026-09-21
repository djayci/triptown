import { resolveConfigId } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY } from './money';
import { effectiveConfig, profileFromTemplate, registerGame } from './profiles';
import { describeRules } from './rules';

// The split-stake code path still ships, but its only config belongs to a retired game. Tests register
// that game explicitly to exercise the path; no shipped profile has it registered (design D1, D2).
registerGame('paper-route');

// Retired game config: resolvable for verification, no longer exported (design D2).
const PAPER_ROUTE_CONFIG = resolveConfigId('paper-route/v1')!;


const O = ['https://op.example'];

// These cases test what a *flag combination* produces, not what a market produces. Naming a market
// here made the coverage hostage to the market list: removing the non-African profiles took the only
// `partialCashout: 'off'`, `cashout-at-disconnect` and x100-cap profiles with it, and every one of
// those code paths still ships. A fixture states the behaviour under test directly.
const fixture = (over: Partial<ReturnType<typeof profileFromTemplate>> = {}) => ({
  ...profileFromTemplate('ng-draft', O),
  crashReveal: undefined,
  ...over,
});

const keys = (items: { key: string }[]) => items.map((i) => i.key);
const param = (items: { key: string; params: Record<string, unknown> }[], key: string) => items.find((i) => i.key === key)?.params;

describe('describeRules (compliance-baseline 6.1)', () => {
  it('has no setback or below-stake items for a rising profile', () => {
    const p = fixture();
    const items = describeRules(effectiveConfig('whack-crash', p), p, DEFAULT_CURRENCY);
    expect(keys(items)).not.toContain('setbacks');
    expect(keys(items)).not.toContain('belowStakeReturns');
    expect(keys(items)).toEqual([
      'growth', 'instantBust', 'rtp', 'maxMultiplier', 'tMax', 'minCashout', 'autoCashout', 'rounding', 'minCycle', 'latency', 'disconnect', 'voidRefund', 'provablyFair', 'outcomeFixed',
    ]);
  });

  it('includes the setback rate and factor for a halving profile', () => {
    const p = profileFromTemplate('light');
    const config = effectiveConfig('whack-crash', p);
    const items = describeRules(config, p, DEFAULT_CURRENCY);
    expect(param(items, 'setbacks')).toMatchObject({ ratePerSecond: config.lambda, factor: 0.5 });
    expect(keys(items)).toContain('belowStakeReturns');
  });

  it('takes every number from config, profile and currency', () => {
    const p = { ...profileFromTemplate('light'), minCashout: 1.1, minCycleMs: 3000 };
    const config = { ...resolveConfigId('whack-crash/v1')!, rtp: 0.96, tMax: 45 };
    const items = describeRules(config, p, { ...DEFAULT_CURRENCY, minBetMinor: 50 });
    expect(param(items, 'rtp')).toMatchObject({ rtp: 0.96 });
    expect(param(items, 'instantBust')!.probability).toBeCloseTo(0.04, 12);
    expect(param(items, 'tMax')).toEqual({ seconds: 45 });
    expect(param(items, 'minCashout')).toEqual({ multiplier: 1.1 });
    expect(param(items, 'minCycle')).toEqual({ ms: 3000 });
    expect(param(items, 'rounding')).toMatchObject({ minStakeMinor: 50 });
    expect(param(items, 'rtp')).not.toHaveProperty('bandMinRtp');
    expect(param(describeRules(config, p, DEFAULT_CURRENCY, { roundingBand: { minRtp: 0.9463, maxRtp: 0.9937, stakeMinor: 20 } }), 'rtp')).toMatchObject({ bandMinRtp: 0.9463 });
  });

  it('reflects an effective x100 cap from the profile', () => {
    const p = fixture({ maxMultiplier: 100 });
    const items = describeRules(effectiveConfig('whack-crash', p), p, DEFAULT_CURRENCY);
    expect(param(items, 'maxMultiplier')).toEqual({ multiplier: 100 });
    expect(param(items, 'autoCashout')).toMatchObject({ maximum: 100 });
  });

  it('adds the part items right after minCashout for partial cash-out games', () => {
    const p = fixture();
    const items = describeRules(effectiveConfig('paper-route', p), p, DEFAULT_CURRENCY);
    const k = keys(items);
    const at = k.indexOf('minCashout');
    expect(k.slice(at + 1, at + 8)).toEqual(['stakeParts', 'partTiming', 'minPartValue', 'roundRounding', 'wipeout', 'disconnectRemainingParts', 'landingIsDecoration']);
    expect(param(items, 'stakeParts')).toEqual({ count: 5 });
    expect(param(items, 'minPartValue')).toMatchObject({ minor: 20 });
    expect(param(items, 'rounding')).toMatchObject({ minStakeMinor: 100 });
    expect(param(items, 'autoCashout')).toMatchObject({ settlesRemainingParts: true });
  });

  it('leaves the part items out when the profile turns partial cash-out off', () => {
    const p = fixture({ partialCashout: 'off', disconnectPolicy: 'cashout-at-disconnect' });
    const items = describeRules({ ...PAPER_ROUTE_CONFIG, maxWinMultiplier: 100 }, p, DEFAULT_CURRENCY);
    expect(keys(items)).not.toContain('stakeParts');
    expect(keys(items)).not.toContain('landingIsDecoration');
    expect(param(items, 'disconnect')).toEqual({ policy: 'cashout-at-disconnect' });
  });
});
