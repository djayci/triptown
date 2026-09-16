import { formatMinor, payoutMinor, type CurrencyRules } from '@triptown/core';
import { growth, growthRate, type GameConfig } from '@triptown/fairness';

// Pure display math for the client. The server stays the source of truth for payouts.

/** Multiplier to show at elapsed seconds t, given how many setbacks have arrived. */
export function displayMultiplier(t: number, setbacksReceived: number, config: GameConfig): number {
  return growth(Math.max(0, t), config) * config.setbackFactor ** setbacksReceived;
}

export function formatMultiplier(m: number): string {
  if (m >= 1000) return `x${Math.floor(m).toLocaleString('en-US')}`;
  return `x${(Math.floor(m * 100 + 1e-7) / 100).toFixed(2)}`;
}

export function formatMoney(minor: number, currency: Pick<CurrencyRules, 'decimals'>): string {
  return formatMinor(minor, currency);
}

export function optimisticPayout(betMinor: number, multiplier: number, config: GameConfig): number {
  return payoutMinor(betMinor, Math.min(multiplier, config.maxWinMultiplier));
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

export type IntensityName = 'CALM' | 'FAST' | 'FRENZY';

export function intensityName(level10: number): IntensityName {
  if (level10 >= 8) return 'FRENZY';
  if (level10 >= 4) return 'FAST';
  return 'CALM';
}

export function intensityAudioLevel(level10: number): 0 | 1 | 2 {
  const name = intensityName(level10);
  return name === 'FRENZY' ? 2 : name === 'FAST' ? 1 : 0;
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

export function nextAutoPreset(current: number): number {
  return AUTO_PRESETS.find((v) => v > current + 1e-9) ?? AUTO_PRESETS[0]!;
}
