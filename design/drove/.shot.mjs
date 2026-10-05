// scratch: screenshot the drove canvas frames at given times
import { chromium } from 'playwright-core';
const out = process.argv[2];
const times = (process.argv[3] || '6,9').split(',').map(Number);
const col = Number(process.argv[4] || 0);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + new URL('./canvas-preview.html', import.meta.url).pathname);
const el = page.locator('.frame').nth(col);
await el.scrollIntoViewIfNeeded();
let t0 = Date.now();
for (const t of times) {
  const wait = t * 1000 - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await el.screenshot({ path: `${out}-c${col}-${t}.png` });
}
console.log('errors:', errs);
await browser.close();
