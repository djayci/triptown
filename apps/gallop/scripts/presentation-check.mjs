// Presentation check (task 4.5), run against a demo build with a slow simulated network:
//  1. a jump that will be cleared and one that will be refused play the same frames until the server answers;
//  2. win effects fire only on a collect or finish above the stake, never on a refusal.
// Usage: node scripts/presentation-check.mjs <baseUrl> [logFile]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [base = 'http://127.0.0.1:5176', logFile] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const failures = [];
const report = {};

async function play(force, actions) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/?force=${force}&check=1&latency=900`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => globalThis.__gallop?.currentPhase === 'betting', null, { timeout: 15000 });
  await page.evaluate(() => globalThis.__gallop.bet());
  await page.waitForFunction(() => globalThis.__gallop.currentPhase === 'waiting', null, { timeout: 15000 });
  await page.evaluate(() => globalThis.__gallop.check.frames.splice(0) && globalThis.__gallop.check.effects.splice(0));
  for (const a of actions) {
    await page.evaluate((x) => globalThis.__gallop[x](), a);
    await page.waitForFunction(() => ['waiting', 'result'].includes(globalThis.__gallop.currentPhase), null, { timeout: 20000 });
  }
  const log = await page.evaluate(() => ({ ...globalThis.__gallop.check, audio: [...(globalThis.__audio?.log ?? [])] }));
  await page.close();
  return log;
}

/** Frames of the first jump before its server response, as (elapsed ms, phase, offset, lift). */
function beforeResponse(log) {
  const response = log.effects.find((e) => e.kind.startsWith('response:'));
  const start = log.frames[0]?.t ?? 0;
  return log.frames.filter((f) => f.t < response.t).map((f) => ({ ms: f.t - start, phase: f.phase, offset: f.offset, lift: f.lift }));
}

const cleared = await play('finish', ['jump', 'collect']);
const refused = await play('1', ['jump']);
const a = beforeResponse(cleared);
const b = beforeResponse(refused);
report.framesBeforeResponse = { cleared: a.length, refused: b.length };
// Same function of time: at equal elapsed time the frames match (allowing one frame of sampling jitter).
for (const fb of b) {
  const fa = a.reduce((best, f) => (Math.abs(f.ms - fb.ms) < Math.abs(best.ms - fb.ms) ? f : best), a[0]);
  if (!fa) break;
  if (Math.abs(fa.ms - fb.ms) > 20) continue;
  if (fa.phase !== fb.phase || fa.lift !== 0 || fb.lift !== 0 || Math.abs(fa.offset - fb.offset) > 6) {
    failures.push(`frames differ before response at ${fb.ms.toFixed(0)} ms: ${JSON.stringify(fa)} vs ${JSON.stringify(fb)}`);
    break;
  }
}
if (!a.some((f) => f.phase === 'hold') || !b.some((f) => f.phase === 'hold')) failures.push('expected a hold phase while waiting 900 ms for the server');

const kinds = (log) => log.effects.map((e) => e.kind);
report.effects = { clearedThenCollect: kinds(cleared), refused: kinds(refused) };
if (!kinds(cleared).includes('win_flash')) failures.push('collect above stake did not play a win effect');
if (kinds(refused).includes('win_flash')) failures.push('refusal played a win effect');
if (!kinds(refused).includes('refused')) failures.push('refusal was not presented');
report.audio = { clearedThenCollect: cleared.audio.filter((a) => a.startsWith('sfx:')), refused: refused.audio.filter((a) => a.startsWith('sfx:')) };
if (!report.audio.clearedThenCollect.includes('sfx:win')) failures.push('collect above stake did not play the win sound');
if (report.audio.refused.some((a) => a === 'sfx:win' || a === 'sfx:finish')) failures.push('refusal played a win sound');
if (!report.audio.refused.includes('sfx:jump') || !report.audio.clearedThenCollect.includes('sfx:jump')) failures.push('jump sound missing');

await browser.close();
report.pass = failures.length === 0;
report.failures = failures;
const text = JSON.stringify(report, null, 2);
if (logFile) writeFileSync(logFile, text);
console.log(text);
process.exit(failures.length ? 1 : 0);
