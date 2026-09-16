import type { StepRoundRecord } from './round';

/** Persistence for step rounds. Sessions, balances and pacing stay in core's `RoundStore`. */
export interface StepRoundStore {
  /** Stores a new round; false if the id exists. */
  createStepRound(round: StepRoundRecord): Promise<boolean>;
  getStepRound(id: string): Promise<StepRoundRecord | null>;
  /**
   * Atomic compare-and-set: stores `next` (with version `expectedVersion + 1`) only if the stored round still has
   * `expectedVersion`. Returns the stored round when applied, null when another change won the race.
   */
  applyStepRound(next: StepRoundRecord, expectedVersion: number): Promise<StepRoundRecord | null>;
}

const clone = (r: StepRoundRecord): StepRoundRecord => JSON.parse(JSON.stringify(r)) as StepRoundRecord;

/** In-memory store for tests, local development and the browser mock. */
export class MemoryStepRoundStore implements StepRoundStore {
  private rounds = new Map<string, StepRoundRecord>();

  async createStepRound(round: StepRoundRecord) {
    if (this.rounds.has(round.id)) return false;
    this.rounds.set(round.id, clone(round));
    return true;
  }

  async getStepRound(id: string) {
    const r = this.rounds.get(id);
    return r ? clone(r) : null;
  }

  async applyStepRound(next: StepRoundRecord, expectedVersion: number) {
    const current = this.rounds.get(next.id);
    if (!current || current.version !== expectedVersion) return null;
    const stored = { ...clone(next), version: expectedVersion + 1 };
    this.rounds.set(next.id, stored);
    return clone(stored);
  }
}
