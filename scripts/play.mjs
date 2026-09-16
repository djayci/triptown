// Dev helper: scripted play-through in headless Chrome with screenshots.
// Usage: node scripts/play.mjs <steps.json>
// steps: [{ "goto": url, "viewport": [w,h] } | { "click": [x,y] } | { "key": "Space" } | { "wait": ms }
//         | { "shot": "file.png" } | { "eval": "js" } | { "waitFor": "js returning truthy", "timeout": ms }]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const steps = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
let page = null;
const logs = [];
for (const step of steps) {
  if (step.navigate) {
    await page.goto(step.navigate, { waitUntil: 'networkidle' });
  } else if (step.goto) {
    const [w, h] = step.viewport ?? [390, 844];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: step.dpr ?? 2, reducedMotion: step.reducedMotion ?? 'no-preference' });
    page = await ctx.newPage();
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}${logs.some((l) => l.startsWith('[pageerror]')) ? '' : '\n' + e.stack}`));
    await page.goto(step.goto, { waitUntil: 'networkidle' });
  } else if (step.click) await page.mouse.click(step.click[0], step.click[1]);
  else if (step.key) await page.keyboard.press(step.key);
  else if (step.wait) await page.waitForTimeout(step.wait);
  else if (step.shot) await page.screenshot({ path: step.shot });
  else if (step.eval) console.log('eval:', JSON.stringify(await page.evaluate(step.eval)));
  else if (step.frameEval) console.log('frameEval:', JSON.stringify(await page.frames().find((f) => f !== page.mainFrame()).evaluate(step.frameEval)));
  else if (step.frameWaitFor) await page.frames().find((f) => f !== page.mainFrame()).waitForFunction(step.frameWaitFor, null, { timeout: step.timeout ?? 15000 });
  else if (step.waitFor) await page.waitForFunction(step.waitFor, null, { timeout: step.timeout ?? 15000 });
}
console.log(logs.filter((l) => !l.includes('[vite]') && !l.includes('404')).join('\n'));
await browser.close();
