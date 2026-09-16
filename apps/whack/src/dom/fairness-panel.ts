import { verifyRound } from '@triptown/fairness';
import { RoundServiceError, type RoundService, type SessionInfo } from '@triptown/rgs-client';
import { formatMultiplier } from '../game/display';

// Provably-fair panel as a DOM dialog: real inputs, selectable text, screen-reader friendly.

const CSS = `
.pf-backdrop { position: fixed; inset: 0; background: rgba(29,20,36,.55); display: flex; align-items: center; justify-content: center; z-index: 20; padding: 16px; }
.pf-backdrop[hidden] { display: none; }
.pf { position: relative; width: min(440px, 100%); max-height: calc(100% - 32px); overflow: auto; background: #fff4d6; border: 5px solid #1d1424; border-radius: 24px; box-shadow: 0 8px 0 #1d1424; font-family: 'Bricolage Grotesque', 'Trebuchet MS', sans-serif; color: #1d1424; padding: 20px; box-sizing: border-box; }
.pf h2 { font-family: 'Lilita One', 'Arial Black', sans-serif; font-weight: 400; font-size: 30px; margin: 0 0 4px; color: #ff3d8b; -webkit-text-stroke: 3px #1d1424; paint-order: stroke fill; }
.pf p { margin: 0 0 14px; font-size: 14px; line-height: 1.4; }
.pf label, .pf .k { display: block; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; opacity: .65; margin: 12px 0 4px; }
.pf code { display: block; font-family: ui-monospace, Menlo, monospace; font-size: 12px; word-break: break-all; background: #fff; border: 3px solid #1d1424; border-radius: 10px; padding: 8px; }
.pf .row { display: flex; gap: 8px; }
.pf input { flex: 1; min-width: 0; font: 700 16px 'Bricolage Grotesque', sans-serif; border: 3px solid #1d1424; border-radius: 10px; padding: 8px 10px; background: #fff; }
.pf button { font: 800 14px 'Bricolage Grotesque', sans-serif; letter-spacing: .5px; text-transform: uppercase; border: 4px solid #1d1424; border-radius: 14px; box-shadow: 0 4px 0 #1d1424; padding: 10px 14px; min-height: 44px; cursor: pointer; background: #3ec6ff; color: #1d1424; }
.pf button:active { transform: translateY(4px); box-shadow: none; }
.pf button.primary { background: #ff3d8b; color: #fff4d6; }
.pf button.close { background: #fff4d6; position: absolute; top: 14px; right: 14px; padding: 6px 12px; }
.pf h2 { padding-right: 96px; }
.pf .msg { min-height: 20px; font-size: 13px; font-weight: 700; margin-top: 8px; }
.pf table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
.pf th, .pf td { text-align: left; padding: 6px 4px; border-bottom: 2px solid rgba(29,20,36,.15); }
.pf .ok { color: #2f8f1d; font-weight: 800; }
.pf .bad { color: #ff3b30; font-weight: 800; }
`;

export class FairnessPanel {
  private readonly backdrop = document.createElement('div');
  private readonly body = document.createElement('div');
  private session: SessionInfo | null = null;

  constructor(
    private readonly service: RoundService,
    private readonly onSessionChanged: () => Promise<void>,
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.backdrop.className = 'pf-backdrop';
    this.backdrop.hidden = true;
    this.body.className = 'pf';
    this.body.setAttribute('role', 'dialog');
    this.body.setAttribute('aria-modal', 'true');
    this.body.setAttribute('aria-labelledby', 'pf-title');
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
    this.session = await this.service.getSession();
    this.render();
    this.backdrop.hidden = false;
    this.body.querySelector<HTMLButtonElement>('.close')?.focus();
  }

  close() {
    this.backdrop.hidden = true;
  }

  private render(reveal?: { html: string }) {
    const s = this.session!;
    this.body.innerHTML = `
      <button class="close" type="button" aria-label="Close">Close</button>
      <h2 id="pf-title">Provably fair</h2>
      <p>Every round is fixed before you bet by the server seed below (shown as its SHA-256 hash), your client seed and the nonce. Rotate the server seed to reveal it and check your past rounds.</p>
      <span class="k">Server seed hash (commit)</span>
      <code data-testid="commit">${s.commit}</code>
      <label for="pf-client">Client seed</label>
      <div class="row"><input id="pf-client" maxlength="64" value="${escapeHtml(s.clientSeed)}" /><button type="button" data-action="save">Save</button></div>
      <span class="k">Next nonce</span>
      <code data-testid="nonce">${s.nonce}</code>
      <div class="row" style="margin-top:14px"><button type="button" class="primary" data-action="rotate">Rotate seed &amp; verify</button></div>
      <div class="msg" role="status"></div>
      <div data-testid="reveal">${reveal?.html ?? ''}</div>`;
    this.body.querySelector('.close')!.addEventListener('click', () => this.close());
    this.body.querySelector('[data-action="save"]')!.addEventListener('click', () => void this.saveClientSeed());
    this.body.querySelector('[data-action="rotate"]')!.addEventListener('click', () => void this.rotate());
  }

  private message(text: string) {
    const el = this.body.querySelector('.msg');
    if (el) el.textContent = text;
  }

  private async saveClientSeed() {
    const input = this.body.querySelector<HTMLInputElement>('#pf-client')!;
    try {
      this.session = await this.service.setClientSeed(input.value.trim());
      this.render();
      this.message('Client seed saved.');
      await this.onSessionChanged();
    } catch (err) {
      this.message(errorText(err));
    }
  }

  private async rotate() {
    try {
      const rotation = await this.service.rotateSeed();
      this.session = rotation.session;
      const rounds = (await this.service.history(50)).filter((r) => r.commit === rotation.previousCommit && r.settlement);
      const rows = rounds
        .map((r) => {
          const v = verifyRound({
            serverSeed: rotation.previousServerSeed,
            clientSeed: r.clientSeed,
            nonce: r.nonce,
            commit: r.commit,
            config: rotation.session.config,
          });
          const ok = v.verified && v.crashTime === r.settlement!.crashTime;
          return `<tr><td>${r.nonce}</td><td>${formatMultiplier(r.settlement!.multiplier)}</td><td>${v.setbacks.length}</td><td class="${ok ? 'ok' : 'bad'}">${ok ? '✓ verified' : '✗ mismatch'}</td></tr>`;
        })
        .join('');
      const html = `
        <span class="k">Revealed server seed</span>
        <code data-testid="revealed">${rotation.previousServerSeed}</code>
        <table><thead><tr><th>Nonce</th><th>Result</th><th>Bad moles</th><th>Check</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No settled rounds used this seed.</td></tr>'}</tbody></table>`;
      this.render({ html });
      this.message(`New seed committed. ${rounds.length} round(s) checked.`);
      await this.onSessionChanged();
    } catch (err) {
      this.message(errorText(err));
    }
  }
}

function errorText(err: unknown): string {
  if (err instanceof RoundServiceError) {
    if (err.code === 'round_in_progress') return 'Finish the current round first.';
    if (err.code === 'invalid_client_seed') return 'Client seed must be 1-64 printable characters.';
    return err.message;
  }
  return 'Something went wrong. Try again.';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
