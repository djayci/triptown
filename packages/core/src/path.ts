import { firstReach, growth, pathValue, type GameConfig } from '@triptown/fairness';
// Path helpers live in fairness so the simulator and the round engine share one implementation.

/** G(t): the multiplier ignoring setbacks. */
export function growthAt(t: number, config: GameConfig): number {
  return growth(t, config);
}

/** m(t): growth with every setback at or before t applied. Setbacks win ties. */
export function multiplierAt(t: number, setbacks: readonly number[], config: GameConfig): number {
  return pathValue(t, setbacks, config);
}

/** Setbacks that have happened by t (inclusive). */
export function setbacksUpTo(t: number, setbacks: readonly number[]): number[] {
  return setbacks.filter((s) => s <= t);
}

/** First time m(t) reaches target, within tMax, or null. */
export function timeToReach(target: number, setbacks: readonly number[], config: GameConfig): number | null {
  return firstReach(target, setbacks, config);
}
