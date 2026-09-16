import type { GameConfig } from '@triptown/fairness';
import type { CurrencyRules } from './money';
import type { JurisdictionProfile } from './profiles';

// Rules and help content as structured items (compliance-baseline 6.1, design D9). Values are raw numbers
// straight from the config, profile and currency; clients format and translate them through a catalogue,
// so the certified rules text for every game comes from this one tested function.

export type RuleParam = number | string | boolean;

export interface RuleItem {
  key: string;
  params: Record<string, RuleParam>;
}

/** Optional figures that come from reports rather than config (e.g. the rounding band at the minimum stake). */
export interface RulesExtras {
  /** Worst-case RTP band at the minimum stake after rounding, as fractions (e.g. 0.9463, 0.9937). */
  roundingBand?: { minRtp: number; maxRtp: number; stakeMinor: number };
}

export function describeRules(config: GameConfig, profile: JurisdictionProfile, currency: CurrencyRules, extras: RulesExtras = {}): RuleItem[] {
  const setbacksOn = profile.setbacksMode !== 'off' && config.lambda > 0;
  const maxMultiplier = Math.min(config.maxWinMultiplier, profile.maxMultiplier);
  const papers = profile.partialCashout === 'papers' ? config.papers : 1;
  const items: RuleItem[] = [];
  const add = (key: string, params: Record<string, RuleParam> = {}) => items.push({ key, params });

  add('growth', { r0: config.r0, rmax: config.rmax, tRamp: config.tRamp });
  if (setbacksOn) add('setbacks', { ratePerSecond: config.lambda, factor: config.setbackFactor, warning: false });
  add('instantBust', { probability: 1 - config.rtp });
  add('rtp', {
    rtp: config.rtp,
    strategyIndependent: true,
    ...(extras.roundingBand && {
      bandMinRtp: extras.roundingBand.minRtp,
      bandMaxRtp: extras.roundingBand.maxRtp,
      bandStakeMinor: extras.roundingBand.stakeMinor,
    }),
  });
  add('maxMultiplier', { multiplier: maxMultiplier });
  add('tMax', { seconds: config.tMax });
  add('minCashout', { multiplier: profile.minCashout });
  if (papers > 1) {
    // Partial cash-out (Paper Route). Left out entirely when the profile turns it off (Portugal).
    add('papers', { count: papers });
    add('throwTiming', { judgedAt: 'serverReceive', graceMs: 0, all: true });
    add('minPaperValue', { minor: currency.minBetMinor, decimals: currency.decimals });
    add('roundRounding', { mode: 'halfUpOncePerRound' });
    add('wipeout', { unthrownLost: true });
    add('disconnectRemainingPapers', { policy: profile.disconnectPolicy });
    add('landingIsDecoration', {});
  }
  add('autoCashout', { minimum: Math.max(1.01, profile.minCashout), maximum: maxMultiplier, settlesRemainingPapers: papers > 1 });
  add('rounding', { mode: 'halfUpOncePerRound', minStakeMinor: currency.minBetMinor * papers, decimals: currency.decimals });
  if (setbacksOn) add('belowStakeReturns', { possible: true });
  if (profile.minCycleMs > 0) add('minCycle', { ms: profile.minCycleMs });
  add('latency', { judgedAt: 'serverReceive', graceMs: 0 });
  add('disconnect', { policy: profile.disconnectPolicy });
  add('voidRefund', {});
  add('provablyFair', {});
  add('outcomeFixed', {});
  return items;
}
