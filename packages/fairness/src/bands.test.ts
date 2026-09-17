import { describe, expect, it } from 'vitest';
import { bandForStake, type BandsByConfig } from './bands';

const band = (stakeMinor: number, minRtp: number, maxRtp: number) => ({
  stakeMinor,
  minRtp,
  maxRtp,
  rounds: 4_000_000,
  report: `rtp-test-halfup-${stakeMinor}-jitter50.md`,
});

// 20 = USD 0.20, 100 = GHS 1.00, 10000 = NGN 100.00.
const BANDS: BandsByConfig = {
  'whack-crash/v4': [band(20, 0.9686, 0.9701), band(100, 0.9694, 0.9706), band(10_000, 0.9699, 0.9701)],
  'whack-crash/v4-rising': [band(100, 0.9691, 0.9704)],
};

describe('rounding band selection', () => {
  it('publishes the band measured at the market minimum when one exists', () => {
    expect(bandForStake(BANDS, 'whack-crash/v4', 20)?.stakeMinor).toBe(20);
    expect(bandForStake(BANDS, 'whack-crash/v4', 100)?.stakeMinor).toBe(100);
    expect(bandForStake(BANDS, 'whack-crash/v4', 10_000)?.stakeMinor).toBe(10_000);
  });

  it('never publishes a band measured above the market minimum', () => {
    // A Ghanaian minimum of 1.00 sits between measurements: the 0.20 band is the honest one, because
    // the 100.00 band would understate the rounding spread the player can actually experience.
    expect(bandForStake(BANDS, 'whack-crash/v4', 500)?.stakeMinor).toBe(100);
    expect(bandForStake(BANDS, 'whack-crash/v4', 99)?.stakeMinor).toBe(20);
  });

  it('falls back to the smallest measurement, which is pessimistic, when all are above the minimum', () => {
    // Only a 1.00 measurement exists but the market allows 0.20: publishing the 1.00 band would claim a
    // tighter spread than the player can see, so the smallest available is used instead.
    expect(bandForStake(BANDS, 'whack-crash/v4-rising', 20)?.stakeMinor).toBe(100);
  });

  it('returns undefined for an unmeasured config rather than inventing a figure', () => {
    expect(bandForStake(BANDS, 'whack-crash/v9', 20)).toBeUndefined();
    expect(bandForStake({ 'whack-crash/v9': [] }, 'whack-crash/v9', 20)).toBeUndefined();
  });
});
