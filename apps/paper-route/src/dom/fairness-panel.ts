import { formatMinor, type SessionInfo } from '@triptown/core';
import { resolveConfigId, verifyRound } from '@triptown/fairness';
import type { RoundService } from '@triptown/rgs-client';
import { Dialog, el } from './dialog';

// Provably fair: shows the commit, client seed and nonce, lets the player change the client seed, and after
// a seed change recomputes every settled round played on the revealed seed.

export class FairnessPanel {
  private readonly dialog = new Dialog('Fairness', 'pr-fair');
  /** Last verification, for automated checks. */
  lastCheck: { roundId: string; verified: boolean; crashMatches: boolean; setbacksMatch: boolean }[] = [];

  constructor(private readonly service: RoundService) {}

  async open(): Promise<void> {
    this.render(await this.service.getSession());
    this.dialog.show();
  }

  private render(session: SessionInfo, message?: string): void {
    const body = this.dialog.body;
    body.replaceChildren(
      el('h3', 'Current server seed commit'),
      el('p', session.commit, 'mono'),
      el('h3', 'Client seed'),
    );
    const row = el('div', undefined, 'row');
    const input = el('input');
    input.type = 'text';
    input.value = session.clientSeed;
    input.maxLength = 64;
    input.setAttribute('aria-label', 'Client seed');
    const save = el('button', 'Save');
    save.onclick = async () => {
      try {
        this.render(await this.service.setClientSeed(input.value.trim()), 'Client seed saved.');
      } catch (err) {
        this.render(session, `Could not save: ${(err as Error).message}`);
      }
    };
    row.append(input, save);
    body.append(row, el('p', `Next round nonce: ${session.nonce}`, 'muted'), el('h3', 'Verify past rounds'));
    const rotate = el('button', 'Reveal seed and verify rounds');
    rotate.dataset.action = 'rotate';
    rotate.onclick = () => void this.rotateAndVerify();
    body.append(rotate, el('p', 'Reveals the current server seed (a new one is committed) and checks every round played on it.', 'muted'));
    if (message) body.append(el('p', message));
  }

  async rotateAndVerify(): Promise<typeof this.lastCheck> {
    const rotation = await this.service.rotateSeed();
    const rounds = (await this.service.history(50)).filter((r) => r.commit === rotation.previousCommit && r.settlement && r.status !== 'void');
    this.lastCheck = [];
    const results = el('div');
    for (const r of rounds) {
      const config = resolveConfigId(r.configId);
      if (!config) continue;
      const v = verifyRound({ serverSeed: rotation.previousServerSeed, clientSeed: r.clientSeed, nonce: r.nonce, commit: r.commit, config });
      const crashMatches = Math.abs(v.crashTime - r.settlement!.crashTime) < 1e-9;
      // Only setbacks that happened before the round ended are recorded; compare that prefix.
      const recorded = r.setbacks;
      const setbacksMatch = recorded.every((t, i) => Math.abs(t - (v.setbacks[i] ?? Number.NaN)) < 1e-9);
      const ok = v.verified && crashMatches && setbacksMatch;
      this.lastCheck.push({ roundId: r.roundId, verified: v.verified, crashMatches, setbacksMatch });
      const line = el('div', `${ok ? 'VERIFIED' : 'MISMATCH'} · nonce ${r.nonce} · stake ${formatMinor(r.betMinor, { decimals: 2 })} · crash ${v.crashTime.toFixed(3)} s · ${v.setbacks.filter((t) => t < v.crashTime).length} setbacks`, 'entry');
      line.dataset.verified = String(ok);
      results.appendChild(line);
    }
    this.render(rotation.session, rounds.length ? `Seed revealed. ${this.lastCheck.filter((c) => c.verified && c.crashMatches && c.setbacksMatch).length} of ${rounds.length} rounds verified.` : 'Seed revealed. No settled rounds used it.');
    this.dialog.body.append(el('h3', 'Revealed server seed'), el('p', rotation.previousServerSeed, 'mono'), results);
    return this.lastCheck;
  }
}
