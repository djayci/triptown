import { formatMoney as coreFormatMoney, payoutMinor, type CurrencyRules } from '@triptown/core';
import { growth, growthRate, type GameConfig } from '@triptown/fairness';

// Pure display math for the client. The server stays the source of truth for payouts.

/** Multiplier to show at elapsed seconds t, given how many setbacks and boosts have arrived. */
export function displayMultiplier(t: number, setbacksReceived: number, config: GameConfig, boostsReceived = 0): number {
  return growth(Math.max(0, t), config) * config.setbackFactor ** setbacksReceived * config.boostFactor ** boostsReceived;
}

/**
 * Deferred reveal (gate-odds-mvp D5): the chance the result is a win if the player goes in at this
 * value, RTP ÷ value, rounded DOWN to one decimal so it can never overstate the chance.
 */
export function formatRevealChance(rtp: number, multiplier: number): string {
  const tenths = Math.floor((1000 * rtp) / Math.max(multiplier, 1e-9) + 1e-9) / 10;
  return tenths < 0.1 ? '<0.1%' : `${tenths.toFixed(1)}%`;
}

/** Values a deferred game may show a chance for during the ride. Capped by the config's max win. */
export const CHANCE_LADDER = [1.5, 2, 5, 10] as const;

/** One settled deferred ride: the value the player went in at, and whether the gate was open. */
export interface RideResult {
  multiplier: number;
  won: boolean;
}

export interface ChanceRow {
  multiplier: number;
  value: string;
  chance: string;
  /** The player's own record at or past this value this session, e.g. "2/3", or null when they have none. */
  yours: string | null;
}

/**
 * The chance at each ladder value, with the player's own rides counted against it, for a game that shows the
 * table while the ride runs. Chance x value is the RTP on every row, so no row is a better place to go in
 * than another, and a player's own tally says nothing about the next ride: each is settled on its own seeds.
 */
export function chanceTable(config: GameConfig, rides: RideResult[] = []): ChanceRow[] {
  return CHANCE_LADDER.filter((m) => m <= config.maxWinMultiplier).map((m) => {
    const reached = rides.filter((r) => r.multiplier >= m);
    const open = reached.filter((r) => r.won).length;
    return {
      multiplier: m,
      value: formatMultiplier(m),
      chance: formatRevealChance(config.rtp, m),
      yours: reached.length === 0 ? null : `${open}/${reached.length}`,
    };
  });
}

/**
 * Deferred reveal (gate-odds-mvp D6): the heading-home state lasts at least this long from the press,
 * for every outcome. It starts on the press, never on the settlement, so its length can't depend on
 * the hidden crash.
 */
export const HEADING_HOME_MS = 1200;

export function formatMultiplier(m: number): string {
  if (m >= 1000) return `x${Math.floor(m).toLocaleString('en-US')}`;
  return `x${(Math.floor(m * 100 + 1e-7) / 100).toFixed(2)}`;
}

/**
 * Amounts carry their currency symbol. A bare "149.57" under a large multiplier reads as a score
 * rather than money, which is the thing Netherlands Rko 3.5(1) ("sufficiently distinguishable"),
 * Brazil Annex I item 10(b) and AGCO 4.06 (prize value units) each aim at. Core owns the symbols.
 */
export function formatMoney(minor: number, currency: Pick<CurrencyRules, 'decimals' | 'code'>): string {
  return coreFormatMoney(minor, currency);
}

export function optimisticPayout(betMinor: number, multiplier: number, config: GameConfig): number {
  return payoutMinor(betMinor, Math.min(multiplier, config.maxWinMultiplier));
}

/** Milestone multipliers that get a blip, a colour change and a badge. All are above the stake. */
export const CHECKPOINTS = [
  1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 500, 750, 1000,
] as const;

/** Spacing of the small in-between milestones, which get a flying number but no sound. */
export function miniStep(multiplier: number): number {
  if (multiplier < 2) return 0.1;
  if (multiplier < 5) return 0.25;
  if (multiplier < 10) return 0.5;
  if (multiplier < 25) return 1;
  if (multiplier < 100) return 5;
  return 25;
}

/** The highest small milestone crossed between `previous` and `current`, or null for none. */
export function crossedMini(previous: number, current: number): number | null {
  const step = miniStep(current);
  const mark = Math.floor(current / step + 1e-9) * step;
  return mark > previous + 1e-9 && mark > 1 ? Number(mark.toFixed(2)) : null;
}

/** The highest checkpoint crossed going from `previous` up to `current`, or null for none. */
export function crossedCheckpoint(previous: number, current: number): number | null {
  let hit: number | null = null;
  for (const c of CHECKPOINTS) if (previous < c && current >= c) hit = c;
  return hit;
}

/** How far the round has ramped, 0..1, from the current growth rate. Continuous, for animation speed. */
export function pace(t: number, config: GameConfig): number {
  const span = config.rmax - config.r0;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (growthRate(t, config) - config.r0) / span));
}

/** Intensity on a 0..10 scale from the current growth rate. */
export function intensity10(t: number, config: GameConfig): number {
  const span = config.rmax - config.r0;
  if (span <= 0) return 10;
  const level = pace(t, config) * 10;
  return Math.max(1, Math.min(10, Math.round(level) || 1));
}

/** Neutral speed read-out. No skill or urgency framing (AGCO 2.15, GLI-19 4.6.1(a)). */
export type IntensityName = 'SLOW' | 'MEDIUM' | 'FAST';

export function intensityName(level10: number): IntensityName {
  if (level10 >= 8) return 'FAST';
  if (level10 >= 4) return 'MEDIUM';
  return 'SLOW';
}

export function intensityAudioLevel(level10: number): 0 | 1 | 2 {
  const name = intensityName(level10);
  return name === 'FAST' ? 2 : name === 'MEDIUM' ? 1 : 0;
}

/** Bet ladder used by the − / + controls, in minor units. */
export const BET_LADDER = [10, 20, 50, 1_00, 2_00, 5_00, 10_00, 20_00, 50_00, 100_00];
export const BET_CHIPS = [1_00, 5_00, 10_00, 50_00, 100_00];
export const AUTO_PRESETS = [1.5, 2, 3, 5, 10, 25, 100];

/**
 * The stakes a player can step through: 1-2-5 values from the currency's minimum to its maximum. A fixed
 * ladder topping out at 100.00 left a naira session (minimum ₦100.00) with exactly one stake, so + did
 * nothing. For a dollar-sized currency this is the same set as BET_LADDER.
 */
export function betLadder(currency: CurrencyRules): number[] {
  const values: number[] = [];
  for (let unit = 10; unit <= currency.maxBetMinor; unit *= 10) {
    for (const m of [1, 2, 5]) {
      const v = m * unit;
      if (v >= currency.minBetMinor && v <= currency.maxBetMinor) values.push(v);
    }
  }
  return values;
}

export function stepBet(current: number, dir: 1 | -1, currency: CurrencyRules): number {
  const ladder = betLadder(currency);
  if (ladder.length === 0) return currency.minBetMinor;
  if (dir > 0) return ladder.find((v) => v > current) ?? ladder[ladder.length - 1]!;
  return [...ladder].reverse().find((v) => v < current) ?? ladder[0]!;
}

/**
 * Snaps a bet onto the ladder within a currency's limits. The client's default bet is written once
 * for a notional currency, but a session may be in naira or cedis where the minimum is 100x larger,
 * and a bet below the minimum is simply rejected by the host. Without this a player in such a market
 * cannot start a round at all until they tap +.
 */
export function clampBet(current: number, currency: CurrencyRules): number {
  const ladder = betLadder(currency);
  if (ladder.length === 0) return currency.minBetMinor;
  if (current >= currency.minBetMinor && current <= currency.maxBetMinor) {
    // Already valid: keep the player's choice, snapped down to a ladder value they could have picked.
    return [...ladder].reverse().find((v) => v <= current) ?? ladder[0]!;
  }
  return current < currency.minBetMinor ? ladder[0]! : ladder[ladder.length - 1]!;
}

export function nextAutoPreset(current: number): number {
  return AUTO_PRESETS.find((v) => v > current + 1e-9) ?? AUTO_PRESETS[0]!;
}
