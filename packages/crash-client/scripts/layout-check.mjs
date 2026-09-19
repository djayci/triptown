// Layout check: drives a demo build through its states and audits the HUD boxes the view reports
// (`debugState().boxes`): no two boxes may intersect, and every row of boxes must span the frame's side
// margins (14..376; the scene is exempt). A game that lays its HUD out on a grid can prove it here rather
// than by eye. Screenshots of each state are written next to the report.
// Usage: node scripts/layout-check.mjs --url http://127.0.0.1:5178/ [--out dir]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const url = args.get('url') ?? 'http://127.0.0.1:5178/';
const out = args.get('out') ?? 'layout-check';
mkdirSync(out, { recursive: true });
const M = 14;
const R = 376;

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const phase = () => page.evaluate(() => window.__triptownView().phase);
const pageUrl = (force) => {
  const u = new URL(url);
  u.searchParams.set('force', force);
  return u.toString();
};

/** Rows: boxes whose vertical ranges touch, merged transitively. */
function rowsOf(boxes) {
  const rows = [];
  for (const bx of boxes) {
    const touching = rows.filter((r) => r.some((o) => bx.y < o.y + o.h && o.y < bx.y + bx.h));
    const merged = [bx, ...touching.flat()];
    for (const r of touching) rows.splice(rows.indexOf(r), 1);
    rows.push(merged);
  }
  return rows;
}

let failures = 0;
async function audit(label) {
  await page.screenshot({ path: `${out}/${label}.png` });
  const boxes = await page.evaluate(() => window.__triptownView().boxes);
  const problems = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const c = boxes[j];
      if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) {
        problems.push(`OVERLAP ${a.name} [${[a.x, a.y, a.w, a.h].map(Math.round)}] and ${c.name} [${[c.x, c.y, c.w, c.h].map(Math.round)}]`);
      }
    }
  }
  // A single-line caption that has wrapped is a layout fault the numbers alone would not show.
  for (const bx of boxes) if ((bx.name === 'payout-label' || bx.name === 'chance-line') && bx.h > 20) problems.push(`WRAP ${bx.name} is ${Math.round(bx.h)} tall: it has wrapped to two lines`);
  for (const row of rowsOf(boxes)) {
    const left = Math.min(...row.map((o) => o.x));
    const right = Math.max(...row.map((o) => o.x + o.w));
    // A row is either on both margins, or every box in it is centred (a title such as READY?).
    const centred = row.every((o) => Math.abs(o.x + o.w / 2 - (M + R) / 2) <= 2);
    // The history strip grows from the left as rides happen; alone in its row it need not reach the right.
    const historyAlone = row.length === 1 && row[0].name === 'history';
    if (!centred && !historyAlone && (Math.abs(left - M) > 2 || Math.abs(right - R) > 2)) problems.push(`MARGIN row [${row.map((o) => o.name).join(', ')}] spans ${Math.round(left)}..${Math.round(right)}, not ${M}..${R}`);
  }
  console.info(`${label}: ${boxes.length} boxes, ${problems.length ? `${problems.length} problems` : 'clean'}`);
  for (const p of problems) console.info(`  ${p}`);
  failures += problems.length;
}

async function startRound() {
  for (let i = 0; i < 40 && (await phase()) !== 'running'; i++) {
    await page.mouse.click(195, 783);
    await page.waitForTimeout(300);
  }
  if ((await phase()) !== 'running') throw new Error('the round never started');
}

// One ride first, then CONTINUE: the waiting screen between rides, with the history strip filled. (A
// reload would start a fresh demo session with no history.)
await page.goto(pageUrl('longRound'), { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await startRound();
await page.waitForTimeout(1500);
await page.mouse.click(195, 783);
await page.waitForFunction(() => ['won', 'lost'].includes(window.__triptownView().phase), null, { polling: 10, timeout: 15000 });
await page.waitForTimeout(2500);
await page.mouse.click(195, 783);
await page.waitForFunction(() => window.__triptownView().phase === 'betting', null, { polling: 10, timeout: 15000 });
await page.waitForTimeout(800);
await audit('1-waiting');
await page.waitForTimeout(5000);
await startRound();
await page.waitForTimeout(2500);
await audit('2-riding-early');
await page.waitForFunction(() => window.__triptownView().multiplier >= 3, null, { polling: 10, timeout: 40000 });
await page.waitForTimeout(200);
await audit('3-riding-higher');
await page.mouse.click(195, 783);
await page.waitForTimeout(600);
await audit('4-heading-home');
await page.waitForFunction(() => ['won', 'lost'].includes(window.__triptownView().phase), null, { polling: 10, timeout: 15000 });
await page.waitForTimeout(1500);
await audit(`5-result-${await phase()}`);
await page.goto(pageUrl('quickCrash'), { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await startRound();
await page.waitForTimeout(4000);
await page.mouse.click(195, 783);
await page.waitForFunction(() => window.__triptownView().phase === 'lost', null, { polling: 10, timeout: 15000 });
await page.waitForTimeout(1500);
await audit('6-gate-shut');
await browser.close();
console.info(failures ? `layout-check FAILED (${failures})` : 'layout-check PASS');
process.exit(failures ? 1 : 0);
