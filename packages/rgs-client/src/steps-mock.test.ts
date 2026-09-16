import { profileFromTemplate } from '@triptown/core';
import { describe, expect, it } from 'vitest';
import { MOCK_BUILD_MARKER } from './mock';
import { MockStepRoundService } from './steps-mock';
import { stepServiceSuite } from './testing/step-service-suite';

const make = async () => new MockStepRoundService({ profile: { ...profileFromTemplate('regulated-uk', ['https://op.test']), minCycleMs: 0 } });

stepServiceSuite('MockStepRoundService', make, {
  force: (s, refuseAt) => (s as MockStepRoundService).forceNext({ refuseAt }),
  makePacedService: async () => new MockStepRoundService({ profile: profileFromTemplate('regulated-uk', ['https://op.test']) }),
});

describe('MockStepRoundService', () => {
  it('sets the mock build marker and forces a refusal at fence 3', async () => {
    const s = await make();
    expect((globalThis as Record<string, unknown>)[MOCK_BUILD_MARKER]).toBe(true);
    s.forceNext({ refuseAt: 3 });
    const { round } = await s.startStepRound({ stakeMinor: 100, difficulty: 'medium' });
    expect((await s.jump(round.id)).action?.result).toBe('cleared');
    expect((await s.jump(round.id)).action?.result).toBe('cleared');
    expect((await s.jump(round.id)).action?.result).toBe('refused');
  });
});
