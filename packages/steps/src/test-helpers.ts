import { MemoryRoundStore, profileFromTemplate } from '@triptown/core';
import { STEP_CONFIGS, type Difficulty } from './config';
import { StepHost } from './host';
import { createStepRound, type StepRoundRecord } from './round';
import { MemoryStepRoundStore } from './store';

export const SEED = 'ab'.repeat(32);

/** A round whose refusal fence is forced, for model tests (bypasses derivation). */
export function roundWith(refusedAt: number | null, opts: { difficulty?: Difficulty; stakeMinor?: number; abandonAfterMs?: number } = {}): StepRoundRecord {
  const r = createStepRound({
    id: 'r1',
    sessionId: 's1',
    playerId: 'p1',
    stakeMinor: opts.stakeMinor ?? 50_000,
    currency: 'NGN',
    config: STEP_CONFIGS[opts.difficulty ?? 'medium'],
    seeds: { serverSeed: SEED, clientSeed: 'c', nonce: 0 },
    commit: 'commit',
    startedAt: 1_000,
    abandonAfterMs: opts.abandonAfterMs ?? 60_000,
  });
  return { ...r, outcome: { refusedAt } };
}

export function makeHost(opts: { minCycleMs?: number; abandonAfterMs?: number } = {}) {
  let now = 1_000_000;
  const clock = { now: () => now, advance: (ms: number) => (now += ms) };
  const store = new MemoryRoundStore();
  const steps = new MemoryStepRoundStore();
  const profile = { ...profileFromTemplate('regulated-uk', ['https://op.example']), minCycleMs: opts.minCycleMs ?? 0 };
  const host = new StepHost({
    store,
    steps,
    clock,
    profiles: { defaultProfile: profile },
    currency: { code: 'NGN', decimals: 2, minBetMinor: 10_000, maxBetMinor: 5_000_000 },
    abandonAfterMs: opts.abandonAfterMs ?? 60_000,
  });
  return { host, store, steps, clock };
}

let n = 0;
export const key = () => `key-${(++n).toString().padStart(6, '0')}`;
