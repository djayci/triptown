/* global window, requestAnimationFrame, KeyboardEvent -- used inside page.evaluate callbacks that run in the browser */
// Timing check (paper-route-mvp 10.3): plays rounds as fast as real input allows and measures the gap
// between round starts on the server clock. Rounds include several throws. Also checks that a held
// Space never starts a round and that the server refuses a start inside the minimum cycle.
// Usage: node scripts/timing-check.mjs [--url http://127.0.0.1:5176/] [--profile regulated-uk] [--rounds 20] [--out file.json]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://127.0.0.1:5176/');
const profileName = arg('profile', 'regulated-uk');
const rounds = Number(arg('rounds', '20'));
const out = arg('out', null);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text() + (m.location().url ?? '')) && errors.push(m.text()));
await page.goto(`${base}?profile=${profileName}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__paperRoute?.session, null, { timeout: 30_000 });

// Record every round start the client sees (server start time) without touching game logic.
await page.evaluate(() => {
  const c = window.__paperRoute;
  window.__starts = [];
  let last = null;
  const poll = () => {
    const r = c.round;
    if (r && r.id !== last) {
      last = r.id;
      window.__starts.push({ roundId: r.id, startedAt: r.startedAt, papers: r.papers.length });
    }
    requestAnimationFrame(poll);
  };
  poll();
});

const phase = () => page.evaluate(() => window.__paperRoute.phase);
const minCycleMs = await page.evaluate(() => window.__paperRoute.profile.minCycleMs);
const tap = async () => {
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
};
const throwsPerRound = [];

for (let n = 0; n < rounds; n++) {
  // Press as fast as a player could: a fresh Space every 50 ms until the round starts.
  while ((await phase()) === 'betting') {
    await tap();
    await page.waitForTimeout(50);
  }
  let throws = 0;
  for (let i = 0; i < 3 && (await phase()) === 'riding'; i++) {
    await page.waitForTimeout(700);
    if ((await phase()) !== 'riding') break;
    if (i < 2) await tap();
    else await page.click('[data-action="all"]').catch(() => {});
    throws++;
  }
  throwsPerRound.push(throws);
  await page.waitForFunction(() => window.__paperRoute.phase === 'result', null, { timeout: 120_000 });
  await page.click('[data-action="continue"]');
}

// A held Space (auto-repeat) must not start a round.
const before = await page.evaluate(() => window.__starts.length);
await page.waitForTimeout(minCycleMs + 200);
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: true })));
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: true })));
  await page.waitForTimeout(100);
}
const heldStarted = (await page.evaluate(() => window.__starts.length)) - before;
await page.keyboard.up('Space');

// The server itself refuses a start inside the cycle, whatever the client does.
const serverRefusal = await page.evaluate(async () => {
  const c = window.__paperRoute;
  const svc = c.d.service;
  const noop = () => {};
  // Auto cash-out at 1.01 ends the first round at once, so the second start meets only the cycle rule.
  const first = await svc.startRound({ betMinor: c.stakeMinor, autoCashout: 1.01 }, noop).then(async (h) => (await h.ended, 'started'), (e) => e.code);
  const second = await svc.startRound({ betMinor: c.stakeMinor, autoCashout: 1.01 }, noop).then(() => 'started', (e) => e.code);
  return { first, second };
});

const starts = await page.evaluate(() => window.__starts);
const gaps = starts.slice(1, rounds).map((s, i) => s.startedAt - starts[i].startedAt);
const minGap = Math.min(...gaps);
const result = {
  check: 'paper-route timing',
  profile: profileName,
  minCycleMs,
  rounds: starts.slice(0, rounds).length,
  throwsPerRound,
  gapsMs: gaps,
  minGapMs: minGap,
  heldSpaceStartedRounds: heldStarted,
  serverRefusal,
  errors,
  pass: gaps.length === rounds - 1 && minGap >= minCycleMs && heldStarted === 0 && serverRefusal.second === 'cycle_too_soon' && errors.length === 0,
};
console.log(JSON.stringify(result, null, 1));
if (out) writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
await browser.close();
process.exit(result.pass ? 0 : 1);
