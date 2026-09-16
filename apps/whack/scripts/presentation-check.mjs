// Compliance check: a return at or below the stake must never be celebrated (UKGC RTS 14F, AGCO 2.20).
// Plays forced rounds in a real browser, reads the audio log and the result screen, and fails loudly.
// Usage: node scripts/presentation-check.mjs [--url http://localhost:5173] [--out file.json]
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
const out = args.get('out');

const WIN_EFFECTS = ['sfx:win', 'sfx:bigwin'];
const isWinCue = (e) => WIN_EFFECTS.includes(e);

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const results = [];

/**
 * Plays one round. `when` is 'time' (cash out after `ms`), 'belowStake' (wait until the value is
 * under x1.00 after a setback, then cash out) or 'never' (ride it to the crash).
 */
async function play(force, when, ms = 0) {
  await page.goto(pageUrl(force), { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // The audio manager keeps a rolling log of every cue; clear it before the round.
  await page.evaluate(() => {
    const log = window.__triptownAudioLog;
    if (log) log.length = 0;
  });
  await page.mouse.click(195, 783);
  if (when === 'time') {
    await page.waitForTimeout(ms);
    await page.mouse.click(195, 783);
  } else if (when === 'belowStake') {
    // Wait for a setback to push the value under the stake, then cash out there.
    await page
      .waitForFunction(() => {
        const s = window.__triptownView?.();
        return s && s.phase === 'running' && s.multiplier > 0 && s.multiplier < 1;
      }, null, { timeout: 20000 })
      .catch(() => {});
    await page.mouse.click(195, 783);
  }
  await page.waitForTimeout(2600);
  const state = await page.evaluate(() => ({
    audio: [...(window.__triptownAudioLog ?? [])],
    view: window.__triptownView ? window.__triptownView() : null,
  }));
  return state;
}

const cases = [
  { name: 'win above stake', force: 'bigWin', when: 'time', ms: 2500, expect: 'win' },
  { name: 'return below stake after a setback', force: 'setback', when: 'belowStake', expect: 'not-win' },
  { name: 'crash', force: 'quickCrash', when: 'never', expect: 'not-win' },
];

for (const c of cases) {
  const state = await play(c.force, c.when, c.ms);
  const celebrated = state.audio.some(isWinCue) || !!state.view?.confetti;
  const kind = state.view?.resultKind ?? 'unknown';
  // A 'not-win' case must have settled (so the check cannot pass by simply never finishing).
  const settled = kind === 'win' || kind === 'even' || kind === 'loss';
  const ok = c.expect === 'win' ? kind === 'win' && celebrated : settled && !celebrated && kind !== 'win';
  results.push({ case: c.name, expect: c.expect, kind, celebrated, audio: state.audio, pass: ok });
  console.info(`${ok ? 'PASS' : 'FAIL'}  ${c.name}: kind=${kind} celebrated=${celebrated} audio=${state.audio.join(',')}`);
}

await browser.close();
if (out) writeFileSync(out, JSON.stringify({ url, date: new Date().toISOString(), results }, null, 2));
if (results.some((r) => !r.pass)) {
  console.error('presentation-check FAILED');
  process.exit(1);
}
