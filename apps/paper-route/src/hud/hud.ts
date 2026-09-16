import { formatMinor } from '@triptown/core';
import type { LiveLabel } from '../game/display';

// DOM HUD for Paper Route. It only renders a view model and reports intents; rules about what may be
// celebrated or shown live in game/display.ts and core, so the HUD cannot drift from them.

export type HudPhase = 'betting' | 'riding' | 'result';

export interface HudPaper {
  state: 'riding' | 'thrown' | 'lost' | 'pending';
  multiplier?: number;
  returnMinor?: number;
}

export interface HudState {
  phase: HudPhase;
  decimals: number;
  balanceMinor: number;
  profileName: string;
  showSessionClock: boolean;
  showNetPosition: boolean;
  partialCashout: boolean;
  sessionSeconds: number;
  sessionNetMinor: number;
  betMinor: number;
  paperMinor: number;
  papers: HudPaper[];
  autoCashout: number | null;
  betBlockedReason: string | null;
  cycleRemainingMs: number;
  multiplier: number;
  previousMultiplier: number | null;
  setbackMarker: boolean;
  liveLabel: LiveLabel;
  ridingMinor: number;
  returnedSoFarMinor: number;
  result: { win: boolean; returnedMinor: number; netMinor: number; note: string } | null;
  demo: boolean;
  /** Blocking card between rounds (operator pause, closed game, idle prompt, operator message). */
  notice?: { title: string; text: string; actions: ('continue' | 'exit')[] } | null;
}

export interface HudIntents {
  bet(): void;
  changeBet(direction: -1 | 1): void;
  changeAutoCashout(direction: -1 | 1): void;
  throwOne(): void;
  throwAll(): void;
  continue(): void;
  exit(): void;
  openRules(): void;
  openHistory(): void;
  openSettings(): void;
  dismissNotice(): void;
}

const CSS = `
.pr-hud { position: absolute; inset: 0; font-family: Chivo, 'Helvetica Neue', Arial, sans-serif; color: #27221f; pointer-events: none; }
.pr-hud button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; pointer-events: auto; min-height: 44px; }
.pr-hud button:disabled { opacity: .45; cursor: not-allowed; }
/* Light panels over the scene; a soft shadow keeps them readable over both bright road and dark shade. */
.pr-hud .pr-glass, .pr-glass { background: rgba(250,246,240,.9); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 6px 24px rgba(60,40,30,.18); }
.pr-dim { color: rgba(39,34,31,.74); }
.pr-cond { font-weight: 800; letter-spacing: -.2px; }
/* Money, multipliers and the clock: monospaced so digits keep their width while they count. */
.pr-num { font-family: 'Chivo Mono', 'SFMono-Regular', Menlo, monospace; font-variant-numeric: tabular-nums; font-weight: 600; }
.pr-top { position: absolute; left: 12px; right: 12px; top: calc(12px + env(safe-area-inset-top, 0px)); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.pr-brand { border-radius: 22px; height: 44px; padding: 0 14px; display: flex; align-items: center; gap: 8px; font-size: 15px; white-space: nowrap; }
.pr-badge { font-size: 9px; letter-spacing: .3px; white-space: nowrap; }
.pr-icons { display: flex; gap: 6px; }
.pr-icon { width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center; }
.pr-strip { position: absolute; left: 12px; right: 12px; top: calc(64px + env(safe-area-inset-top, 0px)); border-radius: 16px; min-height: 32px; padding: 0 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; }
.pr-strip b { font-weight: inherit; }
.pr-mult { position: absolute; left: 0; right: 0; top: calc(112px + env(safe-area-inset-top, 0px)); display: flex; flex-direction: column; align-items: center; gap: 2px; color: #faf6f0; text-shadow: 0 4px 24px rgba(60,40,30,.45); }
.pr-mult .pr-value { font-size: clamp(56px, 21vw, 88px); line-height: 1; font-weight: 600; }
.pr-mult .pr-prev { font-size: 18px; text-decoration: line-through; color: rgba(250,246,240,.85); }
.pr-marker { position: absolute; right: 24px; top: 150px; border-radius: 10px; padding: 4px 10px; background: rgba(39,34,31,.55); color: #faf6f0; font-size: 18px; font-weight: 800; letter-spacing: .5px; }
.pr-result { position: absolute; left: 24px; right: 24px; top: 28%; border-radius: 22px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.pr-result .pr-amount { font-size: 34px; line-height: 1.1; font-weight: 900; letter-spacing: -1px; }
.pr-result .pr-net { font-size: 17px; }
.pr-result[data-win=true] .pr-label { color: #b8492a; }
.pr-panel { position: absolute; left: 12px; right: 12px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); border-radius: 22px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.pr-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 2px; }
.pr-label { font-size: 11px; font-weight: 700; letter-spacing: .8px; }
.pr-papers { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.pr-paper { border-radius: 12px; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 1.5px solid rgba(39,34,31,.18); background: rgba(39,34,31,.06); font-size: 16px; }
.pr-paper small { font-size: 10px; color: rgba(39,34,31,.74); }
.pr-paper[data-state=thrown] { background: #27221f; border-color: #27221f; color: #faf6f0; }
.pr-paper[data-state=thrown] small { color: rgba(250,246,240,.62); }
.pr-paper[data-state=lost] { background: none; border-style: dashed; color: rgba(39,34,31,.4); font-size: 12px; }
.pr-paper[data-state=lost] small { color: rgba(39,34,31,.4); }
.pr-paper[data-state=pending] { opacity: .6; }
.pr-actions { display: flex; gap: 8px; }
/* The warm accent is reserved for the primary action (and win copy above). */
.pr-primary { flex: 1; min-height: 62px !important; border-radius: 16px; background: #b8492a !important; color: #fff8f2 !important; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 18px !important; }
.pr-primary .pr-cond { font-size: 24px; }
.pr-primary span, .pr-secondary span { white-space: nowrap; }
.pr-primary .pr-num { font-size: 13px; }
.pr-secondary { min-width: 100px; min-height: 62px !important; border-radius: 16px; border: 1.5px solid rgba(39,34,31,.75) !important; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 12px !important; font-size: 12px; }
.pr-secondary .pr-cond { font-size: 18px; }
.pr-stepper { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.pr-step { width: 44px; flex: none; border-radius: 14px; border: 1.5px solid rgba(39,34,31,.45) !important; font-size: 22px; }
.pr-reason { font-size: 12px; color: #a24a3a; text-align: center; min-height: 16px; }
.pr-veil { position: absolute; inset: 0; background: rgba(39,34,31,.35); pointer-events: auto; }
.pr-demo { position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%); font-size: 11px; font-weight: 700; letter-spacing: 2px; color: rgba(250,246,240,.85); }
@media (max-height: 700px) { .pr-mult { top: 100px; } .pr-paper { min-height: 44px; } .pr-panel { gap: 8px; padding: 10px; } }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const ICON_HELP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9"/><path d="M12 17.2v.1"/></svg>';
const ICON_SETTINGS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>';
const ICON_HISTORY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/></svg>';

export class Hud {
  readonly root = el('div', 'pr-hud');

  constructor(container: HTMLElement, private readonly intents: HudIntents) {
    if (!document.getElementById('pr-hud-css')) {
      const style = el('style');
      style.id = 'pr-hud-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    container.appendChild(this.root);
  }

  render(s: HudState): void {
    const money = (minor: number) => formatMinor(minor, { decimals: s.decimals });
    const signed = (minor: number) => (minor > 0 ? `+${money(minor)}` : minor < 0 ? `−${money(-minor)}` : money(0));
    const parts: HTMLElement[] = [];

    // Top bar: brand, profile, rules and history are reachable in every state.
    const top = el('div', 'pr-top');
    const brand = el('div', 'pr-glass pr-brand');
    brand.append(el('span', 'pr-cond', 'PAPER ROUTE'), el('span', 'pr-badge pr-dim', s.profileName.toUpperCase()));
    const icons = el('div', 'pr-icons');
    const rules = el('button', 'pr-glass pr-icon');
    rules.innerHTML = ICON_HELP;
    rules.setAttribute('aria-label', 'Rules and help');
    rules.dataset.action = 'rules';
    rules.onclick = () => this.intents.openRules();
    const history = el('button', 'pr-glass pr-icon');
    history.innerHTML = ICON_HISTORY;
    history.setAttribute('aria-label', 'Round history');
    history.dataset.action = 'history';
    history.onclick = () => this.intents.openHistory();
    const settings = el('button', 'pr-glass pr-icon');
    settings.innerHTML = ICON_SETTINGS;
    settings.setAttribute('aria-label', 'Sound and effects settings');
    settings.dataset.action = 'settings';
    settings.onclick = () => this.intents.openSettings();
    icons.append(settings, rules, history);
    top.append(brand, icons);
    parts.push(top);

    const strip = el('div', 'pr-glass pr-strip pr-dim');
    strip.dataset.part = 'strip';
    const stat = (label: string, value: string, part: string) => {
      const span = el('span', '', `${label} `);
      span.dataset.part = part;
      span.appendChild(el('b', 'pr-num', value));
      return span;
    };
    strip.appendChild(stat('Balance', money(s.balanceMinor), 'balance'));
    if (s.showSessionClock) {
      const h = Math.floor(s.sessionSeconds / 3600), m = Math.floor(s.sessionSeconds / 60) % 60, sec = Math.floor(s.sessionSeconds) % 60;
      strip.appendChild(stat('Session', [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':'), 'clock'));
    }
    if (s.showNetPosition) strip.appendChild(stat('Net', signed(s.sessionNetMinor), 'net'));
    parts.push(strip);

    if (s.phase === 'riding') {
      const mult = el('div', 'pr-mult');
      mult.setAttribute('aria-live', 'off');
      if (s.previousMultiplier !== null) mult.appendChild(el('span', 'pr-prev pr-num', `×${s.previousMultiplier.toFixed(2)}`));
      const value = el('span', 'pr-num pr-value', `×${s.multiplier.toFixed(2)}`);
      value.dataset.part = 'multiplier';
      mult.appendChild(value);
      parts.push(mult);
      if (s.setbackMarker) parts.push(el('div', 'pr-marker', '−50%'));
    }

    if (s.phase === 'result' && s.result) {
      const card = el('div', 'pr-glass pr-result');
      card.setAttribute('role', 'status');
      card.dataset.part = 'result';
      card.dataset.win = String(s.result.win);
      const amount = el('span', 'pr-amount');
      amount.append(document.createTextNode('Returned '), el('span', 'pr-num', money(s.result.returnedMinor)));
      card.append(el('span', 'pr-label pr-dim', s.result.win ? 'ROUND WON' : 'ROUND ENDED'), amount);
      const net = el('span', 'pr-net pr-num', `Net ${signed(s.result.netMinor)}`);
      net.style.color = s.result.netMinor > 0 ? '#3f7a4a' : s.result.netMinor < 0 ? '#a24a3a' : '#27221f';
      card.append(net, el('span', 'pr-dim', s.result.note));
      parts.push(card);
    }

    // Bottom panel.
    const panel = el('div', 'pr-glass pr-panel');
    panel.dataset.part = 'panel';
    const head = el('div', 'pr-row');
    const headValue = (label: string, value: string) => {
      const span = el('span', 'pr-dim', `${label} `);
      span.appendChild(el('b', 'pr-num', value));
      return span;
    };
    head.append(
      el('span', 'pr-label pr-dim', s.partialCashout ? `STAKE ${money(s.betMinor)} · ${s.papers.length} PAPERS` : `STAKE ${money(s.betMinor)}`),
      headValue(s.phase === 'betting' ? 'Paper' : 'Returned so far', money(s.phase === 'betting' ? s.paperMinor : s.returnedSoFarMinor)),
    );
    panel.appendChild(head);

    if (s.partialCashout) {
      const grid = el('div', 'pr-papers');
      grid.dataset.part = 'papers';
      for (const p of s.papers) {
        const tile = el('div', 'pr-paper');
        tile.dataset.state = p.state;
        if (p.state === 'thrown') tile.append(el('small', 'pr-num', `×${(p.multiplier ?? 0).toFixed(2)}`), el('span', 'pr-num', money(p.returnMinor ?? 0)));
        else if (p.state === 'lost') tile.append(el('small', '', 'lost'), el('span', '', '—'));
        else tile.append(el('small', '', 'stake'), el('span', 'pr-num', money(s.paperMinor)));
        grid.appendChild(tile);
      }
      panel.appendChild(grid);
    }

    if (s.phase === 'betting') {
      const row = el('div', 'pr-row');
      const stepper = el('div', 'pr-stepper');
      const minus = el('button', 'pr-step', '−');
      minus.setAttribute('aria-label', 'Lower stake');
      minus.dataset.action = 'bet-down';
      minus.onclick = () => this.intents.changeBet(-1);
      const plus = el('button', 'pr-step', '+');
      plus.setAttribute('aria-label', 'Raise stake');
      plus.dataset.action = 'bet-up';
      plus.onclick = () => this.intents.changeBet(1);
      stepper.append(minus, el('span', 'pr-num', money(s.betMinor)), plus);
      const auto = el('div', 'pr-stepper');
      const autoDown = el('button', 'pr-step', '−');
      autoDown.setAttribute('aria-label', 'Lower auto cash-out');
      autoDown.dataset.action = 'auto-down';
      autoDown.onclick = () => this.intents.changeAutoCashout(-1);
      const autoUp = el('button', 'pr-step', '+');
      autoUp.setAttribute('aria-label', 'Raise auto cash-out');
      autoUp.dataset.action = 'auto-up';
      autoUp.onclick = () => this.intents.changeAutoCashout(1);
      const autoLabel = el('span', s.autoCashout ? 'pr-num' : 'pr-dim', s.autoCashout ? `Auto ×${s.autoCashout.toFixed(2)}` : 'Auto off');
      autoLabel.dataset.part = 'auto';
      auto.append(autoDown, autoLabel, autoUp);
      row.append(stepper, auto);
      panel.appendChild(row);
      const bet = el('button', 'pr-primary');
      bet.dataset.action = 'bet';
      const waiting = s.cycleRemainingMs > 0;
      bet.disabled = Boolean(s.betBlockedReason) || waiting;
      bet.append(el('span', 'pr-cond', waiting ? `Wait ${Math.ceil(s.cycleRemainingMs / 1000)}s` : 'Bet'), el('span', 'pr-num', money(s.betMinor)));
      bet.onclick = () => this.intents.bet();
      const actions = el('div', 'pr-actions');
      actions.appendChild(bet);
      panel.appendChild(actions);
      panel.appendChild(el('div', 'pr-reason', s.betBlockedReason ?? ''));
    }

    if (s.phase === 'riding') {
      const riding = s.papers.filter((p) => p.state === 'riding').length;
      const live = el('div', 'pr-row');
      live.dataset.part = 'live';
      live.append(el('span', 'pr-label', s.partialCashout ? `${s.liveLabel} · ${riding} RIDING` : s.liveLabel), el('span', 'pr-num', money(s.ridingMinor)));
      panel.appendChild(live);
      const actions = el('div', 'pr-actions');
      const throwOne = el('button', 'pr-primary');
      throwOne.dataset.action = 'throw';
      throwOne.disabled = riding === 0;
      const oneValue = riding > 0 ? Math.floor(s.ridingMinor / riding) : 0;
      const throwValue = el('span', 'pr-num', s.partialCashout ? `1 paper · ${money(oneValue)}` : money(s.ridingMinor));
      throwOne.append(el('span', 'pr-cond', s.partialCashout ? 'Throw' : 'Cash out'), throwValue);
      throwOne.onclick = () => (s.partialCashout ? this.intents.throwOne() : this.intents.throwAll());
      actions.appendChild(throwOne);
      if (s.partialCashout) {
        const all = el('button', 'pr-secondary');
        all.dataset.action = 'all';
        all.disabled = riding === 0;
        all.append(el('span', 'pr-cond', 'All'), el('span', 'pr-num', money(s.ridingMinor)));
        all.onclick = () => this.intents.throwAll();
        actions.appendChild(all);
      }
      panel.appendChild(actions);
    }

    if (s.phase === 'result') {
      const actions = el('div', 'pr-actions');
      const cont = el('button', 'pr-secondary', 'Continue');
      cont.classList.add('pr-cond');
      cont.style.flex = '1';
      cont.dataset.action = 'continue';
      cont.onclick = () => this.intents.continue();
      const exit = el('button', 'pr-secondary', 'Exit');
      exit.classList.add('pr-cond');
      exit.style.flex = '1';
      exit.dataset.action = 'exit';
      exit.onclick = () => this.intents.exit();
      actions.append(cont, exit);
      panel.appendChild(actions);
    }
    parts.push(panel);

    if (s.notice) {
      const veil = el('div', 'pr-veil');
      const card = el('div', 'pr-glass pr-result');
      card.setAttribute('role', 'alertdialog');
      card.dataset.part = 'notice';
      card.append(el('span', 'pr-label pr-dim', s.notice.title.toUpperCase()), el('span', '', s.notice.text));
      const actions = el('div', 'pr-actions');
      actions.style.alignSelf = 'stretch';
      for (const a of s.notice.actions) {
        const b = el('button', 'pr-secondary pr-cond', a === 'continue' ? 'Continue' : 'Exit');
        b.style.flex = '1';
        b.dataset.action = `notice-${a}`;
        b.onclick = () => (a === 'continue' ? this.intents.dismissNotice() : this.intents.exit());
        actions.appendChild(b);
      }
      if (s.notice.actions.length) card.appendChild(actions);
      veil.appendChild(card);
      parts.push(veil);
      // Betting is blocked while a notice is up.
      panel.querySelectorAll<HTMLButtonElement>('[data-action=bet]').forEach((b) => (b.disabled = true));
    }

    if (s.demo) parts.push(el('div', 'pr-demo', 'DEMO'));
    const next = el('div');
    next.append(...parts);
    morphChildren(this.root, next);
  }
}

/**
 * Patches `target` to match `source` in place. The HUD renders every frame; replacing the nodes would
 * mean a press and its release land on different buttons, so the tap never becomes a click.
 * Nodes are kept when their tag, action and part match, so a press on BET never releases on THROW.
 */
export function morphChildren(target: Element, source: Element): void {
  const from = Array.from(target.childNodes);
  const to = Array.from(source.childNodes);
  to.forEach((node, i) => {
    const current = from[i];
    if (current && sameKind(current, node)) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (current.nodeValue !== node.nodeValue) current.nodeValue = node.nodeValue;
      } else {
        syncElement(current as Element, node as Element);
      }
    } else if (current) {
      target.replaceChild(node, current);
    } else {
      target.appendChild(node);
    }
  });
  for (let i = from.length - 1; i >= to.length; i--) from[i]!.remove();
}

function sameKind(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false;
  if (!(a instanceof Element) || !(b instanceof Element)) return true;
  return a.tagName === b.tagName && a.getAttribute('data-action') === b.getAttribute('data-action') && a.getAttribute('data-part') === b.getAttribute('data-part');
}

function syncElement(target: Element, source: Element): void {
  for (const { name } of Array.from(target.attributes)) if (!source.hasAttribute(name)) target.removeAttribute(name);
  for (const { name, value } of Array.from(source.attributes)) if (target.getAttribute(name) !== value) target.setAttribute(name, value);
  if (target instanceof HTMLElement && source instanceof HTMLElement) {
    target.onclick = source.onclick;
    if (target instanceof HTMLButtonElement && source instanceof HTMLButtonElement) target.disabled = source.disabled;
  }
  morphChildren(target, source);
}
