import type { RoundService } from '@triptown/rgs-client';

export const DEMO = import.meta.env.VITE_DEMO === 'true';

/** Picks the round backend. The mock is only reachable in demo builds, so production bundles drop it. */
export async function createRoundService(): Promise<RoundService> {
  if (import.meta.env.VITE_DEMO === 'true') {
    const { MockRoundService } = await import('@triptown/rgs-client/mock');
    const { GHS_CURRENCY, NGN_CURRENCY, profileFromTemplate, registerGame } = await import('@triptown/core');
    // The mock runs the real round host in the page, so the game registers on its engine here too.
    registerGame('beat-the-gate', 'whack-crash');
    const params = new URLSearchParams(location.search);
    // Demo defaults to the Nigeria draft profile; `?profile=` picks another market for the checks.
    const wanted = params.get('profile') ?? 'ng-draft';
    const origins = [location.origin, ...(params.get('operatorOrigin') ? [params.get('operatorOrigin')!] : [])];
    // A Lagos player with a naira balance, so the Nigeria draft's region gate and stakes are exercised.
    const service = new MockRoundService({
      game: 'beat-the-gate',
      profiles: { defaultProfile: profileFromTemplate(wanted, origins), allowOverride: true },
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
