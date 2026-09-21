import { MemoryRoundStore, profileFromTemplate, registerGame, type RoundRecord } from '@triptown/core';
import { describe, expect, it } from 'vitest';
import { MockRoundService } from './mock';
import { deferredRevealSuite, paperRouteSuite, roundServiceSuite } from './testing/round-service-suite';
import type { RoundEvent } from './types';

// The split-stake code path still ships, but its only config belongs to a retired game. Tests register
// that game explicitly to exercise the path; no shipped profile has it registered (design D1, D2).
registerGame('paper-route');


// Pacing is covered separately; the random-outcome suite plays rounds back to back.
const unpaced = { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } };
roundServiceSuite('MockRoundService', async () => new MockRoundService({ initialBalanceMinor: 500_00, profiles: unpaced }), 120, {
  makePacedService: async () => new MockRoundService({ profiles: { defaultProfile: profileFromTemplate('light') } }),
});

// Paper Route keeps the unboosted maths: the good mole is a Whack Crash config.
const unpacedUnboosted = { defaultProfile: { ...unpaced.defaultProfile, boostsMode: 'off' as const } };
paperRouteSuite('MockRoundService (paper-route)', async () => new MockRoundService({ initialBalanceMinor: 500_00, profiles: unpacedUnboosted, game: 'paper-route' }));

// Deferred reveal (gate-odds-mvp): a test game that opts in, on a rising profile that enables it.
registerGame('deferred-probe', 'whack-crash', { reveal: ['onCollect'] });
const deferred = {
  defaultProfile: { ...profileFromTemplate('ng-draft', ['https://op.example']), name: 'deferred-test', status: 'active' as const, marketCountry: undefined, blockedRegions: undefined, minCycleMs: 0, crashReveal: 'onCollect' as const },
};
deferredRevealSuite('MockRoundService', async () => new MockRoundService({ initialBalanceMinor: 500_00, profiles: deferred, game: 'deferred-probe' }));

describe('MockRoundService extras', () => {
  it('forces a setback scenario for dev tooling', async () => {
    const service = new MockRoundService();
    service.forceNext('setback');
    const events: RoundEvent[] = [];
    const handle = await service.startRound({ betMinor: 100 }, (e) => events.push(e));
    await handle.ended;
    expect(events.some((e) => e.type === 'SETBACK')).toBe(true);
  }, 30_000);

  it('forces an instant bust', async () => {
    const service = new MockRoundService();
    service.forceNext('instantBust');
    const handle = await service.startRound({ betMinor: 100 }, () => {});
    expect(await handle.ended).toMatchObject({ type: 'CRASH', crashTime: 0 });
  });

  it('ends a stuck round with VOID and refunds the stake', async () => {
    const store = new MemoryRoundStore();
    const clock = { t: Date.now(), now() { return this.t; } };
    const service = new MockRoundService({ store, clock, profiles: unpaced, clientVersion: 'test@1' });
    const events: RoundEvent[] = [];
    const handle = await service.startRound({ betMinor: 100 }, (e) => events.push(e));
    handle.close();
    // Simulate an unreadable record, then let reconciliation find it past tMax + 120 s.
    const record = (await store.getRound(handle.roundId)) as RoundRecord;
    (record as { outcome: unknown }).outcome = null;
    await store.putRound(record);
    clock.t += 181_000;
    expect(await service.reconcile()).toMatchObject({ voided: 1 });
    const watched = await service.watchRound(handle.roundId, () => {});
    expect(await watched.ended).toMatchObject({ type: 'VOID', refundMinor: 100 });
    const [summary] = await service.history();
    expect(summary).toMatchObject({ status: 'void', clientVersion: 'test@1', netMinor: 0 });
  });

  it('rejects when balance is too low', async () => {
    const service = new MockRoundService({ initialBalanceMinor: 50 });
    await expect(service.startRound({ betMinor: 100 }, () => {})).rejects.toMatchObject({ code: 'insufficient_funds' });
  });
});
