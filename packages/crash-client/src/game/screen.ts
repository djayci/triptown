import { Container, Graphics, type Application, type Texture } from 'pixi.js';
import type { ResultKind } from '@triptown/core';
import { prefersReducedMotion, type GameApp } from '@triptown/engine';
import { t } from '../i18n';
import { BalancePill, HistoryStrip, Logo, SessionStrip } from '../ui/hud';
import { IconButton, StatBox, StickerButton, bodyStyle, displayStyle, drawSticker, labelStyle, text } from '../ui/primitives';
import { COLORS, onStage, readableOn } from '../theme';
import { CrashViewBase, type ActionControl } from './view-base';
import type { BetUi, CrashView, CrashViewCallbacks, Frames, SessionHud } from './view-contract';

const W = 390;
const H = 844;
const PAD = 12;
/** Stake row widths: [-] 44, stake, [+] 44, auto, with 6 px gaps inside and 8 before auto. */
const STAKE_W = 150;
const AUTO_W = W - PAD * 2 - (44 + 6 + STAKE_W + 6 + 44 + 8);
/** Without auto the stake box takes the whole row between the buttons. */
const STAKE_W_ALONE = W - PAD * 2 - (44 + 6 + 6 + 44);

type IconName = 'sound' | 'muted' | 'rules' | 'fairness' | 'history' | 'minus' | 'plus';

/**
 * Vector icons for the shared controls, rendered once to textures. CrashScreen games have no shared
 * atlas, and these must exist in every game: sound and rules are player-protection controls.
 */
function iconTextures(app: Application): Record<IconName, Texture> {
  const ink = COLORS.ink;
  const stroke = { color: ink, width: 5, cap: 'round' as const, join: 'round' as const };
  const draw = (paint: (g: Graphics) => void): Texture => {
    const g = new Graphics();
    g.rect(0, 0, 48, 48).fill({ color: 0, alpha: 0 });
    paint(g);
    const texture = app.renderer.generateTexture({ target: g, resolution: 3 });
    g.destroy();
    return texture;
  };
  const speaker = (g: Graphics) => g.poly([8, 18, 16, 18, 26, 9, 26, 39, 16, 30, 8, 30]).fill(ink);
  return {
    sound: draw((g) => {
      speaker(g);
      g.moveTo(32, 17).quadraticCurveTo(37, 24, 32, 31).stroke(stroke);
      g.moveTo(37, 12).quadraticCurveTo(45, 24, 37, 36).stroke(stroke);
    }),
    muted: draw((g) => {
      speaker(g);
      g.moveTo(32, 18).lineTo(42, 30).moveTo(42, 18).lineTo(32, 30).stroke(stroke);
    }),
    rules: draw((g) => {
      g.moveTo(16, 17).quadraticCurveTo(16, 8, 24, 8).quadraticCurveTo(33, 8, 33, 16).quadraticCurveTo(33, 22, 24, 25).lineTo(24, 30).stroke(stroke);
      g.circle(24, 39, 3.5).fill(ink);
    }),
    fairness: draw((g) => {
      g.moveTo(24, 6).lineTo(39, 12).lineTo(39, 23).quadraticCurveTo(39, 36, 24, 43).quadraticCurveTo(9, 36, 9, 23).lineTo(9, 12).closePath().stroke(stroke);
      g.moveTo(17, 24).lineTo(22, 29).lineTo(31, 19).stroke(stroke);
    }),
    history: draw((g) => {
      g.circle(24, 24, 15).stroke(stroke);
      g.moveTo(24, 15).lineTo(24, 24).lineTo(31, 28).stroke(stroke);
    }),
    minus: draw((g) => {
      g.moveTo(12, 24).lineTo(36, 24).stroke({ ...stroke, width: 6 });
    }),
    plus: draw((g) => {
      g.moveTo(12, 24).lineTo(36, 24).moveTo(24, 12).lineTo(24, 36).stroke({ ...stroke, width: 6 });
    }),
  };
}

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
  /** Clip for the design frame; the stage must never paint outside the 390x844 screen. */
  private readonly frameClip = new Graphics().rect(0, 0, W, H).fill(0xffffff);
  protected readonly stage: GameStage;

  private readonly logo: Logo;
  private readonly balance = new BalancePill();
  private readonly session = new SessionStrip();
  readonly history = new HistoryStrip(W - PAD * 2);

  private readonly mult = text('x1.00', displayStyle(88, COLORS.sun, 6, 7), [0.5, 0]);
  private readonly payout = text('', displayStyle(34, COLORS.lime, 4, 4), [0.5, 0]);
  // Read on a dark stage at arm's length, and clear of the payout's drop shadow.
  private readonly payoutLabel = text('', bodyStyle(13, onStage()), [0.5, 0]);
  /**
   * Deferred reveal (gate-odds-mvp): the live win chance, RTP ÷ value, under the payout. Plain text in the
   * same weight as the caption: it informs, it never competes with the multiplier or the money.
   */
  private readonly revealChance = text('', labelStyle(12, onStage()), [0.5, 0]);
  private lastChance: string | null = null;

  /** Hard rule 7: a demo build must say so on screen, in every game, always. */
  private readonly demoBadge = new Container();
  private readonly demoBg = new Graphics();

  private readonly counter = new Container();
  private readonly counterBg = new Graphics();
  private readonly counterValue = text('0', bodyStyle(15), [1, 0]);
  private readonly counterCaption = text('', labelStyle(10), [0, 0]);

  private readonly resultCard = new Container();
  private readonly resultBg = new Graphics();
  private readonly resultTitle = text('', displayStyle(34, COLORS.cream, 4, 4), [0.5, 0]);
  private readonly resultLine = text('', bodyStyle(15), [0.5, 0]);
  // (card fills are contrast-checked against the text tokens in useSkin)

  private readonly statBet: StatBox;
  private readonly statAuto: StatBox;
  private readonly icons: Record<IconName, Texture>;
  private readonly soundBtn: IconButton;
  private readonly controls: IconButton[];
  private readonly minusBtn: IconButton;
  private readonly plusBtn: IconButton;
  private readonly bigButton: StickerButton;

  private multiplier = 1;
  private withholding = false;

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

    this.statBet = new StatBox(t('label.stake'), this.hasAutoCashout() ? STAKE_W : STAKE_W_ALONE, 44);
    this.statAuto = new StatBox(t('label.auto'), AUTO_W, 44);
    this.statAuto.visible = this.hasAutoCashout();
    this.statAuto.eventMode = 'static';
    this.statAuto.cursor = 'pointer';
    this.statAuto.on('pointertap', () => this.handlers.onToggleAuto());

    // Controls every game needs: sound, fairness, rules before any bet, history, and the stake.
    this.icons = iconTextures(app);
    this.soundBtn = new IconButton(this.icons.sound, 40, COLORS.cream, () => this.handlers.onSound(), 'Sound');
    this.controls = [
      this.soundBtn,
      new IconButton(this.icons.fairness, 40, COLORS.sky, () => this.handlers.onFairness(), 'Provably fair'),
      new IconButton(this.icons.rules, 40, COLORS.cream, () => this.handlers.onRules(), 'Rules'),
      new IconButton(this.icons.history, 40, COLORS.cream, () => this.handlers.onHistory(), 'Round history'),
    ];
    this.minusBtn = new IconButton(this.icons.minus, 44, COLORS.sky, () => this.handlers.onStepBet(-1), 'Lower stake');
    this.plusBtn = new IconButton(this.icons.plus, 44, COLORS.sky, () => this.handlers.onStepBet(1), 'Raise stake');
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

    this.demoBadge.addChild(this.demoBg, text(t('label.demo'), labelStyle(11, COLORS.cream), [0.5, 0.5]));
    this.demoBadge.visible = false;

    if (words.counterLabel) {
      this.counterCaption.text = words.counterLabel;
      this.counter.addChild(this.counterBg, this.counterCaption, this.counterValue);
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
      this.revealChance,
      this.counter,
      this.demoBadge,
      this.resultCard,
      this.statBet,
      this.minusBtn,
      this.plusBtn,
      ...this.controls,
      this.statAuto,
      this.bigButton,
    );
    app.stage.addChild(this.root);

    // The design is a 390x844 phone frame. It is fitted to the window and centred, the way Whack Crash
    // letterboxes on desktop, and clipped to its own frame so a stage can never paint outside it.
    this.root.mask = this.frameClip;
    this.root.addChild(this.frameClip);
    this.stage.setReducedMotion(prefersReducedMotion());
    this.layout();
    this.fit(game.viewport());
    game.onResize((v) => {
      this.layout();
      this.fit(v);
    });
    app.ticker.add((ticker) => {
      this.stage.update(ticker.deltaMS / 1000);
      // The session clock has to advance while a round runs, not only when a round ends. It reads
      // its own elapsed time from `startedAt`, so ticking it here keeps it honest without telling it
      // anything about the round (compliance rule 7). Nothing called it before, so the clock only
      // moved when `setSessionHud` happened to be called — at round boundaries.
      this.session.tick();
      this.tickCountdown();
    });
    this.installInput(game);
  }

  /** Scales the whole design frame to fit the viewport and centres it. */
  private fit(v: { width: number; height: number }): void {
    const scale = Math.min(v.width / W, v.height / H);
    this.root.scale.set(scale);
    this.root.position.set((v.width - W * scale) / 2, (v.height - H * scale) / 2);
  }

  protected actionControl(): ActionControl {
    return this.bigButton;
  }

  /** The themed counter's value for a multiplier. Return null for no counter. */
  protected abstract counterFor(multiplier: number): string | null;

  /**
   * Whether this game offers auto cash-out. Called from the constructor, so an override must return a
   * constant and read no instance fields.
   */
  protected hasAutoCashout(): boolean {
    return true;
  }

  /**
   * Top of the result card in the 390x844 frame. A game whose result is shown in the scene (a gate opening,
   * say) can lift the card clear of it. The card restates the multiplier and the net, so it may cover the
   * live values but never the stage's own answer.
   */
  protected resultCardTop(): number {
    return 360;
  }

  get offersAutoCashout(): boolean {
    return this.hasAutoCashout();
  }

  private layout(): void {
    this.logo.position.set(PAD, 14);
    this.balance.position.set(W - PAD, 14);
    this.session.position.set(PAD, 64);
    this.placeHistory();
    this.mult.position.set(W / 2, 150);
    this.payout.position.set(W / 2, 246);
    this.payoutLabel.position.set(W / 2, 294);
    // Centred, so it wraps inside the control column on both sides rather than running under the icons.
    for (const line of [this.payoutLabel, this.revealChance]) {
      Object.assign(line.style, { wordWrap: true, wordWrapWidth: 2 * (W - PAD - 40 - 8 - W / 2), align: 'center' });
    }
    this.revealChance.position.set(W / 2, 318);

    // Above the stake row rather than beside the wordmark: a longer two-word logo collided with it
    // there, and this spot is free on every screen of every game regardless of name length.
    this.demoBg.clear();
    drawSticker(this.demoBg, 62, 24, { fill: COLORS.pink, radius: 8, border: 3, shadow: 3 });
    this.demoBg.position.set(-31, -12);
    this.demoBadge.position.set(PAD + 31, H - 196);

    this.counter.position.set(W / 2 - 46, 312);
    this.counterBg.clear();
    drawSticker(this.counterBg, 92, 28, { fill: COLORS.cream, radius: 8, border: 3, shadow: 3 });
    // Both sit inside the 92x28 sticker: caption left, value right-aligned against the inner edge.
    // The caption used to be added at the container origin and never positioned, so its first letter
    // fell outside the box.
    this.counterCaption.position.set(11, 9);
    this.counterValue.position.set(81, 5);

    this.resultCard.position.set(28, this.resultCardTop());
    this.resultTitle.position.set((W - 56) / 2, 20);
    this.resultLine.position.set((W - 56) / 2, 70);

    // Stake row: [-] stake [+] auto, or [-] stake [+] across the row when the game offers no auto.
    const rowY = H - 168;
    const stakeW = this.hasAutoCashout() ? STAKE_W : STAKE_W_ALONE;
    this.minusBtn.position.set(PAD, rowY);
    this.statBet.resize(stakeW, 44);
    this.statBet.position.set(PAD + 44 + 6, rowY);
    this.plusBtn.position.set(PAD + 44 + 6 + stakeW + 6, rowY);
    this.statAuto.resize(AUTO_W, 44);
    this.statAuto.position.set(W - PAD - AUTO_W, rowY);
    // Control column down the right edge, clear of the centred values, as on Whack Crash.
    this.placeControls();
    this.bigButton.resize(W - PAD * 2, 92);
    this.bigButton.position.set(PAD, H - 110);
  }

  private card(fill: number): void {
    this.resultBg.clear();
    drawSticker(this.resultBg, W - 56, 118, { fill, radius: 16, border: 5, shadow: 6 });
    // The line is unstroked, so it needs real contrast against the fill (BR Annex I 14(c),
    // AGCO 4.15, UK RTS 7E). The title carries an ink outline and reads on either card.
    this.resultLine.style.fill = readableOn(fill);
  }

  // ---------- CrashView ----------

  setDemo(on: boolean): void {
    this.demoBadge.visible = on;
  }

  /** Games without audio get no sound button, and the column closes up. */
  setAudioAvailable(available: boolean): void {
    this.soundBtn.visible = available;
    this.placeControls();
  }

  /** The history chips move up into the session strip's row when a market shows no clock or net. */
  private placeHistory(): void {
    this.history.position.set(PAD, this.session.visible ? 96 : 64);
  }

  private placeControls(): void {
    this.controls.filter((b) => b.visible).forEach((b, i) => b.position.set(W - PAD - 40, 136 + i * 50));
  }

  setMuted(muted: boolean): void {
    this.soundBtn.setTexture(muted ? this.icons.muted : this.icons.sound, muted ? 'Sound off' : 'Sound on');
  }

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
    this.placeHistory();
  }

  showBetting(): void {
    this.phase = 'betting';
    this.revealChance.text = '';
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

  /** Deferred reveal: the round's chance line, or null to hide it. */
  setRevealOdds(chance: string | null): void {
    this.lastChance = chance;
    this.revealChance.text = chance === null ? '' : t('run.revealChance', { chance });
  }

  /**
   * Deferred reveal: collect was pressed. The value and the amount it would pay are locked on screen and
   * the button is busy. Nothing here depends on the outcome, which is not known yet (gate-odds-mvp D6).
   */
  showHeadingHome(multiplier: string, payoutIfWon: string): void {
    this.phase = 'cashing';
    // The chance stays on screen while heading home, restated so it is still true: "if you go in now" is
    // false once they have gone in, and hiding it would drop the disclosure that makes a locked value
    // honest when it may already be unwinnable. It describes the value, never this round's result.
    if (this.lastChance !== null) this.revealChance.text = t('run.revealChanceLocked', { chance: this.lastChance, multiplier });
    this.mult.text = multiplier;
    this.payout.text = payoutIfWon;
    this.payout.style.fill = COLORS.cream;
    this.payoutLabel.text = t('run.headingHome');
    this.bigButton.setLabel(t('button.headingHome'), t('button.headingHomeSub'));
    this.bigButton.setEnabled(false);
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
    // Some markets require players to be told winnings may be taxed. It follows the base's
    // celebrate decision rather than a kind branch: a return at or below the stake is not winnings,
    // so there is nothing to withhold from. The game never calculates or deducts anything.
    const withholding = celebrate && this.withholding ? ` · ${t('result.withholding')}` : '';
    this.resultLine.text = `${multiplier} · ${line}${withholding}`;
    this.card(celebrate ? COLORS.lime : COLORS.violet);
    this.resultCard.visible = true;
    // The big value becomes the SETTLED return, not the last animated frame, so the figure on screen
    // is the one actually paid (UK RTS 7E, AGCO 4.15). The live caption goes: it said "collect now".
    // A card lifted over the live values already states that same settled line, so the copy underneath
    // would only peek out from behind it.
    this.payout.text = this.resultCardTop() < 330 ? '' : line;
    this.payout.style.fill = celebrate ? COLORS.lime : COLORS.cream;
    this.payoutLabel.text = '';
    this.replay(celebrate);
  }

  showCrash(multiplier: string, loss: string, instant: boolean): void {
    this.phase = 'lost';
    this.resultTitle.text = this.words.crashedTitle;
    this.resultLine.text = instant ? loss : `${multiplier} · ${loss}`;
    this.card(COLORS.violet);
    this.resultCard.visible = true;
    this.mult.text = multiplier;
    // Nothing was won, so the live payout must not survive the crash. It used to: a lost round kept
    // the last animated figure in green above the result card, which reads as the amount the player
    // would have collected — the near-miss framing that is banned outright (AGCO 2.15, GLI §4.6.1(a),
    // RTS 7C), and a false statement of winnings besides.
    this.payout.text = '';
    this.payoutLabel.text = '';
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

  /** Market disclosures the profile switches on. Set from the session before any round settles. */
  setDisclosures(d: { withholdingNotice?: boolean }): void {
    this.withholding = d.withholdingNotice === true;
  }

  override setPresentation(flags: Parameters<CrashViewBase["setPresentation"]>[0]): void {
    super.setPresentation(flags);
    this.stage.setEffectsEnabled(this.intensityEffects);
  }
}

export type { Frames };
