import { describe, expect, it } from 'vitest';
import { ZONES, floorExact, floorFor, intensityFor, scrollSpeed, zoneFor } from './scene';
import { t } from '../i18n/en';

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

describe('building zones', () => {
  it('are a function of the multiplier alone, so two rounds at the same value look the same', () => {
    // The same value must give the same place in the building whatever the crash time, or the
    // scenery would be telling the player something about the outcome.
    for (const m of [1, 1.49, 1.5, 2.99, 3, 5.99, 6, 11.99, 12, 24.99, 25, 500]) {
      expect(zoneFor(m)).toBe(zoneFor(m));
      expect(zoneFor(m).from).toBeLessThanOrEqual(m);
    }
  });

  it('never goes back down as the value climbs', () => {
    let last = -1;
    for (let m = 1; m <= 60; m += 0.01) {
      const from = zoneFor(m).from;
      expect(from).toBeGreaterThanOrEqual(last);
      last = from;
    }
  });

  it('names every zone through the catalogue rather than in the scene', () => {
    // A hardcoded zone name would be a player-facing string that no market could translate and no
    // reviewer would see in the catalogue (GLI-19 4.4.1, PT R7 language).
    for (const z of ZONES) expect(t(z.key)).not.toBe(z.key);
  });

  it('maps the value onto a building rather than an endless tower', () => {
    // Logarithmic, so the top zone is around floor 100. The linear mapping this replaced put the
    // Penthouse on floor 110 of a 490-storey building, which no amount of art could rescue.
    expect(floorFor(1)).toBe(0);
    expect(floorFor(0.4)).toBe(0);
    expect(floorFor(25)).toBe(100);
    expect(floorFor(50)).toBeLessThan(130);
  });

  it('never sends the floor backwards as the value climbs', () => {
    let last = -1;
    for (let m = 1; m <= 60; m += 0.01) {
      const f = floorFor(m);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });

  it('puts each zone boundary on a floor the player can be standing at', () => {
    // The zone ladder and the floor tape are two views of the same climb; if they disagreed, the
    // indicator would say one thing and the building another.
    for (const z of ZONES) expect(floorFor(z.from)).toBe(Math.round(floorExact(z.from)));
  });
});
