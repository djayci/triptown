import { growth, WHACK_CRASH_RISING_CONFIG as FAST, WHACK_CRASH_SLOW_RISING_CONFIG as SLOW } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { NOSE_Y, groundAt, lineY, secondsTo, speedAt, trackCheckpoints, travelAt } from './track';

// The Dirt Track's ground is the chance table: each painted value must reach the horse exactly when the
// value on screen does, never before (beat-the-gate-mvp spec "The gate and the horse never reveal the
// outcome"). The ground's position is read back from the multiplier on the round's public growth curve.
describe('dirt track ground', () => {
  it('reads the time back from the value on the public curve', () => {
    for (const t of [0.5, 3, 8, 20]) expect(secondsTo(growth(t, SLOW), SLOW)).toBeCloseTo(t, 4);
  });

  it('puts a value on the horse’s nose when the multiplier reaches it', () => {
    for (const v of [1.1, 1.5, 2, 3, 10, 100]) {
      expect(lineY(v, travelAt(v, SLOW), SLOW)).toBeCloseTo(NOSE_Y, 6);
      expect(lineY(v, travelAt(v))).toBeCloseTo(NOSE_Y, 6);
    }
  });

  it('keeps every value not yet reached ahead of the horse', () => {
    for (const m of [1, 1.25, 1.99, 4.5]) {
      for (const v of [1.1, 1.5, 2, 3, 5, 10]) if (v > m) expect(lineY(v, travelAt(m, SLOW), SLOW)).toBeLessThan(NOSE_Y);
    }
  });

  it('moves only with the multiplier, forwards while it rises', () => {
    expect(travelAt(1, SLOW)).toBe(0);
    expect(travelAt(2, SLOW)).toBeGreaterThan(travelAt(1.5, SLOW));
  });

  it('spaces checkpoints far apart at first and closer as the value climbs', () => {
    for (const config of [SLOW, FAST]) {
      const ladder = trackCheckpoints(config);
      const times = ladder.map((v) => secondsTo(v, config));
      console.info(config.id, ladder.map((v, i) => `x${v}@${times[i]!.toFixed(1)}s`).join(' '));
      expect(ladder.length).toBeGreaterThan(5);
      expect(times[0]!).toBeGreaterThan(2.5);
      for (let i = 1; i < ladder.length; i++) expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!);
      // Friendly rounding nudges each a little, so compare the early gaps with the late ones.
      const gap = (i: number) => times[i]! - times[i - 1]!;
      expect(gap(1) + gap(2)).toBeGreaterThan(gap(ladder.length - 2) + gap(ladder.length - 1));
      expect(ladder.at(-1)!).toBeLessThanOrEqual(config.maxWinMultiplier);
    }
  });

  it('winds the gallop up on a fixed curve: speed only rises, and the ground is its integral', () => {
    let last = 0;
    for (let t = 0; t <= 30; t += 0.5) {
      expect(speedAt(t)).toBeGreaterThanOrEqual(last);
      last = speedAt(t);
      // The ground travelled over a short step is the speed at that moment times the step.
      const dt = 1e-3;
      expect((groundAt(t + dt) - groundAt(t)) / dt).toBeCloseTo(speedAt(t), 0);
    }
    expect(speedAt(0)).toBeLessThan(speedAt(8));
  });
});
