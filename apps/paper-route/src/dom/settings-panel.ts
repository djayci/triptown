import type { AudioManager } from '@triptown/engine/audio';

// Settings dialog: sound on/off, effects volume and "Reduce effects". Values persist through AudioManager
// (storage access is wrapped, so blocked storage in sandboxed iframes just means no persistence).

const CSS = `
.pr-sp-backdrop { position: fixed; inset: 0; background: rgba(39,34,31,.45); display: flex; align-items: center; justify-content: center; z-index: 30; padding: 16px; }
.pr-sp-backdrop[hidden] { display: none; }
.pr-sp { position: relative; width: min(360px, 100%); background: #faf6f0; border: 0; border-radius: 22px; box-shadow: 0 12px 40px rgba(60,40,30,.28); color: #27221f; font-family: Chivo, 'Helvetica Neue', Arial, sans-serif; padding: 18px; box-sizing: border-box; }
.pr-sp h2 { font: 900 24px Chivo, 'Helvetica Neue', sans-serif; letter-spacing: -.4px; margin: 0 0 8px; }
.pr-sp .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; border-top: 1px solid rgba(39,34,31,.12); }
.pr-sp .row span { font-size: 12px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
.pr-sp input[type=range] { flex: 1; max-width: 180px; accent-color: #b8492a; height: 32px; }
.pr-sp input[type=checkbox] { width: 26px; height: 26px; accent-color: #b8492a; }
.pr-sp button.close { position: absolute; top: 12px; right: 12px; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1.5px solid rgba(39,34,31,.5); background: none; color: inherit; font: 700 14px Chivo, sans-serif; cursor: pointer; }
`;

export class SettingsPanel {
  private readonly backdrop = document.createElement('div');

  constructor(
    private readonly audio: AudioManager | null,
    private readonly reduceEffects: { get(): boolean; set(on: boolean): void },
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.backdrop.className = 'pr-sp-backdrop';
    this.backdrop.hidden = true;
    this.backdrop.innerHTML = `
      <div class="pr-sp" role="dialog" aria-modal="true" aria-labelledby="pr-sp-title">
        <button class="close" type="button">Close</button>
        <h2 id="pr-sp-title">Settings</h2>
        <label class="row"><span>Sound on</span><input type="checkbox" data-k="on" /></label>
        <label class="row"><span>Effects volume</span><input type="range" min="0" max="100" data-k="sfx" /></label>
        <label class="row"><span>Reduce effects</span><input type="checkbox" data-k="reduce" /></label>
      </div>`;
    document.body.appendChild(this.backdrop);
    const q = <T extends HTMLElement>(sel: string) => this.backdrop.querySelector<T>(sel)!;
    q('.close').addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.backdrop.hidden) this.close();
    });
    q<HTMLInputElement>('[data-k=on]').addEventListener('change', (e) => {
      audio?.unlock();
      audio?.setMuted(!(e.target as HTMLInputElement).checked);
    });
    q<HTMLInputElement>('[data-k=sfx]').addEventListener('input', (e) => {
      audio?.unlock();
      audio?.setSfxVolume(Number((e.target as HTMLInputElement).value) / 100);
      audio?.playSfx('tick');
    });
    q<HTMLInputElement>('[data-k=reduce]').addEventListener('change', (e) => reduceEffects.set((e.target as HTMLInputElement).checked));
    if (!audio) {
      q<HTMLInputElement>('[data-k=on]').disabled = true;
      q<HTMLInputElement>('[data-k=sfx]').disabled = true;
    }
  }

  open(): void {
    const s = this.audio?.current;
    this.backdrop.querySelector<HTMLInputElement>('[data-k=on]')!.checked = s ? !s.muted : false;
    this.backdrop.querySelector<HTMLInputElement>('[data-k=sfx]')!.value = String(Math.round((s?.sfx ?? 0) * 100));
    this.backdrop.querySelector<HTMLInputElement>('[data-k=reduce]')!.checked = this.reduceEffects.get();
    this.backdrop.hidden = false;
    this.backdrop.querySelector<HTMLButtonElement>('.close')!.focus();
  }

  close(): void {
    this.backdrop.hidden = true;
  }
}
