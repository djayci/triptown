import type { AudioManager } from '@triptown/engine';

// Sound settings dialog: mute, music volume, effects volume. Values persist through AudioManager.

const CSS = `
.sp-backdrop { position: fixed; inset: 0; background: rgba(29,20,36,.55); display: flex; align-items: center; justify-content: center; z-index: 20; padding: 16px; }
.sp-backdrop[hidden] { display: none; }
.sp { position: relative; width: min(360px, 100%); background: #fff4d6; border: 5px solid #1d1424; border-radius: 24px; box-shadow: 0 8px 0 #1d1424; font-family: 'Bricolage Grotesque', 'Trebuchet MS', sans-serif; color: #1d1424; padding: 20px; box-sizing: border-box; }
.sp h2 { font-family: 'Lilita One', 'Arial Black', sans-serif; font-weight: 400; font-size: 30px; margin: 0 0 12px; color: #3ec6ff; -webkit-text-stroke: 3px #1d1424; paint-order: stroke fill; padding-right: 96px; }
.sp .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; border-top: 2px solid rgba(29,20,36,.12); }
.sp .row span { font-size: 12px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
.sp input[type=range] { flex: 1; max-width: 190px; accent-color: #ff3d8b; height: 32px; }
.sp input[type=checkbox] { width: 28px; height: 28px; accent-color: #7ed957; }
.sp button.close { position: absolute; top: 14px; right: 14px; font: 800 14px 'Bricolage Grotesque', sans-serif; text-transform: uppercase; border: 4px solid #1d1424; border-radius: 14px; box-shadow: 0 4px 0 #1d1424; padding: 6px 12px; min-height: 44px; cursor: pointer; background: #fff4d6; }
`;

export class SoundPanel {
  private readonly backdrop = document.createElement('div');

  constructor(private readonly audio: AudioManager) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.backdrop.className = 'sp-backdrop';
    this.backdrop.hidden = true;
    this.backdrop.innerHTML = `
      <div class="sp" role="dialog" aria-modal="true" aria-labelledby="sp-title">
        <button class="close" type="button">Close</button>
        <h2 id="sp-title">Sound</h2>
        <label class="row"><span>Sound on</span><input type="checkbox" data-k="on" /></label>
        <label class="row"><span>Music</span><input type="range" min="0" max="100" data-k="music" /></label>
        <label class="row"><span>Effects</span><input type="range" min="0" max="100" data-k="sfx" /></label>
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
      audio.unlock();
      audio.setMuted(!(e.target as HTMLInputElement).checked);
    });
    q<HTMLInputElement>('[data-k=music]').addEventListener('input', (e) => audio.setMusicVolume(Number((e.target as HTMLInputElement).value) / 100));
    q<HTMLInputElement>('[data-k=sfx]').addEventListener('input', (e) => {
      audio.unlock();
      audio.setSfxVolume(Number((e.target as HTMLInputElement).value) / 100);
      audio.playSfx('tick');
    });
  }

  open() {
    const s = this.audio.current;
    this.backdrop.querySelector<HTMLInputElement>('[data-k=on]')!.checked = !s.muted;
    this.backdrop.querySelector<HTMLInputElement>('[data-k=music]')!.value = String(Math.round(s.music * 100));
    this.backdrop.querySelector<HTMLInputElement>('[data-k=sfx]')!.value = String(Math.round(s.sfx * 100));
    this.backdrop.hidden = false;
    this.backdrop.querySelector<HTMLButtonElement>('.close')!.focus();
  }

  close() {
    this.backdrop.hidden = true;
  }
}
