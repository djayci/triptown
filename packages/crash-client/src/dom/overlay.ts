// Full-screen prompts the player must answer: the operator's reality-check pause, the idle prompt
// (PT R33, profile `idlePromptMs`), a closed-game state and operator messages. Betting stays blocked
// while one is open, so these are gates rather than toasts.

const CSS = `
.ov-backdrop { position: fixed; inset: 0; background: rgba(29,20,36,.72); display: flex; align-items: center; justify-content: center; z-index: 30; padding: 16px; }
.ov-backdrop[hidden] { display: none; }
.ov { width: min(420px, 100%); background: #fff4d6; border: 5px solid #1d1424; border-radius: 24px; box-shadow: 0 8px 0 #1d1424; font-family: 'Bricolage Grotesque', 'Trebuchet MS', sans-serif; color: #1d1424; padding: 22px; box-sizing: border-box; text-align: center; }
.ov h2 { font-family: 'Lilita One', 'Arial Black', sans-serif; font-weight: 400; font-size: 26px; margin: 0 0 10px; color: #ff3d8b; -webkit-text-stroke: 3px #1d1424; paint-order: stroke fill; }
.ov p { margin: 0 0 16px; font-size: 15px; line-height: 1.45; }
.ov .actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.ov button { font: 800 15px 'Bricolage Grotesque', sans-serif; letter-spacing: .5px; text-transform: uppercase; border: 4px solid #1d1424; border-radius: 16px; box-shadow: 0 5px 0 #1d1424; padding: 12px 18px; min-height: 48px; min-width: 120px; cursor: pointer; background: #fff4d6; }
.ov button.primary { background: #7ed957; }
.ov button:active { transform: translateY(5px); box-shadow: none; }
`;

export interface OverlayAction {
  label: string;
  primary?: boolean;
  onPick(): void;
}

export class Overlay {
  private readonly backdrop = document.createElement('div');
  private readonly body = document.createElement('div');

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.backdrop.className = 'ov-backdrop';
    this.backdrop.hidden = true;
    this.body.className = 'ov';
    this.body.setAttribute('role', 'alertdialog');
    this.body.setAttribute('aria-modal', 'true');
    this.backdrop.appendChild(this.body);
    document.body.appendChild(this.backdrop);
  }

  get isOpen() {
    return !this.backdrop.hidden;
  }

  show(title: string, text: string, actions: OverlayAction[]) {
    this.body.innerHTML = `<h2>${title}</h2><p>${text}</p><div class="actions">${actions
      .map((a, i) => `<button type="button" data-i="${i}" class="${a.primary ? 'primary' : ''}">${a.label}</button>`)
      .join('')}</div>`;
    this.body.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.addEventListener('click', () => {
        const action = actions[Number(b.dataset.i)];
        this.hide();
        action?.onPick();
      });
    });
    this.backdrop.hidden = false;
    this.body.querySelector<HTMLButtonElement>('button')?.focus();
  }

  hide() {
    this.backdrop.hidden = true;
  }
}
