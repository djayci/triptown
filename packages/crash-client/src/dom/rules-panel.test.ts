import { NGN_CURRENCY, effectiveConfig, profileFromTemplate, registerGame } from '@triptown/core';
import { describe, expect, it } from 'vitest';
import { chanceRows, showsChances } from './rules-panel';

// gate-odds-mvp 7.3: the chance table before any bet. Shown only where this game's rounds reveal at collect,
// and every row carries the same expected return, so none can read as the better place to go in.

registerGame('chance-probe', 'whack-crash', { reveal: ['onCollect'] });
registerGame('chance-live-probe', 'whack-crash');
const origins = ['https://op.example'];
const ng = profileFromTemplate('ng-draft', origins);
const session = { profile: ng, config: effectiveConfig('chance-probe', ng), currency: NGN_CURRENCY };

describe('rules chance table', () => {
  it('is shown only when the game and the market both reveal at collect', () => {
    expect(showsChances('chance-probe', session)).toBe(true);
    expect(showsChances('chance-live-probe', session)).toBe(false);
    expect(showsChances(undefined, session)).toBe(false);
    const uk = { ...profileFromTemplate('ng-draft', origins), status: 'active' as const, crashReveal: undefined, marketCountry: undefined, blockedRegions: undefined, dataTransferBasis: undefined };
    expect(showsChances('chance-probe', { profile: uk, config: effectiveConfig('chance-probe', uk) })).toBe(false);
  });

  it('gives chance x value at the RTP on every row, rounded down', () => {
    const { rows } = chanceRows(session, 500_00);
    expect(rows.length).toBeGreaterThan(5);
    for (const r of rows) {
      const m = Number(r.value.slice(1).replace(/,/g, ''));
      const chance = Number(r.chance.replace('%', '')) / 100;
      expect(chance * m).toBeLessThanOrEqual(session.config.rtp + 1e-9);
      expect(chance * m).toBeGreaterThan(session.config.rtp - 0.001 * m);
    }
    expect(rows.find((r) => r.value === 'x2.00')?.chance).toBe('48.5%');
  });

  it('prices the return at the selected stake, never below the market minimum', () => {
    expect(chanceRows(session, 500_00).stake).toContain('500.00');
    expect(chanceRows(session, 1_00).stake).toContain('100.00');
    expect(chanceRows(session, 500_00).rows.find((r) => r.value === 'x2.00')?.payout).toContain('1,000.00');
  });
});
