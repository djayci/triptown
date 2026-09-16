import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, STEP_CONFIGS, clearChance, paytableFromChance, reachChance, validateStepConfig } from './config';

describe('step configs', () => {
  it('publishes the Medium paytable', () => {
    expect(STEP_CONFIGS.medium.paytable).toEqual([1.21, 1.52, 1.89, 2.37, 2.96, 3.7, 4.63, 5.78, 7.23, 9.03]);
    expect(clearChance(STEP_CONFIGS.medium, 1)).toBeCloseTo(0.97 / 1.21, 12);
  });

  it('matches the tables authored from nominal clear chances', () => {
    expect(STEP_CONFIGS.easy.paytable).toEqual(paytableFromChance(0.97, 0.9, 10));
    expect(STEP_CONFIGS.medium.paytable).toEqual(paytableFromChance(0.97, 0.8, 10));
    expect(STEP_CONFIGS.hard.paytable).toEqual(paytableFromChance(0.97, 0.65, 10));
  });

  it('returns exactly the RTP when stopping after any fence', () => {
    for (const d of DIFFICULTIES) {
      const c = STEP_CONFIGS[d];
      expect(validateStepConfig(c)).toEqual([]);
      for (let k = 1; k <= 10; k++) {
        expect(clearChance(c, k)).toBeLessThan(1);
        expect(reachChance(c, k) * c.paytable[k - 1]!).toBeCloseTo(0.97, 12);
      }
    }
  });

  it('rejects a paytable that does not increase', () => {
    const bad = { ...STEP_CONFIGS.medium, paytable: [1.52, 1.21, 1.89] };
    expect(validateStepConfig(bad).length).toBeGreaterThan(0);
    expect(validateStepConfig({ ...STEP_CONFIGS.medium, paytable: [0.9, 1.5] }).length).toBeGreaterThan(0);
  });
});
