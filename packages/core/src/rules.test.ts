import { PAPER_ROUTE_CONFIG, resolveConfigId } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY } from './money';
import { effectiveConfig, profileFromTemplate } from './profiles';
import { describeRules } from './rules';

const O = ['https://op.example'];
const keys = (items: { key: string }[]) => items.map((i) => i.key);
const param = (items: { key: string; params: Record<string, unknown> }[], key: string) => items.find((i) => i.key === key)?.params;

describe('describeRules (compliance-baseline 6.1)', () => {
  it('has no setback or below-stake items for a rising profile', () => {
    const p = profileFromTemplate('regulated-uk', O);
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

  it('reflects the effective x100 cap of the Portugal draft', () => {
    const p = profileFromTemplate('pt-draft', O);
    const items = describeRules(effectiveConfig('whack-crash', p), p, DEFAULT_CURRENCY);
    expect(param(items, 'maxMultiplier')).toEqual({ multiplier: 100 });
    expect(param(items, 'autoCashout')).toMatchObject({ maximum: 100 });
  });

  it('adds the paper items right after minCashout for partial cash-out games', () => {
    const p = profileFromTemplate('regulated-uk', O);
    const items = describeRules(effectiveConfig('paper-route', p), p, DEFAULT_CURRENCY);
    const k = keys(items);
    const at = k.indexOf('minCashout');
    expect(k.slice(at + 1, at + 8)).toEqual(['papers', 'throwTiming', 'minPaperValue', 'roundRounding', 'wipeout', 'disconnectRemainingPapers', 'landingIsDecoration']);
    expect(param(items, 'papers')).toEqual({ count: 5 });
    expect(param(items, 'minPaperValue')).toMatchObject({ minor: 20 });
    expect(param(items, 'rounding')).toMatchObject({ minStakeMinor: 100 });
    expect(param(items, 'autoCashout')).toMatchObject({ settlesRemainingPapers: true });
  });

  it('leaves the paper items out when the profile turns partial cash-out off', () => {
    const p = profileFromTemplate('pt-draft', O);
    const items = describeRules({ ...PAPER_ROUTE_CONFIG, maxWinMultiplier: 100 }, p, DEFAULT_CURRENCY);
    expect(keys(items)).not.toContain('papers');
    expect(keys(items)).not.toContain('landingIsDecoration');
    expect(param(items, 'disconnect')).toEqual({ policy: 'cashout-at-disconnect' });
  });
});
