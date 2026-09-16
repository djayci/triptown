export interface CurrencyRules {
  code: string;
  /** Digits after the decimal point, e.g. 2 for USD. */
  decimals: number;
  minBetMinor: number;
  maxBetMinor: number;
}

export const DEFAULT_CURRENCY: CurrencyRules = Object.freeze({
  code: 'USD',
  decimals: 2,
  // 0.20 keeps measured RTP within tolerance at the smallest stake (GLI-19 §4.7.1a; design D23).
  minBetMinor: 20, // 0.20
  maxBetMinor: 100_00, // 100.00
});

// Guards against float noise such as 1000 * 4.35 = 4349.999999999999.
const EPSILON = 1e-7;

/** Rounds an exact amount in minor units to a whole minor unit, half-up. */
export function roundHalfUpMinor(exactMinor: number): number {
  return Math.floor(exactMinor + 0.5 + EPSILON);
}

/**
 * Settled return for a single cash-out: bet × multiplier rounded half-up once (design D23).
 * Rounding down every cash-out drops measured RTP at small stakes, which labs and Nevada reject.
 */
export function payoutMinor(betMinor: number, multiplier: number): number {
  return roundHalfUpMinor(betMinor * multiplier);
}

/**
 * Accrual for rounds with several cash-outs (Paper Route papers): each cash-out adds its exact value,
 * whole minor units are credited as they are earned, and the round total is rounded half-up once at
 * settlement. With one cash-out this equals `payoutMinor`.
 */
export interface Accrual {
  exactMinor: number;
  creditedMinor: number;
}

export const emptyAccrual: Accrual = Object.freeze({ exactMinor: 0, creditedMinor: 0 });

/** Adds one cash-out's exact value; returns the whole minor units to credit now. */
export function accrueCashout(state: Accrual, stakeShareMinor: number, multiplier: number): { state: Accrual; creditNowMinor: number } {
  const exactMinor = state.exactMinor + stakeShareMinor * multiplier;
  const earned = Math.floor(exactMinor + EPSILON);
  const creditNowMinor = Math.max(0, earned - state.creditedMinor);
  return { state: { exactMinor, creditedMinor: state.creditedMinor + creditNowMinor }, creditNowMinor };
}

/** Final top-up at settlement so the round total is the half-up rounding of the exact total. */
export function settleAccrual(state: Accrual): { totalMinor: number; creditNowMinor: number } {
  const totalMinor = roundHalfUpMinor(state.exactMinor);
  return { totalMinor, creditNowMinor: Math.max(0, totalMinor - state.creditedMinor) };
}

/** Round result for presentation: only a return above the stake is a win (UKGC RTS 14F, AGCO 2.20). */
export function resultKind(stakeMinor: number, returnMinor: number): 'win' | 'even' | 'loss' {
  if (returnMinor > stakeMinor) return 'win';
  return returnMinor === stakeMinor ? 'even' : 'loss';
}

export function formatMinor(minor: number, currency: Pick<CurrencyRules, 'decimals'>): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const scale = 10 ** currency.decimals;
  const whole = Math.floor(abs / scale);
  const frac = currency.decimals ? '.' + String(abs % scale).padStart(currency.decimals, '0') : '';
  return `${sign}${whole.toLocaleString('en-US')}${frac}`;
}

export type BetValidation =
  | { ok: true }
  | { ok: false; code: 'bet_limit' | 'invalid_bet'; message: string };

export function validateBet(betMinor: number, currency: CurrencyRules): BetValidation {
  if (!Number.isSafeInteger(betMinor) || betMinor <= 0) {
    return { ok: false, code: 'invalid_bet', message: 'Bet must be a positive whole number of minor units' };
  }
  if (betMinor < currency.minBetMinor || betMinor > currency.maxBetMinor) {
    return {
      ok: false,
      code: 'bet_limit',
      message: `Bet must be between ${formatMinor(currency.minBetMinor, currency)} and ${formatMinor(currency.maxBetMinor, currency)} ${currency.code}`,
    };
  }
  return { ok: true };
}
