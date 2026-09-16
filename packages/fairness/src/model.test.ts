import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  GAME_CONFIGS,
  modifierDrift,
  resolveConfigId,
  retiredConfigIds,
  setbackDrag,
  validateConfig,
  type GameConfig,
} from './config';
import {
  crashTimeFromUniform,
  logExpectedMultiplier,
  logGrowth,
  setbackTimesFromUniforms,
  survival,
} from './model';
import { createPrng } from './prng';
import { deriveRound, verifyRound } from './round';
import { commitServerSeed, streamUniform } from './seeds';

const C = DEFAULT_CONFIG;

describe('validateConfig', () => {
  it('accepts the default config', () => {
    expect(validateConfig(C)).toEqual({ ok: true });
  });

  it.each<[string, Partial<GameConfig>]>([
    ['rtp above 1', { rtp: 1.2 }],
    ['rtp of 0', { rtp: 0 }],
    ['negative r0', { r0: -0.1 }],
    ['non-finite rmax', { rmax: Number.POSITIVE_INFINITY }],
    ['setback factor of 0', { setbackFactor: 0 }],
    ['max win of 1', { maxWinMultiplier: 1 }],
    ['tMax of 0', { tMax: 0 }],
    ['0 stake parts', { stakeParts: 0 }],
    ['fractional stake parts', { stakeParts: 2.5 }],
    ['growth below drag at start', { r0: 0.05, lambda: 0.12, setbackFactor: 0.5 }],
    ['growth equal to drag', { r0: 0.06, lambda: 0.12, setbackFactor: 0.5 }],
    ['rmax below drag', { rmax: 0.05, r0: 0.5, lambda: 0.2, setbackFactor: 0.5 }],
  ])('rejects %s', (_name, patch) => {
    const result = validateConfig({ ...C, ...patch });
    expect(result.ok).toBe(false);
  });

  it.each([1, 5, 10])('accepts %i stake parts', (stakeParts) => {
    expect(validateConfig({ ...C, stakeParts })).toEqual({ ok: true });
  });

  it('keeps whack-crash/v1 a single cash-out and paper-route/v1 on the same path model', () => {
    expect(C).toMatchObject({ id: 'whack-crash/v1', stakeParts: 1 });
    const paper = resolveConfigId('paper-route/v1')!;
    expect(validateConfig(paper)).toEqual({ ok: true });
    expect({ ...paper, id: C.id, stakeParts: 1 }).toEqual(C);
  });

  // A config id is a permanent public fact: archived reports name these, and the verifier has to be
  // able to check a round settled under one long after the game is gone (design D4).
  it('still resolves retired config ids, with the parameters their archived reports used', () => {
    for (const id of retiredConfigIds()) {
      const config = resolveConfigId(id);
      expect(config, `${id} must stay resolvable`).not.toBeNull();
      expect(config!.id).toBe(id);
      expect(validateConfig(config!)).toEqual({ ok: true });
    }
    expect(resolveConfigId('paper-route/v1')).toMatchObject({ stakeParts: 5, lambda: 0.12 });
    expect(resolveConfigId('paper-route/v1-rising')).toMatchObject({ stakeParts: 5, lambda: 0 });
  });

  it('resolves a capped id derived from a retired config', () => {
    expect(resolveConfigId('paper-route/v1-rising+cap100')).toMatchObject({ maxWinMultiplier: 100, stakeParts: 5 });
  });

  it('does not offer retired configs for new rounds', () => {
    for (const id of retiredConfigIds()) expect(GAME_CONFIGS[id]).toBeUndefined();
  });

  it('names the drift rule in the error', () => {
    const result = validateConfig({ ...C, r0: 0.05 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/modifier drift/);
  });

  it('rejects impossible boost settings', () => {
    expect(validateConfig({ ...C, boostRate: -1 }).ok).toBe(false);
    expect(validateConfig({ ...C, boostRate: 0.4, boostFactor: 1 }).ok).toBe(false);
    // A boost-heavy config has negative drift, which is legal: the value climbs faster than growth.
    const boostHeavy = { ...C, id: 'test/boost-heavy', lambda: 0, boostRate: 0.8, boostFactor: 1.25 };
    expect(validateConfig(boostHeavy).ok).toBe(true);
    expect(modifierDrift(boostHeavy)).toBeLessThan(0);
  });
});

describe('boosts (good mole)', () => {
  const boosted = GAME_CONFIGS['whack-crash/v2']!;

  it('nets the boost lift against the setback drag', () => {
    expect(modifierDrift(C)).toBeCloseTo(0.06, 12);
    expect(modifierDrift(boosted)).toBeCloseTo(0.06 - 0.4 * 0.05, 12);
    expect(setbackDrag(boosted)).toBeCloseTo(0.06, 12);
  });

  it('keeps survival and the crash-time inversion consistent for both configs', () => {
    for (const c of [C, boosted]) {
      for (const t of [0.4, 3, 11.9, 12, 25, 59]) {
        const u = survival(t, c);
        expect(crashTimeFromUniform(u, c)).toBeCloseTo(t, 9);
      }
    }
  });

  it('crashes sooner for the same uniform once boosts are on', () => {
    for (const u of [0.9, 0.5, 0.1, 0.001]) {
      expect(crashTimeFromUniform(u, boosted)).toBeLessThan(crashTimeFromUniform(u, C));
    }
  });

  it('draws boost times from their own stream, inside the horizon', () => {
    const seeds = { serverSeed: 'a'.repeat(64), clientSeed: 'player', nonce: 7 };
    const plain = deriveRound(seeds, C);
    const withBoosts = deriveRound(seeds, boosted);
    expect(plain.boosts).toEqual([]);
    // Same seeds, same crash stream: only the config's drift moves the crash time.
    expect(withBoosts.boosts.every((t, i) => t > 0 && (i === 0 || t > withBoosts.boosts[i - 1]!))).toBe(true);
    const horizon = Math.min(withBoosts.crashTime, boosted.tMax);
    expect(withBoosts.boosts.every((t) => t < horizon)).toBe(true);
    expect(deriveRound(seeds, boosted)).toEqual(withBoosts);
  });

  it('is unaffected by boost settings in the crash stream itself', () => {
    const seeds = { serverSeed: 'b'.repeat(64), clientSeed: 'c', nonce: 1 };
    const u = streamUniform(seeds, 'crash', 0);
    expect(crashTimeFromUniform(u, boosted)).toBe(deriveRound(seeds, boosted).crashTime);
  });

  it('registers all four whack-crash variants', () => {
    for (const id of ['whack-crash/v1', 'whack-crash/v1-rising', 'whack-crash/v2', 'whack-crash/v2-rising']) {
      const c = resolveConfigId(id);
      expect(c?.id).toBe(id);
      expect(validateConfig(c!).ok).toBe(true);
    }
    const capped = resolveConfigId('whack-crash/v2+cap100');
    expect(capped).toMatchObject({ maxWinMultiplier: 100, boostRate: 0.4 });
  });
});

describe('growth', () => {
  it('is continuous at the end of the ramp', () => {
    const eps = 1e-9;
    expect(logGrowth(C.tRamp - eps, C)).toBeCloseTo(logGrowth(C.tRamp + eps, C), 6);
  });

  it('never grows faster than rmax', () => {
    for (let t = 0; t < 40; t += 0.05) {
      expect(logGrowth(t + 0.1, C) - logGrowth(t, C)).toBeLessThanOrEqual(C.rmax * 0.1 + 1e-12);
    }
  });
});

describe('crashTimeFromUniform', () => {
  it('busts instantly when u > RTP', () => {
    expect(crashTimeFromUniform(0.98, C)).toBe(0);
    expect(crashTimeFromUniform(1, C)).toBe(0);
  });

  it('is deterministic', () => {
    expect(crashTimeFromUniform(0.1234, C)).toBe(crashTimeFromUniform(0.1234, C));
  });

  it('inverts H(T) = ln(RTP/u) to within 1 ms on and after the ramp', () => {
    const rng = createPrng(42);
    for (let i = 0; i < 20_000; i++) {
      const u = rng() * C.rtp;
      if (u === 0) continue;
      const T = crashTimeFromUniform(u, C);
      const target = Math.log(C.rtp / u);
      // Bisection reference.
      let lo = 0;
      let hi = 1;
      while (logExpectedMultiplier(hi, C) < target) hi *= 2;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        if (logExpectedMultiplier(mid, C) < target) lo = mid;
        else hi = mid;
      }
      expect(Math.abs(T - hi)).toBeLessThan(0.001);
    }
  });

  it('handles configs without a ramp and with a decreasing ramp', () => {
    const flat = { ...C, tRamp: 0 };
    const T = crashTimeFromUniform(0.3, flat);
    expect(logExpectedMultiplier(T, flat)).toBeCloseTo(Math.log(C.rtp / 0.3), 9);
    const down = { ...C, r0: 1.2, rmax: 0.4 };
    const T2 = crashTimeFromUniform(0.001, down);
    expect(logExpectedMultiplier(T2, down)).toBeCloseTo(Math.log(C.rtp / 0.001), 9);
  });

  it('matches the survival function empirically', () => {
    const rng = createPrng(7);
    const n = 400_000;
    const checkpoints = [0, 1, 3, 6, 12, 20];
    const counts = checkpoints.map(() => 0);
    for (let i = 0; i < n; i++) {
      const T = crashTimeFromUniform(rng(), C);
      checkpoints.forEach((t, k) => {
        if (T > t) counts[k]!++;
      });
    }
    checkpoints.forEach((t, k) => {
      const p = survival(t, C);
      const se = Math.sqrt((p * (1 - p)) / n);
      expect(Math.abs(counts[k]! / n - p)).toBeLessThan(4 * se + 1e-6);
    });
  });
});

describe('setbackTimesFromUniforms', () => {
  it('keeps ascending times strictly before the horizon', () => {
    const rng = createPrng(3);
    const times = setbackTimesFromUniforms(rng, C, 30);
    for (let i = 1; i < times.length; i++) expect(times[i]!).toBeGreaterThanOrEqual(times[i - 1]!);
    times.forEach((t) => expect(t).toBeLessThan(30));
  });

  it('returns none when lambda is 0 or the horizon is 0', () => {
    expect(setbackTimesFromUniforms(() => 0.5, { ...C, lambda: 0 }, 10)).toEqual([]);
    expect(setbackTimesFromUniforms(() => 0.5, C, 0)).toEqual([]);
  });

  it('has mean count lambda * horizon over 1M samples', () => {
    const rng = createPrng(11);
    const n = 1_000_000;
    let count = 0;
    let expected = 0;
    for (let i = 0; i < n; i++) {
      const T = crashTimeFromUniform(rng(), C);
      const horizon = Math.min(T, C.tMax);
      count += setbackTimesFromUniforms(rng, C, horizon).length;
      expected += C.lambda * horizon;
    }
    const relErr = Math.abs(count - expected) / expected;
    expect(relErr).toBeLessThan(0.01);
  });
});

describe('deriveRound and verifyRound', () => {
  const seeds = {
    serverSeed: 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00',
    clientSeed: 'lucky',
    nonce: 3,
  };

  it('gives identical outcomes for identical inputs', () => {
    expect(deriveRound(seeds, C)).toEqual(deriveRound(seeds, C));
  });

  it('gives different outcomes for different nonces', () => {
    const outcomes = new Set(
      Array.from({ length: 20 }, (_, nonce) => deriveRound({ ...seeds, nonce }, C).crashTime),
    );
    expect(outcomes.size).toBeGreaterThan(15);
  });

  it('keeps setbacks before the crash', () => {
    for (let nonce = 0; nonce < 200; nonce++) {
      const r = deriveRound({ ...seeds, nonce }, C);
      r.setbacks.forEach((t) => expect(t).toBeLessThan(r.crashTime));
    }
  });

  it('verifies a revealed seed that matches the commit', () => {
    const commit = commitServerSeed(seeds.serverSeed);
    const result = verifyRound({ ...seeds, commit, config: C });
    expect(result.verified).toBe(true);
    expect(result.crashTime).toBe(deriveRound(seeds, C).crashTime);
  });

  it('reports a tampered seed as not verified', () => {
    const commit = commitServerSeed(seeds.serverSeed);
    const tampered = seeds.serverSeed.slice(0, -1) + '1';
    expect(verifyRound({ ...seeds, serverSeed: tampered, commit, config: C }).verified).toBe(false);
    expect(verifyRound({ ...seeds, serverSeed: 'not-hex', commit, config: C }).verified).toBe(false);
  });

  it('exposes the drag helper used by the model', () => {
    expect(setbackDrag(C)).toBeCloseTo(0.06, 12);
  });
});
