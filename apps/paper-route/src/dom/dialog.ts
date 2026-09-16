// Shared dialog shell for Paper Route panels (rules, history, fairness): accessible, closable, 44 px targets.

const CSS = `
.pr-dlg-backdrop { position: fixed; inset: 0; background: rgba(39,34,31,.45); display: flex; align-items: center; justify-content: center; z-index: 40; padding: 12px; }
.pr-dlg-backdrop[hidden] { display: none; }
.pr-dlg { position: relative; width: min(440px, 100%); max-height: calc(100% - 24px); overflow: auto; background: #faf6f0; border: 0; border-radius: 22px; box-shadow: 0 12px 40px rgba(60,40,30,.28); color: #27221f; font-family: Chivo, 'Helvetica Neue', Arial, sans-serif; padding: 18px; box-sizing: border-box; font-size: 14px; line-height: 1.45; }
.pr-dlg h2 { font: 900 24px Chivo, 'Helvetica Neue', sans-serif; letter-spacing: -.4px; margin: 0 72px 10px 0; }
.pr-dlg h3 { font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(39,34,31,.58); margin: 14px 0 6px; }
.pr-dlg ul { margin: 0; padding-left: 18px; }
.pr-dlg li { margin: 4px 0; }
.pr-dlg .muted { color: rgba(39,34,31,.58); font-size: 12px; }
.pr-dlg .mono { font-family: 'Chivo Mono', 'SFMono-Regular', Menlo, monospace; font-size: 12px; word-break: break-all; }
.pr-dlg button { min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1.5px solid rgba(39,34,31,.5); background: none; color: inherit; font: 700 14px Chivo, sans-serif; cursor: pointer; }
.pr-dlg button.close { position: absolute; top: 12px; right: 12px; }
.pr-dlg input[type=text] { min-height: 44px; flex: 1; border-radius: 10px; border: 1px solid rgba(39,34,31,.28); background: rgba(39,34,31,.04); color: inherit; padding: 0 10px; font: 14px Chivo, sans-serif; }
.pr-dlg .row { display: flex; gap: 8px; align-items: center; margin: 6px 0; }
.pr-dlg .entry { border-top: 1px solid rgba(39,34,31,.12); padding: 10px 0; }
.pr-dlg .tag { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 1px; border: 1px solid rgba(39,34,31,.35); border-radius: 6px; padding: 1px 6px; margin-right: 6px; }
`;

export class Dialog {
  readonly body = document.createElement('div');
  private readonly backdrop = document.createElement('div');

  constructor(title: string, id: string) {
    if (!document.getElementById('pr-dlg-css')) {
      const style = document.createElement('style');
      style.id = 'pr-dlg-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.backdrop.className = 'pr-dlg-backdrop';
    this.backdrop.hidden = true;
    const box = document.createElement('div');
    box.className = 'pr-dlg';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', `${id}-title`);
    box.dataset.dialog = id;
    const close = document.createElement('button');
    close.className = 'close';
    close.type = 'button';
    close.textContent = 'Close';
    close.onclick = () => this.close();
    const h = document.createElement('h2');
    h.id = `${id}-title`;
    h.textContent = title;
    box.append(close, h, this.body);
    this.backdrop.appendChild(box);
    this.backdrop.addEventListener('click', (e) => e.target === this.backdrop && this.close());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && !this.backdrop.hidden && this.close());
    document.body.appendChild(this.backdrop);
  }

  get isOpen(): boolean {
    return !this.backdrop.hidden;
  }

  show(): void {
    this.backdrop.hidden = false;
    this.backdrop.querySelector<HTMLButtonElement>('button.close')?.focus();
  }

  close(): void {
    this.backdrop.hidden = true;
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
