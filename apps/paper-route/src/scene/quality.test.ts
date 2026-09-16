import { describe, expect, it } from 'vitest';
import { QualityGovernor, initialTier } from './quality';
import type { QualityTier } from './world';

function run(governor: QualityGovernor, frameMs: number, seconds: number, start = 0): number {
  let t = start;
  while (t < start + seconds * 1000) {
    t += frameMs;
    governor.frame(t, frameMs);
  }
  return t;
}

describe('QualityGovernor', () => {
  it('starts touch devices at medium', () => {
    expect(initialTier(true)).toBe('medium');
    expect(initialTier(false)).toBe('high');
  });

  it('steps down after about 2 s above 33 ms per frame', () => {
    const changes: QualityTier[] = [];
    const g = new QualityGovernor('high', (t) => changes.push(t));
    run(g, 40, 1.9);
    expect(changes).toEqual([]);
    run(g, 40, 0.8, 1900);
    expect(changes).toEqual(['medium']);
  });

  it('keeps stepping down to low and never back up', () => {
    const changes: QualityTier[] = [];
    const g = new QualityGovernor('high', (t) => changes.push(t));
    let t = run(g, 50, 10);
    t = run(g, 8, 10, t);
    run(g, 50, 10, t);
    expect(changes).toEqual(['medium', 'low']);
    expect(g.current).toBe('low');
  });

  it('ignores short spikes', () => {
    const changes: QualityTier[] = [];
    const g = new QualityGovernor('high', (t) => changes.push(t));
    let t = 0;
    for (let i = 0; i < 20; i++) {
      t = run(g, 60, 0.6, t);
      t = run(g, 16, 1.5, t);
    }
    expect(changes).toEqual([]);
  });
});
