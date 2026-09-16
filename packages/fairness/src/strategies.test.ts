import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as C, PAPER_ROUTE_CONFIG as PR } from './config';
import { growth } from './model';
import { survival } from './model';
import { firstReach, logGrowthInverse, paperStops, pathValue, roundedMultiple, stopFor, type Strategy } from './strategies';

describe('strategies', () => {
  it('inverts K(t)', () => {
    for (const t of [0.5, 5, 11.9, 12, 20, 45]) {
      expect(logGrowthInverse(Math.log(growth(t, C)), C)).toBeCloseTo(t, 9);
    }
  });

  it('applies a setback at its own time (setback first on ties)', () => {
    const t = 3;
    expect(pathValue(t, [t], C)).toBeCloseTo(growth(t, C) * 0.5, 12);
    expect(pathValue(t - 1e-9, [t], C)).toBeCloseTo(growth(t - 1e-9, C), 12);
  });

  it('reaches a target later after a setback knocks the value down', () => {
    const noSetback = firstReach(2, [], C)!;
    const withSetback = firstReach(2, [noSetback - 0.1], C)!;
    expect(withSetback).toBeGreaterThan(noSetback);
    expect(pathValue(withSetback, [noSetback - 0.1], C)).toBeCloseTo(2, 9);
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
      const single = stopFor(rule, setbacks, C);
      const [leg, ...rest] = paperStops({ label: 'one', legs: [{ papers: 1, rule }] }, setbacks, C);
      expect(rest).toEqual([]);
      expect(leg).toEqual({ ...single, share: 1 });
      expect(leg!.share * leg!.multiplier * survival(leg!.time, C)).toBe(single.multiplier * survival(single.time, C));
    }
  });

  it('splits the bet across legs and targets later setbacks by index', () => {
    const setbacks = [1, 3];
    const stops = paperStops(
      { label: 'split', legs: [{ papers: 1, rule: { kind: 'afterSetback' } }, { papers: 4, rule: { kind: 'afterSetback', index: 1 } }] },
      setbacks,
      PR,
    );
    expect(stops.map((s) => [s.share, s.time])).toEqual([[0.2, 1], [0.8, 3]]);
  });

  it('rejects legs that do not use every paper', () => {
    expect(() => paperStops({ label: 'short', legs: [{ papers: 4, rule: { kind: 'never' } }] }, [], PR)).toThrow(/4 papers/);
  });

  it('rounds each paper payout down to the minor unit', () => {
    expect(roundedMultiple(3.4012, 200)).toBe(3.4);
    expect(roundedMultiple(4.35, 1000)).toBe(4.35);
    expect(roundedMultiple(1.019, 10)).toBe(1);
  });
});
