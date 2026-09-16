// Step game configurations. The paytable fixes what each fence pays; the chance of clearing fence k is
// m[k-1] / m[k] (with m[0] = RTP), so reaching fence k has probability RTP / m[k] and stopping after any
// fence returns exactly the RTP. That is what makes every stopping strategy fair (design D2).

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface StepConfig {
  id: string;
  difficulty: Difficulty;
  rtp: number;
  /** Multiplier after clearing fence k (index k-1), strictly increasing, 2 decimals. */
  paytable: readonly number[];
}

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Rounds to 2 decimals half-up, with a float guard. */
export const round2 = (x: number) => Math.floor(x * 100 + 0.5 + 1e-9) / 100;

/** Paytable from a nominal clear chance: m[k] = round2(rtp / p^k). Used to author the published tables. */
export function paytableFromChance(rtp: number, chance: number, fences: number): number[] {
  const out: number[] = [];
  for (let k = 1; k <= fences; k++) out.push(round2(rtp / Math.pow(chance, k)));
  return out;
}

const table = (id: string, difficulty: Difficulty, paytable: number[]): StepConfig =>
  Object.freeze({ id, difficulty, rtp: 0.97, paytable: Object.freeze(paytable) });

export const STEP_CONFIGS: Readonly<Record<Difficulty, StepConfig>> = Object.freeze({
  easy: table('fence-run/v1-easy', 'easy', [1.08, 1.2, 1.33, 1.48, 1.64, 1.83, 2.03, 2.25, 2.5, 2.78]),
  medium: table('fence-run/v1-medium', 'medium', [1.21, 1.52, 1.89, 2.37, 2.96, 3.7, 4.63, 5.78, 7.23, 9.03]),
  hard: table('fence-run/v1-hard', 'hard', [1.49, 2.3, 3.53, 5.43, 8.36, 12.86, 19.79, 30.44, 46.83, 72.05]),
});

export function stepConfigById(id: string): StepConfig | null {
  return Object.values(STEP_CONFIGS).find((c) => c.id === id) ?? null;
}

export const fenceCount = (c: StepConfig) => c.paytable.length;

/** Chance of clearing fence `k` (1-based). */
export function clearChance(c: StepConfig, k: number): number {
  const prev = k === 1 ? c.rtp : c.paytable[k - 2]!;
  return prev / c.paytable[k - 1]!;
}

/** Chance of clearing fences 1..k. */
export function reachChance(c: StepConfig, k: number): number {
  let p = 1;
  for (let i = 1; i <= k; i++) p *= clearChance(c, i);
  return p;
}

/** Multiplier after `cleared` fences; null before the first fence. */
export const multiplierAfter = (c: StepConfig, cleared: number): number | null => (cleared > 0 ? c.paytable[cleared - 1]! : null);

export function validateStepConfig(c: StepConfig): string[] {
  const errors: string[] = [];
  if (!(c.rtp > 0 && c.rtp < 1)) errors.push('rtp must be between 0 and 1');
  if (c.paytable.length < 1) errors.push('paytable must have at least one fence');
  let prev = c.rtp;
  c.paytable.forEach((m, i) => {
    if (!Number.isFinite(m) || m <= prev) errors.push(`paytable[${i}] must be greater than ${prev}`);
    if (Math.abs(round2(m) - m) > 1e-9) errors.push(`paytable[${i}] must have at most 2 decimals`);
    prev = m;
  });
  return errors;
}

export function assertValidStepConfig(c: StepConfig): StepConfig {
  const errors = validateStepConfig(c);
  if (errors.length) throw new Error(`Invalid step config ${c.id}: ${errors.join('; ')}`);
  return c;
}
