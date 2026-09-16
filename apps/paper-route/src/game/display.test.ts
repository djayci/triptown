import { PAPER_ROUTE_CONFIG as C } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import {
  BASE_SPEED_MPS,
  allowsWinPresentation,
  bankedExactMinor,
  exactReturnMinor,
  liveLabel,
  ridingSpeed,
  shownMinor,
} from './display';

const PAPER = 200; // 2.00
const STAKE = 1000; // 10.00

describe('returns', () => {
  it('shows 3 riding papers at x3.40 as 20.40', () => {
    expect(shownMinor(exactReturnMinor(PAPER, 3, 3.4))).toBe(2040);
  });

  it('sums banked papers exactly before rounding', () => {
    expect(bankedExactMinor(PAPER, [{ papers: 1, multiplier: 3.4012 }, { papers: 1, multiplier: 1.2345 }])).toBeCloseTo(927.14, 6);
  });
});

describe('liveLabel', () => {
  it('reads RETURN NOW at x0.95 with nothing thrown', () => {
    expect(liveLabel(STAKE, 0, exactReturnMinor(PAPER, 5, 0.95))).toBe('RETURN NOW');
  });

  it('reads RETURN NOW when the round would return exactly the stake', () => {
    expect(liveLabel(STAKE, 0, exactReturnMinor(PAPER, 5, 1))).toBe('RETURN NOW');
  });

  it('reads WIN NOW only when banked plus riding beats the stake', () => {
    const banked = bankedExactMinor(PAPER, [{ papers: 1, multiplier: 1.6 }, { papers: 1, multiplier: 2.1 }]);
    expect(liveLabel(STAKE, banked, exactReturnMinor(PAPER, 3, 2.35))).toBe('WIN NOW');
    expect(liveLabel(STAKE, banked, exactReturnMinor(PAPER, 3, 0.4))).toBe('RETURN NOW');
  });
});

describe('allowsWinPresentation', () => {
  it('never celebrates a round total equal to or below the stake', () => {
    expect(allowsWinPresentation(STAKE, 1000)).toBe(false);
    expect(allowsWinPresentation(STAKE, 740)).toBe(false);
    expect(allowsWinPresentation(STAKE, 2400)).toBe(true);
  });
});

describe('ridingSpeed', () => {
  it('stays constant with intensity effects off', () => {
    for (const t of [0, 3, 12, 40]) expect(ridingSpeed(t, C, false)).toBe(BASE_SPEED_MPS);
  });

  it('speeds up during the ramp and stops accelerating after it', () => {
    expect(ridingSpeed(6, C, true)).toBeGreaterThan(ridingSpeed(1, C, true));
    expect(ridingSpeed(C.tRamp + 5, C, true)).toBe(ridingSpeed(C.tRamp + 30, C, true));
  });
});
