import type { RoundService } from '@triptown/rgs-client';

export const GAME_ID = 'cable-car';
export const DEMO = import.meta.env.VITE_DEMO === 'true';

/**
 * Starting stake for a demo build, from `?bet=`, so the shared compliance checks can play at the
 * market's minimum. Never read in production: the operator sets the stake there.
 */
export function demoBetMinor(): number | undefined {
  if (!DEMO) return undefined;
  const raw = new URLSearchParams(location.search).get('bet');
  const minor = raw === null ? NaN : Number(raw);
  return Number.isInteger(minor) && minor > 0 ? minor : undefined;
}

/** Picks the round backend. The mock is only reachable in demo builds, so production bundles drop it. */
export async function createRoundService(): Promise<RoundService> {
  if (import.meta.env.VITE_DEMO === 'true') {
    const { MockRoundService } = await import('@triptown/rgs-client/mock');
    const { GHS_CURRENCY, NGN_CURRENCY, profileFromTemplate, registerGame } = await import('@triptown/core');
    const params = new URLSearchParams(location.search);
    // Registered with its reveal modes so the host resolves this game's rounds, not the engine's.
    // The reveal is opt-in per game AND per market: a profile that permits a deferred reveal does
    // not make a game deferred, and a game that supports one is still live on a market that does not.
    registerGame(GAME_ID, 'whack-crash', { reveal: ['onCollect'] });
    const wanted = params.get('profile');
    const origins = [location.origin, ...(params.get('operatorOrigin') ? [params.get('operatorOrigin')!] : [])];
    const profile = wanted ? profileFromTemplate(wanted, origins) : undefined;
    const service = new MockRoundService({
      game: GAME_ID,
      // `allowOverride` is what lets a draft profile run at all, and `playerRegion` is what stops
      // Nigeria refusing every round. The Lift shipped without either, so no compliance check ever
      // reached a regulated market for it, and the checks read that as a client with no rounds.
      ...(profile && { profiles: { defaultProfile: profile, allowOverride: true } }),
      playerRegion: params.get('region') ?? 'NG-LA',
      ...(wanted === 'ng-draft' && { currency: NGN_CURRENCY, initialBalanceMinor: 100_000_00 }),
      ...(wanted === 'gh-draft' && { currency: GHS_CURRENCY, initialBalanceMinor: 5_000_00 }),
    });
    const force = params.get('force');
    if (force) service.forceNext(force as Parameters<typeof service.forceNext>[0]);
    return service;
  }
  const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!baseUrl) throw new Error('VITE_API_URL is not set');
  const { RemoteRoundService, browserTokenStorage } = await import('@triptown/rgs-client/remote');
  return new RemoteRoundService({ baseUrl, tokenStorage: browserTokenStorage() });
}
