// Dev helper: open a page in headless Chrome, optionally run steps, save screenshots.
// Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs] [evalJs]
import { chromium } from 'playwright-core';

const [url, out, width = '390', height = '844', waitMs = '1500', js] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(waitMs));
if (js) {
  const result = await page.evaluate(js);
  if (result !== undefined) console.log('eval:', JSON.stringify(result));
  await page.waitForTimeout(Number(waitMs));
}
await page.screenshot({ path: out });
console.log(logs.filter((l) => !l.includes('[vite]')).join('\n'));
await browser.close();
