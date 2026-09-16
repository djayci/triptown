import { commitServerSeed, createPrng } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { STEP_CONFIGS, clearChance } from './config';
import { deriveFences, fenceUniform, verifyStepRound } from './derive';

const SEEDS = { serverSeed: Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join(''), clientSeed: 'night-gallop', nonce: 0 };

describe('fence derivation', () => {
  it('is deterministic', () => {
    expect(deriveFences(SEEDS, STEP_CONFIGS.medium)).toEqual(deriveFences(SEEDS, STEP_CONFIGS.medium));
    expect(fenceUniform(SEEDS, 3)).toBe(fenceUniform(SEEDS, 3));
  });

  it('matches the committed test vector', () => {
    const uniforms = [1, 2, 3].map((k) => fenceUniform(SEEDS, k).toFixed(12));
    expect(uniforms).toMatchInlineSnapshot(`
      [
        "0.468561595337",
        "0.264199126672",
        "0.765335616612",
      ]
    `);
    expect(
      [0, 1, 2, 3, 4, 5, 6, 7].map((nonce) => deriveFences({ ...SEEDS, nonce }, STEP_CONFIGS.medium).refusedAt),
    ).toMatchInlineSnapshot(`
      [
        4,
        null,
        null,
        2,
        8,
        10,
        9,
        3,
      ]
    `);
  });

  it('verifies a round and its commitment', () => {
    const commit = commitServerSeed(SEEDS.serverSeed);
    const v = verifyStepRound({ ...SEEDS, configId: 'fence-run/v1-medium', commit });
    expect(v.commitMatches).toBe(true);
    expect(v.refusedAt).toBe(deriveFences(SEEDS, STEP_CONFIGS.medium).refusedAt);
    for (const f of v.fences) expect(f.cleared).toBe(f.uniform < clearChance(STEP_CONFIGS.medium, f.fence));
    expect(verifyStepRound({ ...SEEDS, configId: 'fence-run/v1-medium', commit: 'ab' }).commitMatches).toBe(false);
  });

  it('clears fence 1 about as often as its clear chance', () => {
    const rnd = createPrng(7);
    let cleared = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const seeds = { serverSeed: SEEDS.serverSeed, clientSeed: String(Math.floor(rnd() * 1e12)), nonce: i };
      if (deriveFences(seeds, STEP_CONFIGS.medium).refusedAt !== 1) cleared++;
    }
    expect(cleared / n).toBeCloseTo(clearChance(STEP_CONFIGS.medium, 1), 1);
  });
});

describe('randomness sources', () => {
  it('uses no randomness besides the HMAC fence stream', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of ['config.ts', 'derive.ts', 'round.ts']) {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(src).not.toMatch(/Math\.random|crypto\.getRandomValues|createPrng/);
    }
  });
});
