// Monte Carlo RTP simulator for the crash path model.
// Usage: pnpm --filter @triptown/fairness simulate -- --rounds 10000000 --seed 1 [--config whack-crash/v1-rising+cap100] [--min-cashout 1.1] [--part-minor 10] [--rounding cumulative]
// --config takes any registered id, including retired ones, so an archived report can be reproduced.
// Writes reports/rtp-<id>.{md,json} and updates reports/index.json (theoretical runs only).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CONFIG,
  assertValidConfig,
  createPrng,
  crashTimeFromUniform,
  boostTimesFromUniforms,
  resolveConfigId,
  setbackTimesFromUniforms,
  survival,
} from '../src/index';
import {
  modifiersOf,
  partStops,
  roundedMultiple,
  strategyLabel,
  withMinCashout,
  type PartStrategy,
  type Strategy,
} from '../src/strategies';

const args = new Map<string, string>();
// Reports are certification evidence and a run overwrites the committed one for its config id, so a
// misparsed argument must stop the run rather than silently produce a default report under the wrong
// name. Some shells and package managers forward a bare `--`, which used to shift every key onto the
// previous value and hand back a 1,000,000-round DEFAULT_CONFIG run whatever was asked for.
const argv = process.argv.slice(2).filter((a) => a !== '--');
for (let i = 0; i < argv.length; i += 2) {
  const flag = argv[i]!;
  if (!flag.startsWith('--')) {
    throw new Error(`Expected a --flag but got "${flag}". Arguments must be --name value pairs.`);
  }
  if (i + 1 >= argv.length) throw new Error(`Flag "${flag}" has no value.`);
  args.set(flag.replace(/^--/, ''), argv[i + 1]!);
}
const rounds = Number(args.get('rounds') ?? 1_000_000);
const seed = Number(args.get('seed') ?? 1);
const configArg = args.get('config');
const resolved = configArg ? resolveConfigId(configArg) : DEFAULT_CONFIG;
if (!resolved) throw new Error(`Unknown config id: ${configArg}`);
const config = assertValidConfig(resolved);
// Profile minimum cash-out; stops below it continue until the value reaches it.
const minCashout = Number(args.get('min-cashout') ?? 0);
// Stake-part value in minor units used for rounding; 0 = exact (theoretical) payouts. --stake-minor sets it as stake / stakeParts.
const stakeMinorArg = Number(args.get('stake-minor') ?? 0);
const partMinor = stakeMinorArg ? stakeMinorArg / config.stakeParts : Number(args.get('part-minor') ?? 0);
// perPart: each stake part rounds down on its own. cumulative: the round total rounds down once.
// halfup: exact accrual, round total rounded half-up once at settlement (production settlement, design D23).
const rounding = args.get('rounding') ?? 'perPart';
// Real cash-out times are continuous (tap timing, network): fixed-time strategies land within ±jitter ms.
// Without it, "cash out at exactly 2.000 s" hits one deterministic multiplier and measures rounding luck, not RTP.
const jitterMs = Number(args.get('time-jitter-ms') ?? 0);
const jittered = (ps: PartStrategy, u: () => number): PartStrategy =>
  jitterMs > 0
    ? { ...ps, legs: ps.legs.map((leg) => (leg.rule.kind === 'time' ? { ...leg, rule: { kind: 'time', seconds: Math.max(0, leg.rule.seconds + ((u() - 0.5) * 2 * jitterMs) / 1000) } } : leg)) }
    : ps;
const halfUp = (exactMinor: number) => Math.floor(exactMinor + 0.5 + 1e-7);

/**
 * Exact expected paid multiple under half-up settlement for one path: crash falls between consecutive
 * stops with probability S(t_k) - S(t_k+1), and the paid total is the rounded sum of stops before it.
 */
function halfUpConditional(stops: { share: number; multiplier: number; time: number }[]): number {
  const sorted = [...stops].sort((a, b) => a.time - b.time);
  let exact = 0;
  let expected = 0;
  for (let k = 0; k < sorted.length; k++) {
    exact += sorted[k]!.share * N * partMinor * sorted[k]!.multiplier;
    const pAfterThis = survival(sorted[k]!.time, config);
    const pAfterNext = k + 1 < sorted.length ? survival(sorted[k + 1]!.time, config) : 0;
    expected += (pAfterThis - pAfterNext) * halfUp(exact);
  }
  return expected / (partMinor * N);
}

const single = (rule: Strategy): PartStrategy => ({ label: strategyLabel(rule), legs: [{ parts: 1, rule }] });
const N = config.stakeParts;
const strategies: PartStrategy[] =
  N === 1
    ? [
        { kind: 'target', target: 1.5 },
        { kind: 'target', target: 2 },
        { kind: 'target', target: 10 },
        { kind: 'target', target: 100 },
        { kind: 'time', seconds: 2 },
        { kind: 'time', seconds: 5 },
        { kind: 'time', seconds: 10 },
        { kind: 'afterSetback' },
        ...(config.boostRate > 0 ? [{ kind: 'afterBoost' } as Strategy] : []),
        { kind: 'never' },
      ].map((r) => single(r as Strategy))
    : [
        { label: `all ${N} at x2`, legs: [{ parts: N, rule: { kind: 'target', target: 2 } }] },
        { label: `1 at x1.5, ${N - 1} at x5`, legs: [{ parts: 1, rule: { kind: 'target', target: 1.5 } }, { parts: N - 1, rule: { kind: 'target', target: 5 } }] },
        { label: '1 per second', legs: Array.from({ length: N }, (_, i) => ({ parts: 1, rule: { kind: 'time', seconds: i + 1 } as Strategy })) },
        { label: '1 per 0.7 s', legs: Array.from({ length: N }, (_, i) => ({ parts: 1, rule: { kind: 'time', seconds: 0.7 * (i + 1) } as Strategy })) },
        { label: `all ${N} at 1.3 s`, legs: [{ parts: N, rule: { kind: 'time', seconds: 1.3 } }] },
        // Setback-timed collects only mean something when the config has setbacks.
        ...(config.lambda > 0
          ? [{ label: '1 right after each setback', legs: Array.from({ length: N }, (_, i) => ({ parts: 1, rule: { kind: 'afterSetback', index: i } as Strategy })) }]
          : []),
        { label: `1 at x3, ${N - 1} never`, legs: [{ parts: 1, rule: { kind: 'target', target: 3 } }, { parts: N - 1, rule: { kind: 'never' } }] },
        { label: `all ${N} at x10`, legs: [{ parts: N, rule: { kind: 'target', target: 10 } }] },
        { label: 'never collect (caps only)', legs: [{ parts: N, rule: { kind: 'never' } }] },
      ];

/** Paid multiple of the bet for a set of stops, given which stops beat the crash. */
function paid(stops: { share: number; multiplier: number }[], weights: number[]): number {
  if (!partMinor) return stops.reduce((sum, st, i) => sum + st.share * st.multiplier * weights[i]!, 0);
  const partCounts = stops.map((st) => st.share * N);
  if (rounding === 'halfup') {
    const exact = stops.reduce((sum, st, i) => sum + partCounts[i]! * partMinor * st.multiplier * weights[i]!, 0);
    return halfUp(exact) / (partMinor * N);
  }
  if (rounding === 'cumulative') {
    // Expected floor of the round total: exact sum minus the rounding of the combined payout.
    const exact = stops.reduce((sum, st, i) => sum + partCounts[i]! * partMinor * st.multiplier * weights[i]!, 0);
    return Math.floor(exact + 1e-7) / (partMinor * N);
  }
  return stops.reduce((sum, st, i) => sum + st.share * roundedMultiple(st.multiplier, partMinor) * weights[i]!, 0);
}

interface Acc {
  direct: number;
  directSq: number;
  rb: number;
  rbSq: number;
  wins: number;
}
const acc: Acc[] = strategies.map(() => ({ direct: 0, directSq: 0, rb: 0, rbSq: 0, wins: 0 }));

const rng = createPrng(seed);
let instantBusts = 0;
// Round length: boosts are paid for by a higher crash hazard, so the mean and median move (design D11).
let lengthSum = 0;
const LENGTH_SAMPLE = 200_000;
const lengths: number[] = [];
const started = Date.now();

for (let i = 0; i < rounds; i++) {
  const crashTime = crashTimeFromUniform(rng(), config);
  if (crashTime === 0) instantBusts++;
  // The full path up to tMax. Setbacks are independent of the crash time,
  // so the same path serves the direct estimate (win iff stop < crash) and the
  // conditional estimate E[payout | path] = m(stop) * P(T > stop).
  const setbacks = setbackTimesFromUniforms(rng, config, config.tMax);
  const boosts = boostTimesFromUniforms(rng, config, config.tMax);
  const mods = modifiersOf(setbacks, boosts, config);
  lengthSum += Math.min(crashTime, config.tMax);
  if (lengths.length < LENGTH_SAMPLE) lengths.push(Math.min(crashTime, config.tMax));
  for (let s = 0; s < strategies.length; s++) {
    const stops = partStops(jittered(strategies[s]!, rng), mods, config).map((st) =>
      minCashout > 1 ? { ...withMinCashout(st, minCashout, mods, config), share: st.share } : st,
    );
    const a = acc[s]!;
    const direct = paid(stops, stops.map((st) => (st.time < crashTime ? 1 : 0)));
    if (direct > 0) a.wins++;
    a.direct += direct;
    a.directSq += direct * direct;
    // Rounding is not linear, so the conditional estimate rounds each stop's value and weights by survival.
    const rb = partMinor && rounding === 'halfup'
      ? halfUpConditional(stops)
      : partMinor && rounding === 'cumulative'
      ? stops.reduce((sum, st) => sum + st.share * st.multiplier * survival(st.time, config), 0) - roundingLoss(stops)
      : paid(stops, stops.map((st) => survival(st.time, config)));
    a.rb += rb;
    a.rbSq += rb * rb;
  }
  if ((i + 1) % 1_000_000 === 0) {
    console.error(`${(i + 1) / 1e6}M rounds, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
}

/** Mean loss from rounding the round total down once (uniform fractional part ≈ 0.5 minor units per paying round). */
function roundingLoss(stops: { share: number; time: number }[]): number {
  const pWin = Math.max(...stops.map((st) => survival(st.time, config)));
  return (0.5 / (partMinor * N)) * pWin;
}

const se = (sum: number, sq: number) => Math.sqrt(Math.max(0, sq / rounds - (sum / rounds) ** 2) / rounds);
const bustShare = instantBusts / rounds;
const bustSe = Math.sqrt((bustShare * (1 - bustShare)) / rounds);
const TOL = 0.001;
const JURISDICTION_MIN_RTP = 0.85;

/** Worst-case return ratio from rounding one paper-sized cash-out (the smallest exact amount) half-up to a cent. */
function roundingBand(minorPerCashout: number, minMultiplier = 1.01): { lo: number; hi: number } {
  let lo = 1;
  let hi = 1;
  const xmin = minorPerCashout * minMultiplier;
  // round(x)/x is smallest just below k+0.5 and largest at k+0.5, for the first k reachable from xmin.
  for (let k = Math.max(0, Math.floor(xmin - 0.5)); k < Math.floor(xmin - 0.5) + 3; k++) {
    const below = k + 0.5 - 1e-6;
    if (below >= xmin && below > 0) lo = Math.min(lo, k / below);
    const at = k + 0.5;
    if (at >= xmin) hi = Math.max(hi, (k + 1) / at);
  }
  return { lo, hi };
}
const band = partMinor && rounding === 'halfup' ? roundingBand(partMinor, Math.max(1.01, minCashout)) : null;

const rows = strategies.map((s, k) => {
  const a = acc[k]!;
  const direct = a.direct / rounds;
  const rb = a.rb / rounds;
  return {
    strategy: s.label,
    winRate: a.wins / rounds,
    directRtp: direct,
    directSe: se(a.direct, a.directSq),
    conditionalRtp: rb,
    conditionalSe: se(a.rb, a.rbSq),
    // Theoretical runs: conditional estimate within ±0.1%. Rounded settlement runs: within the published
    // rounding band (plus 3 SE) and at or above the jurisdiction minimum (design D23).
    pass: band
      ? rb >= Math.max(JURISDICTION_MIN_RTP, config.rtp * band.lo - 3 * se(a.rb, a.rbSq)) && rb <= config.rtp * band.hi + 3 * se(a.rb, a.rbSq)
      : Math.abs(rb - config.rtp) <= TOL && Math.abs(direct - config.rtp) <= 4 * se(a.direct, a.directSq),
  };
});

const bustPass = Math.abs(bustShare - (1 - config.rtp)) <= 0.0005;
const meanLength = lengthSum / rounds;
const sortedLengths = [...lengths].sort((a, b) => a - b);
const medianLength = sortedLengths.length ? sortedLengths[Math.floor(sortedLengths.length / 2)]! : 0;
const pct = (x: number) => `${(x * 100).toFixed(3)}%`;
const report = [
  `# RTP simulation: ${config.id}`,
  '',
  `- Rounds: ${rounds.toLocaleString('en-US')} (seed ${seed}), ${((Date.now() - started) / 1000).toFixed(1)}s`,
  `- Config: \`${JSON.stringify(config)}\``,
  `- Minimum cash-out: ${minCashout > 1 ? `x${minCashout}` : 'none'}`,
  `- Time strategy jitter: ${jitterMs ? `±${jitterMs} ms` : 'none'}`,
  `- Rounding: ${partMinor ? `${rounding} at ${partMinor} minor units per paper` : 'none (theoretical)'}`,
  band
    ? `- Target RTP ${pct(config.rtp)}; rounding band at ${partMinor} minor units per cash-out: ${pct(config.rtp * band.lo)} .. ${pct(config.rtp * band.hi)}; jurisdiction minimum ${pct(JURISDICTION_MIN_RTP)}`
    : `- Target RTP ${pct(config.rtp)}, tolerance ±${pct(TOL)}`,
  `- Round length: mean ${meanLength.toFixed(3)} s, median ${medianLength.toFixed(3)} s (first ${Math.min(rounds, LENGTH_SAMPLE).toLocaleString('en-US')} rounds)`,
  `- Modifiers: setbacks x${config.setbackFactor} at ${config.lambda}/s; boosts ${config.boostRate > 0 ? `x${config.boostFactor} at ${config.boostRate}/s` : 'off'}`,
  `- Instant bust share: ${pct(bustShare)} (±${pct(bustSe)} SE), target ${pct(1 - config.rtp)} ±0.05% → ${bustPass ? 'PASS' : 'FAIL'}`,
  '',
  '"Direct" counts a payout only when the stop beats the sampled crash time.',
  '"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.',
  'PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.',
  '',
  '| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |',
  '|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.strategy} | ${pct(r.winRate)} | ${pct(r.directRtp)} (±${pct(r.directSe)}) | ${pct(r.conditionalRtp)} (±${pct(r.conditionalSe)}) | ${r.pass ? 'PASS' : 'FAIL'} |`,
  ),
  '',
].join('\n');

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports');
mkdirSync(outDir, { recursive: true });
const suffix = (partMinor ? `-${rounding}-${partMinor}` : '') + (minCashout > 1 ? `-min${minCashout}` : '') + (jitterMs ? `-jitter${jitterMs}` : '');
const base = join(outDir, `rtp-${config.id.replace(/[^a-z0-9]+/gi, '-')}${suffix}`);
writeFileSync(`${base}.md`, report);
writeFileSync(`${base}.json`, JSON.stringify({ rounds, seed, config, bustShare, bustSe, meanLength, medianLength, rows }, null, 2));
const allPass = rows.every((r) => r.pass) && bustPass;
// The index gates jurisdiction profiles, so only theoretical runs (no rounding or min cash-out variants) update it.
if (!suffix) {
  const indexPath = join(outDir, 'index.json');
  const index = existsSync(indexPath) ? (JSON.parse(readFileSync(indexPath, 'utf8')) as Record<string, unknown>) : {};
  index[config.id] = {
    pass: allPass,
    rounds,
    date: new Date().toISOString().slice(0, 10),
    report: `rtp-${config.id.replace(/[^a-z0-9]+/gi, '-')}.md`,
  };
  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(indexPath, JSON.stringify(sorted, null, 2) + '\n');
}
console.log(report);
process.exitCode = allPass ? 0 : 1;
