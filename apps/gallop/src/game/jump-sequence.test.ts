import { describe, expect, it } from 'vitest';
import { GEOMETRY, JumpSequence, TIMING, type JumpResult } from './jump-sequence';

function framesUntil(result: JumpResult, respondAt: number) {
  const seq = new JumpSequence();
  seq.start(0);
  const frames = [];
  for (let t = 0; t <= respondAt; t += 16) frames.push(seq.frame(t));
  seq.resolve(result, respondAt);
  return { seq, frames };
}

describe('JumpSequence', () => {
  it('plays identical frames for a cleared and a refused jump until the result is applied', () => {
    for (const respondAt of [120, 650, 1_400]) {
      const cleared = framesUntil('cleared', respondAt);
      const refused = framesUntil('refused', respondAt);
      expect(refused.frames).toEqual(cleared.frames);
      // Even after an early response, the branch waits for the take-off point.
      const t = Math.min(respondAt + 16, TIMING.approachMs - 1);
      if (respondAt < TIMING.approachMs) expect(refused.seq.frame(t)).toEqual(cleared.seq.frame(t));
    }
  });

  it('holds at the take-off point while waiting for the server', () => {
    const seq = new JumpSequence();
    seq.start(0);
    expect(seq.frame(5_000)).toMatchObject({ phase: 'hold', offset: GEOMETRY.takeoff, lift: 0 });
  });

  it('jumps over the fence and lands at the next stand point', () => {
    const seq = new JumpSequence();
    seq.start(0);
    seq.resolve('cleared', 100);
    const mid = seq.frame(TIMING.approachMs + TIMING.jumpMs / 2);
    expect(mid.phase).toBe('jump');
    expect(mid.lift).toBeGreaterThan(80);
    const end = seq.frame(TIMING.approachMs + TIMING.jumpMs + TIMING.landMs + 10);
    expect(end).toMatchObject({ phase: 'land', offset: GEOMETRY.nextStand, done: true });
  });

  it('stops at the fence on a refusal, without lifting off', () => {
    const seq = new JumpSequence();
    seq.start(0);
    seq.resolve('refused', 900);
    for (let t = 900; t < 900 + TIMING.refuseMs; t += 16) {
      const f = seq.frame(t);
      expect(f.phase).toBe('refuse');
      expect(f.lift).toBe(0);
      expect(f.offset).toBeLessThan(GEOMETRY.takeoff + 25);
    }
    expect(seq.frame(900 + TIMING.refuseMs).done).toBe(true);
  });
});
