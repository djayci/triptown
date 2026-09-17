import { describe, expect, it } from 'vitest';
import { BET_LADDER, betLadder, clampBet, stepBet } from './display';

const USD = { code: 'USD', decimals: 2, minBetMinor: 20, maxBetMinor: 100_00 };
const NGN = { code: 'NGN', decimals: 2, minBetMinor: 100_00, maxBetMinor: 1_000_000_00 };
const GHS = { code: 'GHS', decimals: 2, minBetMinor: 1_00, maxBetMinor: 10_000_00 };

// The client's default bet is written once, for a notional currency. A session in naira has a
// minimum 500x larger, and a bet under the minimum is refused by the host — so without clamping,
// a player in that market cannot start a round at all until they notice and tap +.
describe('clampBet', () => {
  it('lifts a default bet up to a market whose minimum is higher', () => {
    expect(clampBet(10_00, NGN)).toBeGreaterThanOrEqual(NGN.minBetMinor);
  });

  it('leaves a bet that is already valid alone', () => {
    expect(clampBet(10_00, USD)).toBe(10_00);
    expect(clampBet(5_00, GHS)).toBe(5_00);
  });

  it('brings a bet above the maximum back into range', () => {
    expect(clampBet(1_000_00, USD)).toBeLessThanOrEqual(USD.maxBetMinor);
  });

  it('always lands on a value the player could have chosen themselves', () => {
    for (const currency of [USD, NGN, GHS]) {
      for (const start of [1, 10, 10_00, 99_99, 10_000_00]) {
        const value = clampBet(start, currency);
        expect(value).toBeGreaterThanOrEqual(currency.minBetMinor);
        expect(value).toBeLessThanOrEqual(currency.maxBetMinor);
      }
    }
  });

  it('falls back to the minimum when no ladder value fits', () => {
    const odd = { code: 'ODD', decimals: 2, minBetMinor: 33, maxBetMinor: 44 };
    expect(clampBet(10_00, odd)).toBe(33);
  });
});

describe('stake stepping', () => {
  it('gives naira and cedi a full range of stakes', () => {
    expect(betLadder(NGN).slice(0, 4)).toEqual([100_00, 200_00, 500_00, 1_000_00]);
    expect(betLadder(NGN).at(-1)).toBe(1_000_000_00);
    expect(stepBet(100_00, 1, NGN)).toBe(200_00);
    expect(stepBet(200_00, -1, NGN)).toBe(100_00);
    expect(stepBet(1_00, 1, GHS)).toBe(2_00);
  });

  it('keeps the dollar ladder unchanged', () => {
    expect(betLadder(USD)).toEqual(BET_LADDER.filter((v) => v >= USD.minBetMinor && v <= USD.maxBetMinor));
  });
});
