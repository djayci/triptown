// Dev-only HUD preview: renders sample states at a fixed size and checks layout rules for tasks 8.1.
import '@fontsource/chivo/latin-400.css';
import '@fontsource/chivo/latin-700.css';
import '@fontsource/chivo/latin-800.css';
import '@fontsource/chivo/latin-900.css';
import '@fontsource/chivo-mono/latin-400.css';
import '@fontsource/chivo-mono/latin-600.css';
import { Hud, type HudState } from './hud/hud';

const q = new URLSearchParams(location.search);
const w = Number(q.get('w') ?? 390), h = Number(q.get('h') ?? 844);
const container = document.getElementById('hud')!;
container.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px`;

const base: HudState = {
  phase: 'betting', decimals: 2, balanceMinor: 123850, profileName: q.get('profile') ?? 'regulated-uk',
  showSessionClock: true, showNetPosition: true, partialCashout: q.get('partial') !== 'off',
  sessionSeconds: 761, sessionNetMinor: -340, betMinor: 1000, paperMinor: 200,
  papers: Array.from({ length: 5 }, () => ({ state: 'riding' as const })), autoCashout: null,
  betBlockedReason: null, cycleRemainingMs: 0, multiplier: 1, previousMultiplier: null, setbackMarker: false,
  liveLabel: 'RETURN NOW', ridingMinor: 1000, returnedSoFarMinor: 0, result: null, demo: q.get('demo') === '1',
};
const states: Record<string, Partial<HudState>> = {
  betting: {},
  insufficient: { balanceMinor: 500, betBlockedReason: 'Insufficient balance for this stake' },
  cycle: { cycleRemainingMs: 3800 },
  auto: { autoCashout: 2.5 },
  riding: { phase: 'riding', multiplier: 2.35, liveLabel: 'WIN NOW', ridingMinor: 1410, returnedSoFarMinor: 740, papers: [{ state: 'thrown', multiplier: 1.6, returnMinor: 320 }, { state: 'thrown', multiplier: 2.1, returnMinor: 420 }, { state: 'riding' }, { state: 'riding' }, { state: 'riding' }] },
  below: { phase: 'riding', multiplier: 0.95, previousMultiplier: 1.9, setbackMarker: true, liveLabel: 'RETURN NOW', ridingMinor: 950 },
  result: { phase: 'result', returnedSoFarMinor: 740, result: { win: false, returnedMinor: 740, netMinor: -260, note: '2 papers returned 3.20 and 4.20 · 3 papers lost' }, papers: [{ state: 'thrown', multiplier: 1.6, returnMinor: 320 }, { state: 'thrown', multiplier: 2.1, returnMinor: 420 }, { state: 'lost' }, { state: 'lost' }, { state: 'lost' }] },
};
const name = q.get('state') ?? 'riding';
const hud = new Hud(container, { bet() {}, changeBet() {}, changeAutoCashout() {}, throwOne() {}, throwAll() {}, continue() {}, exit() {}, openRules() {}, openHistory() {}, openSettings() {}, dismissNotice() {} });
hud.render({ ...base, ...states[name] });

// Layout checks: every interactive control is at least 44 px tall and fully inside the frame; key parts are visible.
setTimeout(() => {
  // The frame is the requested size; the container is pinned at the top-left corner.
  const frame = { top: 0, left: 0, right: w, bottom: h };
  const problems: string[] = [];
  for (const b of container.querySelectorAll('button')) {
    const r = b.getBoundingClientRect();
    if (r.height < 44) problems.push(`${b.dataset.action} height ${r.height}`);
    if (r.top < frame.top || r.bottom > frame.bottom || r.left < frame.left || r.right > frame.right) problems.push(`${b.dataset.action} outside frame [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] in [${Math.round(frame.right)}x${Math.round(frame.bottom)}]`);
  }
  for (const part of ['balance', 'clock', 'net']) if (!container.querySelector(`[data-part=${part}]`)) problems.push(`missing ${part}`);
  const overlaps = (a: Element, b: Element) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return !(x.bottom <= y.top || y.bottom <= x.top || x.right <= y.left || y.right <= x.left); };
  const panel = container.querySelector('[data-part=panel]');
  const mult = container.querySelector('[data-part=multiplier]');
  if (panel && mult && overlaps(panel, mult)) problems.push('multiplier overlaps panel');
  document.title = problems.length ? `FAIL ${problems.join('; ')}` : `PASS ${name} ${w}x${h} buttons=${container.querySelectorAll('button').length}`;
}, 1500);
