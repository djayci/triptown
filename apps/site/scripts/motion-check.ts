// The wordmark barely moves (spec): its box never changes, the VHS bands show for under 400 ms at most
// every 4 s, and nothing animates under reduced motion. Usage: site running, then `pnpm check:motion`.
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.argv[2] ?? 'http://localhost:5180';
const SAMPLE_MS = 50;
const DURATION_MS = 20_000;

type Sample = { t: number; box: string; bandsVisible: boolean };

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  // Sample inside the page so round trips do not skew the timing.
  const samples = await page.evaluate(
    ({ sampleMs, durationMs }) =>
      new Promise<Sample[]>((resolve) => {
        const word = document.querySelector('h1.word')!;
        const bands = [...document.querySelectorAll('.band')];
        const out: Sample[] = [];
        const start = performance.now();
        const timer = setInterval(() => {
          const r = word.getBoundingClientRect();
          out.push({
            t: performance.now() - start,
            box: [r.x, r.y, r.width, r.height].map((n) => n.toFixed(2)).join(','),
            bandsVisible: bands.some((b) => Number(getComputedStyle(b).opacity) > 0.01),
          });
          if (performance.now() - start >= durationMs) {
            clearInterval(timer);
            resolve(out);
          }
        }, sampleMs);
      }),
    { sampleMs: SAMPLE_MS, durationMs: DURATION_MS },
  );

  check(new Set(samples.map((s) => s.box)).size === 1, `wordmark box never changes over ${samples.length} samples`);

  // Group consecutive visible samples into windows.
  const windows: { from: number; to: number }[] = [];
  for (const s of samples) {
    const last = windows.at(-1);
    if (!s.bandsVisible) continue;
    if (last && s.t - last.to <= SAMPLE_MS * 1.5) last.to = s.t;
    else windows.push({ from: s.t, to: s.t });
  }
  const lengths = windows.map((w) => Math.round(w.to - w.from + SAMPLE_MS));
  check(windows.length >= 1, `the distortion runs (${windows.length} window(s): ${lengths.join(', ')} ms)`);
  check(windows.length <= 5, 'the distortion shows at most 5 times in 20 s');
  check(lengths.every((l) => l < 400), 'each distortion lasts under 400 ms');
  const gaps = windows.slice(1).map((w, i) => w.from - windows[i]!.from);
  check(gaps.every((g) => g >= 4000), `distortions are at least 4 s apart (${gaps.map(Math.round).join(', ')} ms)`);

  const reduced = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  ).newPage();
  await reduced.goto(base, { waitUntil: 'networkidle' });
  const running = await reduced.evaluate(() =>
    [...document.querySelectorAll('.wordmark, .wordmark *')].flatMap((el) => el.getAnimations()).length,
  );
  check(running === 0, `no animation runs under reduced motion (${running})`);
  const bandsShown = await reduced.evaluate(() =>
    [...document.querySelectorAll('.band')].some((b) => getComputedStyle(b).display !== 'none'),
  );
  check(!bandsShown, 'the band copies are not rendered under reduced motion');
} finally {
  await browser.close();
}
if (failures.length > 0) process.exit(1);
