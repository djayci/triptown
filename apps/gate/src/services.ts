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
    const { DEFAULT_CURRENCY, profileFromTemplate, registerGame } = await import('@triptown/core');
    // The mock runs the real round host in the page, so the game registers on its engine here too.
    registerGame('beat-the-gate', 'whack-crash', { reveal: ['onCollect'] });
    const params = new URLSearchParams(location.search);
    // Demo defaults to the Nigeria draft profile; `?profile=` picks another market for the checks.
    const wanted = params.get('profile') ?? 'ng-draft';
    const origins = [location.origin, ...(params.get('operatorOrigin') ? [params.get('operatorOrigin')!] : [])];
    // The demo shows the Candy Paddock look under every market while the art direction is explored
    // (17 Sep 2026); `?skin=adult` shows Adult Sticker. The draft profiles themselves still ask for the
    // adult skin, and that is what a regulated build ships until the market decision changes.
    const skin = params.get('skin') === 'adult' ? 'adult' : 'candy';
    const demoProfile = { ...profileFromTemplate(wanted, origins), skin } as const;
    // A Lagos player, so the Nigeria draft's region gate is exercised. Prices are in USD for now, on every
    // market, until the operator's local-currency stakes are settled.
    const service = new MockRoundService({
      game: 'beat-the-gate',
      profiles: { defaultProfile: demoProfile, allowOverride: true },
      playerRegion: params.get('region') ?? 'NG-LA',
      currency: DEFAULT_CURRENCY,
      initialBalanceMinor: 1_000_00,
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
