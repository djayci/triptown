import { describe, expect, it } from 'vitest';
import { effectiveConfig, effectiveReveal, profileFromTemplate, registerGame } from '@triptown/core';
import { FAR_PROFILE, RIDGE_PROFILE, STOPS, heightExact, heightFor, intensityFor, scrollSpeed, stopFor } from './scene';
import { t } from '../i18n/en';

registerGame('cable-car', 'whack-crash', { reveal: ['onCollect'] });

const PROFILES = ['light', 'ng-draft', 'gh-draft'] as const;
const origins = ['https://example.test'];

describe('a skin, not a new engine', () => {
  it('resolves the engine configuration on every shipped profile', () => {
    // If this ever diverges the game has its own maths, and its own maths needs its own lab
    // acceptance — which is the entire cost the skin architecture exists to avoid.
    for (const name of PROFILES) {
      const p = profileFromTemplate(name, origins);
      expect(effectiveConfig('cable-car', p)).toEqual(effectiveConfig('whack-crash', p));
      expect(effectiveConfig('cable-car', p).id).not.toContain('cable-car');
    }
  });

  it('reveals on the collect only where the market allows it', () => {
    // The market flag says what is permitted; effectiveReveal says what this game actually does.
    // Reading the flag alone is how a live game gets treated as deferred, and vice versa.
    for (const name of PROFILES) {
      const p = profileFromTemplate(name, origins);
      const c = effectiveConfig('cable-car', p);
      const expected = name === 'light' ? 'live' : 'onCollect';
      expect(effectiveReveal('cable-car', p, c)).toBe(expected);
    }
  });
});

describe('ride intensity', () => {
  it('is a pure function of the multiplier', () => {
    // Two rounds that reach the same value must look identical there, whatever their crash times.
    for (const m of [1, 1.5, 2, 4, 10, 40]) expect(intensityFor(m)).toBe(intensityFor(m));
  });

  it('rises with the multiplier and never falls', () => {
    let last = -1;
    for (let m = 1; m <= 60; m += 0.05) {
      const v = intensityFor(m);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('stays within bounds at the extremes', () => {
    expect(intensityFor(0.2)).toBe(0);
    expect(intensityFor(1)).toBe(0);
    expect(intensityFor(1e6)).toBeLessThanOrEqual(1);
  });

  it('holds a constant baseline when the profile turns intensity effects off', () => {
    const off = [1, 2, 8, 30].map((m) => scrollSpeed(m, false));
    expect(new Set(off).size).toBe(1);
    expect(scrollSpeed(8, true)).toBeGreaterThan(scrollSpeed(8, false));
  });
});

describe('the stops along the line', () => {
  it('are a function of the multiplier alone', () => {
    for (const m of [1, 1.49, 1.5, 2.99, 3, 5.99, 6, 11.99, 12, 24.99, 25, 500]) {
      expect(stopFor(m)).toBe(stopFor(m));
      expect(stopFor(m).from).toBeLessThanOrEqual(m);
    }
  });

  it('never goes back down as the value climbs', () => {
    let last = -1;
    for (let m = 1; m <= 60; m += 0.01) {
      const from = stopFor(m).from;
      expect(from).toBeGreaterThanOrEqual(last);
      last = from;
    }
  });

  it('names every stop through the catalogue rather than in the scene', () => {
    // A hardcoded name is a player-facing string no market can translate and no reviewer sees in
    // the catalogue (GLI-19 4.4.1, PT R7 language).
    for (const s of STOPS) expect(t(s.key)).not.toBe(s.key);
  });

  it('has no stop that reads as the end of the line', () => {
    // A terminus on the ladder would be a progress bar toward the crash. The top stop is named for
    // open sky precisely because it is not a destination.
    const names = STOPS.map((s) => t(s.key).toLowerCase());
    for (const banned of ['summit', 'top', 'terminus', 'final', 'last', 'end']) {
      expect(names.some((n) => n.includes(banned))).toBe(false);
    }
  });
});

describe('height on the car', () => {
  it('maps the value onto a mountain rather than an endless climb', () => {
    expect(heightFor(1)).toBe(0);
    expect(heightFor(0.4)).toBe(0);
    expect(heightFor(25)).toBe(2000);
    expect(heightFor(50)).toBeLessThan(2500);
  });

  it('never sends the height backwards as the value climbs', () => {
    let last = -1;
    for (let m = 1; m <= 60; m += 0.01) {
      const h = heightExact(m);
      expect(h).toBeGreaterThanOrEqual(last);
      last = h;
    }
  });
});

describe('nothing keyed to the crash', () => {
  it('exposes no function that takes a crash time or a time remaining', () => {
    // The scene's whole public surface takes the multiplier. This is the structural version of the
    // no-advance-warning rule: there is nothing to pass that could leak the outcome.
    for (const fn of [intensityFor, stopFor, heightExact, heightFor]) {
      expect(fn.length).toBe(1);
    }
    expect(scrollSpeed.length).toBe(2);
  });
});

describe('the landscape loops without a seam', () => {
  it('starts and ends each layer at the same height', () => {
    // The layers tile sideways forever. If a tile's left and right edges sit at different heights,
    // a step appears at every wrap — which is the only way these layers can show a seam.
    for (const profile of [FAR_PROFILE, RIDGE_PROFILE]) {
      const first = profile[0]!;
      const last = profile[profile.length - 1]!;
      expect(last[1]).toBe(first[1]);
    }
  });

  it('spans exactly one tile width', () => {
    // A profile narrower or wider than the tile would stretch or clip at the repeat.
    for (const profile of [FAR_PROFILE, RIDGE_PROFILE]) {
      expect(profile[0]![0]).toBe(0);
      expect(profile[profile.length - 1]![0]).toBe(390);
    }
  });
});
