import type { GameConfig } from './config';
import { logGrowth } from './model';

// Stopping rules evaluated on a setback path, used by the RTP simulator.
// A stop is where the player (or a cap) ends the round; it wins only if stop < crashTime.

export interface Stop {
  time: number;
  multiplier: number;
}

/** One in-round modifier: a setback (factor below 1) or a boost (factor above 1). */
export interface Modifier {
  time: number;
  factor: number;
}

/** Merges setbacks and boosts into one ascending list; a setback wins a tie (design D5). */
export function modifiersOf(setbacks: readonly number[], boosts: readonly number[], c: GameConfig): Modifier[] {
  return [
    ...setbacks.map((time) => ({ time, factor: c.setbackFactor })),
    ...boosts.map((time) => ({ time, factor: c.boostFactor })),
  ].sort((a, b) => a.time - b.time || a.factor - b.factor);
}

/** Cumulative log factor of the first `n` modifiers. */
function logFactor(mods: readonly Modifier[], n: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) k += Math.log(mods[i]!.factor);
  return k;
}

/** Inverse of K(t) for k >= 0. */
export function logGrowthInverse(k: number, c: GameConfig): number {
  if (k <= 0) return 0;
  if (c.tRamp <= 0) return k / c.rmax;
  const kRamp = logGrowth(c.tRamp, c);
  if (k <= kRamp) {
    const a = (c.rmax - c.r0) / (2 * c.tRamp);
    const b = c.r0;
    if (Math.abs(a) < 1e-15) return k / b;
    return (2 * k) / (b + Math.sqrt(b * b + 4 * a * k));
  }
  return c.tRamp + (k - kRamp) / c.rmax;
}

/** m(t) with every modifier at or before t applied (setbacks and boosts alike). */
export function pathValue(t: number, mods: readonly Modifier[], c: GameConfig): number {
  let n = 0;
  while (n < mods.length && mods[n]!.time <= t) n++;
  return Math.exp(logGrowth(t, c) + logFactor(mods, n));
}

/** First time m(t) >= target, capped by tMax. Returns null if never within tMax. */
export function firstReach(target: number, mods: readonly Modifier[], c: GameConfig): number | null {
  for (let n = 0; n <= mods.length; n++) {
    const segStart = n === 0 ? 0 : mods[n - 1]!.time;
    const segEnd = n < mods.length ? mods[n]!.time : c.tMax;
    const t = Math.max(segStart, logGrowthInverse(Math.log(target) - logFactor(mods, n), c));
    if (t < segEnd && t <= c.tMax) return t;
    // A boost can lift the value to the target exactly at its own time.
    if (n < mods.length && pathValue(segEnd, mods, c) >= target) return segEnd;
    if (segEnd >= c.tMax) break;
  }
  return null;
}

/** First time at or after `after` that m(t) >= target, within tMax. */
export function firstReachAfter(target: number, after: number, mods: readonly Modifier[], c: GameConfig): number | null {
  if (after <= 0) return firstReach(target, mods, c);
  let n = 0;
  while (n < mods.length && mods[n]!.time <= after) n++;
  for (; n <= mods.length; n++) {
    const segStart = n === 0 ? 0 : Math.max(after, mods[n - 1]!.time);
    const from = Math.max(after, segStart);
    const segEnd = n < mods.length ? mods[n]!.time : c.tMax;
    const t = Math.max(from, logGrowthInverse(Math.log(target) - logFactor(mods, n), c));
    if (t < segEnd && t <= c.tMax) return t;
    if (n < mods.length && pathValue(segEnd, mods, c) >= target) return segEnd;
    if (segEnd >= c.tMax) break;
  }
  return null;
}

/**
 * A manual stop below the minimum cash-out is refused and the round continues; the player then
 * stops as soon as the value reaches the minimum. Caps and the tMax forced cash-out are unaffected.
 * Still a stopping time, so RTP is unchanged.
 */
export function withMinCashout(stop: Stop, minCashout: number, mods: readonly Modifier[], c: GameConfig): Stop {
  if (minCashout <= 1 || stop.multiplier >= minCashout || stop.time >= c.tMax) return stop;
  const t = firstReachAfter(minCashout, stop.time, mods, c);
  if (t === null) return { time: c.tMax, multiplier: Math.min(pathValue(c.tMax, mods, c), c.maxWinMultiplier) };
  return { time: t, multiplier: Math.min(pathValue(t, mods, c), c.maxWinMultiplier) };
}

/** Applies the max win and max duration caps to a desired stop time (or null = never). */
function capped(desired: number | null, mods: readonly Modifier[], c: GameConfig): Stop {
  const capTime = firstReach(c.maxWinMultiplier, mods, c);
  let time = c.tMax;
  if (desired !== null) time = Math.min(time, desired);
  if (capTime !== null && capTime <= time) {
    return { time: capTime, multiplier: c.maxWinMultiplier };
  }
  return { time, multiplier: Math.min(pathValue(time, mods, c), c.maxWinMultiplier) };
}

export type Strategy =
  | { kind: 'target'; target: number }
  | { kind: 'time'; seconds: number }
  | { kind: 'afterSetback'; index?: number }
  | { kind: 'afterBoost'; index?: number }
  | { kind: 'never' };

export function strategyLabel(s: Strategy): string {
  switch (s.kind) {
    case 'target':
      return `auto cash-out x${s.target}`;
    case 'time':
      return `cash out at ${s.seconds}s`;
    case 'afterSetback':
      return s.index ? `cash out right after setback ${s.index + 1}` : 'cash out right after first setback';
    case 'afterBoost':
      return s.index ? `cash out right after boost ${s.index + 1}` : 'cash out right after first boost';
    case 'never':
      return 'never cash out (caps only)';
  }
}

export function stopFor(s: Strategy, mods: readonly Modifier[], c: GameConfig): Stop {
  switch (s.kind) {
    case 'target':
      return capped(firstReach(s.target, mods, c), mods, c);
    case 'time':
      return capped(s.seconds, mods, c);
    case 'afterSetback': {
      const at = mods.filter((m) => m.factor < 1)[s.index ?? 0];
      return capped(at?.time ?? null, mods, c);
    }
    case 'afterBoost': {
      const at = mods.filter((m) => m.factor > 1)[s.index ?? 0];
      return capped(at?.time ?? null, mods, c);
    }
    case 'never':
      return capped(null, mods, c);
  }
}

// Partial cash-out: the bet is split into equal parts and each group of parts has its own stop.

export interface PartLeg {
  parts: number;
  rule: Strategy;
}

export interface PartStrategy {
  label: string;
  legs: PartLeg[];
}

export interface PartStop extends Stop {
  /** Fraction of the bet settled at this stop. */
  share: number;
}

// Guards against float noise such as 1000 * 4.35 = 4349.999999999999, same as payoutMinor.
const EPSILON = 1e-7;

/** Multiplier actually paid on one stake part after rounding its payout down to the minor unit. */
export function roundedMultiple(multiplier: number, partMinor: number): number {
  return Math.floor(partMinor * multiplier + EPSILON) / partMinor;
}

/** Stops for each leg; throws if the legs don't use exactly `config.stakeParts` parts. */
export function partStops(ps: PartStrategy, mods: readonly Modifier[], c: GameConfig): PartStop[] {
  const used = ps.legs.reduce((n, leg) => n + leg.parts, 0);
  if (used !== c.stakeParts) {
    throw new Error(`${ps.label}: legs use ${used} parts, config has ${c.stakeParts}`);
  }
  return ps.legs.map((leg) => ({ ...stopFor(leg.rule, mods, c), share: leg.parts / c.stakeParts }));
}
