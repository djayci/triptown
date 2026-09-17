import { verifyRound } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { RoundHost } from './host';
import { profileFromTemplate, type JurisdictionProfile } from './profiles';
import { MemoryRoundStore } from './store';
import { describeRules } from './rules';
import { DEFAULT_CURRENCY } from './money';

// Practice rounds (practice-rounds): a round with no stake, same maths, recorded like any other.
//
// The load-bearing property is the nonce. A practice round that does not consume one would leave the
// next staked round on the nonce the player has just watched play out — not an information leak but a
// solved game, and indistinguishable from an honest build until someone exploits it. These tests assert
// that directly rather than inferring it from the round working.

const practiceProfile: JurisdictionProfile = { ...profileFromTemplate('light'), practiceRounds: true, minCycleMs: 0 };
// A market with practice rounds off. `light` now offers them, so this uses a regulated template, which
// is where the flag must stay absent.
const plainProfile: JurisdictionProfile = { ...profileFromTemplate('regulated-uk', ['https://op.example']), minCycleMs: 0 };

function setup(profile = practiceProfile) {
  const clock = { t: 1_700_000_000_000, now() { return this.t; } };
  const store = new MemoryRoundStore();
  const host = new RoundHost({ store, clock, sleep: async () => {}, profiles: { defaultProfile: profile } });
  return { clock, store, host };
}

describe('practice rounds consume randomness like any other round (1.3)', () => {
  it('advances the nonce by exactly what a staked round advances it by', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);

    const before = (await s.store.getSession(info.sessionId))!.nonce;
    await s.host.startRound(info.sessionId, { betMinor: 0, practice: true });
    const afterPractice = (await s.store.getSession(info.sessionId))!.nonce;
    s.clock.t += 120_000;

    await s.host.startRound(info.sessionId, { betMinor: 1_00 });
    const afterStaked = (await s.store.getSession(info.sessionId))!.nonce;

    expect(afterPractice - before).toBe(1);
    expect(afterStaked - afterPractice).toBe(afterPractice - before);
  });

  it('a practice round tells the player nothing about the next round', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);

    const { round: practice } = await s.host.startRound(info.sessionId, { betMinor: 0, practice: true });
    s.clock.t += 120_000;
    const { round: staked } = await s.host.startRound(info.sessionId, { betMinor: 1_00 });

    // Different nonces, so the outcomes are independent draws. If a practice round reused or peeked at
    // a nonce these would match, and a player could watch a round free and then stake on it.
    expect(practice.seeds.nonce).not.toBe(staked.seeds.nonce);
    expect(staked.seeds.nonce).toBe(practice.seeds.nonce + 1);
  });

  it('is verifiable after the fact exactly as a staked round is', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);
    const { round } = await s.host.startRound(info.sessionId, { betMinor: 0, practice: true });

    // Re-derive the outcome from the recorded seeds and config, the way the public verifier does. A
    // practice round carries the same evidence as a staked one or it is not really the same round.
    const check = verifyRound({
      serverSeed: round.seeds.serverSeed,
      clientSeed: round.seeds.clientSeed,
      nonce: round.seeds.nonce,
      commit: round.commit,
      config: round.config,
    });
    expect(check.verified).toBe(true);
    expect(check.crashTime).toBe(round.outcome.crashTime);
  });
});

describe('practice rounds take no money (1.2)', () => {
  it('leaves the balance unchanged at start and at settlement', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);

    const start = await s.host.startRound(info.sessionId, { betMinor: 0, practice: true });
    expect(start.balanceMinor).toBe(100_00);
    expect(await s.store.getBalance(info.sessionId)).toBe(100_00);

    s.clock.t += 120_000;
    const snap = await s.host.getRound(info.sessionId, start.round.id);
    expect(snap.status).not.toBe('running');
    expect(await s.store.getBalance(info.sessionId)).toBe(100_00);
  });

  it('records the round as practice with a zero stake, not as an absent stake', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);
    const { round } = await s.host.startRound(info.sessionId, { betMinor: 0, practice: true });

    const stored = (await s.store.getRound(round.id))!;
    expect(stored.practice).toBe(true);
    expect(stored.betMinor).toBe(0);
    // A practice round took no debit, so the balance did not move across the start.
    expect(stored.balanceBeforeMinor).toBe(100_00);

    const snap = await s.host.getRound(info.sessionId, round.id);
    expect(snap.practice).toBe(true);
    expect(snap.betMinor).toBe(0);
  });
});

describe('practice rounds are refused where they are not allowed (1.1, 1.4)', () => {
  it('refuses a practice round under a profile that does not permit one, consuming nothing', async () => {
    const s = setup(plainProfile);
    const info = await s.host.createSession(100_00);
    const before = (await s.store.getSession(info.sessionId))!.nonce;

    await expect(s.host.startRound(info.sessionId, { betMinor: 0, practice: true })).rejects.toThrow(/not available/i);

    // Refused before anything was taken: no nonce, no round, no balance movement.
    expect((await s.store.getSession(info.sessionId))!.nonce).toBe(before);
    expect(await s.store.getBalance(info.sessionId)).toBe(100_00);
    expect(await s.host.history(info.sessionId, 10)).toHaveLength(0);
  });

  it('refuses a practice round that carries a stake rather than silently dropping it', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);

    await expect(s.host.startRound(info.sessionId, { betMinor: 1_00, practice: true })).rejects.toThrow(/cannot carry a stake/i);
    expect(await s.store.getBalance(info.sessionId)).toBe(100_00);
  });

  it('still rejects a zero stake on a staked round', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);
    // validateBet must keep refusing this: loosening it to admit zero would let every staked path
    // start a free round by omission.
    await expect(s.host.startRound(info.sessionId, { betMinor: 0 })).rejects.toThrow();
  });
});

describe('practice rounds obey the market pacing (3.3, 4.4)', () => {
  it('is subject to the same minimum gap as a staked round', async () => {
    const s = setup({ ...practiceProfile, minCycleMs: 5_000 });
    const info = await s.host.createSession(100_00);

    const first = await s.host.startRound(info.sessionId, { betMinor: 1_00 });
    s.clock.t += 120_000;
    await s.host.getRound(info.sessionId, first.round.id);

    // Settled, but inside the gap: a practice round must not be a way to fill the enforced wait.
    s.clock.t = first.round.startedAt + 1_000;
    await expect(s.host.startRound(info.sessionId, { betMinor: 0, practice: true })).rejects.toThrow(/wait/i);

    s.clock.t = first.round.startedAt + 5_001;
    const practice = await s.host.startRound(info.sessionId, { betMinor: 0, practice: true });
    expect(practice.round.startedAt - first.round.startedAt).toBeGreaterThanOrEqual(5_000);
  });
});

describe('the rules describe practice rounds only where they exist (2.5)', () => {
  it('states no stake, no payout and identical odds when the market offers them', async () => {
    const s = setup();
    const info = await s.host.createSession(100_00);
    const item = describeRules(info.config, practiceProfile, DEFAULT_CURRENCY).find((i) => i.key === 'practiceRounds');
    expect(item).toBeDefined();
    expect(item!.params).toEqual({ stake: 0, payout: 0, sameOdds: true });
  });

  it('says nothing about them where the market does not', async () => {
    const s = setup(plainProfile);
    const info = await s.host.createSession(100_00);
    const keys = describeRules(info.config, plainProfile, DEFAULT_CURRENCY).map((i) => i.key);
    expect(keys).not.toContain('practiceRounds');
  });
});


describe('only unregulated markets ship practice rounds (2.2)', () => {
  it('light offers them and every regulated template does not', () => {
    expect(profileFromTemplate('light').practiceRounds).toBe(true);
    for (const name of ['regulated-uk', 'regulated-on', 'regulated-br']) {
      // Free play is advertising in these markets, with obligations a gameplay flag cannot answer.
      expect(profileFromTemplate(name, ['https://op.example']).practiceRounds).toBeUndefined();
    }
  });
});
