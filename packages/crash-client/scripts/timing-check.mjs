// Compliance check: the minimum gap between round starts (UK RTS 14G 5 s, Ontario 2.5 s), measured
// by driving the real client as fast as it will go. Never measure this with a stopwatch: the UKGC
// criticised exactly that in the Stakelogic settlement.
// Usage: node scripts/timing-check.mjs [--url ...] [--rounds 20] [--min-ms 2500] [--out file.json]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const KNOWN = new Set(['url', 'profile', 'rounds', 'min-ms', 'out']);
// Parse strictly: a malformed invocation must stop the run, never silently produce a result for
// options that were never applied. An unquoted "$pf" in a zsh loop arrives as ONE argv entry
// ("--profile ng-draft"), which shifts every later pair — a run labelled as a regulated market then
// quietly measured the default profile at the default gap and reported PASS.
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (!flag.startsWith('--') || flag.includes(' ')) {
    throw new Error(`bad argument ${JSON.stringify(flag)} — expected --flag value pairs (quote values containing spaces)`);
  }
  const key = flag.slice(2);
  if (!KNOWN.has(key)) throw new Error(`unknown option --${key}; known: ${[...KNOWN].join(', ')}`);
  if (value === undefined) throw new Error(`--${key} needs a value`);
  args.set(key, value);
}
const url = args.get('url') ?? 'http://localhost:5173';
const profile = args.get('profile');
/** Keeps any query already on --url (e.g. ?profile=ng-draft) and adds the scenario. */
const pageUrl = (force) => {
  const u = new URL(url);
  if (force) u.searchParams.set('force', force);
  if (profile) u.searchParams.set('profile', profile);
  return u.toString();
};
const rounds = Number(args.get('rounds') ?? 20);
const minMs = Number(args.get('min-ms') ?? 2500);
const out = args.get('out');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(pageUrl('instantBust'), { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// A client that never booted has no rounds, which would otherwise read as an infinite gap and a
// plain FAIL — hiding the real cause. The draft profiles did exactly that: they threw at boot for
// want of the dev override, and this check reported a timing failure for a client that never ran.
if (!(await page.evaluate(() => typeof window.__triptownView === 'function'))) {
  console.error(
    'timing-check FAILED: the demo hook __triptownView is missing, so the client never booted (or is ' +
      'not a demo build). This is not a timing result.',
  );
  await browser.close();
  process.exit(1);
}

const BET = { x: 195, y: 783 };

// Hammer the start control as fast as a player could, and let the client record every actual start.
const deadline = Date.now() + rounds * (minMs + 2000) + 15000;
while (Date.now() < deadline) {
  await page.mouse.click(BET.x, BET.y);
  await page.waitForTimeout(120);
  const n = await page.evaluate(() => window.__triptownView?.().starts.length ?? 0);
  if (n >= rounds) break;
}
let starts = await page.evaluate(() => window.__triptownView?.().starts ?? []);

// Mixed sequence (practice-rounds): a stake-free round must be paced exactly like a staked one, or it
// becomes a way to fill the enforced wait with play, which is the opposite of what the gap is for.
// Practice starts go into the same log, so a practice round missing from it would be invisible here
// while still being playable — the shape that makes a check pass while proving nothing.
//
// This measures rather than asserts a refusal. The gap runs from one START to the next, so after a
// round that lasts longer than the gap it has already elapsed and a refusal would be the wrong thing
// to expect. Any practice start that came too soon shows up in the gaps computed below.
// Gate on the market, not on the hook. The demo hook ships in every demo build, so testing for it
// drove a practice round on markets that forbid one, the host correctly refused it, and the refusal
// was reported as "never reached the start log" — a FAIL for behaving properly.
const practiceAllowedHere = await page.evaluate(() => window.__triptownView?.().profile?.practiceRounds === true);
if (practiceAllowedHere && (await page.evaluate(() => typeof window.__triptownPractice === 'function'))) {
  const ready = await page
    .waitForFunction(() => ['betting', 'won', 'lost'].includes(window.__triptownView?.().phase), null, { timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    console.error('FAIL: the client never settled, so practice pacing was not measured');
    await browser.close();
    process.exit(1);
  }
  const before = (await page.evaluate(() => window.__triptownView?.().starts ?? [])).length;
  // Hammer it the way a player would, so a client that lets one through early is caught by the gaps.
  // The window has to outlast this market's own gap, or a refusal for pacing reads as "never started".
  const attempts = Math.ceil((minMs + 4000) / 250);
  for (let i = 0; i < attempts; i++) {
    await page.evaluate(() => window.__triptownPractice());
    await page.waitForTimeout(250);
    const n = await page.evaluate(() => window.__triptownView?.().starts.length ?? 0);
    if (n > before) break;
  }
  starts = await page.evaluate(() => window.__triptownView?.().starts ?? []);
  if (starts.length <= before) {
    console.error('FAIL: the practice round never reached the start log, so its pacing was not measured');
    await browser.close();
    process.exit(1);
  }
  console.info(`practice round recorded: start log grew ${before} -> ${starts.length}`);
}

// A held control must not roll into another round: wait out the gap while Space stays down.
await page.waitForTimeout(500);
await page.keyboard.down('Space');
const beforeHold = (await page.evaluate(() => window.__triptownView?.().starts.length ?? 0));
await page.waitForTimeout(minMs + 3000);
const afterHold = await page.evaluate(() => window.__triptownView?.().starts.length ?? 0);
await page.keyboard.up('Space');
// One start may happen on the initial keydown; a second one while still held is the violation.
const holdStartedARound = afterHold - beforeHold > 1;

const gaps = starts.slice(1).map((t, i) => t - starts[i]);
const worst = gaps.length ? Math.min(...gaps) : Infinity;
const pass = gaps.length > 0 && worst >= minMs && !holdStartedARound;

console.info(`starts=${starts.length} gaps=${gaps.join(',')}`);
console.info(`worst gap ${worst} ms (minimum ${minMs} ms), hold-to-repeat started a round: ${holdStartedARound}`);
console.info(pass ? 'PASS' : 'FAIL');

await browser.close();
if (out) writeFileSync(out, JSON.stringify({ url, minMs, date: new Date().toISOString(), starts, gaps, worst, holdStartedARound, pass }, null, 2));
if (!pass) process.exit(1);
