import { bandForStake, type BandsByConfig } from '@triptown/fairness';
import { describeRules, effectiveReveal, type RuleItem, type SessionInfo } from '@triptown/core';
import { t } from '../i18n';
import { formatMoney, formatMultiplier, formatRevealChance, optimisticPayout } from '../game/display';

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
.rp h3 { font-size: 16px; font-weight: 800; margin: 14px 0 6px; }
.rp table.chances { width: 100%; border-collapse: collapse; margin: 0 0 12px; font-size: 14px; font-variant-numeric: tabular-nums; }
.rp table.chances th, .rp table.chances td { text-align: right; padding: 4px 6px; border-bottom: 2px solid rgba(29,20,36,.12); }
.rp table.chances th:first-child, .rp table.chances td:first-child { text-align: left; }
.rp table.chances th { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
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
      // A missing band is a failure to disclose, never licence to publish the bare theoretical
      // figure: rounding costs measurable RTP at the minimum stake, and GLI-19 4.7.1(a) requires the
      // minimum to be met at any single bet level. Say so on screen and shout in the console rather
      // than quietly showing a number the committed reports do not support.
      if (p.bandMinRtp === undefined) {
        console.error('[rules] no measured RTP band for this configuration; the published figure is incomplete');
        return `${base} ${t('rules.rtpBandMissing')}`;
      }
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
  /** Measured rounding bands per config id and stake level, from the committed RTP reports. */
  bands: BandsByConfig;
  version: string;
  build: string;
  reduceEffects: boolean;
  onReduceEffects(on: boolean): void;
  /** False for a game with no auto cash-out control, so the rules never describe one. Default true. */
  autoCashout?: boolean;
  /**
   * The registered game id. With it, a session whose rounds reveal at collect (effectiveReveal, the same
   * function the server uses at START) gets the chance section and the deferred intro. Without it the panel
   * never shows them: a market flag alone says what is allowed, not what this game does.
   */
  game?: string;
  /** The stake currently selected, for the return column of the chance table. */
  stakeMinor?: () => number;
}

/** Values in the chance table. Every row has chance x value = RTP, so none is highlighted. */
const CHANCE_VALUES = [1.01, 1.2, 1.5, 2, 3, 5, 10, 20, 50, 100];

/** Whether the rules show the chance section: only when this game's rounds actually reveal at collect. */
export function showsChances(game: string | undefined, session: Pick<SessionInfo, 'profile' | 'config'>): boolean {
  return !!game && effectiveReveal(game, session.profile, session.config) === 'onCollect';
}

/** The chance table rows, capped at the max win, at the stake shown (never below the market minimum). */
export function chanceRows(session: Pick<SessionInfo, 'profile' | 'config' | 'currency'>, stakeMinor: number | undefined) {
  const { config, currency, profile } = session;
  const stake = Math.max(stakeMinor ?? currency.minBetMinor, currency.minBetMinor);
  const cap = Math.min(config.maxWinMultiplier, profile.maxMultiplier);
  return {
    stake: formatMoney(stake, currency),
    rows: CHANCE_VALUES.filter((m) => m <= cap).map((m) => ({
      value: formatMultiplier(m),
      chance: formatRevealChance(config.rtp, m),
      payout: formatMoney(optimisticPayout(stake, m, config), currency),
    })),
  };
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
    // The band belongs to the config in play AND to this market's minimum stake: a player who cannot
    // bet less than NGN 100.00 must not be shown a figure measured at 0.20 (GLI-19 4.7.1(a)).
    const roundingBand = bandForStake(this.opts.bands, session.config.id, session.currency.minBetMinor);
    const items = describeRules(session.config, session.profile, session.currency, { roundingBand });
    const lines = items
      .filter((i) => i.key !== 'autoCashout' || this.opts.autoCashout !== false)
      .map((i) => line(i, session.currency.code)).filter((l): l is string => !!l);
    const deferred = showsChances(this.opts.game, session);
    const suffix = deferred ? 'Deferred' : '';
    this.body.innerHTML = `
      <button class="close" type="button">${t('rules.close')}</button>
      <h2>${t('rules.title')}</h2>
      <p>${t(`rules.intro${suffix}`)}</p>
      <p><strong>${t(`rules.outcomeFixed${suffix}`)}</strong></p>
      <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
      ${deferred ? this.chanceSection(session) : ''}
      <label class="toggle"><input type="checkbox" class="reduce" ${this.opts.reduceEffects ? 'checked' : ''} /> ${t('rules.reduceEffects')}</label>
      ${session.profile.withholdingNotice ? `<p>${t('rules.withholding')}</p>` : ''}
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

  /**
   * Deferred reveal (gate-odds-mvp): the chance a round is still running at each value, before any bet.
   * Chance x value is the RTP on every row, so no row is marked as better. The chance is derived from the
   * theoretical RTP; the published band above is measured at the minimum stake after rounding, and the
   * text says so, so the two figures don't read as inconsistent. The value keeps rising after a round
   * has been decided, so this chance is what makes the amount on screen honest (AGCO 2.15).
   */
  private chanceSection(session: SessionInfo): string {
    const rtp = (session.config.rtp * 100).toFixed(2);
    const table = chanceRows(session, this.opts.stakeMinor?.());
    const stake = table.stake;
    const rows = table.rows.map((r) => `<tr><td>${r.value}</td><td>${r.chance}</td><td>${r.payout}</td></tr>`).join('');
    return `
      <h3>${t('rules.chance.title')}</h3>
      <p>${t('rules.chance.intro', { rtp })}</p>
      <table class="chances"><thead><tr><th>${t('rules.chance.value')}</th><th>${t('rules.chance.chance')}</th><th>${t('rules.chance.return', { stake })}</th></tr></thead><tbody>${rows}</tbody></table>
      <p>${t('rules.chance.nominal', { rtp })}</p>
      <p>${t('rules.chance.onScreen')}</p>
      <p>${t('rules.chance.yours')}</p>`;
  }
}
