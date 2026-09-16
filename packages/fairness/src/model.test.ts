import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, PAPER_ROUTE_CONFIG, setbackDrag, validateConfig, type GameConfig } from './config';
import {
  crashTimeFromUniform,
  logExpectedMultiplier,
  logGrowth,
  setbackTimesFromUniforms,
  survival,
} from './model';
import { createPrng } from './prng';
import { deriveRound, verifyRound } from './round';
import { commitServerSeed } from './seeds';

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
    ['0 papers', { papers: 0 }],
    ['fractional papers', { papers: 2.5 }],
    ['growth below drag at start', { r0: 0.05, lambda: 0.12, setbackFactor: 0.5 }],
    ['growth equal to drag', { r0: 0.06, lambda: 0.12, setbackFactor: 0.5 }],
    ['rmax below drag', { rmax: 0.05, r0: 0.5, lambda: 0.2, setbackFactor: 0.5 }],
  ])('rejects %s', (_name, patch) => {
    const result = validateConfig({ ...C, ...patch });
    expect(result.ok).toBe(false);
  });

  it.each([1, 5, 10])('accepts %i papers', (papers) => {
    expect(validateConfig({ ...C, papers })).toEqual({ ok: true });
  });

  it('keeps whack-crash/v1 a single cash-out and paper-route/v1 on the same path model', () => {
    expect(C).toMatchObject({ id: 'whack-crash/v1', papers: 1 });
    expect(validateConfig(PAPER_ROUTE_CONFIG)).toEqual({ ok: true });
    expect({ ...PAPER_ROUTE_CONFIG, id: C.id, papers: 1 }).toEqual(C);
  });

  it('names the drag rule in the error', () => {
    const result = validateConfig({ ...C, r0: 0.05 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/setback drag/);
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
