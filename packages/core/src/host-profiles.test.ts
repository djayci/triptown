import { deriveRound } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import { HostError, RoundHost, type ProfileSettings } from './host';
import { profileFromTemplate, registerGame, type GameId } from './profiles';
import { MemoryRoundStore } from './store';

// The split-stake code path still ships, but its only config belongs to a retired game. Tests register
// that game explicitly to exercise the path; no shipped profile has it registered (design D1, D2).
registerGame('paper-route');


const clock = { t: 1_700_000_000_000, now() { return this.t; } };
const sleep = async () => {};
const ORIGIN = ['https://casino.example'];

function host(profiles: ProfileSettings, game: GameId = 'whack-crash') {
  const store = new MemoryRoundStore();
  return { store, host: new RoundHost({ store, clock, sleep, profiles, game }) };
}

describe('profile binding (1.5)', () => {
  it('binds the default profile and exposes it with the effective config', async () => {
    const { host: h } = host({ defaultProfile: profileFromTemplate('regulated-uk', ORIGIN) });
    const info = await h.createSession(100_00);
    expect(info.profile.name).toBe('regulated-uk');
    expect(info.config.id).toBe('whack-crash/v1-rising');
  });

  it('binds an operator profile by operator id and rejects unknown operators', async () => {
    const { host: h } = host({
      defaultProfile: profileFromTemplate('light'),
      operators: { acme: profileFromTemplate('regulated-on', ORIGIN) },
    });
    expect((await h.createSession(100_00, { operatorId: 'acme' })).profile.name).toBe('regulated-on');
    await expect(h.createSession(100_00, { operatorId: 'nope' })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('refuses profile overrides unless the dev override is on', async () => {
    const prod = host({ defaultProfile: profileFromTemplate('light') }).host;
    const err = await prod.createSession(100_00, { profile: 'regulated-uk' }).catch((e) => e);
    expect(err).toBeInstanceOf(HostError);
    expect(err).toMatchObject({ code: 'profile_not_allowed' });
    const dev = host({ defaultProfile: profileFromTemplate('light'), allowOverride: true }).host;
    expect((await dev.createSession(100_00, { profile: 'pt-draft' })).config.id).toBe('whack-crash/v1-rising+cap100');
  });

  it('refuses draft or origin-less regulated profiles without the override', () => {
    expect(() => host({ defaultProfile: profileFromTemplate('pt-draft', ORIGIN) })).toThrow(/draft/);
    expect(() => host({ defaultProfile: profileFromTemplate('regulated-uk') })).toThrow(/operatorOrigins/);
  });

  it('gates profiles on the RTP report index', () => {
    expect(() => host({ defaultProfile: profileFromTemplate('regulated-uk', ORIGIN), reportIndex: {} })).toThrow(/no passing RTP report/);
  });

  it('rising profiles produce rounds without setbacks', async () => {
    const { host: h, store } = host({ defaultProfile: profileFromTemplate('regulated-uk', ORIGIN) });
    const info = await h.createSession(1_000_00);
    for (let i = 0; i < 40; i++) {
      const { round } = await h.startRound(info.sessionId, { betMinor: 1_00 });
      expect(round.config.lambda).toBe(0);
      expect(round.outcome.setbacks).toEqual([]);
      clock.t += 120_000;
      await h.getRound(info.sessionId, round.id);
    }
    const session = (await store.getSession(info.sessionId))!;
    // The same seeds under the halving config would have produced setbacks in some rounds.
    const withSetbacks = Array.from({ length: 40 }, (_, nonce) =>
      deriveRound({ serverSeed: session.serverSeed, clientSeed: session.clientSeed, nonce }, profileFromTemplate('light') && h.configFor(profileFromTemplate('light'))),
    ).filter((o) => o.setbacks.length > 0).length;
    expect(withSetbacks).toBeGreaterThan(0);
  });

  it('works for paper-route configs too', async () => {
    const { host: h } = host({ defaultProfile: profileFromTemplate('regulated-uk', ORIGIN) }, 'paper-route');
    const info = await h.createSession(100_00);
    expect(info.config).toMatchObject({ id: 'paper-route/v1-rising', stakeParts: 5, lambda: 0 });
  });
});

describe('minimum cash-out at the host (1.6)', () => {
  it('throws below_min_cashout and keeps the round running', async () => {
    const profile = { ...profileFromTemplate('light'), minCashout: 5 };
    const { host: h } = host({ defaultProfile: profile });
    const info = await h.createSession(100_00);
    // Find a round that lasts long enough.
    let roundId = '';
    for (let i = 0; i < 50 && !roundId; i++) {
      const { round } = await h.startRound(info.sessionId, { betMinor: 1_00 });
      if (round.outcome.crashTime > 2) roundId = round.id;
      else {
        clock.t += 120_000;
        await h.getRound(info.sessionId, round.id);
      }
    }
    clock.t += 500;
    await expect(h.cashout(info.sessionId, roundId)).rejects.toMatchObject({ code: 'below_min_cashout' });
    expect((await h.getRound(info.sessionId, roundId)).status).toBe('running');
    await expect(h.startRound(info.sessionId, { betMinor: 1_00, autoCashout: 2 })).rejects.toMatchObject({ code: 'invalid_auto_cashout' });
  });
});

describe('kill switch (1.7)', () => {
  it('blocks new rounds for a game, config or profile while running rounds settle', async () => {
    const { host: h } = host({ defaultProfile: profileFromTemplate('light') });
    const info = await h.createSession(100_00);
    let running = '';
    for (let i = 0; i < 50 && !running; i++) {
      const { round } = await h.startRound(info.sessionId, { betMinor: 1_00 });
      // No early setback, so the value at 1 s is above the light profile's x1.01 minimum cash-out.
      if (round.outcome.crashTime > 3 && (round.outcome.setbacks[0] ?? 99) > 2) running = round.id;
      else {
        clock.t += 120_000;
        await h.getRound(info.sessionId, round.id);
      }
    }
    await h.setKillSwitch('game:whack-crash', true);
    clock.t += 1_000;
    const result = await h.cashout(info.sessionId, running);
    expect(['won', 'crashed']).toContain(result.result);
    await expect(h.startRound(info.sessionId, { betMinor: 1_00 })).rejects.toMatchObject({ code: 'game_disabled' });
    await h.setKillSwitch('game:whack-crash', false);
    await h.setKillSwitch('config:whack-crash/v2', true);
    await expect(h.startRound(info.sessionId, { betMinor: 1_00 })).rejects.toMatchObject({ code: 'game_disabled' });
    await h.setKillSwitch('config:whack-crash/v2', false);
    await h.setKillSwitch('profile:light', true);
    await expect(h.startRound(info.sessionId, { betMinor: 1_00 })).rejects.toMatchObject({ code: 'game_disabled' });
    await h.setKillSwitch('profile:light', false);
    clock.t += 5_000; // past the minimum game cycle
    await expect(h.startRound(info.sessionId, { betMinor: 1_00 })).resolves.toBeTruthy();
    await expect(h.setKillSwitch('everything', true)).rejects.toThrow(/Invalid kill switch/);
  });
});

describe('player lock and minimum game cycle (2.1, 2.2)', () => {
  it('locks one active round per player across sessions', async () => {
    const { host: h } = host({ defaultProfile: profileFromTemplate('light'), operators: { acme: profileFromTemplate('regulated-uk', ORIGIN) } });
    const phone = await h.createSession(100_00, { operatorId: 'acme', playerId: 'player-7' });
    const laptop = await h.createSession(100_00, { operatorId: 'acme', playerId: 'player-7' });
    for (let i = 0; i < 50; i++) {
      const { round } = await h.startRound(phone.sessionId, { betMinor: 1_00 });
      if (round.outcome.crashTime > 5) {
        await expect(h.startRound(laptop.sessionId, { betMinor: 1_00 })).rejects.toMatchObject({ code: 'round_in_progress' });
        return;
      }
      clock.t += 120_000;
      await h.getRound(phone.sessionId, round.id);
    }
    throw new Error('no long round found');
  });

  it('rejects a start 1.2 s after an instant bust with about 3.8 s remaining, then accepts at 5 s', async () => {
    const { host: h, store } = host({ defaultProfile: profileFromTemplate('regulated-uk', ORIGIN) });
    const info = await h.createSession(100_00);
    const session = (await store.getSession(info.sessionId))!;
    for (let i = 0; i < 5000; i++) {
      const clientSeed = `bust-${i}`;
      const o = deriveRound({ serverSeed: session.serverSeed, clientSeed, nonce: session.nonce }, h.configFor(info.profile));
      if (o.crashTime === 0) {
        await h.setClientSeed(info.sessionId, clientSeed);
        break;
      }
    }
    const started = clock.t;
    const { round } = await h.startRound(info.sessionId, { betMinor: 1_00 });
    expect(round.outcome.crashTime).toBe(0);
    clock.t = started + 1200;
    const err = await h.startRound(info.sessionId, { betMinor: 1_00 }).catch((e) => e);
    expect(err).toMatchObject({ code: 'cycle_too_soon' });
    expect((err as HostError).details?.retryAfterMs).toBe(3800);
    clock.t = started + 5000;
    await expect(h.startRound(info.sessionId, { betMinor: 1_00 })).resolves.toBeTruthy();
  });

  it('does not charge the pacing clock when the bet fails', async () => {
    const { host: h } = host({ defaultProfile: profileFromTemplate('light'), operators: { acme: profileFromTemplate('regulated-uk', ORIGIN) } });
    const info = await h.createSession(50, { operatorId: 'acme', playerId: 'p1' });
    await expect(h.startRound(info.sessionId, { betMinor: 1_00 })).rejects.toMatchObject({ code: 'insufficient_funds' });
    const rich = await h.createSession(100_00, { operatorId: 'acme', playerId: 'p1' });
    await expect(h.startRound(rich.sessionId, { betMinor: 1_00 })).resolves.toBeTruthy();
  });
});
