import { resolveConfigId, verifyRound } from '@triptown/fairness';
import './style.css';

// Fake operator page: embeds a game in a cross-origin iframe, shows the wallet and operator bridge events,
// and verifies revealed rounds with the shared fairness package.

const GAMES: Record<string, { url: string; title: string; configId: string }> = {
  'whack-crash': { url: (import.meta.env.VITE_WHACK_URL as string | undefined) ?? 'http://127.0.0.1:5173/', title: 'Whack Crash', configId: 'whack-crash/v1' },
  'paper-route': { url: (import.meta.env.VITE_PAPER_ROUTE_URL as string | undefined) ?? 'http://127.0.0.1:5175/', title: 'Paper Route', configId: 'paper-route/v1' },
};

const params = new URLSearchParams(location.search);
const gameId = params.get('game') && GAMES[params.get('game')!] ? params.get('game')! : 'whack-crash';
const game = GAMES[gameId]!;
const profile = params.get('profile') ?? '';

const gameSelect = document.querySelector<HTMLSelectElement>('#game-select')!;
const profileSelect = document.querySelector<HTMLSelectElement>('#profile-select')!;
gameSelect.value = gameId;
profileSelect.value = profile;
const reload = () => {
  const next = new URLSearchParams({ game: gameSelect.value, ...(profileSelect.value && { profile: profileSelect.value }) });
  location.search = next.toString();
};
gameSelect.addEventListener('change', reload);
profileSelect.addEventListener('change', reload);

// Demo builds read `profile` and accept this page as their operator origin; live builds ignore both.
const src = new URL(game.url);
if (profile) src.searchParams.set('profile', profile);
src.searchParams.set('operatorOrigin', location.origin);
const iframe = document.querySelector<HTMLIFrameElement>('#game')!;
iframe.title = game.title;
iframe.src = src.toString();

const balanceEl = document.querySelector<HTMLElement>('#balance')!;
const eventsEl = document.querySelector<HTMLOListElement>('#events')!;
const money = (minor: unknown) => (typeof minor === 'number' ? (minor / 100).toFixed(2) : '—');
window.addEventListener('message', (e: MessageEvent) => {
  if (src.origin !== e.origin) return;
  const data = e.data as { protocol?: string; type?: string; payload?: Record<string, unknown>; balanceMinor?: number; currency?: string };
  if (data?.type === 'triptown:balance' && typeof data.balanceMinor === 'number') {
    // Legacy Whack Crash message (until its bridge lands).
    balanceEl.textContent = `${money(data.balanceMinor)} ${data.currency ?? ''}`;
    return;
  }
  if (data?.protocol !== 'triptown' || !data.type) return;
  const p = data.payload ?? {};
  if (data.type === 'balance') balanceEl.textContent = `${money(p.balanceMinor)} ${String(p.currency ?? '')}`;
  const li = document.createElement('li');
  li.textContent =
    data.type === 'roundEnded'
      ? `roundEnded stake ${money(p.stakeMinor)} return ${money(p.returnMinor)} net ${money(p.netMinor)} (${String(p.kind)})`
      : `${data.type} ${JSON.stringify(p)}`;
  eventsEl.prepend(li);
});

const form = document.querySelector<HTMLFormElement>('#verify')!;
form.querySelector<HTMLInputElement>('[name=configId]')!.value = game.configId;
const out = document.querySelector<HTMLOutputElement>('#result')!;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(form);
  const config = resolveConfigId(String(f.get('configId')).trim());
  if (!config) {
    out.innerHTML = `<p class="bad">Unknown config id</p>`;
    return;
  }
  try {
    const result = verifyRound({
      serverSeed: String(f.get('serverSeed')).trim(),
      commit: String(f.get('commit')).trim(),
      clientSeed: String(f.get('clientSeed')),
      nonce: Number(f.get('nonce')),
      config,
    });
    const setbacks = result.setbacks.filter((t) => t < result.crashTime);
    out.innerHTML = result.verified
      ? `<p class="ok">✓ Seed matches the commit</p><p>Crash time: <b>${result.crashTime.toFixed(3)} s</b></p><p>Setbacks at: ${setbacks.map((t) => t.toFixed(3) + ' s').join(', ') || 'none'}</p>`
      : `<p class="bad">✗ Seed does not match the commit</p>`;
  } catch (err) {
    out.innerHTML = `<p class="bad">${(err as Error).message}</p>`;
  }
});
