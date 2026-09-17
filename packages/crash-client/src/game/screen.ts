import { Container, Graphics } from 'pixi.js';
import type { ResultKind } from '@triptown/core';
import { prefersReducedMotion, type GameApp } from '@triptown/engine';
import { t } from '../i18n';
import { BalancePill, HistoryStrip, Logo, SessionStrip } from '../ui/hud';
import { StatBox, StickerButton, bodyStyle, displayStyle, drawSticker, labelStyle, text } from '../ui/primitives';
import { COLORS } from '../theme';
import { CrashViewBase, type ActionControl } from './view-base';
import type { BetUi, CrashView, CrashViewCallbacks, Frames, SessionHud } from './view-contract';

const W = 390;
const H = 844;
const PAD = 12;

/** What a game must supply. Everything else on screen is the shared layout's. */
export interface GameStage extends Container {
  /** The only input: the current multiplier. Never the crash time, never the time remaining. */
  setMultiplier(multiplier: number): void;
  setEffectsEnabled(on: boolean): void;
  setReducedMotion(on: boolean): void;
  /** Called every frame with seconds elapsed. */
  update(dtSeconds: number): void;
  /** The round ended badly. No build-up preceded this. */
  onCrash(): void;
  /** Back to a fresh round. */
  reset(): void;
}

export interface ScreenWords {
  /** The two halves of the wordmark, e.g. `['THE', 'LIFT']`. */
  logo: [string, string];
  /** The cash-out verb, e.g. `GET OUT!`. */
  collect: string;
  /** Label under the live payout while a round runs. */
  liveLabel: string;
  /** Subtitle on the betting screen. */
  readySub: string;
  /** Title on a settled round that returned something. */
  settledTitle: string;
  /** Title when the round ended badly. */
  crashedTitle: string;
  /** Themed counter caption, e.g. `Floor`. Omit for no counter. */
  counterLabel?: string;
}

/**
 * The whole screen except the game's own scene: wordmark, balance, session clock and net position,
 * history strip, the two primary values, the themed counter, the result card, the stake row and the
 * action button — plus every compliance behaviour inherited from `CrashViewBase`.
 *
 * A game subclasses this, supplies a `GameStage` and its words, and implements no layout and no
 * compliance logic at all. That is the point: the presentation and timing rules then hold for every
 * game by construction rather than by each one remembering them.
 *
 * The primary values are the multiplier and the money. The themed counter is deliberately small,
 * muted and never in the payout's position — Brazil requires the rising multiplier shown, Portugal
 * makes its numeric value mandatory, the Netherlands requires the money "sufficiently
 * distinguishable", and Ontario forbids displaying amounts that are unachievable.
 */
export abstract class CrashScreen extends CrashViewBase implements CrashView {
  protected readonly root = new Container();
  protected readonly stage: GameStage;

  private readonly logo: Logo;
  private readonly balance = new BalancePill();
  private readonly session = new SessionStrip();
  readonly history = new HistoryStrip(W - PAD * 2);

  private readonly mult = text('x1.00', displayStyle(88, COLORS.sun, 6, 7), [0.5, 0]);
  private readonly payout = text('', displayStyle(34, COLORS.lime, 4, 4), [0.5, 0]);
  private readonly payoutLabel = text('', labelStyle(11), [0.5, 0]);

  private readonly counter = new Container();
  private readonly counterBg = new Graphics();
  private readonly counterValue = text('0', bodyStyle(15), [0, 0]);

  private readonly resultCard = new Container();
  private readonly resultBg = new Graphics();
  private readonly resultTitle = text('', displayStyle(34, COLORS.cream, 4, 4), [0.5, 0]);
  private readonly resultLine = text('', bodyStyle(15), [0.5, 0]);

  private readonly statBet: StatBox;
  private readonly statAuto: StatBox;
  private readonly bigButton: StickerButton;

  private multiplier = 1;

  protected constructor(
    game: GameApp,
    handlers: CrashViewCallbacks,
    private readonly words: ScreenWords,
    stage: GameStage,
  ) {
    super(handlers);
    const { app } = game;
    this.stage = stage;
    this.logo = new Logo(words.logo[0], words.logo[1], 22);

    const statW = (W - PAD * 2 - 8) / 2;
    this.statBet = new StatBox(t('label.stake'), statW, 44);
    this.statAuto = new StatBox(t('label.auto'), statW, 44);
    this.bigButton = new StickerButton({
      width: W - PAD * 2,
      height: 92,
      fill: COLORS.sky,
      radius: 26,
      label: t('button.bet', { amount: '' }),
      labelSize: 40,
      shadow: 8,
      border: 5,
      onTap: () => this.handlers.onBigButton(),
      a11y: t('button.bet', { amount: '' }),
    });

    if (words.counterLabel) {
      this.counter.addChild(this.counterBg, text(words.counterLabel, labelStyle(10), [0, 0]), this.counterValue);
    }
    this.resultCard.addChild(this.resultBg, this.resultTitle, this.resultLine);
    this.resultCard.visible = false;

    this.root.addChild(
      this.stage,
      this.logo,
      this.balance,
      this.session,
      this.history,
      this.mult,
      this.payout,
      this.payoutLabel,
      this.counter,
      this.resultCard,
      this.statBet,
      this.statAuto,
      this.bigButton,
    );
    app.stage.addChild(this.root);

    this.stage.setReducedMotion(prefersReducedMotion());
    this.layout();
    game.onResize(() => this.layout());
    app.ticker.add((ticker) => {
      this.stage.update(ticker.deltaMS / 1000);
      this.tickCountdown();
    });
    this.installInput(game);
  }

  protected actionControl(): ActionControl {
    return this.bigButton;
  }

  /** The themed counter's value for a multiplier. Return null for no counter. */
  protected abstract counterFor(multiplier: number): string | null;

  private layout(): void {
    this.logo.position.set(PAD, 14);
    this.balance.position.set(W - PAD, 14);
    this.session.position.set(PAD, 64);
    this.history.position.set(PAD, 96);
    this.mult.position.set(W / 2, 150);
    this.payout.position.set(W / 2, 246);
    this.payoutLabel.position.set(W / 2, 286);

    this.counter.position.set(W / 2 - 46, 312);
    this.counterBg.clear();
    drawSticker(this.counterBg, 92, 28, { fill: COLORS.cream, radius: 8, border: 3, shadow: 3 });
    this.counterValue.position.set(54, 6);

    this.resultCard.position.set(28, 360);
    this.resultTitle.position.set((W - 56) / 2, 20);
    this.resultLine.position.set((W - 56) / 2, 70);

    const statW = (W - PAD * 2 - 8) / 2;
    this.statBet.resize(statW, 44);
    this.statAuto.resize(statW, 44);
    this.statBet.position.set(PAD, H - 168);
    this.statAuto.position.set(PAD + statW + 8, H - 168);
    this.bigButton.resize(W - PAD * 2, 92);
    this.bigButton.position.set(PAD, H - 110);
  }

  private card(fill: number): void {
    this.resultBg.clear();
    drawSticker(this.resultBg, W - 56, 118, { fill, radius: 16, border: 5, shadow: 6 });
  }

  // ---------- CrashView ----------

  setDemo(): void {}

  setMuted(): void {}

  setBalance(amount: string, currency: string): void {
    this.balance.set(amount, currency);
  }

  setBetUi(ui: BetUi): void {
    this.statBet.set(t('label.stake'), ui.bet);
    this.statAuto.set(t('label.auto'), ui.autoOn ? ui.auto : '—');
    if (this.phase !== 'betting') return;
    this.setActionLabel({ label: ui.reason ?? t('button.bet', { amount: ui.bet }), sub: '', enabled: ui.canBet });
    if (!this.counting) {
      this.bigButton.setLabel(this.actionLabel.label, this.actionLabel.sub);
      this.bigButton.setEnabled(this.actionLabel.enabled);
    }
  }

  setSessionHud(hud: SessionHud): void {
    this.session.set(hud);
  }

  showBetting(): void {
    this.phase = 'betting';
    this.resultCard.visible = false;
    this.payout.text = '';
    this.payoutLabel.text = this.words.readySub;
    this.mult.text = 'x1.00';
    this.multiplier = 1;
    this.stage.setMultiplier(1);
    this.stage.reset();
    this.stage.setEffectsEnabled(this.intensityEffects);
    this.bigButton.setFill(COLORS.sky);
  }

  showStarting(): void {
    this.phase = 'starting';
    this.resultCard.visible = false;
  }

  showRunning(): void {
    this.phase = 'running';
    this.resultCard.visible = false;
    this.bigButton.setFill(COLORS.lime);
    this.bigButton.setLabel(this.words.collect, '');
    this.bigButton.setEnabled(true);
    this.setActionLabel({ label: this.words.collect, sub: '', enabled: true });
  }

  showCashing(payout: string): void {
    this.phase = 'cashing';
    this.bigButton.setLabel(t('button.cashingOut', { amount: payout }), '');
    this.bigButton.setEnabled(false);
  }

  cancelCashing(payout: string): void {
    this.phase = 'running';
    this.bigButton.setLabel(t('button.cashOut', { amount: payout }), '');
    this.bigButton.setEnabled(true);
  }

  showWin(multiplier: string, payout: string, _big: boolean, kind: ResultKind, net: string): void {
    this.phase = 'won';
    // The rule lives in the base; this only draws what it returns.
    const { celebrate, line } = this.resultPresentation(kind, payout, net);
    this.resultTitle.text = this.words.settledTitle;
    this.resultLine.text = `${multiplier} · ${line}`;
    this.card(celebrate ? COLORS.lime : COLORS.violet);
    this.resultCard.visible = true;
    this.replay(celebrate);
  }

  showCrash(multiplier: string, loss: string, instant: boolean): void {
    this.phase = 'lost';
    this.resultTitle.text = this.words.crashedTitle;
    this.resultLine.text = instant ? loss : `${multiplier} · ${loss}`;
    this.card(COLORS.violet);
    this.resultCard.visible = true;
    this.mult.text = multiplier;
    this.stage.onCrash();
    this.replay(false);
  }

  private replay(celebrate: boolean): void {
    const next = this.quickReplay
      ? { label: t('button.playAgain'), sub: t('button.playAgainSub') }
      : { label: t('button.continue'), sub: t('button.continueSub') };
    this.bigButton.setFill(celebrate ? COLORS.lime : COLORS.sky);
    this.bigButton.setLabel(next.label, next.sub);
    this.bigButton.setEnabled(true);
    this.setActionLabel({ ...next, enabled: true });
  }

  frame(multiplier: string, payout: string, _level: number, _intensity: string, _pace: number, belowStake: boolean): void {
    this.mult.text = multiplier;
    this.payout.text = payout;
    this.payout.style.fill = belowStake ? COLORS.cream : COLORS.lime;
    this.payoutLabel.text = this.words.liveLabel;
    const value = Number(multiplier.replace(/[^\d.]/g, '')) || 1;
    this.multiplier = value;
    this.stage.setMultiplier(value);
    const counter = this.counterFor(value);
    if (counter !== null) this.counterValue.text = counter;
  }

  checkpoint(): void {}

  miniCheckpoint(): void {}

  boost(_percent: number, to: string): void {
    this.mult.text = to;
  }

  setback(_from: string, to: string): void {
    this.mult.text = to;
  }

  toast(message: string): void {
    this.resultLine.text = message;
  }

  override setPresentation(flags: Parameters<CrashViewBase["setPresentation"]>[0]): void {
    super.setPresentation(flags);
    this.stage.setEffectsEnabled(this.intensityEffects);
  }
}

export type { Frames };
