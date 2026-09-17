import type { RoundSummary } from '@triptown/rgs-client';
import { describe, expect, it } from 'vitest';
import { resultText } from './history-panel';

// gate-odds-mvp D7: recall of a deferred-reveal round states where the player went in, never the hidden
// crash value. Live rounds keep showing their crash point.
const lost = (extra: Partial<RoundSummary>): RoundSummary =>
  ({
    status: 'lost',
    returnMinor: 0,
    crashMultiplier: 4.9,
    settlement: { status: 'lost', reason: 'crash', time: 9, multiplier: 5, payoutMinor: 0, crashTime: 8.8 },
    ...extra,
  }) as RoundSummary;

describe('history result text', () => {
  it('shows the reveal value and no crash value for a deferred round', () => {
    const text = resultText(lost({ reveal: 'onCollect' }));
    expect(text).toBe('Lost at x5.00');
    expect(text).not.toContain('4.90');
  });

  it('keeps the crash point for a live round', () => {
    expect(resultText(lost({}))).toBe('Crashed at x4.90');
  });
});
