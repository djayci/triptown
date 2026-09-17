// Compliance check: the minimum gap between round starts (UK RTS 14G 5 s, Ontario 2.5 s), measured
// by driving the real client as fast as it will go. Never measure this with a stopwatch: the UKGC
// criticised exactly that in the Stakelogic settlement.
// Usage: node scripts/timing-check.mjs [--url ...] [--rounds 20] [--min-ms 2500] [--out file.json]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const url = args.get('url') ?? 'http://localhost:5173';
const profile = args.get('profile');
/** Keeps any query already on --url (e.g. ?profile=regulated-uk) and adds the scenario. */
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

const BET = { x: 195, y: 783 };

// Hammer the start control as fast as a player could, and let the client record every actual start.
const deadline = Date.now() + rounds * (minMs + 2000) + 15000;
while (Date.now() < deadline) {
  await page.mouse.click(BET.x, BET.y);
  await page.waitForTimeout(120);
  const n = await page.evaluate(() => window.__triptownView?.().starts.length ?? 0);
  if (n >= rounds) break;
}
const starts = await page.evaluate(() => window.__triptownView?.().starts ?? []);

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
