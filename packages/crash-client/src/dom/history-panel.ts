import type { RoundService, RoundSummary } from '@triptown/rgs-client';
import { formatMinor, type CurrencyRules } from '@triptown/core';
import { formatMultiplier } from '../game/display';

// In-game round history (GLI-19 §4.14, PT R37, Brazil items 54-55). Every entry states its result in
// words as well as colour, so it survives greyscale and colour-blind viewing, and the detail view is
// labelled as a past round so it can never be mistaken for the live one.

const CSS = `
.hp-backdrop { position: fixed; inset: 0; background: rgba(29,20,36,.55); display: flex; align-items: center; justify-content: center; z-index: 22; padding: 16px; }
.hp-backdrop[hidden] { display: none; }
.hp { position: relative; width: min(460px, 100%); max-height: calc(100% - 32px); overflow: auto; background: #fff4d6; border: 5px solid #1d1424; border-radius: 24px; box-shadow: 0 8px 0 #1d1424; font-family: 'Bricolage Grotesque', 'Trebuchet MS', sans-serif; color: #1d1424; padding: 20px; box-sizing: border-box; }
.hp h2 { font-family: 'Lilita One', 'Arial Black', sans-serif; font-weight: 400; font-size: 28px; margin: 0 0 8px; padding-right: 96px; color: #ff3d8b; -webkit-text-stroke: 3px #1d1424; paint-order: stroke fill; }
.hp table { width: 100%; border-collapse: collapse; font-size: 13px; }
.hp th, .hp td { text-align: left; padding: 7px 4px; border-bottom: 2px solid rgba(29,20,36,.15); }
.hp th { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; opacity: .65; }
.hp tr.row { cursor: pointer; }
.hp tr.row:hover { background: rgba(62,198,255,.15); }
.hp .pos { color: #2f8f1d; font-weight: 800; }
.hp .neg { color: #ff3b30; font-weight: 800; }
.hp .detail { background: #fff; border: 3px solid #1d1424; border-radius: 12px; padding: 10px; margin-top: 12px; font-size: 13px; }
.hp .detail .tag { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: #1d1424; color: #fff4d6; border-radius: 6px; padding: 2px 8px; margin-bottom: 8px; }
.hp .detail dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; }
.hp .detail dt { font-weight: 800; opacity: .7; }
.hp .detail dd { margin: 0; word-break: break-all; }
.hp button.close { font: 800 14px 'Bricolage Grotesque', sans-serif; letter-spacing: .5px; text-transform: uppercase; border: 4px solid #1d1424; border-radius: 14px; box-shadow: 0 4px 0 #1d1424; padding: 6px 12px; min-height: 44px; cursor: pointer; background: #fff4d6; position: absolute; top: 14px; right: 14px; }
.hp .empty { font-size: 14px; opacity: .7; }
`;

/** Result in words, never colour alone. */
export function resultText(r: RoundSummary): string {
  if (r.status === 'void') return 'Void · stake returned';
  // A practice round staked nothing, so it neither won nor lost money: say what it reached and stop.
  // Describing it as a win or a loss would put a result on a bet the player never placed.
  if (r.practice === true) {
    if (r.status === 'running') return 'Practice · in progress';
    return `Practice · reached ${formatMultiplier(r.settlement?.multiplier ?? 1)}`;
  }
  if (r.status === 'running') return 'In progress';
  // A deferred-reveal round shows where the player went in, never where the hidden crash was: drawing
  // both side by side is a near-miss reveal (gate-odds-mvp D7).
  if (r.reveal === 'onCollect' && r.status === 'lost') return `Lost at ${formatMultiplier(r.settlement?.multiplier ?? 1)}`;
  if (r.status === 'lost' && (r.returnMinor ?? 0) === 0) return `Crashed at ${formatMultiplier(r.crashMultiplier ?? r.settlement?.multiplier ?? 1)}`;
  return `Cashed out at ${formatMultiplier(r.settlement?.multiplier ?? 1)}`;
}

const time = (ms: number) => new Date(ms).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });

export class HistoryPanel {
  private readonly backdrop = document.createElement('div');
  private readonly body = document.createElement('div');
  private rounds: RoundSummary[] = [];
  private selected: string | null = null;

  constructor(
    private readonly service: RoundService,
    private readonly currency: () => CurrencyRules,
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.backdrop.className = 'hp-backdrop';
    this.backdrop.hidden = true;
    this.body.className = 'hp';
    this.body.setAttribute('role', 'dialog');
    this.body.setAttribute('aria-modal', 'true');
    this.body.setAttribute('aria-label', 'Round history');
    this.backdrop.appendChild(this.body);
    document.body.appendChild(this.backdrop);
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.backdrop.hidden) this.close();
    });
  }

  get isOpen() {
    return !this.backdrop.hidden;
  }

  async open() {
    this.rounds = await this.service.history(50).catch(() => []);
    this.selected = null;
    this.render();
    this.backdrop.hidden = false;
    this.body.querySelector<HTMLButtonElement>('.close')?.focus();
  }

  close() {
    this.backdrop.hidden = true;
  }

  private render() {
    const c = this.currency();
    const money = (minor: number | null) => (minor === null ? '—' : formatMinor(minor, c));
    const rows = this.rounds
      .filter((r) => r.status !== 'running')
      .map((r) => {
        const net = r.netMinor ?? 0;
        const sign = net > 0 ? '+' : net < 0 ? '-' : '';
        return `<tr class="row" data-id="${r.roundId}">
          <td>${time(r.startedAt)}</td>
          <td>${r.practice === true ? '—' : money(r.betMinor)}</td>
          <td>${resultText(r)}</td>
          <td>${r.practice === true ? '—' : money(r.returnMinor)}</td>
          <td class="${r.practice === true ? '' : net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${r.practice === true ? '—' : `${sign}${formatMinor(Math.abs(net), c)}`}</td>
        </tr>`;
      })
      .join('');
    const detail = this.selected ? this.detailHtml(this.rounds.find((r) => r.roundId === this.selected)) : '';
    this.body.innerHTML = `
      <button class="close" type="button">Close</button>
      <h2>Round history</h2>
      ${rows
        ? `<table><thead><tr><th>Time</th><th>Stake</th><th>Result</th><th>Return</th><th>Net</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="empty">No settled rounds yet.</p>'}
      ${detail}`;
    this.body.querySelector<HTMLButtonElement>('.close')?.addEventListener('click', () => this.close());
    this.body.querySelectorAll<HTMLTableRowElement>('tr.row').forEach((row) => {
      row.addEventListener('click', () => {
        this.selected = row.dataset.id ?? null;
        this.render();
      });
    });
  }

  private detailHtml(r: RoundSummary | undefined): string {
    if (!r) return '';
    const c = this.currency();
    const money = (minor: number | null) => (minor === null ? '—' : formatMinor(minor, c));
    const crash = r.crashMultiplier ? formatMultiplier(r.crashMultiplier) : '—';
    const list: [string, string][] = [
      ['Round', r.roundId],
      ['Started', time(r.startedAt)],
      ['Settled', r.settledAt ? time(r.settledAt) : '—'],
      ['Stake', money(r.betMinor)],
      ['Result', resultText(r)],
      ['Return', money(r.returnMinor)],
      ['Net', money(r.netMinor)],
      // Deferred rounds keep the crash in the seeds for verification, but recall never draws it.
      ...(r.reveal === 'onCollect' ? [] : ([['Crash point', crash]] as [string, string][])),
      ['Bad moles', r.setbacks.length ? r.setbacks.map((t) => `${t.toFixed(2)}s`).join(', ') : 'none'],
      ['Good moles', r.boosts.length ? r.boosts.map((t) => `${t.toFixed(2)}s`).join(', ') : 'none'],
      ['Game', r.configId],
      ['Seed commit', r.commit],
      ['Client seed', r.clientSeed],
      ['Nonce', String(r.nonce)],
    ];
    return `<div class="detail"><span class="tag">Past round</span>
      <dl>${list.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
  }
}
