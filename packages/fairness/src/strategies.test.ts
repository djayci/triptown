import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as C, resolveConfigId } from './config';

// Retired game config: resolvable for verification, no longer exported (design D4).
const PR = resolveConfigId('paper-route/v1')!;
import { growth } from './model';
import { survival } from './model';
import {
  firstReach,
  logGrowthInverse,
  modifiersOf,
  partStops,
  pathValue,
  roundedMultiple,
  stopFor,
  type Strategy,
} from './strategies';

/** Setback times as modifiers on the default config. */
const setbacksOf = (times: number[], c = C) => modifiersOf(times, [], c);

describe('strategies', () => {
  it('inverts K(t)', () => {
    for (const t of [0.5, 5, 11.9, 12, 20, 45]) {
      expect(logGrowthInverse(Math.log(growth(t, C)), C)).toBeCloseTo(t, 9);
    }
  });

  it('applies a setback at its own time (setback first on ties)', () => {
    const t = 3;
    expect(pathValue(t, setbacksOf([t]), C)).toBeCloseTo(growth(t, C) * 0.5, 12);
    expect(pathValue(t - 1e-9, setbacksOf([t]), C)).toBeCloseTo(growth(t - 1e-9, C), 12);
  });

  it('reaches a target later after a setback knocks the value down', () => {
    const noSetback = firstReach(2, [], C)!;
    const mods = setbacksOf([noSetback - 0.1]);
    const withSetback = firstReach(2, mods, C)!;
    expect(withSetback).toBeGreaterThan(noSetback);
    expect(pathValue(withSetback, mods, C)).toBeCloseTo(2, 9);
  });

  it('caps never-cash-out at the max win', () => {
    const stop = stopFor({ kind: 'never' }, [], C);
    expect(stop.multiplier).toBe(C.maxWinMultiplier);
    expect(growth(stop.time, C)).toBeCloseTo(C.maxWinMultiplier, 6);
  });

  it('forces a stop at tMax when the cap is out of reach', () => {
    const slow = { ...C, rmax: 0.1, r0: 0.1, maxWinMultiplier: 1e9 };
    expect(stopFor({ kind: 'never' }, [], slow).time).toBe(slow.tMax);
  });

  it('gives a one-paper strategy the same estimate as the single-stop strategy', () => {
    const setbacks = [1.4, 6.2];
    const rules: Strategy[] = [{ kind: 'target', target: 2 }, { kind: 'time', seconds: 5 }, { kind: 'afterSetback' }, { kind: 'never' }];
    for (const rule of rules) {
      const mods = setbacksOf(setbacks);
      const single = stopFor(rule, mods, C);
      const [leg, ...rest] = partStops({ label: 'one', legs: [{ parts: 1, rule }] }, mods, C);
      expect(rest).toEqual([]);
      expect(leg).toEqual({ ...single, share: 1 });
      expect(leg!.share * leg!.multiplier * survival(leg!.time, C)).toBe(single.multiplier * survival(single.time, C));
    }
  });

  it('splits the bet across legs and targets later setbacks by index', () => {
    const setbacks = [1, 3];
    const stops = partStops(
      { label: 'split', legs: [{ parts: 1, rule: { kind: 'afterSetback' } }, { parts: 4, rule: { kind: 'afterSetback', index: 1 } }] },
      setbacksOf(setbacks, PR),
      PR,
    );
    expect(stops.map((s) => [s.share, s.time])).toEqual([[0.2, 1], [0.8, 3]]);
  });

  it('rejects legs that do not use every paper', () => {
    expect(() => partStops({ label: 'short', legs: [{ parts: 4, rule: { kind: 'never' } }] }, [], PR)).toThrow(/4 parts/);
  });

  it('rounds each paper payout down to the minor unit', () => {
    expect(roundedMultiple(3.4012, 200)).toBe(3.4);
    expect(roundedMultiple(4.35, 1000)).toBe(4.35);
    expect(roundedMultiple(1.019, 10)).toBe(1);
  });
});

describe('boost modifiers', () => {
  const boosted = { ...C, id: 'test/boosted', boostRate: 0.4, boostFactor: 1.25 };

  it('merges setbacks and boosts in time order, setback first on a tie', () => {
    expect(modifiersOf([2, 5], [1, 2], boosted)).toEqual([
      { time: 1, factor: 1.25 },
      { time: 2, factor: 0.5 },
      { time: 2, factor: 1.25 },
      { time: 5, factor: 0.5 },
    ]);
  });

  it('multiplies the path by every modifier at or before t', () => {
    const mods = modifiersOf([3], [1], boosted);
    expect(pathValue(0.5, mods, boosted)).toBeCloseTo(growth(0.5, boosted), 12);
    expect(pathValue(2, mods, boosted)).toBeCloseTo(growth(2, boosted) * 1.25, 12);
    expect(pathValue(4, mods, boosted)).toBeCloseTo(growth(4, boosted) * 1.25 * 0.5, 12);
  });

  it('reaches a target sooner with a boost, and can reach it exactly at the boost', () => {
    const plain = firstReach(2, [], boosted)!;
    const withBoost = firstReach(2, modifiersOf([], [plain - 0.5], boosted), boosted)!;
    expect(withBoost).toBeLessThan(plain);
    // A boost that crosses the target lands the stop exactly on the boost time.
    const justUnder = growth(1.5, boosted) * 1.2;
    expect(firstReach(justUnder, modifiersOf([], [1.5], boosted), boosted)).toBeCloseTo(1.5, 9);
  });

  it('stops right after the first boost when asked', () => {
    const mods = modifiersOf([1], [2.5], boosted);
    expect(stopFor({ kind: 'afterBoost' }, mods, boosted).time).toBe(2.5);
    expect(stopFor({ kind: 'afterSetback' }, mods, boosted).time).toBe(1);
  });
});
