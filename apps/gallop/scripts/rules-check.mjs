// Rules and fonts check (tasks 4.3, 4.6): rules open in the betting state without changing the balance,
// cover the required items, and every HUD face is a loaded Barlow font (no fallback monospace).
// Usage: node scripts/rules-check.mjs <baseUrl> [logFile]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [base = 'http://127.0.0.1:5176', logFile] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => globalThis.__gallop?.currentPhase === 'betting', null, { timeout: 15000 });
const before = await page.evaluate(() => globalThis.__gallop.session.balanceMinor);
await page.evaluate(() => globalThis.__gallop.openRules());
const result = await page.evaluate(async () => {
  const dialog = globalThis.document.querySelector('.ng-rules');
  const text = dialog?.textContent ?? '';
  await globalThis.__gallop.refreshSession();
  return {
    visible: !!dialog && !dialog.hidden,
    phase: globalThis.__gallop.currentPhase,
    balanceAfter: globalThis.__gallop.session.balanceMinor,
    fonts: {
      display900: globalThis.document.fonts.check('italic 900 32px "Barlow Condensed"'),
      display800: globalThis.document.fonts.check('italic 800 32px "Barlow Condensed"'),
      ui700: globalThis.document.fonts.check('700 16px "Barlow"'),
    },
    covers: {
      jumpCollect: /JUMP/.test(text) && /COLLECT/.test(text),
      refusal: /refuses a fence, the round ends and the stake is lost/.test(text),
      finish: /finish line and collects the top prize/.test(text),
      paytables: (text.match(/Clear chance/g) ?? []).length === 3,
      fixedAtStart: /decided by the server when the round/.test(text),
      noEffectOfPressing: /Pressing faster, slower or at any moment changes nothing/.test(text),
      rtpEveryStrategy: /97% for every way of playing/.test(text),
      abandonment: /no action for/.test(text),
      noRaceResult: /no race result/.test(text),
      decoration: /decoration/.test(text),
    },
  };
});
await browser.close();
const failures = [];
if (!result.visible) failures.push('rules did not open');
if (result.phase !== 'betting') failures.push(`phase changed to ${result.phase}`);
if (result.balanceAfter !== before) failures.push(`balance changed ${before} -> ${result.balanceAfter}`);
for (const [k, v] of Object.entries(result.fonts)) if (!v) failures.push(`font not loaded: ${k}`);
for (const [k, v] of Object.entries(result.covers)) if (!v) failures.push(`rules missing: ${k}`);
const report = { ...result, balanceBefore: before, pass: failures.length === 0, failures };
if (logFile) writeFileSync(logFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);
