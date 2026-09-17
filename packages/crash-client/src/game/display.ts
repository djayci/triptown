import { formatMoney as coreFormatMoney, payoutMinor, type CurrencyRules } from '@triptown/core';
import { growth, growthRate, type GameConfig } from '@triptown/fairness';

// Pure display math for the client. The server stays the source of truth for payouts.

/** Multiplier to show at elapsed seconds t, given how many setbacks and boosts have arrived. */
export function displayMultiplier(t: number, setbacksReceived: number, config: GameConfig, boostsReceived = 0): number {
  return growth(Math.max(0, t), config) * config.setbackFactor ** setbacksReceived * config.boostFactor ** boostsReceived;
}

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

export function stepBet(current: number, dir: 1 | -1, currency: CurrencyRules): number {
  const ladder = BET_LADDER.filter((v) => v >= currency.minBetMinor && v <= currency.maxBetMinor);
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
  const ladder = BET_LADDER.filter((v) => v >= currency.minBetMinor && v <= currency.maxBetMinor);
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
