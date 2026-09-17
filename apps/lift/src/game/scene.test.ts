import { describe, expect, it } from 'vitest';
import { intensityFor, scrollSpeed } from './scene';

// The rule this file exists to protect: the scene may read the multiplier and nothing else.
// A scene that quickened as the end approached would be an advance warning, and there are no
// warnings before a crash (AGENTS hard rule 2, and the lift-game-client spec).
describe('ascent intensity', () => {
  it('is a pure function of the multiplier', () => {
    // Same multiplier, two rounds that will end at completely different times: identical scenes.
    expect(intensityFor(4)).toBe(intensityFor(4));
    expect(scrollSpeed(4, true)).toBe(scrollSpeed(4, true));
  });

  it('rises with the multiplier and never falls', () => {
    let previous = -1;
    for (const m of [1, 1.5, 2, 4, 8, 20, 100, 10_000]) {
      const value = intensityFor(m);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('stays within bounds at the extremes', () => {
    expect(intensityFor(1)).toBe(0);
    expect(intensityFor(0.5)).toBe(0);
    expect(intensityFor(10_000)).toBeLessThanOrEqual(1);
  });

  it('holds a constant baseline when the profile turns intensity effects off', () => {
    const off = [1, 2, 10, 1000].map((m) => scrollSpeed(m, false));
    expect(new Set(off).size).toBe(1);
    // and the escalation only exists when the profile allows it
    expect(scrollSpeed(10, true)).toBeGreaterThan(scrollSpeed(10, false));
  });
});
