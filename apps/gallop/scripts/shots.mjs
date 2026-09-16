// Dev helper: screenshots of Fence Run states from the demo build.
// Usage: node scripts/shots.mjs <baseUrl> <outDir> [width] [height]
import { chromium } from 'playwright-core';

const [base, out, width = '390', height = '844'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function open(query) {
  const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => globalThis.__gallop?.currentPhase === 'betting', null, { timeout: 15000 });
  return page;
}
const phase = (page, p) => page.waitForFunction((want) => globalThis.__gallop.currentPhase === want, p, { timeout: 15000 });
const shot = (page, name) => page.screenshot({ path: `${out}/${name}-${width}x${height}.png` });

let page = await open('?force=finish');
await wait(800);
await shot(page, '1-betting');
await page.evaluate(() => globalThis.__gallop.bet());
await phase(page, 'waiting');
await page.evaluate(() => globalThis.__gallop.jump());
await phase(page, 'waiting');
await page.evaluate(() => globalThis.__gallop.jump());
await wait(420);
await shot(page, '3-mid-jump');
await phase(page, 'waiting');
await wait(200);
await shot(page, '2-waiting');
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => globalThis.__gallop.jump());
  await page.waitForFunction(() => ['waiting', 'result'].includes(globalThis.__gallop.currentPhase), null, { timeout: 15000 });
}
await phase(page, 'result');
await wait(250);
await shot(page, '5-finish');
await page.close();

page = await open('?force=2');
await page.evaluate(() => globalThis.__gallop.bet());
await phase(page, 'waiting');
await page.evaluate(() => globalThis.__gallop.jump());
await phase(page, 'waiting');
await page.evaluate(() => globalThis.__gallop.jump());
await phase(page, 'result');
await wait(200);
await shot(page, '4-refused');
await page.close();

page = await open('?force=finish');
await page.evaluate(() => globalThis.__gallop.bet());
await phase(page, 'waiting');
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => globalThis.__gallop.jump());
  await phase(page, 'waiting');
}
await page.evaluate(() => globalThis.__gallop.collect());
await phase(page, 'result');
await wait(250);
await shot(page, '6-collect');
await page.evaluate(() => globalThis.__gallop.openRules());
await wait(300);
await shot(page, '7-rules');
await page.close();

await browser.close();
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
