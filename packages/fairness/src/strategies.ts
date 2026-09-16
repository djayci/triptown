import type { GameConfig } from './config';
import { logGrowth } from './model';

// Stopping rules evaluated on a setback path, used by the RTP simulator.
// A stop is where the player (or a cap) ends the round; it wins only if stop < crashTime.

export interface Stop {
  time: number;
  multiplier: number;
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

/** m(t) with setbacks at or before t applied (setback wins ties). */
export function pathValue(t: number, setbacks: readonly number[], c: GameConfig): number {
  let n = 0;
  while (n < setbacks.length && setbacks[n]! <= t) n++;
  return Math.exp(logGrowth(t, c)) * c.setbackFactor ** n;
}

/** First time m(t) >= target, capped by tMax. Returns null if never within tMax. */
export function firstReach(target: number, setbacks: readonly number[], c: GameConfig): number | null {
  const lnF = Math.log(c.setbackFactor);
  for (let n = 0; n <= setbacks.length; n++) {
    const segStart = n === 0 ? 0 : setbacks[n - 1]!;
    const segEnd = n < setbacks.length ? setbacks[n]! : c.tMax;
    const t = Math.max(segStart, logGrowthInverse(Math.log(target) - n * lnF, c));
    if (t < segEnd && t <= c.tMax) return t;
    if (segEnd >= c.tMax) break;
  }
  return null;
}

/** First time at or after `after` that m(t) >= target, within tMax. */
export function firstReachAfter(target: number, after: number, setbacks: readonly number[], c: GameConfig): number | null {
  if (after <= 0) return firstReach(target, setbacks, c);
  const lnF = Math.log(c.setbackFactor);
  let n = 0;
  while (n < setbacks.length && setbacks[n]! <= after) n++;
  for (; n <= setbacks.length; n++) {
    const segStart = n === 0 ? 0 : Math.max(after, setbacks[n - 1]!);
    const from = Math.max(after, segStart);
    const segEnd = n < setbacks.length ? setbacks[n]! : c.tMax;
    const t = Math.max(from, logGrowthInverse(Math.log(target) - n * lnF, c));
    if (t < segEnd && t <= c.tMax) return t;
    if (segEnd >= c.tMax) break;
  }
  return null;
}

/**
 * A manual stop below the minimum cash-out is refused and the round continues; the player then
 * stops as soon as the value reaches the minimum. Caps and the tMax forced cash-out are unaffected.
 * Still a stopping time, so RTP is unchanged.
 */
export function withMinCashout(stop: Stop, minCashout: number, setbacks: readonly number[], c: GameConfig): Stop {
  if (minCashout <= 1 || stop.multiplier >= minCashout || stop.time >= c.tMax) return stop;
  const t = firstReachAfter(minCashout, stop.time, setbacks, c);
  if (t === null) return { time: c.tMax, multiplier: Math.min(pathValue(c.tMax, setbacks, c), c.maxWinMultiplier) };
  return { time: t, multiplier: Math.min(pathValue(t, setbacks, c), c.maxWinMultiplier) };
}

/** Applies the max win and max duration caps to a desired stop time (or null = never). */
function capped(desired: number | null, setbacks: readonly number[], c: GameConfig): Stop {
  const capTime = firstReach(c.maxWinMultiplier, setbacks, c);
  let time = c.tMax;
  if (desired !== null) time = Math.min(time, desired);
  if (capTime !== null && capTime <= time) {
    return { time: capTime, multiplier: c.maxWinMultiplier };
  }
  return { time, multiplier: Math.min(pathValue(time, setbacks, c), c.maxWinMultiplier) };
}

export type Strategy =
  | { kind: 'target'; target: number }
  | { kind: 'time'; seconds: number }
  | { kind: 'afterSetback'; index?: number }
  | { kind: 'never' };

export function strategyLabel(s: Strategy): string {
  switch (s.kind) {
    case 'target':
      return `auto cash-out x${s.target}`;
    case 'time':
      return `cash out at ${s.seconds}s`;
    case 'afterSetback':
      return s.index ? `cash out right after setback ${s.index + 1}` : 'cash out right after first setback';
    case 'never':
      return 'never cash out (caps only)';
  }
}

export function stopFor(s: Strategy, setbacks: readonly number[], c: GameConfig): Stop {
  switch (s.kind) {
    case 'target':
      return capped(firstReach(s.target, setbacks, c), setbacks, c);
    case 'time':
      return capped(s.seconds, setbacks, c);
    case 'afterSetback': {
      const at = setbacks[s.index ?? 0];
      return capped(at ?? null, setbacks, c);
    }
    case 'never':
      return capped(null, setbacks, c);
  }
}

// Partial cash-out: the bet is split into papers and each group of papers has its own stop.

export interface ThrowLeg {
  papers: number;
  rule: Strategy;
}

export interface PaperStrategy {
  label: string;
  legs: ThrowLeg[];
}

export interface PaperStop extends Stop {
  /** Fraction of the bet settled at this stop. */
  share: number;
}

// Guards against float noise such as 1000 * 4.35 = 4349.999999999999, same as payoutMinor.
const EPSILON = 1e-7;

/** Multiplier actually paid on one paper after rounding its payout down to the minor unit. */
export function roundedMultiple(multiplier: number, paperMinor: number): number {
  return Math.floor(paperMinor * multiplier + EPSILON) / paperMinor;
}

/** Stops for each leg; throws if the legs don't use exactly `config.papers` papers. */
export function paperStops(ps: PaperStrategy, setbacks: readonly number[], c: GameConfig): PaperStop[] {
  const used = ps.legs.reduce((n, leg) => n + leg.papers, 0);
  if (used !== c.papers) throw new Error(`${ps.label}: legs use ${used} papers, config has ${c.papers}`);
  return ps.legs.map((leg) => ({ ...stopFor(leg.rule, setbacks, c), share: leg.papers / c.papers }));
}
