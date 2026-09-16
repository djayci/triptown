// Monte Carlo RTP report for the Fence Run step configs.
// Usage: pnpm --filter @triptown/steps simulate -- --rounds 10000000 --seed 1
// Every strategy is evaluated on the same simulated fences per round (common random numbers).
// Writes reports/rtp-fence-run-v1.{md,json}: theoretical RTP per stop, measured RTP per strategy, and the
// rounding band at small stakes (payout rounded half-up once per round).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { payoutMinor } from '@triptown/core';
import { createPrng } from '@triptown/fairness';
import { DIFFICULTIES, STEP_CONFIGS, clearChance, reachChance, validateStepConfig, type StepConfig } from '../src/config';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const args = new Map<string, string>();
for (let i = 0; i < argv.length; i += 2) {
  const flag = argv[i]!;
  // A misparsed argument must stop the run: reports are certification evidence.
  if (!flag.startsWith('--') || i + 1 >= argv.length) throw new Error(`Arguments must be --name value pairs (got "${flag}")`);
  args.set(flag.slice(2), argv[i + 1]!);
}
const rounds = Number(args.get('rounds') ?? 1_000_000);
const seed = Number(args.get('seed') ?? 1);
if (!Number.isSafeInteger(rounds) || rounds < 1000) throw new Error('--rounds must be an integer >= 1000');

interface Strategy {
  label: string;
  /** Fence after which the player collects, for this round (10 = run to the finish). */
  stop(rnd: () => number): number;
}

const STRATEGIES: Strategy[] = [
  { label: 'collect after fence 1', stop: () => 1 },
  { label: 'collect after fence 3', stop: () => 3 },
  { label: 'collect after fence 5', stop: () => 5 },
  { label: 'collect after fence 9', stop: () => 9 },
  { label: 'run to the finish', stop: () => 10 },
  { label: 'collect at a random fence each round', stop: (r) => 1 + Math.floor(r() * 10) },
];

const SMALL_STAKES = [20, 100, 1_000, 10_000];

function simulate(config: StepConfig) {
  const rnd = createPrng(seed);
  const choice = createPrng(seed + 1_000_003);
  const n = STRATEGIES.length;
  const sum = new Float64Array(n);
  const sumSq = new Float64Array(n);
  const wins = new Float64Array(n);
  const refusalAt = new Float64Array(12);
  for (let i = 0; i < rounds; i++) {
    // Fences cleared before the first refusal (10 = all cleared).
    let cleared = 0;
    while (cleared < 10 && rnd() <= clearChance(config, cleared + 1)) cleared++;
    refusalAt[cleared]!++;
    for (let s = 0; s < n; s++) {
      const stop = STRATEGIES[s]!.stop(choice);
      const ret = cleared >= stop ? config.paytable[stop - 1]! : 0;
      sum[s]! += ret;
      sumSq[s]! += ret * ret;
      if (ret > 0) wins[s]!++;
    }
  }
  const strategies = STRATEGIES.map((st, s) => {
    const mean = sum[s]! / rounds;
    const se = Math.sqrt(Math.max(0, sumSq[s]! / rounds - mean * mean) / rounds);
    return { strategy: st.label, rtp: mean, standardError: se, winRate: wins[s]! / rounds, withinFourSe: Math.abs(mean - config.rtp) <= 4 * se };
  });
  const theoretical = config.paytable.map((m, k) => ({ fence: k + 1, multiplier: m, clearChance: clearChance(config, k + 1), reachChance: reachChance(config, k + 1), rtp: reachChance(config, k + 1) * m }));
  // Payout rounded half-up once per round, per stake: exact expectation per stop.
  const rounding = SMALL_STAKES.map((stake) => {
    const perStop = config.paytable.map((m, k) => (reachChance(config, k + 1) * payoutMinor(stake, m)) / stake);
    return { stakeMinor: stake, minRtp: Math.min(...perStop), maxRtp: Math.max(...perStop) };
  });
  return { strategies, theoretical, rounding, refusalShare: Array.from(refusalAt.slice(0, 11), (c) => c / rounds) };
}

const pct = (x: number, d = 3) => `${(x * 100).toFixed(d)}%`;
const out: Record<string, unknown> = { rounds, seed, generatedAt: new Date().toISOString(), configs: {} };
const md: string[] = [
  '# RTP simulation: Fence Run v1 (step game)',
  '',
  `- Rounds per difficulty: ${rounds.toLocaleString('en-US')} (seed ${seed}); all strategies share the same fences each round.`,
  '- Paytable rule: clear chance of fence k = m[k-1] / m[k] with m[0] = RTP, so stopping after any fence returns exactly the RTP.',
  '- PASS requires every theoretical stop at 97% ± 0.1% and every measured strategy within 4 standard errors of 97%.',
  '',
];
let allPass = true;
for (const d of DIFFICULTIES) {
  const config = STEP_CONFIGS[d];
  const errors = validateStepConfig(config);
  if (errors.length) throw new Error(errors.join('; '));
  const r = simulate(config);
  (out.configs as Record<string, unknown>)[config.id] = { config, ...r };
  const theoryPass = r.theoretical.every((t) => Math.abs(t.rtp - config.rtp) <= 0.001);
  const measuredPass = r.strategies.every((s) => s.withinFourSe);
  allPass &&= theoryPass && measuredPass;
  md.push(`## ${config.id}`, '', '| Fence | Multiplier | Clear chance | Reach chance | Theoretical RTP |', '|---|---|---|---|---|');
  for (const t of r.theoretical) md.push(`| ${t.fence} | x${t.multiplier.toFixed(2)} | ${pct(t.clearChance, 2)} | ${pct(t.reachChance, 3)} | ${pct(t.rtp, 4)} |`);
  md.push('', '| Strategy | Win rate | Measured RTP (± SE) | Result |', '|---|---|---|---|');
  for (const s of r.strategies) md.push(`| ${s.strategy} | ${pct(s.winRate, 2)} | ${pct(s.rtp)} (±${pct(s.standardError)}) | ${s.withinFourSe ? 'PASS' : 'FAIL'} |`);
  md.push('', '| Stake (minor units) | RTP band after half-up rounding |', '|---|---|');
  for (const b of r.rounding) md.push(`| ${b.stakeMinor} | ${pct(b.minRtp)} .. ${pct(b.maxRtp)} |`);
  md.push('', `Theoretical: ${theoryPass ? 'PASS' : 'FAIL'} · Measured: ${measuredPass ? 'PASS' : 'FAIL'}`, '');
}
md.push(`**Overall: ${allPass ? 'PASS' : 'FAIL'}**`, '');
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'rtp-fence-run-v1.json'), JSON.stringify({ ...out, pass: allPass }, null, 2));
writeFileSync(join(dir, 'rtp-fence-run-v1.md'), md.join('\n'));
console.log(md.join('\n'));
if (!allPass) process.exit(1);
