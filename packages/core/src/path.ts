import { firstReach, growth, modifiersOf, pathValue, type GameConfig, type Modifier, type RoundOutcome } from '@triptown/fairness';
// Path helpers live in fairness so the simulator and the round engine share one implementation.

/** G(t): the multiplier ignoring modifiers. */
export function growthAt(t: number, config: GameConfig): number {
  return growth(t, config);
}

/** Setbacks and boosts of an outcome as one ascending modifier list (setback wins a tie). */
export function modifiersOfOutcome(outcome: Pick<RoundOutcome, 'setbacks' | 'boosts'>, config: GameConfig): Modifier[] {
  return modifiersOf(outcome.setbacks, outcome.boosts ?? [], config);
}

/** m(t): growth with every setback and boost at or before t applied. Setbacks win ties. */
export function multiplierAt(t: number, mods: readonly Modifier[], config: GameConfig): number {
  return pathValue(t, mods, config);
}

/** Modifier times that have happened by t (inclusive). */
export function setbacksUpTo(t: number, setbacks: readonly number[]): number[] {
  return setbacks.filter((s) => s <= t);
}

/** First time m(t) reaches target, within tMax, or null. */
export function timeToReach(target: number, mods: readonly Modifier[], config: GameConfig): number | null {
  return firstReach(target, mods, config);
}
