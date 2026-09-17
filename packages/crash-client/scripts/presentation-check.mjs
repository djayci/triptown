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
 * A check that cannot see the game must FAIL, never pass quietly. The demo-only hooks
 * (`__triptownView`, `__triptownAudioLog`) exist only under VITE_DEMO, so a build that is not a demo
 * build, or a client that dropped the hooks in a refactor, would otherwise score every scenario as
 * "no win cue found" and report green while proving nothing. That happened once during
 * compliance-baseline and again when apps/lift shipped without a .env.demo.
 */
function assertObservable(state, scenario) {
  if (!state.hooked) {
    throw new Error(
      `[${scenario}] the demo hooks are missing — __triptownView and __triptownAudioLog are only ` +
        `defined under VITE_DEMO. This build cannot be checked; it has not passed.`,
    );
  }
  if (!state.view || !state.settled) {
    throw new Error(
      `[${scenario}] the round never settled (phase=${state.view?.phase ?? 'unknown'}), so there was ` +
        `nothing to judge. Not a pass.`,
    );
  }
}


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
  const state = await page.evaluate(() => {
    const hooked = typeof window.__triptownView === 'function' && Array.isArray(window.__triptownAudioLog);
    const view = typeof window.__triptownView === 'function' ? window.__triptownView() : null;
    return {
      hooked,
      view,
      settled: !!view && ['won', 'lost'].includes(view.phase),
      audio: [...(window.__triptownAudioLog ?? [])],
    };
  });
  return state;
}

/**
 * Which at-or-below-stake outcomes a profile can actually produce.
 *
 * On a rising-only config the multiplier never falls below 1.00, and a minimum cash-out above 1.00
 * means every COLLECTED return is strictly greater than the stake. On such a profile a below-stake
 * return and an even return are impossible by construction, and the crash is the whole of the
 * at-or-below-stake coverage. Forcing a setback there would hang and read as a failure, which is why
 * this is computed rather than assumed — but an unreachable case is reported as unreachable, never
 * quietly dropped, so coverage can never shrink without saying so.
 */
function reachable(profile) {
  if (!profile) return { belowStake: true, even: true, why: 'profile unknown; assuming everything is reachable' };
  const belowStake = profile.setbacks;
  const even = profile.minCashout === 0 || profile.minCashout <= 1;
  return {
    belowStake,
    even,
    why:
      `profile ${profile.name}: setbacks ${profile.setbacks ? 'on' : 'off'}, ` +
      `minimum cash-out ${profile.minCashout === 0 ? 'none' : `x${profile.minCashout}`}`,
  };
}

const cases = [
  { name: 'win above stake', force: 'bigWin', when: 'time', ms: 2500, expect: 'win', needs: null },
  { name: 'return below stake after a setback', force: 'setback', when: 'belowStake', expect: 'not-win', needs: 'belowStake' },
  { name: 'even return at x1.00', force: 'longRound', when: 'time', ms: 150, expect: 'not-win', needs: 'even' },
  { name: 'crash', force: 'quickCrash', when: 'never', expect: 'not-win', needs: null },
];

// One probe round tells us what this profile can produce before we try to force anything.
const probe = await play('quickCrash', 'never');
assertObservable(probe, 'probe');
const can = reachable(probe.view?.profile);
console.info(`presentation-check: ${can.why}`);

for (const c of cases) {
  if (c.needs && !can[c.needs]) {
    const note = `${c.name}: UNREACHABLE on this profile (${can.why}) — not tested, and not a pass`;
    console.info(note);
    results.push({ name: c.name, status: 'unreachable', why: can.why });
    continue;
  }
  const state = await play(c.force, c.when, c.ms);
  assertObservable(state, c.name);
  const celebrated = state.audio.some(isWinCue) || !!state.view?.confetti;
  const kind = state.view?.resultKind ?? 'unknown';
  // A 'not-win' case must have settled (so the check cannot pass by simply never finishing).
  const settled = kind === 'win' || kind === 'even' || kind === 'loss';
  const ok = c.expect === 'win' ? kind === 'win' && celebrated : settled && !celebrated && kind !== 'win';
  results.push({ case: c.name, expect: c.expect, kind, celebrated, audio: state.audio, pass: ok });
  console.info(`${ok ? 'PASS' : 'FAIL'}  ${c.name}: kind=${kind} celebrated=${celebrated} audio=${state.audio.join(',')}`);
}

await browser.close();
if (out) writeFileSync(out, JSON.stringify({ url, date: new Date().toISOString(), profile: can, results }, null, 2));

// The whole point of this check is the at-or-below-stake rule (UK RTS 14F, AGCO 2.20). If every
// such case turned out to be unreachable, the run proved nothing about it and must not report green.
const belowStakeTested = results.some((r) => r.pass && ['return below stake after a setback', 'even return at x1.00', 'crash'].includes(r.case));
if (!belowStakeTested) {
  console.error('presentation-check FAILED: no at-or-below-stake outcome was actually tested');
  process.exit(1);
}

if (results.some((r) => r.status !== 'unreachable' && !r.pass)) {
  console.error('presentation-check FAILED');
  process.exit(1);
}
console.info('presentation-check PASS');
