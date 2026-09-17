// End-to-end proof of the 18+ gate against the real server (spec: No play without the 18+ confirmation).
// Usage: `pnpm build && pnpm start`, then `pnpm e2e [baseUrl]`. Exits non-zero on any failure.
import { chromium, type Browser, type Request } from 'playwright-core';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE_COOKIE } from '../src/gate';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.argv[2] ?? 'http://localhost:5180';
const origin = new URL(base).origin;
const siteDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATE_DEMO = '/play/gate/index.html';

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

async function rawFetch(path: string, cookie?: string) {
  return fetch(new URL(path, base), { redirect: 'manual', headers: cookie ? { cookie } : {} });
}

async function run(browser: Browser) {
  // (a) No cookie: the page and a real hashed asset are refused with none of their bytes.
  const asset = readdirSync(join(siteDir, 'public', 'play', 'gate', 'assets')).find((f) => f.endsWith('.js'));
  if (!asset) throw new Error('no built gate asset; run the site build first');
  for (const path of [GATE_DEMO, `/play/gate/assets/${asset}`]) {
    const res = await rawFetch(path);
    const body = await res.text();
    const location = res.headers.get('location') ?? '';
    check(res.status === 307, `(a) ${path} without the cookie answers 307 (got ${res.status})`);
    check(
      new URL(location, base).searchParams.get('next') === path,
      `(a) ${path} redirects to the gate with next=${path}`,
    );
    const real = await rawFetch(path, `${GATE_COOKIE}=1`);
    const realBody = await real.text();
    check(real.status === 200 && realBody.length > 200, `(a) ${path} with the cookie answers 200`);
    check(!body.includes(realBody.slice(0, 200)), `(a) the refusal for ${path} carries none of the file`);
    check((res.headers.get('x-robots-tag') ?? '').includes('noindex'), `(a) ${path} carries noindex`);
  }
  const bare = await rawFetch('/play/gate/');
  check(bare.status >= 300 && bare.status < 400, '(a) a directory URL redirects rather than serving');

  // (b) The home page before confirming has no /play/ link.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const playRequests: string[] = [];
  const offOrigin: string[] = [];
  const onRequest = (req: Request) => {
    const url = new URL(req.url());
    if (url.origin === origin && url.pathname.startsWith('/play/')) playRequests.push(url.pathname);
    if (url.origin !== origin && !url.protocol.startsWith('data') && !url.protocol.startsWith('blob')) {
      offOrigin.push(req.url());
    }
  };
  page.on('request', onRequest);
  await page.goto(base, { waitUntil: 'networkidle' });
  check((await page.locator('a[href*="/play/"]').count()) === 0, '(b) the unconfirmed home page has no /play/ link');
  check((await page.locator('.row-locked').count()) === 2, '(b) the unconfirmed home page shows the live games greyed out');
  await page.locator('.row-locked').first().click({ force: true });
  check(new URL(page.url()).pathname === '/', '(b) clicking a greyed-out game goes nowhere');

  // (c) NO leaves no cookie and no link.
  await page.getByRole('button', { name: 'NO' }).click();
  await page.waitForURL(/declined=1/);
  const afterNo = await context.cookies(base);
  check(!afterNo.some((c) => c.name === GATE_COOKIE), '(c) declining stores no cookie');
  check((await page.locator('a[href*="/play/"]').count()) === 0, '(c) the declined page has no /play/ link');
  const blocked = await page.goto(new URL(GATE_DEMO, base).href);
  check(new URL(page.url()).pathname === '/' && blocked?.status() === 200, '(c) a declined visitor opening a demo lands on the gate');

  // (d) Keyboard: Tab to YES, Enter, and land on the demo that was asked for.
  await page.goto(new URL(`/?next=${encodeURIComponent(GATE_DEMO)}`, base).href, { waitUntil: 'networkidle' });
  let focused = '';
  for (let i = 0; i < 12 && focused !== 'YES, 18+'; i++) {
    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  }
  check(focused === 'YES, 18+', '(d) Tab reaches "YES, 18+"');
  const atlasRequests: string[] = [];
  page.on('request', (req) => {
    if (/atlas-(adult|candy)\.(json|png)/.test(req.url())) atlasRequests.push(req.url());
  });
  await Promise.all([page.waitForURL(/\/play\/gate\/index\.html/), page.keyboard.press('Enter')]);
  const cookie = (await context.cookies(base)).find((c) => c.name === GATE_COOKIE);
  check(cookie?.value === '1', '(d) confirming sets the gate cookie');
  check(cookie !== undefined && cookie.expires === -1, '(d) the gate cookie is a session cookie');
  check(cookie?.httpOnly === true, '(d) the gate cookie is HttpOnly');
  await page
    .waitForFunction(
      () => (window as unknown as { __triptownView?: () => { phase: string } }).__triptownView?.().phase === 'betting',
      null,
      { timeout: 20_000 },
    )
    .then(() => check(true, '(d) the demo reaches its betting screen'))
    .catch(() => check(false, '(d) the demo reaches its betting screen'));
  check(atlasRequests.length > 0, '(d) the demo loads its art from the site');
  // The DEMO label is drawn in the canvas; the demo build's hook exposes that this is a demo build.
  const demo = await page.evaluate(() => typeof (window as unknown as { __triptownView?: unknown }).__triptownView === 'function');
  check(demo, '(d) the served build is the demo build (demo hooks present)');

  // (e) The confirmed home page loads nothing under /play/.
  playRequests.length = 0;
  await page.goto(base, { waitUntil: 'networkidle' });
  check((await page.locator('a[href*="/play/"]').count()) === 2, '(e) the confirmed home page links two live demos');
  check(playRequests.length === 0, `(e) the confirmed home page requested nothing under /play/ (${playRequests.length})`);

  // (g) No demo request left the site's origin (fonts are self-hosted by next/font).
  check(offOrigin.length === 0, `(g) no request to another origin (${offOrigin.slice(0, 3).join(', ')})`);
  await context.close();

  // (f) A new browser session is gated again.
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto(new URL(GATE_DEMO, base).href);
  check(new URL(freshPage.url()).pathname === '/', '(f) a new session opening a demo lands on the gate');
  await fresh.close();
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
});
try {
  await run(browser);
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`\ne2e-gate: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\ne2e-gate: all checks passed');
