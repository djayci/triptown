import type { RoundService } from '@triptown/rgs-client';

export const DEMO = import.meta.env.VITE_DEMO === 'true';

/** Picks the round backend. The mock is only reachable in demo builds, so production bundles drop it. */
export async function createRoundService(): Promise<RoundService> {
  if (import.meta.env.VITE_DEMO === 'true') {
    const { MockRoundService } = await import('@triptown/rgs-client/mock');
    const { profileFromTemplate } = await import('@triptown/core');
    const params = new URLSearchParams(location.search);
    // Demo builds may pick a market profile, so the compliance checks can drive every market.
    const wanted = params.get('profile');
    const origins = [location.origin, ...(params.get('operatorOrigin') ? [params.get('operatorOrigin')!] : [])];
    const profile = wanted ? profileFromTemplate(wanted, origins) : undefined;
    const service = new MockRoundService(profile ? { profiles: { defaultProfile: profile } } : {});
    const force = params.get('force');
    if (force) service.forceNext(force as Parameters<typeof service.forceNext>[0]);
    return service;
  }
  const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!baseUrl) throw new Error('VITE_API_URL is not set');
  const { RemoteRoundService, browserTokenStorage } = await import('@triptown/rgs-client/remote');
  return new RemoteRoundService({ baseUrl, tokenStorage: browserTokenStorage() });
}
