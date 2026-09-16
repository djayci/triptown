import { describe, expect, it } from 'vitest';
import { judgeCollect, judgeJump, settleIfAbandoned, snapshotOf, type StepJudgement, type StepRoundRecord } from './round';
import { roundWith } from './test-helpers';

const applied = (j: StepJudgement): StepRoundRecord => {
  if (j.kind !== 'applied') throw new Error(`expected applied, got ${j.kind}`);
  return j.round;
};

const jumps = (r: StepRoundRecord, n: number, at = 2_000) => {
  for (let i = 0; i < n; i++) r = applied(judgeJump(r, at + i, `jump-${i}-aaaa`));
  return r;
};

describe('step round model', () => {
  it('clears fences and exposes the next value', () => {
    const r = jumps(roundWith(null), 4);
    const s = snapshotOf(r);
    expect(s.cleared).toBe(4);
    expect(s.currentMultiplier).toBe(2.37);
    expect(s.nextMultiplier).toBe(2.96);
    expect(s.status).toBe('running');
  });

  it('settles a refusal as lost with nothing credited', () => {
    const r = applied(judgeJump(jumps(roundWith(3), 2), 3_000, 'jump-refused'));
    expect(r.status).toBe('lost');
    expect(r.settlement).toMatchObject({ reason: 'refused', cleared: 2, payoutMinor: 0, netMinor: -50_000, result: 'loss' });
    expect(r.actions.at(-1)).toMatchObject({ fence: 3, result: 'refused' });
  });

  it('finishes at the top multiplier after the last fence', () => {
    const r = jumps(roundWith(null), 10);
    expect(r.status).toBe('finished');
    expect(r.settlement).toMatchObject({ reason: 'finish', multiplier: 9.03, payoutMinor: 451_500 });
  });

  it('collects at the current value, rounded half-up once', () => {
    const r = applied(judgeCollect(jumps(roundWith(null), 4), 9_000, 'collect-1'));
    expect(r.settlement).toMatchObject({ status: 'collected', multiplier: 2.37, payoutMinor: 118_500, netMinor: 68_500, result: 'win' });
  });

  it('refuses to collect before the first fence', () => {
    expect(judgeCollect(roundWith(null), 2_000, 'collect-early').kind).toBe('nothing_to_collect');
  });

  it('returns the recorded action for a repeated key without revealing another fence', () => {
    const r = applied(judgeJump(roundWith(null), 2_000, 'same-key-1'));
    const again = judgeJump(r, 2_100, 'same-key-1');
    expect(again.kind).toBe('duplicate');
    expect(again.round.cleared).toBe(1);
  });

  it('does not act on a settled round', () => {
    const r = applied(judgeCollect(jumps(roundWith(null), 1), 3_000, 'collect-2'));
    expect(judgeJump(r, 3_100, 'late-jump-1').kind).toBe('not_running');
  });

  it('collects an abandoned round with fences cleared, and voids one without', () => {
    const withFences = settleIfAbandoned(jumps(roundWith(null), 2), 2_001 + 60_000);
    expect(withFences?.settlement).toMatchObject({ status: 'collected', reason: 'abandoned', payoutMinor: 76_000 });
    const none = settleIfAbandoned(roundWith(null), 1_000 + 60_000);
    expect(none?.settlement).toMatchObject({ status: 'void', reason: 'abandoned_void', payoutMinor: 50_000, netMinor: 0 });
    expect(settleIfAbandoned(roundWith(null), 1_000 + 59_999)).toBeNull();
  });

  it('never exposes the outcome or server seed in snapshots', () => {
    for (const r of [roundWith(5), jumps(roundWith(5), 3), applied(judgeJump(jumps(roundWith(5), 4), 5_000, 'jump-last-1'))]) {
      const json = JSON.stringify(snapshotOf(r));
      expect(json).not.toContain('refusedAt');
      expect(json).not.toContain('outcome');
      expect(json).not.toContain(r.seeds.serverSeed);
    }
  });
});
