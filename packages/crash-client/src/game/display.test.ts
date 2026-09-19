import { DEFAULT_CURRENCY } from '@triptown/core';
import { DEFAULT_CONFIG, growth, type GameConfig } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import {
  chanceTable,
  crossedCheckpoint,
  crossedMini,
  displayMultiplier,
  formatMultiplier,
  intensity10,
  intensityAudioLevel,
  intensityName,
  nextAutoPreset,
  optimisticPayout,
  stepBet,
} from './display';

const C = DEFAULT_CONFIG;

describe('display math', () => {
  it('applies received setbacks', () => {
    expect(displayMultiplier(5, 0, C)).toBe(growth(5, C));
    expect(displayMultiplier(5, 2, C)).toBeCloseTo(growth(5, C) / 4, 12);
  });

  it('formats multipliers rounded down', () => {
    expect(formatMultiplier(4.2099)).toBe('x4.20');
    expect(formatMultiplier(1)).toBe('x1.00');
    expect(formatMultiplier(12345.6)).toBe('x12,345');
  });

  it('caps the optimistic payout at max win', () => {
    expect(optimisticPayout(10_00, 4.2037, C)).toBe(42_04);
    expect(optimisticPayout(1_00, 1e9, C)).toBe(C.maxWinMultiplier * 1_00);
  });

  it('maps growth speed to intensity', () => {
    expect(intensity10(0, C)).toBe(1);
    expect(intensity10(C.tRamp, C)).toBe(10);
    expect(intensityName(2)).toBe('SLOW');
    expect(intensityName(5)).toBe('MEDIUM');
    expect(intensityName(9)).toBe('FAST');
    expect(intensityAudioLevel(9)).toBe(2);
  });

  it('steps bets along the ladder within limits', () => {
    expect(stepBet(10_00, 1, DEFAULT_CURRENCY)).toBe(20_00);
    expect(stepBet(10_00, -1, DEFAULT_CURRENCY)).toBe(5_00);
    expect(stepBet(100_00, 1, DEFAULT_CURRENCY)).toBe(100_00);
    expect(stepBet(20, -1, DEFAULT_CURRENCY)).toBe(20); // 0.20 minimum stake
  });

  it('reports the highest checkpoint crossed, once each', () => {
    expect(crossedCheckpoint(1, 1.49)).toBeNull();
    expect(crossedCheckpoint(1, 1.5)).toBe(1.5);
    expect(crossedCheckpoint(2, 2.4)).toBeNull();
    expect(crossedCheckpoint(1.6, 12)).toBe(10); // jumped several at once, reports the highest
    expect(crossedCheckpoint(800, 1200)).toBe(1000);
  });

  it('spaces the small in-between milestones by size', () => {
    expect(crossedMini(1.02, 1.1)).toBe(1.1);
    expect(crossedMini(1.1, 1.19)).toBeNull();
    expect(crossedMini(3.2, 3.5)).toBe(3.5); // 0.25 steps above x2
    expect(crossedMini(12, 13.4)).toBe(13); // whole steps above x10
    expect(crossedMini(1, 1.05)).toBeNull(); // nothing at or below x1
  });

  it('cycles auto cash-out presets', () => {
    expect(nextAutoPreset(5)).toBe(10);
    expect(nextAutoPreset(100)).toBe(1.5);
  });
});

describe('chance table with the player\'s own rides', () => {
  const config = { rtp: 0.97, maxWinMultiplier: 10_000 } as GameConfig;

  it('gives every row the same expected return, and no tally before the first ride', () => {
    const rows = chanceTable(config);
    expect(rows.map((r) => r.value)).toEqual(['x1.50', 'x2.00', 'x5.00', 'x10.00']);
    expect(rows.every((r) => r.yours === null)).toBe(true);
    for (const r of rows) expect((Number(r.chance.replace('%', '')) / 100) * r.multiplier).toBeCloseTo(0.97, 2);
  });

  it('counts a ride at every value it reached, open or shut', () => {
    const rides = [
      { multiplier: 3, won: true },
      { multiplier: 1.6, won: false },
      { multiplier: 12, won: true },
      { multiplier: 1.2, won: true },
    ];
    const yours = Object.fromEntries(chanceTable(config, rides).map((r) => [r.value, r.yours]));
    // x1.50: three rides reached it (3, 1.6, 12), two of them open. x5.00 and x10.00: only the x12 ride.
    expect(yours).toEqual({ 'x1.50': '2/3', 'x2.00': '2/2', 'x5.00': '1/1', 'x10.00': '1/1' });
  });
});
