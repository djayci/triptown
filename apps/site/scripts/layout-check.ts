// Layout at the two reference sizes: no horizontal scroll, the play-money statement above the first game,
// Play columns aligned across rows, and evidence screenshots of every gate state.
// Usage: site running, then `pnpm check:layout [baseUrl] [evidenceDir]`.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { GATE_COOKIE } from '../src/gate';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.argv[2] ?? 'http://localhost:5180';
const evidence = process.argv[3];
if (evidence) mkdirSync(evidence, { recursive: true });

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

const SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1440x900', width: 1440, height: 900 },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const size of SIZES) {
    for (const state of ['ask', 'declined', 'confirmed'] as const) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        reducedMotion: 'reduce',
      });
      if (state === 'confirmed') await context.addCookies([{ name: GATE_COOKIE, value: '1', url: base }]);
      const page = await context.newPage();
      await page.goto(new URL(state === 'declined' ? '/?declined=1' : '/', base).href, { waitUntil: 'networkidle' });
      const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      check(scroll.sw <= scroll.iw, `${size.name} ${state}: no horizontal scroll (${scroll.sw} <= ${scroll.iw})`);

      if (state === 'confirmed') {
        const layout = await page.evaluate(() => {
          const statement = document.querySelector('.games-head p')!.getBoundingClientRect();
          const rows = [...document.querySelectorAll('.row')].map((r) => r.getBoundingClientRect().top);
          const plays = [...document.querySelectorAll('.row-play')].map((p) => p.getBoundingClientRect());
          return {
            statementBottom: statement.bottom,
            firstRowTop: rows[0] ?? 0,
            playLefts: plays.map((p) => Math.round(p.left)),
            playRights: plays.map((p) => Math.round(p.right)),
          };
        });
        check(layout.statementBottom <= layout.firstRowTop, `${size.name}: the play-money statement is above the first game`);
        if (size.width >= 1440) {
          check(new Set(layout.playLefts).size === 1, `${size.name}: Play column dividers align (${layout.playLefts.join(', ')})`);
          check(new Set(layout.playRights).size === 1, `${size.name}: Play columns end together`);
        }
      }
      if (evidence) await page.screenshot({ path: join(evidence, `${state}-${size.name}.png`), fullPage: true });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length > 0) process.exit(1);
