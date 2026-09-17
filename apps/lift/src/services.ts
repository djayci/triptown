import type { RoundService } from '@triptown/rgs-client';

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
    // The demo must play under this game's own id, as the API already does, or its rounds and recall
    // records are filed against the engine instead. The id resolves to the engine's certified config
    // ids, so this adds no maths and needs no report of its own.
    registerGame('the-lift', 'whack-crash');
    // Demo builds may pick a market profile, so the compliance checks can drive every market.
    const wanted = params.get('profile');
    const origins = [location.origin, ...(params.get('operatorOrigin') ? [params.get('operatorOrigin')!] : [])];
    const profile = wanted ? profileFromTemplate(wanted, origins) : undefined;
    const service = new MockRoundService({
      game: 'the-lift',
      // `allowOverride` is what lets a draft profile run at all. Without it the Nigeria and Ghana
      // profiles threw at boot, so the compliance checks could never reach them — the checks read
      // that as a client with no rounds rather than as a client that never started.
      ...(profile && { profiles: { defaultProfile: profile, allowOverride: true } }),
      // Nigeria gates play by region, and the operator is the one that supplies it. Without this the
      // session refuses every round with "the operator must send the player region for this market".
      playerRegion: params.get('region') ?? 'NG-LA',
      // A player in the market the profile describes, so its stakes and balance are the real ones.
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
