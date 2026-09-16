import type { Clock } from '@triptown/core';

export interface TimeSourceOptions {
  /** Shared authority time in epoch ms (e.g. Redis TIME). */
  fetchTime: () => Promise<number>;
  /** Re-sync when the last sync is older than this. */
  syncMs?: number;
  /** Report offset jumps larger than this. */
  driftThresholdMs?: number;
  onDrift?: (event: { driftMs: number; offsetMs: number; previousOffsetMs: number }) => void;
  localNow?: () => number;
}

/**
 * One time authority for every serverless instance: local clock plus an offset measured against
 * the shared store. `now()` stays synchronous so RoundHost's Clock interface is unchanged.
 */
export class TimeSource implements Clock {
  private offset = 0;
  private lastSync = -Infinity;
  private inFlight: Promise<void> | null = null;
  private readonly syncMs: number;
  private readonly threshold: number;
  private readonly localNow: () => number;

  constructor(private readonly opts: TimeSourceOptions) {
    this.syncMs = opts.syncMs ?? 10_000;
    this.threshold = opts.driftThresholdMs ?? 100;
    this.localNow = opts.localNow ?? (() => Date.now());
  }

  get offsetMs() {
    return this.offset;
  }

  get synced() {
    return this.lastSync > -Infinity;
  }

  now(): number {
    return this.localNow() + this.offset;
  }

  async sync(): Promise<void> {
    this.inFlight ??= (async () => {
      const t0 = this.localNow();
      const authority = await this.opts.fetchTime();
      const t1 = this.localNow();
      // Assume the authority read happened halfway through the round trip.
      const next = authority - (t0 + (t1 - t0) / 2);
      if (this.synced && Math.abs(next - this.offset) > this.threshold) {
        this.opts.onDrift?.({ driftMs: next - this.offset, offsetMs: next, previousOffsetMs: this.offset });
      }
      this.offset = next;
      this.lastSync = t1;
    })().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Waits for the first sync (cold start); afterwards refreshes in the background when stale. */
  async ensureFresh(): Promise<void> {
    if (!this.synced) return this.sync();
    if (this.localNow() - this.lastSync > this.syncMs) void this.sync().catch(() => {});
  }
}
