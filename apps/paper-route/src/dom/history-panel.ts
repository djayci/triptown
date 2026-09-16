import { formatMinor, type RoundSummary, type SessionInfo } from '@triptown/core';
import type { RoundService } from '@triptown/rgs-client';
import { Dialog, el } from './dialog';

// Recent rounds, newest first, each with every paper's stake, multiplier and return. Results are text, not
// colour alone. The crash point belongs here (and in fairness), never on the result screen.

const RESULT_TEXT = { win: 'Won', even: 'Returned stake', loss: 'Lost' } as const;

export class HistoryPanel {
  private readonly dialog = new Dialog('Round history', 'pr-history');

  constructor(private readonly service: RoundService) {}

  async open(session: SessionInfo): Promise<void> {
    const body = this.dialog.body;
    body.replaceChildren(el('p', 'Loading…', 'muted'));
    this.dialog.show();
    let rounds: RoundSummary[];
    try {
      rounds = await this.service.history(50);
    } catch {
      body.replaceChildren(el('p', 'History is unavailable right now.', 'muted'));
      return;
    }
    const money = (minor: number | null) => (minor === null ? '—' : formatMinor(minor, session.currency));
    body.replaceChildren();
    if (!rounds.length) body.appendChild(el('p', 'No rounds yet.', 'muted'));
    for (const r of rounds) {
      const entry = el('div', undefined, 'entry');
      entry.dataset.round = r.roundId;
      const kind = r.status === 'running' ? 'Running' : r.status === 'void' ? 'Void (refunded)' : r.resultKind ? RESULT_TEXT[r.resultKind] : '—';
      const head = el('div');
      head.append(el('span', kind.toUpperCase(), 'tag'), el('span', new Date(r.startedAt).toLocaleString()));
      entry.append(
        head,
        el('div', `Stake ${money(r.betMinor)} · Returned ${money(r.returnMinor)} · Net ${r.netMinor === null ? '—' : (r.netMinor > 0 ? '+' : '') + money(r.netMinor)}`),
      );
      if (r.papers > 1) {
        const papers = r.throws.map((t) => `${t.papers}×${money(r.paperMinor)} at x${t.multiplier.toFixed(2)} → ${money(Math.floor(t.exactMinor + 1e-7))}`);
        const lost = r.papers - r.throws.reduce((n, t) => n + t.papers, 0);
        entry.append(el('div', [...papers, ...(lost && r.status !== 'running' ? [`${lost} lost`] : [])].join(' · ') || 'No papers thrown', 'muted'));
      }
      if (r.status !== 'running' && r.crashMultiplier !== null) {
        entry.append(el('div', `Past round · ended at x${r.crashMultiplier.toFixed(2)} · nonce ${r.nonce}`, 'muted'));
      }
      body.appendChild(entry);
    }
  }
}
