import { growthRate, type GameConfig } from '@triptown/fairness';

// Pure presentation rules for Paper Route. Everything here is derived from public round data
// (elapsed time, setbacks received, settled throws), never from the hidden crash time.

export interface ThrownPaper {
  papers: number;
  multiplier: number;
}

/** Exact return in minor units (not rounded) of `papers` papers at `multiplier`. */
export function exactReturnMinor(paperMinor: number, papers: number, multiplier: number): number {
  return paperMinor * papers * multiplier;
}

export function bankedExactMinor(paperMinor: number, thrown: readonly ThrownPaper[]): number {
  return thrown.reduce((sum, t) => sum + exactReturnMinor(paperMinor, t.papers, t.multiplier), 0);
}

// Guards against float noise such as 2.00 × 3 × 3.40 = 2039.9999999999998.
const EPSILON = 1e-7;

/** What the player sees for an amount still in play: whole minor units, rounded down. */
export function shownMinor(exactMinor: number): number {
  return Math.floor(exactMinor + EPSILON);
}

export type LiveLabel = 'RETURN NOW' | 'WIN NOW';

/**
 * Label for the unthrown papers. It only says WIN when the whole round (banked plus riding)
 * would return more than the stake, so a partial return is never framed as a win (UKGC RTS 14F).
 */
export function liveLabel(stakeMinor: number, bankedMinor: number, ridingMinor: number): LiveLabel {
  return shownMinor(bankedMinor + ridingMinor) > stakeMinor ? 'WIN NOW' : 'RETURN NOW';
}

/** Win effects are allowed only for a settled round whose total return beats the stake. */
export function allowsWinPresentation(stakeMinor: number, roundTotalMinor: number): boolean {
  return roundTotalMinor > stakeMinor;
}

export const BASE_SPEED_MPS = 9;
const SPEED_PER_RATE = 14;

/**
 * Riding speed in metres per second. With intensity effects on it follows the growth rate, which is
 * capped after the ramp; with them off it stays constant so nothing builds tension.
 */
export function ridingSpeed(elapsed: number, config: GameConfig, intensityEffects: boolean): number {
  if (!intensityEffects) return BASE_SPEED_MPS;
  return BASE_SPEED_MPS + SPEED_PER_RATE * growthRate(Math.max(0, elapsed), config);
}

// The sun no longer follows the multiplier: light that tracked the round would read as progress and
// as a tell about what is coming (design D7). It is fixed in the scene instead.
