import { describe, expect, it } from 'vitest';
import { mockRedis } from './test-helpers';
import { TimeSource } from './time-source';

describe('TimeSource (2.3)', () => {
  it('applies the authority offset and reports drift over 100 ms', async () => {
    let local = 1_000_000;
    let authority = 1_000_000 + 2_000; // authority runs 2 s ahead
    const drifts: number[] = [];
    const ts = new TimeSource({
      fetchTime: async () => authority,
      localNow: () => local,
      syncMs: 10_000,
      onDrift: (e) => drifts.push(e.driftMs),
    });
    await ts.ensureFresh();
    expect(ts.now()).toBe(1_002_000);
    expect(drifts).toEqual([]); // first sync is not drift

    local += 5_000;
    authority += 5_050; // 50 ms drift: below threshold
    await ts.sync();
    expect(drifts).toEqual([]);
    expect(ts.offsetMs).toBe(2_050);

    local += 5_000;
    authority += 5_300; // 300 ms more drift
    await ts.sync();
    expect(drifts).toEqual([300]);
    expect(ts.now()).toBe(local + 2_350);
  });

  it('re-syncs in the background only when stale', async () => {
    let local = 0;
    let calls = 0;
    const ts = new TimeSource({ fetchTime: async () => (calls++, local), localNow: () => local, syncMs: 10_000 });
    await ts.ensureFresh();
    local += 5_000;
    await ts.ensureFresh();
    expect(calls).toBe(1);
    local += 6_000;
    await ts.ensureFresh();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(2);
  });

  it('reads Redis TIME through the store adapter', async () => {
    const redis = mockRedis();
    const t = await redis.time();
    expect(Math.abs(t - Date.now())).toBeLessThan(5_000);
  });
});
