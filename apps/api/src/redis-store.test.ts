import { describe, expect, it } from 'vitest';
import { RedisRoundStore } from './redis-store';
import { mockRedis } from './test-helpers';

describe('RedisRoundStore credit-once and pending set (3.6)', () => {
  it('credits a round exactly once and tracks pending rounds', async () => {
    const store = new RedisRoundStore(mockRedis());
    await store.createSession({ id: 's1', currency: 'USD', serverSeed: 'x', commit: 'c', clientSeed: 'cs', nonce: 0, createdAt: 0 }, 1_00);
    expect(await store.creditOnce('s1', 'r1', 250)).toBe(true);
    expect(await store.creditOnce('s1', 'r1', 250)).toBe(false);
    expect(await store.getBalance('s1')).toBe(350);
    await store.addPending('r1');
    await store.addPending('r2');
    expect((await store.listPending(10)).sort()).toEqual(['r1', 'r2']);
    await store.removePending('r1');
    expect(await store.listPending(10)).toEqual(['r2']);
  });

  it('claims starts with pacing and restores the clock on release', async () => {
    const store = new RedisRoundStore(mockRedis());
    expect(await store.claimRoundStart('p', 'a', 1_000, 5_000)).toEqual({ ok: true, previousStartAt: null });
    expect(await store.claimRoundStart('p', 'b', 1_500, 5_000)).toEqual({ ok: false, reason: 'in_progress' });
    await store.releaseActiveRound('p', 'a');
    expect(await store.claimRoundStart('p', 'b', 2_000, 5_000)).toEqual({ ok: false, reason: 'too_soon', retryAfterMs: 4_000 });
    expect(await store.claimRoundStart('p', 'b', 6_000, 5_000)).toEqual({ ok: true, previousStartAt: 1_000 });
    await store.releaseActiveRound('p', 'b', 1_000);
    expect(await store.claimRoundStart('p', 'c', 6_500, 5_000)).toEqual({ ok: true, previousStartAt: 1_000 });
  });
});
