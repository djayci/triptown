import { profileFromTemplate } from '@triptown/core';
import type { StepRoundService } from '@triptown/rgs-client/steps';

export const DEMO = import.meta.env.VITE_DEMO === 'true';

/** Picks the step round backend. The mock is only reachable in demo builds, so production bundles drop it. */
export async function createStepService(): Promise<StepRoundService> {
  if (import.meta.env.VITE_DEMO === 'true') {
    const { MockStepRoundService } = await import('@triptown/rgs-client/steps-mock');
    const params = new URLSearchParams(location.search);
    // Night Gallop draft profiles are rising-only with a 5 s gap; regulated-uk has that shape until
    // ng-draft and gh-draft land in core (tasks 5.2-5.3).
    const service = new MockStepRoundService({
      profile: profileFromTemplate('regulated-uk', [location.origin]),
      latencyMs: Number(params.get('latency') ?? 120),
      abandonAfterMs: 60_000,
    });
    const force = params.get('force');
    if (force !== null) service.forceNext({ refuseAt: force === 'finish' ? null : Number(force) });
    Object.assign(window, { __gallopForce: (refuseAt: number | null) => service.forceNext({ refuseAt }) });
    return service;
  }
  const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!baseUrl) throw new Error('VITE_API_URL is not set');
  const [{ RemoteStepRoundService }, { browserTokenStorage }] = await Promise.all([
    import('@triptown/rgs-client/steps-remote'),
    import('@triptown/rgs-client/remote'),
  ]);
  return new RemoteStepRoundService({ baseUrl, tokenStorage: browserTokenStorage('triptown.gallop.session.v1') });
}
