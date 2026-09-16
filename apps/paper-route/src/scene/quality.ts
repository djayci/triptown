import type { QualityTier } from './world';

const ORDER: QualityTier[] = ['high', 'medium', 'low'];

/** Starting tier: touch devices begin at medium, everything else at high (design D8). */
export function initialTier(isTouch: boolean): QualityTier {
  return isTouch ? 'medium' : 'high';
}

/**
 * Steps render quality down when frames stay slow, and never back up during a session, so a
 * device that struggles once doesn't oscillate. Only rendering changes; the round display and
 * controls live in the DOM and keep updating at any tier.
 */
export class QualityGovernor {
  private samples: { at: number; ms: number }[] = [];
  private slowSince: number | null = null;

  constructor(
    private tier: QualityTier,
    private readonly onChange: (tier: QualityTier) => void,
    private readonly thresholdMs = 33,
    private readonly sustainMs = 2000,
    private readonly windowMs = 500,
  ) {}

  get current(): QualityTier {
    return this.tier;
  }

  /** Feed one frame: `now` is a timestamp in ms, `frameMs` the time since the previous frame. */
  frame(now: number, frameMs: number): void {
    this.samples.push({ at: now, ms: frameMs });
    while (this.samples.length && this.samples[0]!.at < now - this.windowMs) this.samples.shift();
    const avg = this.samples.reduce((sum, s) => sum + s.ms, 0) / this.samples.length;
    if (avg <= this.thresholdMs) {
      this.slowSince = null;
      return;
    }
    this.slowSince ??= now;
    if (now - this.slowSince >= this.sustainMs) {
      const next = ORDER[ORDER.indexOf(this.tier) + 1];
      this.slowSince = null;
      this.samples = [];
      if (next) {
        this.tier = next;
        this.onChange(next);
      }
    }
  }
}
