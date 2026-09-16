import type { RoundService } from '@triptown/rgs-client';

export const DEMO = import.meta.env.VITE_DEMO === 'true';

/** Picks the round backend. The mock is only reachable in demo builds, so production bundles drop it. */
export async function createRoundService(): Promise<RoundService> {
  if (import.meta.env.VITE_DEMO === 'true') {
    const [{ MockRoundService }, { profileFromTemplate }] = await Promise.all([import('@triptown/rgs-client/mock'), import('@triptown/core')]);
    const params = new URLSearchParams(location.search);
    // Demo only: preview the game under any profile template (drafts included) with `?profile=`.
    const profile = params.get('profile');
    // Demo only: an embedding sandbox names itself as the operator so the bridge can be exercised.
    const operatorOrigin = params.get('operatorOrigin');
    const origins = operatorOrigin && /^https?:\/\/[\w.:-]+$/.test(operatorOrigin) ? [operatorOrigin] : [location.origin];
    const service = new MockRoundService({
      game: 'paper-route',
      profiles: { defaultProfile: profileFromTemplate(profile ?? 'light', origins), allowOverride: true },
    });
    const force = params.get('force');
    if (force) service.forceNext(force as Parameters<typeof service.forceNext>[0]);
    return service;
  }
  const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!baseUrl) throw new Error('VITE_API_URL is not set');
  const { RemoteRoundService, browserTokenStorage } = await import('@triptown/rgs-client/remote');
  return new RemoteRoundService({ baseUrl, game: 'paper-route', tokenStorage: browserTokenStorage('triptown.paper-route.session.v1') });
}
