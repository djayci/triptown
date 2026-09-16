export interface GameConfig {
  /** Identifier published with every round so verifiers use the same parameters. */
  id: string;
  /** Return to player, e.g. 0.97. Also the probability a round does not bust instantly. */
  rtp: number;
  /** Log-growth rate at t = 0, per second. */
  r0: number;
  /** Log-growth rate after the ramp, per second. About 0.95 is +10% per 100 ms. */
  rmax: number;
  /** Seconds to ramp linearly from r0 to rmax. 0 means rmax from the start. */
  tRamp: number;
  /** Bad mole setbacks per second (Poisson rate). */
  lambda: number;
  /** Multiplier applied by each setback, e.g. 0.5. */
  setbackFactor: number;
  /** Payout cap as a multiple of the bet. */
  maxWinMultiplier: number;
  /** Forced cash-out after this many seconds. */
  tMax: number;
  /** Equal parts the bet is split into, each cashed out separately. 1 = a single cash-out. */
  papers: number;
}

export const DEFAULT_CONFIG: GameConfig = Object.freeze({
  id: 'whack-crash/v1',
  rtp: 0.97,
  r0: 0.12,
  rmax: 0.95,
  tRamp: 12,
  lambda: 0.12,
  setbackFactor: 0.5,
  maxWinMultiplier: 10_000,
  tMax: 60,
  papers: 1,
});

/** Paper Route: same path model, the bet split into 5 papers thrown separately. */
export const PAPER_ROUTE_CONFIG: GameConfig = Object.freeze({
  ...DEFAULT_CONFIG,
  id: 'paper-route/v1',
  papers: 5,
});

/** Rising-only variants: no setbacks, so the multiplier never falls (regulated markets). */
export const WHACK_CRASH_RISING_CONFIG: GameConfig = Object.freeze({
  ...DEFAULT_CONFIG,
  id: 'whack-crash/v1-rising',
  lambda: 0,
});

export const PAPER_ROUTE_RISING_CONFIG: GameConfig = Object.freeze({
  ...PAPER_ROUTE_CONFIG,
  id: 'paper-route/v1-rising',
  lambda: 0,
});

export const GAME_CONFIGS: Readonly<Record<string, GameConfig>> = Object.freeze({
  [DEFAULT_CONFIG.id]: DEFAULT_CONFIG,
  [PAPER_ROUTE_CONFIG.id]: PAPER_ROUTE_CONFIG,
  [WHACK_CRASH_RISING_CONFIG.id]: WHACK_CRASH_RISING_CONFIG,
  [PAPER_ROUTE_RISING_CONFIG.id]: PAPER_ROUTE_RISING_CONFIG,
});

const CAP_SUFFIX = /^(.+)\+cap(\d+(?:\.\d+)?)$/;

/** Config id for a lower max-multiplier cap on a registered base config, e.g. `whack-crash/v1-rising+cap100`. */
export function cappedConfigId(baseId: string, maxWinMultiplier: number): string {
  return `${baseId}+cap${maxWinMultiplier}`;
}

/**
 * Looks up a registered config id, including derived `+capN` ids. A cap only lowers `maxWinMultiplier`;
 * forced cash-outs are stopping times, so RTP is unchanged but the variant still gets its own report.
 */
export function resolveConfigId(id: string): GameConfig | null {
  const direct = GAME_CONFIGS[id];
  if (direct) return direct;
  const m = CAP_SUFFIX.exec(id);
  if (!m) return null;
  const base = GAME_CONFIGS[m[1]!];
  const cap = Number(m[2]);
  if (!base || !(cap > 1) || cap >= base.maxWinMultiplier) return null;
  return Object.freeze({ ...base, id, maxWinMultiplier: cap });
}

/** Expected log-drag per second caused by setbacks: lambda * (1 - f). */
export function setbackDrag(config: GameConfig): number {
  return config.lambda * (1 - config.setbackFactor);
}

export type ConfigValidation = { ok: true } | { ok: false; errors: string[] };

export function validateConfig(config: GameConfig): ConfigValidation {
  const errors: string[] = [];
  const numeric: (keyof GameConfig)[] = [
    'rtp', 'r0', 'rmax', 'tRamp', 'lambda', 'setbackFactor', 'maxWinMultiplier', 'tMax', 'papers',
  ];
  for (const key of numeric) {
    const v = config[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${key} must be a finite number`);
  }
  if (errors.length) return { ok: false, errors };

  if (!config.id) errors.push('id is required');
  if (!(config.rtp > 0 && config.rtp < 1)) errors.push('rtp must be between 0 and 1');
  if (!(config.r0 > 0)) errors.push('r0 must be positive');
  if (!(config.rmax > 0)) errors.push('rmax must be positive');
  if (!(config.tRamp >= 0)) errors.push('tRamp must be zero or positive');
  if (!(config.lambda >= 0)) errors.push('lambda must be zero or positive');
  if (!(config.setbackFactor > 0 && config.setbackFactor <= 1)) {
    errors.push('setbackFactor must be in (0, 1]');
  }
  if (!(config.maxWinMultiplier > 1)) errors.push('maxWinMultiplier must be greater than 1');
  if (!(config.tMax > 0)) errors.push('tMax must be positive');
  if (!(Number.isInteger(config.papers) && config.papers >= 1)) errors.push('papers must be a whole number of at least 1');

  // The growth rate is linear between r0 and rmax, so its minimum is at one end.
  // Survival must strictly decrease, so the rate has to beat the setback drag everywhere.
  const drag = setbackDrag(config);
  const minRate = config.tRamp > 0 ? Math.min(config.r0, config.rmax) : config.rmax;
  if (!(minRate > drag)) {
    errors.push(`growth rate (min ${minRate}) must exceed setback drag lambda*(1-f) = ${drag}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertValidConfig(config: GameConfig): GameConfig {
  const result = validateConfig(config);
  if (!result.ok) throw new Error(`Invalid game config: ${result.errors.join('; ')}`);
  return config;
}
