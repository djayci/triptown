import { describe, expect, it } from 'vitest';
import {
  FlockModel,
  HERO,
  HERO_LANE,
  JOIN_SECONDS,
  LEAVE_SECONDS,
  flockCount,
  ramView,
  slots,
} from './flock';

// flock-mvp spec "The flock and the pace never know the crash" and "The player's ram is always
// identifiable": what the scene shows depends on the multiplier, the shared pace and what the screen has
// already shown, never on when the round will end.

/** Plays a multiplier sequence into a model at 60 fps, then lets every animation settle. */
function play(sequence: number[], settle = 3): FlockModel {
  const m = new FlockModel();
  m.setPhase('running');
  for (const v of sequence) {
    m.setMultiplier(v);
    m.step(1 / 60);
  }
  for (let i = 0; i < settle * 60; i++) m.step(1 / 60);
  return m;
}

describe('flockCount', () => {
  it('is alone at x1.00, has company before x1.50, and never shrinks as the value rises', () => {
    expect(flockCount(1)).toBe(0);
    expect(flockCount(1.49)).toBeGreaterThanOrEqual(1);
    let last = 0;
    for (let v = 1; v < 200; v *= 1.01) {
      expect(flockCount(v)).toBeGreaterThanOrEqual(last);
      last = flockCount(v);
    }
  });

  it('fills the field at high values', () => {
    expect(flockCount(50)).toBeGreaterThanOrEqual(slots().length);
  });
});

describe('the flock is a function of the value', () => {
  it('two rounds reaching x4.00 by different paths settle into the same flock', () => {
    const steady = Array.from({ length: 600 }, (_, i) => 1 + (3 * i) / 599);
    const late = [
      ...Array.from({ length: 300 }, () => 1),
      ...Array.from({ length: 300 }, (_, i) => 1 + (3 * i) / 299),
    ];
    const a = play(steady);
    const b = play(late);
    expect(a.states.map((r) => r.mode)).toEqual(b.states.map((r) => r.mode));
    expect(a.present()).toBe(flockCount(4));
  });

  it('joins nearest the hero first and the horizon last', () => {
    const order = slots();
    const dist = (i: number) => Math.hypot(order[i]!.x - HERO.x, order[i]!.y - HERO.y);
    const firstTen = Array.from({ length: 10 }, (_, i) => dist(i));
    const lastTen = Array.from({ length: 10 }, (_, i) => dist(order.length - 1 - i));
    expect(Math.max(...firstTen)).toBeLessThan(Math.min(...lastTen));
  });
});

describe('the hero is never hidden', () => {
  it('no slot stands in his lane, in his row or in front of him', () => {
    for (const s of slots()) {
      if (s.y < 545) continue;
      const lane = s.y > HERO.y ? HERO_LANE.front : HERO_LANE.near;
      expect(Math.abs(s.x - HERO.x)).toBeGreaterThanOrEqual(lane);
    }
  });
});

describe('a split under setbacks', () => {
  it('the flock shrinks to the halved value, and the leavers face forward while the run goes on', () => {
    const m = play(Array.from({ length: 300 }, (_, i) => 1 + (2 * i) / 299));
    expect(m.present()).toBe(flockCount(3));
    m.setMultiplier(1.5);
    m.speed = 400;
    m.step(1 / 60);
    const leaving = m.states.map((r, i) => [r, i] as const).filter(([r]) => r.mode === 'leaving');
    expect(leaving.length).toBe(flockCount(3) - flockCount(1.5));
    for (const [r, i] of leaving)
      expect(ramView(slots()[i]!, r, 1, 0, m.speed, false)?.flip).toBe(false);
    for (let i = 0; i < (LEAVE_SECONDS + 0.1) * 60; i++) m.step(1 / 60);
    expect(m.present()).toBe(flockCount(1.5));
  });
});

describe('the wolf', () => {
  it('at the crash every ram bolts, facing the way it runs, and none stays', () => {
    const m = play(Array.from({ length: 300 }, (_, i) => 1 + (4 * i) / 299));
    m.setPhase('crashed');
    for (let i = 0; i < 30; i++) m.step(1 / 60);
    const fleeing = m.states.map((r, i) => [r, i] as const).filter(([r]) => r.mode === 'fleeing');
    expect(fleeing.length).toBe(flockCount(5));
    for (const [r, i] of fleeing) {
      const v = ramView(slots()[i]!, r, 1, 0, m.speed, false);
      if (v) expect(v.flip).toBe(true);
    }
    for (let i = 0; i < LEAVE_SECONDS * 60 + 10; i++) m.step(1 / 60);
    expect(m.present()).toBe(0);
  });
});

describe('pace', () => {
  it('the run speed follows the shared pace and nothing else', () => {
    const a = new FlockModel();
    const b = new FlockModel();
    for (const m of [a, b]) m.setPhase('running');
    a.setMultiplier(1.2);
    b.setMultiplier(9);
    for (const m of [a, b]) m.setPace(0.4);
    for (let i = 0; i < 300; i++) {
      a.step(1 / 60);
      b.step(1 / 60);
    }
    expect(a.speed).toBeCloseTo(b.speed, 6);
    expect(a.speed).toBeCloseTo(a.targetSpeed(), 1);
  });

  it('joining takes a fixed time', () => {
    expect(JOIN_SECONDS).toBeGreaterThan(0);
  });
});
