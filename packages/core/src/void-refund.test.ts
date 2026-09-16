import { describe, expect, it } from 'vitest';
import { MemoryAuditLog } from './audit';
import type { RoundEvent, Settlement } from './events';
import { HostError, RoundHost } from './host';
import { profileFromTemplate } from './profiles';
import type { RoundRecord } from './round';
import { MemoryRoundStore } from './store';

const unpaced = { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } };

/** Memory store whose chosen operations fail on demand. */
class FaultyStore extends MemoryRoundStore {
  failPutRound = 0;
  failCreditOnce = 0;
  failSettle = 0;
  override async putRound(round: RoundRecord) {
    if (this.failPutRound > 0) {
      this.failPutRound--;
      throw new Error('store write failed');
    }
    return super.putRound(round);
  }
  override async creditOnce(sessionId: string, roundId: string, amountMinor: number) {
    if (this.failCreditOnce > 0) {
      this.failCreditOnce--;
      throw new Error('credit failed');
    }
    return super.creditOnce(sessionId, roundId, amountMinor);
  }
  override async settleOnce(roundId: string, settlement: Settlement) {
    if (this.failSettle > 0) {
      this.failSettle--;
      throw new Error('settle failed');
    }
    return super.settleOnce(roundId, settlement);
  }
  corruptRound(roundId: string) {
    // Simulate a record whose outcome can no longer be read (e.g. corrupted or undecryptable data).
    const rounds = (this as unknown as { rounds: Map<string, RoundRecord> }).rounds;
    const r = rounds.get(roundId)!;
    (r as { outcome: unknown }).outcome = null;
  }
}

function setup() {
  const clock = { t: 1_700_000_000_000, now() { return this.t; } };
  const store = new FaultyStore();
  const audit = new MemoryAuditLog(() => clock.t);
  const host = new RoundHost({ store, clock, sleep: async () => {}, profiles: unpaced, audit });
  return { clock, store, audit, host };
}

describe('void and refund (3.6)', () => {
  it('refunds and voids when the round record cannot be written after the debit', async () => {
    const { store, audit, host } = setup();
    const info = await host.createSession(10_00);
    store.failPutRound = 1;
    const err = await host.startRound(info.sessionId, { betMinor: 2_00 }).catch((e) => e);
    expect(err).toBeInstanceOf(HostError);
    expect(err).toMatchObject({ code: 'round_voided', details: { refundMinor: 2_00 } });
    expect((await host.sessionInfo(info.sessionId)).balanceMinor).toBe(10_00);
    expect(audit.entries.find((e) => e.type === 'round_voided')?.data).toMatchObject({ refundMinor: 2_00, stage: 'start', reason: 'store write failed' });
    // The player is free to bet again.
    await expect(host.startRound(info.sessionId, { betMinor: 2_00 })).resolves.toBeTruthy();
  });

  it('credits a settled win exactly once when the credit failed, via reconciliation', async () => {
    const { clock, store, host } = setup();
    const info = await host.createSession(10_00);
    let roundId = '';
    for (let i = 0; i < 100 && !roundId; i++) {
      const { round } = await host.startRound(info.sessionId, { betMinor: 1_00 });
      if (round.outcome.crashTime > 3 && (round.outcome.setbacks[0] ?? 99) > 3) roundId = round.id;
      else {
        clock.t += 61_000;
        await host.getRound(info.sessionId, round.id);
      }
    }
    const before = (await host.sessionInfo(info.sessionId)).balanceMinor;
    clock.t += 2_000;
    store.failCreditOnce = 1;
    await expect(host.cashout(info.sessionId, roundId)).rejects.toThrow('credit failed');
    const settled = (await store.getRound(roundId))!.settlement!;
    expect(settled.status).toBe('won');
    expect((await store.getBalance(info.sessionId))).toBe(before); // not credited yet

    const stats = await host.reconcile();
    expect(stats.credited).toBe(1);
    expect(await store.getBalance(info.sessionId)).toBe(before + settled.payoutMinor);
    // Running again never double-credits.
    await host.reconcile();
    await host.cashout(info.sessionId, roundId);
    expect(await store.getBalance(info.sessionId)).toBe(before + settled.payoutMinor);
  });

  it('voids and refunds a round stuck past tMax + 120 s, and streams VOID', async () => {
    const { clock, store, audit, host } = setup();
    const info = await host.createSession(10_00);
    const { round } = await host.startRound(info.sessionId, { betMinor: 3_00 });
    store.corruptRound(round.id);
    clock.t += (60 + 121) * 1000;
    const stats = await host.reconcile();
    expect(stats.voided).toBe(1);
    expect(await store.getBalance(info.sessionId)).toBe(10_00);
    const stored = (await store.getRound(round.id))!;
    expect(stored.settlement).toMatchObject({ status: 'void', reason: 'system_failure', payoutMinor: 3_00 });
    expect(audit.entries.some((e) => e.type === 'round_voided' && e.data.stage === 'settlement')).toBe(true);
    const [summary] = await host.history(info.sessionId);
    expect(summary).toMatchObject({ status: 'void', returnMinor: 3_00, netMinor: 0, resultKind: null, balanceBeforeMinor: 10_00, balanceAfterMinor: 10_00, crashMultiplier: null, cashouts: [] });
    expect((await host.sessionInfo(info.sessionId))).toMatchObject({ stakedMinor: 3_00, returnedMinor: 3_00 });

    const events: RoundEvent[] = [];
    await host.streamRound(info.sessionId, round.id, (e) => events.push(e)).done;
    expect(events.at(-1)).toMatchObject({ type: 'VOID', refundMinor: 3_00, balanceMinor: 10_00 });
    await expect(host.startRound(info.sessionId, { betMinor: 1_00 })).resolves.toBeTruthy();
  });

  it('settles a due round whose settlement write failed earlier', async () => {
    const { clock, store, host } = setup();
    const info = await host.createSession(10_00);
    const { round } = await host.startRound(info.sessionId, { betMinor: 1_00 });
    clock.t += 61_000;
    store.failSettle = 1;
    await expect(host.getRound(info.sessionId, round.id)).rejects.toThrow('settle failed');
    const stats = await host.reconcile();
    expect(stats.settled + stats.voided).toBe(1);
    expect((await store.getRound(round.id))!.settlement).not.toBeNull();
    expect(await store.listPending(10)).toEqual([]);
  });
});
