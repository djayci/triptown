import { describe, expect, it } from 'vitest';
import { WHACK_CRASH_SLOW_CONFIG, growth } from '@triptown/fairness';
import { intensity10 } from '@triptown/crash-client';
import { whackAudioLevel } from './music';

/** The elapsed second at which the live client first reports this 0..10 intensity. */
const firstAt = (level: number): number => {
  for (let t = 0; t <= 60; t += 0.05) if (intensity10(t, WHACK_CRASH_SLOW_CONFIG) >= level) return t;
  return Infinity;
};

describe('whack music layers', () => {
  it('adds a layer, never drops one, as the round climbs', () => {
    let seen = 0;
    for (let level = 0; level <= 10; level++) {
      const now = whackAudioLevel(level);
      expect(now).toBeGreaterThanOrEqual(seen);
      seen = now;
    }
    expect(whackAudioLevel(10)).toBe(2);
  });

  it('brings the drums in well inside a median round (7.2 s for v3)', () => {
    const t = firstAt(2);
    expect(whackAudioLevel(2)).toBe(1);
    expect(t).toBeLessThan(7.2);
    // Not on the first beat of the round: the base stem gets a moment on its own.
    expect(t).toBeGreaterThan(2);
  });

  it('saves the lead stem for a genuine run, around x10', () => {
    const t = firstAt(6);
    expect(whackAudioLevel(6)).toBe(2);
    expect(growth(t, WHACK_CRASH_SLOW_CONFIG)).toBeGreaterThan(5);
    // The old threshold (level 8, ~x48) was reached by 3.4% of rounds.
    expect(t).toBeLessThan(18);
  });
});
