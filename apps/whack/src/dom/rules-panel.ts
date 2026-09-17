import { describeRules, type RuleItem, type SessionInfo } from '@triptown/core';
import { t } from '../i18n/en';

// Rules and help, reachable before any bet (GLI-19 §4.4.1, UK RTS 3/4, Brazil 1.207 Annex I item 14(b),
// PT R31). The content is generated from the config and profile actually in play, so it can never drift
// from the maths: `describeRules` returns structured items and this panel renders them.

const CSS = `
.rp-backdrop { position: fixed; inset: 0; background: rgba(29,20,36,.55); display: flex; align-items: center; justify-content: center; z-index: 21; padding: 16px; }
.rp-backdrop[hidden] { display: none; }
.rp { position: relative; width: min(460px, 100%); max-height: calc(100% - 32px); overflow: auto; background: #fff4d6; border: 5px solid #1d1424; border-radius: 24px; box-shadow: 0 8px 0 #1d1424; font-family: 'Bricolage Grotesque', 'Trebuchet MS', sans-serif; color: #1d1424; padding: 20px; box-sizing: border-box; }
.rp h2 { font-family: 'Lilita One', 'Arial Black', sans-serif; font-weight: 400; font-size: 28px; margin: 0 0 8px; padding-right: 96px; color: #ff3d8b; -webkit-text-stroke: 3px #1d1424; paint-order: stroke fill; }
.rp p { margin: 0 0 12px; font-size: 14px; line-height: 1.45; }
.rp ul { margin: 0 0 12px; padding-left: 18px; }
.rp li { font-size: 14px; line-height: 1.5; margin-bottom: 6px; }
.rp .foot { font-size: 12px; opacity: .7; margin-top: 14px; border-top: 2px solid rgba(29,20,36,.15); padding-top: 10px; }
.rp button.close { font: 800 14px 'Bricolage Grotesque', sans-serif; letter-spacing: .5px; text-transform: uppercase; border: 4px solid #1d1424; border-radius: 14px; box-shadow: 0 4px 0 #1d1424; padding: 6px 12px; min-height: 44px; cursor: pointer; background: #fff4d6; position: absolute; top: 14px; right: 14px; }
.rp button.close:active { transform: translateY(4px); box-shadow: none; }
.rp .toggle { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; margin: 10px 0; }
.rp .toggle input { width: 22px; height: 22px; }
`;

/** Turns one structured rule item into a sentence. Unknown keys are skipped rather than shown raw. */
function line(item: RuleItem, currency: string): string | null {
  const p = item.params;
  switch (item.key) {
    case 'growth':
      return t('rules.growth', { tRamp: Number(p.tRamp) });
    case 'setbacks':
      return t('rules.setbacks', { every: (1 / Number(p.ratePerSecond)).toFixed(0) });
    case 'boosts':
      return t('rules.boosts', { every: (1 / Number(p.ratePerSecond)).toFixed(0), percent: Math.round((Number(p.factor) - 1) * 100) });
    case 'instantBust':
      return t('rules.instantBust', { percent: (Number(p.probability) * 100).toFixed(1) });
    case 'rtp': {
      const base = t('rules.rtp', { rtp: (Number(p.rtp) * 100).toFixed(2) });
      if (p.bandMinRtp === undefined) return base;
      return `${base} ${t('rules.rtpBand', {
        currency,
        stake: (Number(p.bandStakeMinor ?? 0) / 100).toFixed(2),
        low: (Number(p.bandMinRtp) * 100).toFixed(2),
        high: (Number(p.bandMaxRtp) * 100).toFixed(2),
        rtp: (Number(p.rtp) * 100).toFixed(2),
      })}`;
    }
    case 'maxMultiplier':
      return t('rules.maxMultiplier', { multiplier: Number(p.multiplier).toLocaleString('en-US') });
    case 'tMax':
      return t('rules.tMax', { seconds: Number(p.seconds) });
    case 'minCashout':
      return Number(p.multiplier) > 1 ? t('rules.minCashout', { multiplier: Number(p.multiplier).toFixed(2) }) : t('rules.minCashoutNone');
    case 'autoCashout':
      return t('rules.autoCashout', { min: Number(p.minimum).toFixed(2), max: Number(p.maximum).toLocaleString('en-US') });
    case 'rounding':
      return t('rules.rounding', { currency });
    case 'belowStakeReturns':
      return t('rules.belowStakeReturns');
    case 'minCycle':
      return t('rules.minCycle', { seconds: (Number(p.ms) / 1000).toFixed(1) });
    case 'latency':
      return t('rules.latency');
    case 'disconnect':
      return p.policy === 'cashout-at-disconnect' ? t('rules.disconnect.cashoutAtDisconnect') : t('rules.disconnect.lose');
    case 'voidRefund':
      return t('rules.voidRefund');
    case 'provablyFair':
      return t('rules.provablyFair');
    case 'outcomeFixed':
      return null; // Shown as its own paragraph, above the list.
    default:
      return null;
  }
}

export interface RulesPanelOptions {
  /** Measured rounding bands per config id, from the committed RTP reports. */
  bands: Record<string, { minRtp: number; maxRtp: number; stakeMinor: number }>;
  version: string;
  build: string;
  reduceEffects: boolean;
  onReduceEffects(on: boolean): void;
}

export class RulesPanel {
  private readonly backdrop = document.createElement('div');
  private readonly body = document.createElement('div');

  constructor(
    private readonly session: () => SessionInfo | null,
    private readonly opts: RulesPanelOptions,
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.backdrop.className = 'rp-backdrop';
    this.backdrop.hidden = true;
    this.body.className = 'rp';
    this.body.setAttribute('role', 'dialog');
    this.body.setAttribute('aria-modal', 'true');
    this.body.setAttribute('aria-label', t('rules.title'));
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

  open() {
    this.render();
    this.backdrop.hidden = false;
    this.body.querySelector<HTMLButtonElement>('.close')?.focus();
  }

  close() {
    this.backdrop.hidden = true;
  }

  private render() {
    const session = this.session();
    if (!session) return;
    // The band belongs to the config actually in play, so it is looked up at render time.
    const items = describeRules(session.config, session.profile, session.currency, { roundingBand: this.opts.bands[session.config.id] });
    const lines = items.map((i) => line(i, session.currency.code)).filter((l): l is string => !!l);
    this.body.innerHTML = `
      <button class="close" type="button">${t('rules.close')}</button>
      <h2>${t('rules.title')}</h2>
      <p>${t('rules.intro')}</p>
      <p><strong>${t('rules.outcomeFixed')}</strong></p>
      <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
      <label class="toggle"><input type="checkbox" class="reduce" ${this.opts.reduceEffects ? 'checked' : ''} /> ${t('rules.reduceEffects')}</label>
      <p>${t('rules.responsible')}</p>
      <div class="foot">${t('rules.version', {
        version: this.opts.version,
        build: this.opts.build,
        config: session.config.id,
        profile: session.profile.name,
      })}</div>`;
    this.body.querySelector<HTMLButtonElement>('.close')?.addEventListener('click', () => this.close());
    this.body.querySelector<HTMLInputElement>('.reduce')?.addEventListener('change', (e) => {
      this.opts.onReduceEffects((e.target as HTMLInputElement).checked);
    });
  }
}
