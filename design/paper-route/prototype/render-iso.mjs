import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const [outDir, ...jobs] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const job of jobs) {
  const [style, state] = job.split(':');
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`http://127.0.0.1:8792/design/paper-route/prototype/render-iso.html?style=${style}&state=${state}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 60000 });
  const data = await page.evaluate(() => window.__png);
  const ext = style === 'diorama' ? 'jpg' : 'png';
  writeFileSync(`${outDir}/iso-${style}-${state}.${ext}`, Buffer.from(data.split(',')[1], 'base64'));
  await page.screenshot({ path: `${outDir}/preview-${style}-${state}.png` });
  await page.context().close();
}
await browser.close();
