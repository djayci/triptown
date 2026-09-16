import { setbackDrag, type GameConfig } from './config';

// Math model from design.md D4. All times are seconds since round start.

/** Instantaneous log-growth rate K'(t). */
export function growthRate(t: number, c: GameConfig): number {
  if (c.tRamp <= 0 || t >= c.tRamp) return c.rmax;
  return c.r0 + (c.rmax - c.r0) * (Math.max(0, t) / c.tRamp);
}

/** K(t): integral of the growth rate. Growth G(t) = exp(K(t)). */
export function logGrowth(t: number, c: GameConfig): number {
  if (t <= 0) return 0;
  if (c.tRamp <= 0) return c.rmax * t;
  if (t <= c.tRamp) return c.r0 * t + ((c.rmax - c.r0) * t * t) / (2 * c.tRamp);
  return c.r0 * c.tRamp + ((c.rmax - c.r0) * c.tRamp) / 2 + c.rmax * (t - c.tRamp);
}

export function growth(t: number, c: GameConfig): number {
  return Math.exp(logGrowth(t, c));
}

/** H(t) = ln E[m(t)] = K(t) - lambda*(1-f)*t. Strictly increasing for a valid config. */
export function logExpectedMultiplier(t: number, c: GameConfig): number {
  return logGrowth(t, c) - setbackDrag(c) * Math.max(0, t);
}

/** P(T > t) = RTP / E[m(t)] for t >= 0. */
export function survival(t: number, c: GameConfig): number {
  return c.rtp * Math.exp(-logExpectedMultiplier(Math.max(0, t), c));
}

/**
 * Crash time for a uniform u in (0, 1]. u > RTP busts instantly (T = 0),
 * otherwise T solves H(T) = ln(RTP / u), so P(T > t) = survival(t).
 */
export function crashTimeFromUniform(u: number, c: GameConfig): number {
  if (!(u > 0 && u <= 1)) throw new RangeError('u must be in (0, 1]');
  if (u > c.rtp) return 0;
  const target = Math.log(c.rtp / u);
  if (target === 0) return 0;
  const drag = setbackDrag(c);

  if (c.tRamp > 0) {
    const hAtRamp = logExpectedMultiplier(c.tRamp, c);
    if (target <= hAtRamp) {
      // a*T^2 + b*T = target on the ramp; stable form of the positive root.
      const a = (c.rmax - c.r0) / (2 * c.tRamp);
      const b = c.r0 - drag;
      if (Math.abs(a) < 1e-15) return target / b;
      return (2 * target) / (b + Math.sqrt(b * b + 4 * a * target));
    }
    return c.tRamp + (target - hAtRamp) / (c.rmax - drag);
  }
  return target / (c.rmax - drag);
}

/**
 * Setback times from a uniform stream: exponential gaps with rate lambda,
 * keeping only times strictly before the horizon.
 */
export function setbackTimesFromUniforms(
  uniformAt: (index: number) => number,
  c: GameConfig,
  horizon: number,
  maxCount = 10_000,
): number[] {
  const times: number[] = [];
  if (c.lambda <= 0 || c.setbackFactor >= 1 || horizon <= 0) return times;
  let t = 0;
  for (let i = 0; i < maxCount; i++) {
    t += -Math.log(uniformAt(i)) / c.lambda;
    if (t >= horizon) break;
    times.push(t);
  }
  return times;
}
