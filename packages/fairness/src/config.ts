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
  /** Setbacks per second (Poisson rate). */
  lambda: number;
  /** Multiplier applied by each setback, e.g. 0.5. */
  setbackFactor: number;
  /** Boosts per second (Poisson rate). 0 disables them. */
  boostRate: number;
  /** Multiplier applied by each boost, e.g. 1.05. Must be above 1 whenever boostRate is above 0. */
  boostFactor: number;
  /** Payout cap as a multiple of the bet. */
  maxWinMultiplier: number;
  /** Forced cash-out after this many seconds. */
  tMax: number;
  /** Equal parts the bet is split into, each cashed out separately. 1 = a single cash-out. */
  stakeParts: number;
}

export const DEFAULT_CONFIG: GameConfig = Object.freeze({
  id: 'whack-crash/v1',
  rtp: 0.97,
  r0: 0.12,
  rmax: 0.95,
  tRamp: 12,
  lambda: 0.12,
  setbackFactor: 0.5,
  boostRate: 0,
  boostFactor: 1.05,
  maxWinMultiplier: 10_000,
  tMax: 60,
  stakeParts: 1,
});

/** Rising-only variants: no setbacks, so the multiplier never falls (regulated markets). */
export const WHACK_CRASH_RISING_CONFIG: GameConfig = Object.freeze({
  ...DEFAULT_CONFIG,
  id: 'whack-crash/v1-rising',
  lambda: 0,
});

/** Boosted variants (good-mole D6): boosts lift the value and the crash hazard pays for it. */
export const WHACK_CRASH_BOOST_CONFIG: GameConfig = Object.freeze({
  ...DEFAULT_CONFIG,
  id: 'whack-crash/v2',
  boostRate: 0.4,
});

export const WHACK_CRASH_BOOST_RISING_CONFIG: GameConfig = Object.freeze({
  ...WHACK_CRASH_RISING_CONFIG,
  id: 'whack-crash/v2-rising',
  boostRate: 0.4,
});

/**
 * Slow-pace family (v3/v4). The v1/v2 median round is 3.4 s, which players read as frantic next to the
 * crash games they know. Dividing every rate by PACE and multiplying the ramp by it plays the same
 * round in slow motion: the multiplier reached at any given hazard quantile is unchanged, so the
 * distribution of the crash multiplier — and therefore RTP — is identical by construction. Only the
 * tMax cut-off could bind differently, and a round still reaches the x10,000 cap well inside 60 s.
 * Proven, not assumed: every id here has its own committed 10M-round report.
 */
const PACE = 2;
const slow = (config: GameConfig, id: string): GameConfig =>
  Object.freeze({
    ...config,
    id,
    r0: config.r0 / PACE,
    rmax: config.rmax / PACE,
    tRamp: config.tRamp * PACE,
    lambda: config.lambda / PACE,
    boostRate: config.boostRate / PACE,
  });

export const WHACK_CRASH_SLOW_CONFIG = slow(DEFAULT_CONFIG, 'whack-crash/v3');
export const WHACK_CRASH_SLOW_RISING_CONFIG = slow(WHACK_CRASH_RISING_CONFIG, 'whack-crash/v3-rising');
export const WHACK_CRASH_SLOW_BOOST_CONFIG = slow(WHACK_CRASH_BOOST_CONFIG, 'whack-crash/v4');
export const WHACK_CRASH_SLOW_BOOST_RISING_CONFIG = slow(WHACK_CRASH_BOOST_RISING_CONFIG, 'whack-crash/v4-rising');

export const GAME_CONFIGS: Readonly<Record<string, GameConfig>> = Object.freeze({
  [DEFAULT_CONFIG.id]: DEFAULT_CONFIG,
  [WHACK_CRASH_RISING_CONFIG.id]: WHACK_CRASH_RISING_CONFIG,
  [WHACK_CRASH_BOOST_CONFIG.id]: WHACK_CRASH_BOOST_CONFIG,
  [WHACK_CRASH_BOOST_RISING_CONFIG.id]: WHACK_CRASH_BOOST_RISING_CONFIG,
  [WHACK_CRASH_SLOW_CONFIG.id]: WHACK_CRASH_SLOW_CONFIG,
  [WHACK_CRASH_SLOW_RISING_CONFIG.id]: WHACK_CRASH_SLOW_RISING_CONFIG,
  [WHACK_CRASH_SLOW_BOOST_CONFIG.id]: WHACK_CRASH_SLOW_BOOST_CONFIG,
  [WHACK_CRASH_SLOW_BOOST_RISING_CONFIG.id]: WHACK_CRASH_SLOW_BOOST_RISING_CONFIG,
});

/**
 * Configs of retired games. A config id is a permanent public fact: the verifier must still check a
 * round settled under one, and the archived RTP reports name them (design D4). They resolve but are
 * not exported and are not in GAME_CONFIGS, so no new round can start on one.
 */
const RETIRED_CONFIGS: Readonly<Record<string, GameConfig>> = Object.freeze({
  'paper-route/v1': Object.freeze({ ...DEFAULT_CONFIG, id: 'paper-route/v1', stakeParts: 5 }),
  'paper-route/v1-rising': Object.freeze({ ...DEFAULT_CONFIG, id: 'paper-route/v1-rising', stakeParts: 5, lambda: 0 }),
});

/** Every id that resolves, registered or retired. */
export function retiredConfigIds(): string[] {
  return Object.keys(RETIRED_CONFIGS);
}

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
  const direct = GAME_CONFIGS[id] ?? RETIRED_CONFIGS[id];
  if (direct) return direct;
  const m = CAP_SUFFIX.exec(id);
  if (!m) return null;
  const base = GAME_CONFIGS[m[1]!] ?? RETIRED_CONFIGS[m[1]!];
  const cap = Number(m[2]);
  if (!base || !(cap > 1) || cap >= base.maxWinMultiplier) return null;
  return Object.freeze({ ...base, id, maxWinMultiplier: cap });
}

/**
 * Net expected log-drift per second from both modifiers: setbacks drag the value down, boosts lift
 * it up. `H(t) = K(t) - modifierDrift * t` (design D3). May be negative for a boost-heavy config.
 */
export function modifierDrift(config: GameConfig): number {
  return config.lambda * (1 - config.setbackFactor) - config.boostRate * (config.boostFactor - 1);
}

/** Expected log-drag per second caused by setbacks alone: lambda * (1 - f). */
export function setbackDrag(config: GameConfig): number {
  return config.lambda * (1 - config.setbackFactor);
}

export type ConfigValidation = { ok: true } | { ok: false; errors: string[] };

export function validateConfig(config: GameConfig): ConfigValidation {
  const errors: string[] = [];
  const numeric: (keyof GameConfig)[] = [
    'rtp', 'r0', 'rmax', 'tRamp', 'lambda', 'setbackFactor', 'boostRate', 'boostFactor',
    'maxWinMultiplier', 'tMax', 'stakeParts',
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
  if (!(config.boostRate >= 0)) errors.push('boostRate must be zero or positive');
  if (config.boostRate > 0 && !(config.boostFactor > 1)) {
    errors.push('boostFactor must be greater than 1 when boostRate is above 0');
  }
  if (!(config.maxWinMultiplier > 1)) errors.push('maxWinMultiplier must be greater than 1');
  if (!(config.tMax > 0)) errors.push('tMax must be positive');
  if (!(Number.isInteger(config.stakeParts) && config.stakeParts >= 1)) {
    errors.push('stakeParts must be a whole number of at least 1');
  }

  // The growth rate is linear between r0 and rmax, so its minimum is at one end.
  // Survival must strictly decrease, so the rate has to beat the net modifier drift everywhere.
  const drift = modifierDrift(config);
  const minRate = config.tRamp > 0 ? Math.min(config.r0, config.rmax) : config.rmax;
  if (!(minRate > drift)) {
    errors.push(`growth rate (min ${minRate}) must exceed modifier drift ${drift}`);
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertValidConfig(config: GameConfig): GameConfig {
  const result = validateConfig(config);
  if (!result.ok) throw new Error(`Invalid game config: ${result.errors.join('; ')}`);
  return config;
}
