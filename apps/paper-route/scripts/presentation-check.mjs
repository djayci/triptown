/* global window, document, requestAnimationFrame -- used inside page.evaluate callbacks that run in the browser */
// Presentation check (paper-route-mvp 10.3): forces loss, below-stake and win rounds for each profile and
// checks what the player sees and hears. Win copy and the win sound only when the round total is above
// the stake; RETURN NOW (not WIN NOW) while the return is at or below stake; no crash point on the result;
// no setback splash under rising-only profiles.
// Usage: node scripts/presentation-check.mjs [--url http://127.0.0.1:5176/] [--profiles light,regulated-uk,...] [--out file.json]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://127.0.0.1:5176/');
const profiles = arg('profiles', 'light,regulated-uk,regulated-on,regulated-br,pt-draft').split(',');
const out = arg('out', null);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

async function openProfile(name) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text()) && errors.push(m.text()));
  await page.goto(`${base}?profile=${name}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__paperRoute?.session, null, { timeout: 30_000 });
  // Log every sound the controller asks for, and keep playing it.
  await page.evaluate(() => {
    const c = window.__paperRoute;
    const real = c.d.sounds;
    window.__sounds = [];
    c.d.sounds = {
      play: (n) => (window.__sounds.push(n), real?.play(n)),
      startRide: () => real?.startRide?.(),
      rideMultiplier: (m) => real?.rideMultiplier?.(m),
      stopRide: () => real?.stopRide?.(),
    };
  });
  return { page, errors };
}

const readCard = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('[data-part="result"]');
    return card ? { win: card.dataset.win, text: card.textContent } : null;
  });

/** Plays one forced round. `during(page)` acts while riding; returns what the result showed. */
async function playRound(page, scenario, during) {
  await page.waitForFunction(() => window.__paperRoute.phase === 'betting' && !window.__paperRoute.cycleRemainingMs(), null, { timeout: 20_000 });
  await page.evaluate((s) => {
    window.__sounds.length = 0;
    window.__liveLabels = [];
    window.__paperRoute.d.service.forceNext(s);
  }, scenario);
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.__paperRoute.phase !== 'betting', null, { timeout: 10_000 });
  // Sample the live label every frame while riding.
  await page.evaluate(() => {
    const tick = () => {
      const live = document.querySelector('[data-part="live"]');
      if (live) window.__liveLabels.push({ label: live.textContent, total: window.__paperRoute.hudState(window.__paperRoute.round, window.__paperRoute.stats.lastMultiplier) });
      if (window.__paperRoute.phase === 'riding') requestAnimationFrame(tick);
    };
    tick();
  });
  if (during) await during(page);
  await page.waitForFunction(() => window.__paperRoute.phase === 'result' && document.querySelector('[data-part="result"]'), null, { timeout: 120_000 });
  const card = await readCard(page);
  const state = await page.evaluate(() => {
    const c = window.__paperRoute;
    const r = c.round;
    // WIN NOW may only show while banked + riding value is above the stake.
    const badLabels = window.__liveLabels.filter((l) => /WIN NOW/.test(l.label) && !(l.total.returnedSoFarMinor + l.total.ridingMinor > l.total.betMinor)).length;
    return { stakeMinor: r.stakeMinor, returnedMinor: c.result.returnedMinor, sounds: [...window.__sounds], badLabels, sawLabels: [...new Set(window.__liveLabels.map((l) => l.label.replace(/[\d.,]+/g, '#')))] };
  });
  await page.click('[data-action="continue"]');
  return { scenario, card, ...state };
}

const tapSpace = async (page) => {
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
};
const clickAll = (page) => page.click('[data-action="all"]', { timeout: 2000 });
const clickThrow = (page) => page.click('[data-action="throw"]', { timeout: 2000 });

const report = { check: 'paper-route presentation', profiles: {} };
let pass = true;

for (const name of profiles) {
  const { page, errors } = await openProfile(name);
  const profile = await page.evaluate(() => ({ ...window.__paperRoute.profile, papers: window.__paperRoute.papersPerRound, rising: window.__paperRoute.config.lambda === 0 }));
  const rounds = [];

  rounds.push({ kind: 'loss', ...(await playRound(page, 'instantBust')) });
  if (profile.papers > 1) {
    rounds.push({
      kind: 'below-stake',
      ...(await playRound(page, 'quickCrash', async (p) => {
        await p.waitForTimeout(700);
        await tapSpace(p);
      })),
    });
  }
  if (!profile.rising) {
    // Setback round: the splash shows, then throw everything as soon as the minimum cash-out allows.
    // Whatever the total, the result must follow return against stake.
    rounds.push({
      kind: 'setback',
      ...(await playRound(page, 'setback', async (p) => {
        await p.waitForFunction(() => window.__paperRoute.round.setbacks.length > 0, null, { timeout: 10_000 });
        while ((await p.evaluate(() => window.__paperRoute.phase)) === 'riding') {
          await (profile.papers > 1 ? clickAll(p) : clickThrow(p)).catch(() => {});
          await p.waitForTimeout(200);
        }
      })),
    });
  }
  rounds.push({
    kind: 'win',
    ...(await playRound(page, 'bigWin', async (p) => {
      await p.waitForTimeout(3000);
      // With partial cash-out off there is one CASH OUT button (the throw action) for the whole stake.
      await clickThrow(p);
      if (profile.papers > 1) {
        await p.waitForTimeout(500);
        await clickAll(p);
      }
    })),
  });

  const checks = rounds.map((r) => {
    const aboveStake = r.returnedMinor > r.stakeMinor;
    const failures = [];
    if (!r.card) failures.push('no result card');
    if (r.kind === 'win' && !aboveStake) failures.push('win scenario did not end above stake');
    if ((r.kind === 'loss' || r.kind === 'below-stake') && r.returnedMinor >= r.stakeMinor) failures.push(`${r.kind} scenario ended at or above stake`);
    if ((r.card?.win === 'true') !== aboveStake) failures.push(`result card win=${r.card?.win} with return ${r.returnedMinor} on stake ${r.stakeMinor}`);
    if (/WON/.test(r.card?.text ?? '') !== aboveStake) failures.push('win copy does not match the round total');
    if (r.sounds.includes('win') !== aboveStake) failures.push(`win sound ${r.sounds.includes('win') ? 'played' : 'missing'}`);
    if (r.badLabels > 0) failures.push(`${r.badLabels} frames showed WIN NOW at or below stake`);
    // The result shows what was returned, never where the round would have ended.
    if (r.kind !== 'loss' && /x\d/.test(r.card?.text ?? '')) failures.push('result card shows a multiplier');
    if (r.kind === 'setback' && !r.sounds.includes('splash')) failures.push('no setback splash sound');
    if (profile.rising && r.sounds.includes('splash')) failures.push('setback splash under a rising-only profile');
    return { ...r, failures };
  });
  const ok = checks.every((c) => c.failures.length === 0) && errors.length === 0;
  pass &&= ok;
  report.profiles[name] = { partialCashout: profile.partialCashout, papers: profile.papers, rising: profile.rising, intensityEffects: profile.intensityEffects, rounds: checks, errors, pass: ok };
  await page.context().close();
}

report.pass = pass;
console.log(JSON.stringify(report, null, 1));
if (out) writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
await browser.close();
process.exit(pass ? 0 : 1);
