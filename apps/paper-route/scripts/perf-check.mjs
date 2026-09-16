/* global window, document, requestAnimationFrame -- used inside page.evaluate callbacks that run in the browser */
// Performance check (paper-route-iso-look 6.1, 6.2): draw calls and memory per quality tier on a
// scripted ride, then a throttled run to prove the tier steps down while the HUD keeps updating.
// Usage: node scripts/perf-check.mjs [--url http://127.0.0.1:5176/] [--out file.json]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://127.0.0.1:5176/');
const out = arg('out', null);
/** Draw-call budget for the busiest tier, carried over from the chase-camera build. */
const MAX_DRAW_CALLS = 150;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

// ---- 6.1: a 60 s scripted ride per tier ----
const tiers = {};
for (const tier of ['high', 'medium', 'low']) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 })).newPage();
  await page.goto(`${base}preview.html?tier=${tier}&ride=30`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 300_000 });
  const report = await page.evaluate(() => window.__preview);
  tiers[tier] = {
    maxDrawCalls: report.maxCalls,
    frames: report.frames,
    geometriesMin: Math.min(...report.geometries),
    geometriesMax: Math.max(...report.geometries),
  };
  await page.context().close();
}

// ---- 6.2: tier step-down under 6x CPU throttling, with the HUD still updating ----
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?profile=light`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__paperRoute?.session, null, { timeout: 30_000 });
const client = await page.context().newCDPSession(page);
await page.evaluate(async () => {
  const c = window.__paperRoute;
  c.d.service.forceNext('bigWin');
  await c.bet();
});
await page.waitForFunction(() => window.__paperRoute.phase === 'riding', null, { timeout: 10_000 });
const startTier = await page.evaluate(() => window.__paperRoute.governor.current);
await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });
const stepDown = await page.evaluate(
  (from) =>
    new Promise((resolve) => {
      const c = window.__paperRoute;
      const t0 = performance.now();
      const firstMultiplier = c.stats.lastMultiplier;
      const firstText = document.querySelector('[data-part="multiplier"]')?.textContent;
      const tick = () => {
        const tier = c.governor.current;
        if (tier !== from) {
          resolve({
            ms: Math.round(performance.now() - t0),
            tier,
            hudKeptUpdating: document.querySelector('[data-part="multiplier"]')?.textContent !== firstText,
            multiplierKeptUpdating: c.stats.lastMultiplier !== firstMultiplier,
          });
          return;
        }
        if (performance.now() - t0 > 12_000) {
          resolve({ ms: null, tier, hudKeptUpdating: null, multiplierKeptUpdating: null });
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    }),
  startTier,
);
await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const afterTier = await page.evaluate(() => ({
  tier: window.__paperRoute.governor.current,
  depthPass: window.__paperRoute.d.world.settings.depthPass,
  nearSideDetail: window.__paperRoute.d.world.settings.nearSideDetail,
  drawDistance: window.__paperRoute.d.world.settings.drawDistance,
}));

const result = {
  check: 'paper-route performance',
  tiers,
  throttled: { startTier, ...stepDown, after: afterTier },
  errors,
  pass:
    Object.values(tiers).every((t) => t.maxDrawCalls <= MAX_DRAW_CALLS && t.geometriesMax - t.geometriesMin <= 4) &&
    stepDown.ms !== null &&
    stepDown.ms <= 4000 &&
    stepDown.hudKeptUpdating === true &&
    // The depth pass is the first thing to go.
    afterTier.depthPass === false &&
    errors.length === 0,
};
console.log(JSON.stringify(result, null, 1));
if (out) writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
await browser.close();
process.exit(result.pass ? 0 : 1);
