/* global window, document, Image, requestAnimationFrame, getComputedStyle -- used inside page.evaluate callbacks that run in the browser */
// HUD checks (paper-route-iso-look 5.4, 5.5): panel contrast over the brightest and darkest parts of
// the scene, and layout stability while money counts up.
// Usage: node scripts/hud-check.mjs [--url http://127.0.0.1:5176/] [--profile regulated-uk] [--out file.json]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://127.0.0.1:5176/');
const profileName = arg('profile', 'regulated-uk');
const out = arg('out', null);
/** WCAG AA for body text; the project's floor for HUD copy. */
const MIN_CONTRAST = 4.5;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?profile=${profileName}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__paperRoute?.session, null, { timeout: 30_000 });

// Run a round so the riding HUD (the busiest panel) is on screen while sampling.
await page.evaluate(async () => {
  const c = window.__paperRoute;
  c.d.service.forceNext('bigWin');
  await c.bet();
});
await page.waitForFunction(() => window.__paperRoute.phase === 'riding', null, { timeout: 10_000 });
await page.waitForTimeout(1200);

// Sample the scene alone (HUD hidden) so the panel's translucency can be composited over the real
// extremes behind it.
await page.evaluate(() => (document.querySelector('.pr-hud').style.visibility = 'hidden'));
const sceneShot = (await page.screenshot({ type: 'png' })).toString('base64');
const scenePixels = await page.evaluate(async (data) => {
  const srgb = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const img = new Image();
  img.src = `data:image/png;base64,${data}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data: px } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let brightest = [0, 0, 0];
  let darkest = [255, 255, 255];
  for (let i = 0; i < px.length; i += 4 * 31) {
    const c = [px[i], px[i + 1], px[i + 2]];
    if (luminance(c) > luminance(brightest)) brightest = c;
    if (luminance(c) < luminance(darkest)) darkest = c;
  }
  return { brightest, darkest };
}, sceneShot);
await page.evaluate(() => (document.querySelector('.pr-hud').style.visibility = ''));

const contrast = await page.evaluate(({ min, brightest, darkest }) => {
  const srgb = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const ratio = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const parse = (css) => css.match(/[\d.]+/g).map(Number);
  /** Text colour as it actually lands: its own alpha composited over the panel behind it. */
  const inkOver = (css, behind) => {
    const [r, g, b, a = 1] = parse(css);
    return [r, g, b].map((v, i) => v * a + behind[i] * (1 - a));
  };
  // Composite the translucent panel over each extreme, then measure the text against it.
  const panel = document.querySelector('[data-part="panel"]');
  const style = getComputedStyle(panel);
  const panelRgba = style.backgroundColor.match(/[\d.]+/g).map(Number);
  const alpha = panelRgba[3] ?? 1;
  const over = (scene) => panelRgba.slice(0, 3).map((v, i) => v * alpha + scene[i] * (1 - alpha));
  const inkCss = getComputedStyle(document.querySelector('[data-part="live"]')).color;
  const dimCss = getComputedStyle(panel.querySelector('.pr-dim')).color;
  const primary = document.querySelector('[data-action="throw"]');
  const primaryBg = parse(getComputedStyle(primary).backgroundColor).slice(0, 3);
  const primaryRatio = ratio(inkOver(getComputedStyle(primary).color, primaryBg), primaryBg);
  const results = {
    overBrightest: { ink: ratio(inkOver(inkCss, over(brightest)), over(brightest)), dim: ratio(inkOver(dimCss, over(brightest)), over(brightest)) },
    overDarkest: { ink: ratio(inkOver(inkCss, over(darkest)), over(darkest)), dim: ratio(inkOver(dimCss, over(darkest)), over(darkest)) },
    primaryButton: primaryRatio,
    brightest,
    darkest,
  };
  const all = [results.overBrightest.ink, results.overBrightest.dim, results.overDarkest.ink, results.overDarkest.dim, primaryRatio];
  return { ...results, min: Math.min(...all), pass: Math.min(...all) >= min };
}, { min: MIN_CONTRAST, ...scenePixels });

// Money counts up while riding; the digits must keep their width and move nothing around them.
const layout = await page.evaluate(async () => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, w: Math.round(r.width * 100) / 100, text: el.textContent };
  };
  const samples = [];
  const start = Date.now();
  while (Date.now() - start < 3000 && window.__paperRoute.phase === 'riding') {
    samples.push({ label: rect('[data-part="live"] .pr-label'), value: rect('[data-part="live"] .pr-num'), panel: rect('[data-part="panel"]') });
    await new Promise((r) => requestAnimationFrame(r));
  }
  const values = samples.map((s) => s.value.text);
  const digits = (t) => t.replace(/[^\d]/g, '').length;
  const widthsByDigits = new Map();
  for (const s of samples) {
    const key = digits(s.value.text);
    if (!widthsByDigits.has(key)) widthsByDigits.set(key, new Set());
    widthsByDigits.get(key).add(s.value.w);
  }
  return {
    samples: samples.length,
    distinctValues: new Set(values).size,
    labelMoved: new Set(samples.map((s) => `${s.label.x},${s.label.y}`)).size,
    panelMoved: new Set(samples.map((s) => `${s.panel.x},${s.panel.y},${s.panel.w}`)).size,
    widthsPerDigitCount: [...widthsByDigits].map(([d, w]) => [d, [...w]]),
    valueRightEdgeMoved: new Set(samples.map((s) => Math.round((s.value.x + s.value.w) * 10))).size,
  };
});
layout.pass =
  layout.distinctValues > 5 &&
  layout.labelMoved === 1 &&
  layout.panelMoved === 1 &&
  layout.valueRightEdgeMoved === 1 &&
  layout.widthsPerDigitCount.every(([, widths]) => widths.length === 1);

const result = { check: 'paper-route hud', profile: profileName, contrast, layout, errors, pass: contrast.pass && layout.pass && errors.length === 0 };
console.log(JSON.stringify(result, null, 1));
if (out) writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
await browser.close();
process.exit(result.pass ? 0 : 1);
