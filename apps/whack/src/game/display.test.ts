import { DEFAULT_CURRENCY } from '@triptown/core';
import { DEFAULT_CONFIG, growth } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import {
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
    expect(intensityName(2)).toBe('CALM');
    expect(intensityName(5)).toBe('FAST');
    expect(intensityName(9)).toBe('FRENZY');
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
