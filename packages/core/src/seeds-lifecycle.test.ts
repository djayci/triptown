import { commitServerSeed, verifyRound } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { RoundHost } from './host';
import { profileFromTemplate } from './profiles';
import { redactSeeds } from './seed-cipher';
import { MemoryRoundStore } from './store';

const unpaced = { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } };

function setup(seedRotation?: { maxRounds?: number; maxAgeMs?: number }) {
  const clock = { t: 1_700_000_000_000, now() { return this.t; } };
  const store = new MemoryRoundStore();
  const host = new RoundHost({ store, clock, sleep: async () => {}, profiles: unpaced, seedRotation });
  return { clock, store, host };
}

async function playAndSettle(h: RoundHost, clock: { t: number }, sessionId: string) {
  const { round } = await h.startRound(sessionId, { betMinor: 20 });
  clock.t += 61_000;
  return h.getRound(sessionId, round.id);
}

describe('automatic seed rotation (3.2)', () => {
  it('rotates after 1,000 rounds: round 1,001 uses a new commit published first, and the revealed seed verifies earlier rounds', async () => {
    const { clock, host } = setup();
    const info = await host.createSession(1_000_000_00);
    const firstCommit = info.commit;
    const early = [];
    for (let i = 0; i < 1000; i++) {
      const snap = await playAndSettle(host, clock, info.sessionId);
      if (i < 3 || i === 999) early.push(snap);
      expect(snap.commit).toBe(firstCommit);
    }
    // Rotated at the 1,000th settlement: visible before the next bet.
    const after = await host.sessionInfo(info.sessionId);
    expect(after.commit).not.toBe(firstCommit);
    expect(after.nonce).toBe(0);
    const revealed = (await host.revealedSeeds(info.sessionId))[0]!;
    expect(revealed).toMatchObject({ commit: firstCommit, roundsPlayed: 1000, auto: true });
    expect(commitServerSeed(revealed.serverSeed)).toBe(firstCommit);

    const next = await playAndSettle(host, clock, info.sessionId);
    expect(next.commit).toBe(after.commit);
    expect(next.nonce).toBe(0);

    for (const snap of early) {
      const v = verifyRound({ serverSeed: revealed.serverSeed, clientSeed: snap.clientSeed, nonce: snap.nonce, commit: snap.commit, config: host.config });
      expect(v.verified).toBe(true);
      expect(v.crashTime).toBe(snap.settlement!.crashTime);
    }
  }, 60_000);

  it('rotates on age when the session is touched after 24 h', async () => {
    const { clock, host } = setup();
    const info = await host.createSession(100_00);
    await playAndSettle(host, clock, info.sessionId);
    clock.t += 24 * 60 * 60 * 1000;
    const touched = await host.sessionInfo(info.sessionId);
    expect(touched.commit).not.toBe(info.commit);
    expect((await host.revealedSeeds(info.sessionId))[0]).toMatchObject({ auto: true, roundsPlayed: 1 });
  });

  it('keeps only the last 20 revealed seeds', async () => {
    const { host } = setup();
    const info = await host.createSession(100_00);
    for (let i = 0; i < 25; i++) await host.rotateSeed(info.sessionId);
    const list = await host.revealedSeeds(info.sessionId);
    expect(list).toHaveLength(20);
    expect(list.every((r) => r.auto === false)).toBe(true);
  });
});

describe('seed redaction (3.3)', () => {
  it('redacts hex seeds in nested log data', () => {
    const seed = 'ab'.repeat(32);
    expect(redactSeeds({ msg: `failed for ${seed}`, nested: [{ serverSeed: seed }], n: 1 })).toEqual({
      msg: 'failed for [redacted-seed]',
      nested: [{ serverSeed: '[redacted-seed]' }],
      n: 1,
    });
  });
});
