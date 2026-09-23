import { describe, expect, it } from 'vitest';
import { HEADING_CUE, LAP_SECONDS, intensityFor, lapOffset } from './stage';

// beat-the-gate-mvp spec "The gate and the horse never reveal the outcome": what the scene shows may
// depend on the multiplier and on scene time modulo the lap, never on when the round will end.
describe('gate stage timing rules', () => {
  it('intensity is a pure function of the multiplier', () => {
    expect(intensityFor(1)).toBe(0);
    expect(intensityFor(4)).toBeCloseTo(intensityFor(4));
    expect(intensityFor(20)).toBe(1);
    expect(intensityFor(10_000)).toBe(1);
    expect(intensityFor(2)).toBeLessThan(intensityFor(3));
    // Front-loaded: half the build-up is done by x2, where most rides end.
    expect(intensityFor(2)).toBeGreaterThan(0.45);
  });

  it('the lap repeats exactly every LAP_SECONDS', () => {
    for (const t of [0, 0.7, 2.3, 4.9]) {
      expect(lapOffset(t + LAP_SECONDS)).toBeCloseTo(lapOffset(t), 9);
      expect(lapOffset(t + 7 * LAP_SECONDS)).toBeCloseTo(lapOffset(t), 9);
    }
  });

  it('the lap never brings the horse more than its amplitude towards the gate', () => {
    for (let t = 0; t < LAP_SECONDS; t += 0.05) expect(Math.abs(lapOffset(t))).toBeLessThanOrEqual(14);
  });

  it('the ride home is one fixed timeline, its hits in order and inside it', () => {
    // gate-odds-mvp D6: the same length for every press. The drumroll and the screen's pulses both read it.
    expect(HEADING_CUE.seconds).toBeGreaterThanOrEqual(1.2);
    const hits = [...HEADING_CUE.hits];
    expect(hits).toEqual([...hits].sort((a, b) => a - b));
    expect(hits[0]).toBeGreaterThanOrEqual(0);
    expect(hits.at(-1)!).toBeLessThan(HEADING_CUE.seconds);
  });
});
