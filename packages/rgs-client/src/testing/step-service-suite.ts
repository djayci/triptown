import { describe, expect, it } from 'vitest';
import type { StepRoundService } from '../steps';
import { StepServiceError } from '../steps';

// Shared integration suite for any StepRoundService (demo mock and live API client).
// Fence results are random; `force` makes the next round refuse where a scenario needs it.

const STAKE = 1_00;

export interface StepSuiteOptions {
  /** Forces the next round's refusal fence (null = clears every fence). */
  force: (service: StepRoundService, refuseAt: number | null) => void | Promise<void>;
  /** A service whose profile has a minimum cycle ≥ 1 s, for the cycle_too_soon check. */
  makePacedService?: () => Promise<StepRoundService>;
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof StepServiceError && e.code === code);
}

export function stepServiceSuite(name: string, makeService: () => Promise<StepRoundService>, opts: StepSuiteOptions) {
  describe(`StepRoundService integration: ${name}`, () => {
    it('debits once at start and hides fence results', async () => {
      const s = await makeService();
      const before = (await s.getSession()).balanceMinor;
      const { round, balanceMinor } = await s.startStepRound({ stakeMinor: STAKE, difficulty: 'medium' });
      expect(balanceMinor).toBe(before - STAKE);
      expect(round).toMatchObject({ status: 'running', cleared: 0, nextMultiplier: 1.21, currentMultiplier: null });
      expect(JSON.stringify(round)).not.toMatch(/refusedAt|outcome|serverSeed/);
    });

    it('clears fences and pays a collect once', async () => {
      const s = await makeService();
      await opts.force(s, null);
      const before = (await s.getSession()).balanceMinor;
      const { round } = await s.startStepRound({ stakeMinor: STAKE, difficulty: 'medium' });
      for (let i = 0; i < 4; i++) await s.jump(round.id);
      const key = 'collect-key-0001';
      const first = await s.collect(round.id, key);
      const again = await s.collect(round.id, key);
      expect(first.round.settlement).toMatchObject({ status: 'collected', multiplier: 2.37, payoutMinor: 237, result: 'win' });
      expect(again.balanceMinor).toBe(before - STAKE + 237);
      await expectCode(s.jump(round.id), 'round_not_running');
    });

    it('ends on a refusal with nothing paid and no later fences shown', async () => {
      const s = await makeService();
      await opts.force(s, 3);
      const before = (await s.getSession()).balanceMinor;
      const { round } = await s.startStepRound({ stakeMinor: STAKE, difficulty: 'medium' });
      await s.jump(round.id);
      await s.jump(round.id);
      const refused = await s.jump(round.id);
      expect(refused.action).toMatchObject({ fence: 3, result: 'refused' });
      expect(refused.round.settlement).toMatchObject({ status: 'lost', payoutMinor: 0, result: 'loss' });
      expect(refused.round.actions).toHaveLength(3);
      expect(refused.balanceMinor).toBe(before - STAKE);
    });

    it('collects the top prize at the finish line', async () => {
      const s = await makeService();
      await opts.force(s, null);
      const { round } = await s.startStepRound({ stakeMinor: STAKE, difficulty: 'easy' });
      let last;
      for (let i = 0; i < 10; i++) last = await s.jump(round.id);
      expect(last!.round.settlement).toMatchObject({ status: 'finished', multiplier: 2.78, payoutMinor: 278 });
    });

    it('applies a repeated jump key once and refuses an early collect', async () => {
      const s = await makeService();
      await opts.force(s, null);
      const { round } = await s.startStepRound({ stakeMinor: STAKE, difficulty: 'medium' });
      await expectCode(s.collect(round.id), 'nothing_to_collect');
      const a = await s.jump(round.id, 'jump-key-00001');
      const b = await s.jump(round.id, 'jump-key-00001');
      expect(a.round.cleared).toBe(1);
      expect(b.round.cleared).toBe(1);
      expect((await s.activeStepRound())?.id).toBe(round.id);
    });

    it('lists history newest first', async () => {
      const s = await makeService();
      await opts.force(s, 1);
      const { round } = await s.startStepRound({ stakeMinor: STAKE, difficulty: 'hard' });
      await s.jump(round.id);
      const history = await s.stepHistory(5);
      expect(history[0]).toMatchObject({ id: round.id, status: 'lost' });
    });

    if (opts.makePacedService) {
      it('enforces the minimum gap between round starts', async () => {
        const s = await opts.makePacedService!();
        await opts.force(s, 1);
        const { round } = await s.startStepRound({ stakeMinor: STAKE, difficulty: 'medium' });
        await s.jump(round.id);
        await expectCode(s.startStepRound({ stakeMinor: STAKE, difficulty: 'medium' }), 'cycle_too_soon');
      });
    }
  });
}
