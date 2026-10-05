import { describe, expect, it } from 'vitest';
import { planSwitch, tierFor } from './ranch-music';

// flock-mvp: the round music speeds up over time with the pitch fixed (user, 4 Oct 2026). It steps a
// tier at a time on a bar line, keeps the bar of the tune, and is driven by the shared pace alone.
const PACE = [0, 0.15, 0.35, 0.6];

describe('tierFor', () => {
  it('climbs with elapsed time and never skips a threshold', () => {
    expect(tierFor(0, PACE)).toBe(0);
    expect(tierFor(0.14, PACE)).toBe(0);
    expect(tierFor(0.15, PACE)).toBe(1);
    expect(tierFor(0.5, PACE)).toBe(2);
    expect(tierFor(1, PACE)).toBe(3);
    let last = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      expect(tierFor(p, PACE)).toBeGreaterThanOrEqual(last);
      last = tierFor(p, PACE);
    }
  });
});

describe('planSwitch', () => {
  const bar168 = 240 / 168;

  it('lands on the next bar line and carries on from the same bar at the new tempo', () => {
    const now = 10 + 5.3 * bar168;
    const { at, offset, bar } = planSwitch(now, 10, 168, 180, 16);
    expect(at).toBeCloseTo(10 + 6 * bar168, 9);
    expect(bar).toBe(6);
    expect(offset).toBeCloseTo(6 * (240 / 180), 9);
  });

  it('wraps at the end of the 16-bar loop back to bar 0', () => {
    const { bar, offset } = planSwitch(10 + 15.9 * bar168, 10, 168, 180, 16);
    expect(bar).toBe(0);
    expect(offset).toBe(0);
  });

  it('never schedules a switch closer than the lead time', () => {
    const now = 10 + (3 - 0.01) * bar168;
    const { at } = planSwitch(now, 10, 168, 180, 16, 0.03);
    expect(at - now).toBeGreaterThanOrEqual(0.03);
  });
});
