// Rules as a DOM dialog so the text is selectable, zoomable and read by screen readers. Available in every
// state without a bet (client spec "Rules content").
import type { StepConfig } from '@triptown/steps';
import { t } from '../i18n/en';

export interface RulesInput {
  configs: readonly StepConfig[];
  abandonAfterMs: number;
  minCycleMs: number;
}

const css = `
.ng-rules{position:fixed;inset:0;z-index:20;display:flex;align-items:flex-end;justify-content:center;background:rgba(3,7,18,.72);font-family:'Barlow',system-ui,sans-serif;color:#f1f5f9}
.ng-rules[hidden]{display:none}
.ng-rules__sheet{width:min(560px,100%);max-height:88vh;overflow:auto;background:#0b1224;border-top:3px solid #e11d48;padding:18px 18px 28px;box-sizing:border-box}
.ng-rules h2{margin:0 0 10px;font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:900;font-size:28px}
.ng-rules h3{margin:16px 0 6px;font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:800;font-size:18px;color:#fda4af}
.ng-rules p{margin:0 0 10px;font-size:15px;line-height:1.45}
.ng-rules table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
.ng-rules th,.ng-rules td{text-align:right;padding:4px 6px;border-bottom:1px solid rgba(241,245,249,.12)}
.ng-rules th:first-child,.ng-rules td:first-child{text-align:left}
.ng-rules__close{margin-top:16px;width:100%;height:48px;border:1.5px solid #f1f5f9;background:transparent;color:#f1f5f9;font:700 16px 'Barlow',sans-serif;cursor:pointer}
`;

export class RulesDialog {
  private readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;

  constructor(onClose?: () => void) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.className = 'ng-rules';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'ng-rules-title');
    const sheet = document.createElement('div');
    sheet.className = 'ng-rules__sheet';
    this.body = document.createElement('div');
    const close = document.createElement('button');
    close.className = 'ng-rules__close';
    close.textContent = t('close');
    close.addEventListener('click', () => {
      this.close();
      onClose?.();
    });
    sheet.append(this.body, close);
    this.root.appendChild(sheet);
    this.root.addEventListener('click', (e) => e.target === this.root && this.close());
    document.body.appendChild(this.root);
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(input: RulesInput) {
    const hours = input.abandonAfterMs / 3_600_000;
    const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
    const time = hours >= 1 ? plural(Math.round(hours), 'hour') : plural(Math.round(input.abandonAfterMs / 60_000), 'minute');
    const el = (tag: string, text: string) => {
      const e = document.createElement(tag);
      e.textContent = text;
      return e;
    };
    this.body.replaceChildren(
      Object.assign(el('h2', t('rulesTitle')), { id: 'ng-rules-title' }),
      el('p', t('rulesPlay')),
      el('p', t('rulesFixed')),
      el('p', t('rulesRtp')),
      el('p', t('rulesAbandon', { time })),
      el('p', t('rulesRounding', { gap: Math.round(input.minCycleMs / 1000) })),
      ...input.configs.flatMap((c) => [el('h3', `${t(c.difficulty)} · RTP ${(c.rtp * 100).toFixed(0)}%`), this.table(c)]),
    );
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
  }

  private table(c: StepConfig) {
    const table = document.createElement('table');
    const head = document.createElement('tr');
    for (const h of [t('rulesTableFence'), t('rulesTableValue'), t('rulesTableChance')]) head.appendChild(Object.assign(document.createElement('th'), { textContent: h }));
    table.appendChild(head);
    c.paytable.forEach((m, i) => {
      const prev = i === 0 ? c.rtp : c.paytable[i - 1]!;
      const row = document.createElement('tr');
      for (const cell of [i === c.paytable.length - 1 ? `${i + 1} · ${t('finish')}` : String(i + 1), `x${m.toFixed(2)}`, `${((prev / m) * 100).toFixed(1)}%`]) {
        row.appendChild(Object.assign(document.createElement('td'), { textContent: cell }));
      }
      table.appendChild(row);
    });
    return table;
  }
}
