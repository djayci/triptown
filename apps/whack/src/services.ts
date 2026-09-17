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
    const { profileFromTemplate } = await import('@triptown/core');
    const params = new URLSearchParams(location.search);
    // Demo builds may pick a market profile, so the compliance checks can drive every market.
    const wanted = params.get('profile');
    const origins = [location.origin, ...(params.get('operatorOrigin') ? [params.get('operatorOrigin')!] : [])];
    const base = wanted ? profileFromTemplate(wanted, origins) : undefined;
    // Demo builds only: lets the compliance checks exercise practice rounds on a market that has them
    // switched off, without inventing a profile the repo does not ship.
    const profile =
      params.get('practice') === 'on'
        ? { ...(base ?? profileFromTemplate('light', origins)), practiceRounds: true }
        : base;
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
