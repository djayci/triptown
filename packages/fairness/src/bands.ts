/**
 * Measured rounding bands, and how a market picks the one it may publish.
 *
 * Payouts are rounded half-up once per round (compliance-baseline D23), so the measured return at a
 * small stake sits a little away from the theoretical RTP. GLI-19 4.7.1(a) asks for the minimum RTP at
 * any single bet level and 4.7.2(a) for the derivation, so the rules screen publishes the band measured
 * at the smallest stake the player can actually place — never a flat headline figure.
 *
 * Bands come from `reports/bands.json`, which is generated from committed simulation reports by
 * `scripts/build-bands.mjs`. Nothing here may invent a number.
 */

export interface RoundingBand {
  /** Stake in minor units the band was measured at. */
  stakeMinor: number;
  /** Worst and best measured RTP across every strategy, as fractions (0.9668 = 96.68%). */
  minRtp: number;
  maxRtp: number;
  rounds: number;
  /** Committed report the band came from, so a lab can reproduce it. */
  report: string;
}

/** Config id -> bands, ascending by stake. */
export type BandsByConfig = Record<string, RoundingBand[]>;

/**
 * The band to publish for a market whose minimum stake is `minBetMinor`.
 *
 * Picks the largest measured stake at or below the market's minimum, because rounding cost falls as the
 * stake rises: a band measured at a *larger* stake than the player can place would understate the
 * spread and overstate the floor, which is the direction that misleads. When every measurement is above
 * the market's minimum the smallest is returned, which is pessimistic and therefore safe to publish.
 *
 * Returns undefined when the config has no measured band at all. Callers must treat that as a failure
 * to disclose, not as a reason to fall back to the theoretical figure.
 */
export function bandForStake(bands: BandsByConfig, configId: string, minBetMinor: number): RoundingBand | undefined {
  const list = bands[configId];
  if (!list || list.length === 0) return undefined;
  let best: RoundingBand | undefined;
  for (const band of list) {
    if (band.stakeMinor <= minBetMinor && (!best || band.stakeMinor > best.stakeMinor)) best = band;
  }
  return best ?? list.reduce((lowest, b) => (b.stakeMinor < lowest.stakeMinor ? b : lowest));
}
