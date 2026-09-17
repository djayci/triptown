import { BitmapFont, BitmapText, Container, Graphics, Rectangle, Sprite, Text, TilingSprite, type Ticker } from 'pixi.js';
import { Confetti, gsap, pop, prefersReducedMotion, shake, tilt, type GameApp } from '@triptown/engine';
import type { ResultKind } from '@triptown/core';
import { t } from '../i18n/en';
import { COLORS, FONT_DISPLAY, SKIN } from '@triptown/crash-client';
import {
  Burst,
  Chip,
  IconButton,
  StatBox,
  StickerButton,
  bodyStyle,
  displayStyle,
  drawSticker,
  labelStyle,
  text,
} from '@triptown/crash-client';
import { BalancePill, HistoryStrip, Logo, SessionStrip, StickerLabel } from '@triptown/crash-client';
import { Hole, Meter, RISE_FULL, RISE_HIDDEN, Stage, type Frames, type MoleFrame } from '../ui/stage';
import { BET_CHIPS, CrashViewBase, type ActionControl, type BetUi, type CrashView, type CrashViewCallbacks, type Phase } from '@triptown/crash-client';

// The handler shape, the phases and the bet UI are the shared contract now, not this game's.
export type ViewHandlers = CrashViewCallbacks;
export type { BetUi, Phase };

type Layout = 'portrait' | 'desktop';

const PORTRAIT = { w: 390, h: 844 };
const DESKTOP = { w: 1440, h: 900 };
/** Side gutter in portrait, and the content width it leaves. */
const PAD = 10;
const CONTENT = PORTRAIT.w - PAD * 2;

/** Everything the player sees. Knows nothing about rounds or money rules; the controller drives it. */
/** Bright colours the flying in-between numbers cycle through. */
const MINI_TINTS = [COLORS.pink, COLORS.sky, COLORS.lime2, COLORS.violet, COLORS.sun, COLORS.red];

/** Multiplier colour per checkpoint tier: cream, lime, sky, gold, pink. */
const CHECKPOINT_TINTS: [number, number][] = [
  [1.5, COLORS.lime2],
  [3, COLORS.sky],
  [5, COLORS.sun],
  [10, COLORS.pink],
  [25, COLORS.violet],
  [100, COLORS.red],
];

/** How far the background moles peek out while betting (0 is fully up, RISE_HIDDEN is down). */
const DECOY_PEEK = 96;

export class GameView extends CrashViewBase implements CrashView {
  readonly root = new Container();
  private readonly bgDots: TilingSprite;
  private readonly bgFill = new Graphics();
  private layout: Layout = 'portrait';
  /** Portrait design height for the current viewport; desktop keeps its fixed frame. */
  private designH = PORTRAIT.h;

  // Header
  private logo = new Logo(t('logo.whack'), t('logo.crash'), 22);
  private logoBig = new Logo(t('logo.whack'), t('logo.crash'), 32);
  private balance = new BalancePill(false);
  private balanceBig = new BalancePill(true);
  readonly history = new HistoryStrip(358);
  readonly sessionStrip = new SessionStrip(358);

  // Stage
  readonly stage: Stage;
  private readonly mainHole: Hole;
  private readonly decoys: Hole[] = [];
  /** Background hole index a modifier mole is currently using, so the idle pop leaves it alone. */
  private busyDecoy: number | null = null;
  private readonly fx = new Container();
  private readonly confetti: Confetti;
  private readonly mult: BitmapText;
  private readonly oldMult: BitmapText;
  private readonly strike = new Graphics();
  private readonly winNow: StickerLabel;
  private readonly ready = new Container();
  private readonly meter = new Meter(326);
  private readonly resultCard = new Container();
  private readonly resultMult: BitmapText;
  private readonly resultPayout = text('', bodyStyle(28));
  private readonly resultTitle = text(t('result.cashedOut'), labelStyle(13), [0.5, 0]);
  private readonly resultCardBg = new Graphics();
  private readonly escaped: StickerLabel;
  private readonly lostChip: StickerLabel;
  private readonly bustBurst: Burst;
  private readonly demo: StickerLabel;
  private readonly soundBtn: IconButton;
  private readonly shieldBtn: IconButton;
  private readonly helpBtn: IconButton;

  // Controls
  private readonly panel = new Graphics();
  private readonly lockedLabel = text(t('label.betLocked'), labelStyle(12));
  private readonly minus: IconButton;
  private readonly plus: IconButton;
  private readonly amountBox = new Container();
  private readonly amountBg = new Graphics();
  private readonly amountText = text('10.00', displayStyle(36, COLORS.ink));
  private readonly amountUnit = text('USD', labelStyle(12));
  private readonly chips: Chip[] = [];
  private readonly autoRow = new Container();
  private readonly autoBg = new Graphics();
  private readonly autoToggle = new Graphics();
  private readonly autoLabel = text(t('label.autoCashOut'), labelStyle(12));
  private readonly autoField = new Container();
  private readonly autoFieldBg = new Graphics();
  private readonly autoValue = text('x5.00', bodyStyle(18));
  private readonly statBet: StatBox;
  private readonly statAuto: StatBox;
  readonly bigButton: StickerButton;
  /** Stake-free practice round, offered beside the primary action where the market allows it. */
  private readonly practiceButton: StickerButton;

  /** Count of setback moments played (used by automated checks). */
  setbacksShown = 0;
  /** Screen shakes played this round. A return at or below the stake must never add one. */
  shakesShown = 0;
  private fxTweens: gsap.core.Animation[] = [];
  private decoyTimer = 0;
  private level = 0;
  private bob = 0;
  /** False from a round start until the control is released again (RTS 14G). */
  /** Profile-driven presentation: one-tap replay, and whether shake/tilt/confetti are allowed. */
  /** Which modifiers this market actually plays, so the standby screen shows only those moles. */
  /** What the start control should read once any countdown finishes. */
  /** Which side the bad mole pops from; chosen fresh for every setback. */
  private modSide: 'left' | 'right' = 'right';
  /** Colour of the current checkpoint tier; the multiplier and payout keep it until the next one. */
  private tierTint: number = COLORS.cream;
  private stageH = 424;
  private readonly tick = (t: Ticker) => this.update(t.deltaMS / 1000);

  constructor(
    private readonly game: GameApp,
    private readonly frames: Frames,
    handlers: ViewHandlers,
  ) {
    super(handlers);
    const { app } = game;
    installFonts();

    // Page background: sun with ink dots.
    const dot = new Graphics().rect(0, 0, 18, 18).fill(COLORS.sun).circle(9, 9, 1.6).fill({ color: COLORS.ink, alpha: 0.09 });
    this.bgDots = new TilingSprite({ texture: app.renderer.generateTexture(dot), width: 10, height: 10 });
    app.stage.addChild(this.bgFill, this.bgDots, this.root);

    this.stage = new Stage(app.ticker);
    const c = this.stage.content;

    // Holes
    this.decoys = [0, 1, 2, 3].map(() => new Hole(frames, 'mole-decoy-happy'));
    this.mainHole = new Hole(frames, 'mole-gold-sleep');
    this.mainHole.eventMode = 'static';
    this.mainHole.cursor = 'pointer';
    this.mainHole.hitArea = new Rectangle(30, 0, 220, 280);
    this.mainHole.on('pointertap', () => this.handlers.onCollect());
    this.decoys.forEach((d) => {
      // Decoration only: no input, no response to taps (AGCO 2.15, GLI-19 4.6.1(a), UK RTS 7C,
      // Netherlands Bko art. 4.2(4) bans requiring actions that do not influence the outcome).
      d.eventMode = 'none';
      d.cursor = 'default';
    });

    this.mult = new BitmapText({ text: 'x1.00', style: { fontFamily: 'MultCream', fontSize: 92 } });
    this.mult.anchor.set(0.5, 0);
    this.oldMult = new BitmapText({ text: 'x4.20', style: { fontFamily: 'MultCream', fontSize: 30 } });
    this.oldMult.anchor.set(0.5, 0);
    this.oldMult.visible = false;
    this.strike.visible = false;
    this.winNow = new StickerLabel('WIN NOW 0.00', COLORS.cream, () => labelStyle(12));

    const readyTitle = text(t('stage.ready'), displayStyle(54, COLORS.cream, 5, 5), [0.5, 0]);
    const readySub = text('Whack the golden mole\nbefore it dives.', { ...bodyStyle(15, COLORS.ink, '700'), align: 'center', lineHeight: 19 }, [0.5, 0]);
    readySub.y = 70;
    this.ready.addChild(readyTitle, readySub);

    // Result card
    this.resultMult = new BitmapText({ text: 'x1.00', style: { fontFamily: 'MultPink', fontSize: 80 } });
    this.resultMult.anchor.set(0.5, 0);
    this.resultPayout.anchor.set(0.5, 0);
    this.resultCard.addChild(this.resultCardBg, this.resultTitle, this.resultMult, this.resultPayout);
    this.resultCard.visible = false;

    this.escaped = new StickerLabel(t('result.escaped'), COLORS.ink, () => displayStyle(24, COLORS.sun), 16, 8, 0);
    this.lostChip = new StickerLabel('-10.00', COLORS.red, () => displayStyle(30, COLORS.cream, 3), 18, 6, 4);
    this.bustBurst = new Burst(frames('burst-red'), 150, t('stage.instantBust'), 30);
    this.escaped.visible = this.lostChip.visible = this.bustBurst.visible = false;

    this.demo = new StickerLabel(t('label.demo'), COLORS.pink, () => displayStyle(16, COLORS.cream, 2), 10, 4, 3);
    this.demo.rotation = -0.08;
    this.demo.visible = false;

    this.soundBtn = new IconButton(frames('icon-sound'), 44, COLORS.cream, () => this.handlers.onSound(), 'Mute sound');
    this.shieldBtn = new IconButton(frames('icon-shield'), 44, COLORS.sky, () => this.handlers.onFairness(), 'Provably fair');
    // Rules must be reachable in every state, including before the first bet (GLI-19 4.4.1, RTS 3/4).
    this.helpBtn = new IconButton(frames('icon-help'), 44, COLORS.cream, () => this.handlers.onRules(), 'How this game works');

    this.confetti = new Confetti(app.ticker);
    c.addChild(this.sessionStrip, ...this.decoys, this.mainHole, this.ready, this.resultCard, this.oldMult, this.strike, this.mult, this.winNow, this.meter, this.escaped, this.lostChip, this.bustBurst, this.fx, this.confetti, this.demo, this.soundBtn, this.shieldBtn, this.helpBtn);

    // Controls
    this.minus = new IconButton(frames('icon-minus'), 56, COLORS.sky, () => this.handlers.onStepBet(-1), 'Decrease bet', 0.5);
    this.plus = new IconButton(frames('icon-plus'), 56, COLORS.sky, () => this.handlers.onStepBet(1), 'Increase bet', 0.5);
    this.amountUnit.alpha = 0.55;
    this.amountText.anchor.set(1, 0.5);
    this.amountUnit.anchor.set(0, 0.5);
    this.amountBox.addChild(this.amountBg, this.amountText, this.amountUnit);
    BET_CHIPS.forEach((minor) => this.chips.push(new Chip(String(minor / 100), 60, 44, () => this.handlers.onChip(minor))));

    this.autoToggle.eventMode = 'static';
    this.autoToggle.cursor = 'pointer';
    this.autoRow.eventMode = 'static';
    this.autoRow.hitArea = new Rectangle(0, 0, 220, 54);
    this.autoRow.cursor = 'pointer';
    this.autoRow.accessible = true;
    this.autoRow.accessibleTitle = 'Toggle auto cash out';
    this.autoRow.on('pointertap', (e) => {
      if (this.autoField.getBounds().containsPoint(e.global.x, e.global.y)) return;
      this.handlers.onToggleAuto();
    });
    this.autoField.eventMode = 'static';
    this.autoField.cursor = 'pointer';
    this.autoField.accessible = true;
    this.autoField.accessibleTitle = 'Change auto cash out target';
    this.autoField.on('pointertap', () => this.handlers.onCycleAuto());
    this.autoValue.anchor.set(0.5, 0.5);
    this.autoLabel.anchor.set(0, 0.5);
    this.autoField.addChild(this.autoFieldBg, this.autoValue);
    this.autoRow.addChild(this.autoBg, this.autoToggle, this.autoLabel, this.autoField);

    this.statBet = new StatBox('Bet', 174, 44);
    this.statBet.eventMode = 'static';
    this.statBet.cursor = 'pointer';
    this.statBet.accessible = true;
    this.statBet.accessibleTitle = 'Change bet';
    this.statBet.on('pointertap', () => this.handlers.onEditBet());
    this.statAuto = new StatBox('Auto', 174, 44);

    this.bigButton = new StickerButton({
      width: 358,
      height: 80,
      fill: COLORS.lime,
      label: 'BET 10.00',
      sub: '',
      labelSize: 40,
      icon: frames('icon-hammer-cream'),
      onTap: () => this.handlers.onBigButton(),
    });

    this.practiceButton = new StickerButton({
      width: 358,
      height: 46,
      fill: COLORS.cream,
      label: t('button.practice'),
      sub: t('button.practiceSub'),
      labelSize: 20,
      onTap: () => this.handlers.onPractice(),
    });
    this.practiceButton.visible = false;

    this.history.onOpen = () => this.handlers.onHistory();
    this.root.addChild(this.panel, this.logo, this.logoBig, this.balance, this.balanceBig, this.history, this.stage, this.lockedLabel, this.minus, this.amountBox, this.plus, ...this.chips, this.autoRow, this.statBet, this.statAuto, this.bigButton, this.practiceButton);

    app.ticker.add(this.tick);
    game.onResize((v) => this.applyViewport(v.width, v.height));
    // Release-and-press (RTS 14G) and the minimum-gap countdown live in CrashViewBase, so every
    // game gets them without reimplementing them.
    this.installInput(game);
  }

  protected override secondaryControl() {
    return this.practiceButton.visible ? this.practiceButton : null;
  }

  protected actionControl(): ActionControl {
    return this.bigButton;
  }

  // ---------- public API ----------

  setDemo(on: boolean) {
    this.demo.visible = on;
  }

  setMuted(muted: boolean) {
    this.soundBtn.setTexture(this.frames(muted ? 'icon-mute' : 'icon-sound'), muted ? 'Unmute sound' : 'Mute sound');
  }

  setBalance(amount: string, currency: string) {
    this.balance.set(amount, currency);
    this.balanceBig.set(amount, currency);
    this.relayoutHeader();
  }

  setBetUi(ui: BetUi) {
    this.amountText.text = ui.bet;
    this.chips.forEach((chip, i) => chip.setState(BET_CHIPS[i] === ui.betMinor, !ui.locked));
    this.minus.alpha = this.plus.alpha = this.amountBox.alpha = this.autoRow.alpha = ui.locked ? 0.45 : 1;
    this.minus.eventMode = this.plus.eventMode = this.autoRow.eventMode = this.autoField.eventMode = ui.locked ? 'none' : 'static';
    this.lockedLabel.visible = this.layout === 'desktop' && ui.locked;
    this.drawAuto(ui.autoOn, ui.auto);
    this.statBet.set('Bet', ui.bet);
    this.statAuto.set('Auto', ui.autoOn ? ui.auto : 'OFF');
    if (this.phase === 'betting') this.setActionLabel({ label: ui.reason ?? `BET ${ui.bet}`, sub: '', enabled: ui.canBet });
    if (this.phase === 'betting' && !this.counting) {
      this.bigButton.setFill(COLORS.lime);
      this.bigButton.setIcon(null);
      this.bigButton.setLabel(this.actionLabel.label, this.actionLabel.sub);
      this.bigButton.setEnabled(this.actionLabel.enabled);
    }
    this.layoutAmount();
  }

  /** Switches to the betting screen. */
  showBetting() {
    this.phase = 'betting';
    this.showSideButtons(true);
    this.resetStageFx();
    this.stage.setMood('sun');
    this.ready.visible = true;
    this.mult.visible = this.winNow.visible = this.meter.visible = false;
    this.mainHole.setFrame(this.frames, 'mole-gold-sleep');
    this.mainHole.riseTo(140, 0.5, 'power2.out');
    // Background moles look out while the player is choosing a bet; they duck away once a round starts.
    this.decoys.forEach((d, i) => {
      // Only the modifiers this market plays are introduced: good mole left, bad mole right.
      const frame =
        i === 1 && this.modifiers.setbacks ? 'mole-bad-angry' : i === 0 && this.modifiers.boosts ? 'mole-good-happy' : 'mole-decoy-happy';
      d.setFrame(this.frames, frame);
      d.riseTo(DECOY_PEEK, 0.45 + i * 0.08, 'back.out(1.4)');
    });
    this.bigButton.setEnabled(true);
    this.relayout(true);
  }

  /** Session clock and net position, per the market profile. */
  setSessionHud(opts: Parameters<SessionStrip['set']>[0]) {
    this.sessionStrip.set(opts);
    this.layoutSessionStrip();
  }

  private layoutSessionStrip() {
    if (!this.sessionStrip.visible) return;
    const { width: w } = this.stage.size;
    // A band across the top of the stage; the round display shifts down to make room for it.
    // Clear of the DEMO badge on the left and the side buttons on the right.
    const left = this.demo.visible ? 100 : 12;
    this.sessionStrip.resize(Math.max(150, w - left - (this.layout === 'desktop' ? 12 : 72)));
    this.sessionStrip.position.set(left, 8);
  }

  /** Vertical room the session band takes from the round display. */
  private get hudOffset() {
    return this.sessionStrip.visible ? 34 : 0;
  }

  /** Applies the market profile's presentation flags. */


  showStarting() {
    this.phase = 'starting';
    this.showSideButtons(false);
    this.bigButton.setEnabled(false);
  }

  /** Round started: mole pops out, multiplier appears. */
  showRunning(cashout: string) {
    this.phase = 'running';
    this.showSideButtons(false);
    this.resetStageFx();
    this.tierTint = COLORS.cream;
    this.mult.tint = COLORS.cream;
    this.winNow.caption.tint = COLORS.cream;
    this.stage.spinFrom(0); // fresh wind-up, but the curve's floor means it is never fully stopped
    this.ready.visible = false;
    this.mult.visible = this.winNow.visible = this.meter.visible = true;
    this.mult.text = 'x1.00';
    // Background moles duck away when the run starts; they pop on their own timer from here.
    this.decoys.forEach((d) => d.riseTo(RISE_HIDDEN, 0.22, 'power2.in'));
    this.mainHole.setFrame(this.frames, 'mole-gold-happy');
    this.mainHole.rise = RISE_HIDDEN;
    this.mainHole.riseTo(RISE_FULL, 0.45, 'back.out(1.8)');
    this.bigButton.setFill(COLORS.pink);
    this.bigButton.setIcon(this.frames('icon-hammer-cream'));
    this.bigButton.setLabel(t('button.whack'), `Cash out ${cashout}`);
    this.bigButton.setEnabled(true);
    this.relayout(true);
  }

  /** Per-frame running values. */
  frame(multiplier: string, cashout: string, level10: number, levelName: string, pace: number, belowStake = false) {
    this.mult.text = multiplier;
    this.fitMult();
    this.winNow.set(t(belowStake ? 'label.returnNow' : 'label.winNow', { amount: cashout }));
    this.layoutWinNow();
    this.meter.set(level10, levelName);
    this.level = level10;
    this.stage.speed = pace;
    if (this.phase === 'running') this.bigButton.setLabel(t('button.whack'), `Cash out ${cashout}`);
  }

  /**
   * A milestone multiplier (x2, x5, x10 …): the number changes colour and pops, and a badge flies up.
   * Milestones are all above the stake, so this never celebrates a losing round (RTS 14F).
   */
  checkpoint(value: number, label: string) {
    let tint: number = COLORS.cream;
    for (const [from, colour] of CHECKPOINT_TINTS) if (value >= from) tint = colour;
    // Flash white, then settle on the tier colour and keep it for the rest of the round.
    this.mult.tint = COLORS.white;
    this.tierTint = tint;
    gsap.delayedCall(0.1, () => {
      if (this.phase === 'running' || this.phase === 'cashing') this.mult.tint = this.tierTint;
    });
    // The running payout carries the same tier colour as the multiplier.
    this.winNow.caption.tint = tint;
    pop(this.mult, 1.22, 0.24);

    const badge = new Burst(this.frames(value >= 10 ? 'burst-gold' : 'burst-sky'), 84, label, 26);
    // Anchored to the multiplier, not the stage edge: the number is centred, so a badge pinned to the
    // right edge sat a whole stage-width away on desktop and read as unrelated to the value it marks.
    // Clamped so a long multiplier cannot push it off the stage. The side buttons are hidden mid-round.
    const desktop = this.layout === 'desktop';
    const beside = this.mult.x + this.mult.width / 2 + (desktop ? 58 : 38);
    badge.position.set(Math.min(beside, this.stage.size.width - 56), this.mult.y + this.mult.height * 0.42);
    badge.scale.set(0.2);
    this.fx.addChild(badge);
    this.trackFx(gsap.timeline({ onComplete: () => badge.destroy({ children: true }) }))
      .to(badge.scale, { x: 1, y: 1, duration: 0.16, ease: 'back.out(3)' })
      .to(badge, { y: badge.y - 26, alpha: 0, duration: 0.28, delay: 0.1, ease: 'power2.in' });
  }

  /** A small in-between milestone: its number flies off the multiplier in a bright colour. */
  miniCheckpoint(label: string) {
    if (prefersReducedMotion()) return;
    const colour = MINI_TINTS[Math.floor(Math.random() * MINI_TINTS.length)]!;
    const chip = text(label, displayStyle(this.layout === 'desktop' ? 34 : 26, colour, 4, 0), [0.5, 0.5]);
    const dir = Math.random() < 0.5 ? -1 : 1;
    chip.position.set(this.mult.x + dir * (this.mult.width * 0.32), this.mult.y + this.mult.height * 0.55);
    this.fx.addChild(chip);
    chip.scale.set(0.5);
    this.trackFx(gsap.timeline({ onComplete: () => chip.destroy() }))
      .to(chip.scale, { x: 1.1, y: 1.1, duration: 0.12, ease: 'back.out(3)' })
      .to(chip, { x: chip.x + dir * 70, y: chip.y - 60, rotation: dir * 0.35, alpha: 0, duration: 0.45, ease: 'power2.out' }, 0.05);
  }

  /**
   * Good mole boost: the value jumps up. Deliberately calmer than the setback — no shake, no tilt,
   * no hazard flash — so a modifier never reads like a win (D9).
   */
  boost(percent: number, to: string, cashout: string) {
    this.mult.text = to;
    this.fitMult();
    if (this.phase === 'running') this.bigButton.setLabel(t('button.whack'), `Cash out ${cashout}`);
    pop(this.mult, 1.12, 0.2);
    if (prefersReducedMotion()) return;

    const { width: w } = this.stage.size;
    // Either background hole, but not the one the bad mole just used.
    this.modSide = this.modSide === 'right' ? 'left' : 'right';
    const good = this.popModifierMole(this.modSide, 'mole-good-happy', 0.5);
    if (!good) return;

    const burst = new Burst(this.frames('burst-lime'), 72, `+${percent}%`, 22);
    // On the hole's rim, below the mole's face, so it never covers what the mole is doing.
    burst.position.set(Math.min(Math.max(good.x + 140 * good.scale.x, 40), w - 40), good.y + 250 * good.scale.y);
    burst.scale.set(0.2);
    this.fx.addChild(burst);
    this.trackFx(gsap.timeline({ onComplete: () => burst.destroy({ children: true }) }))
      .to(burst.scale, { x: 0.75, y: 0.75, duration: 0.16, ease: 'back.out(3)' })
      .to(burst, { y: burst.y - 22, alpha: 0, duration: 0.3, delay: 0.35, ease: 'power2.in' });
    this.stage.flashBoon();
    // A short hop of the gold mole, no shake and no stage tilt.
    gsap.timeline()
      .to(this.mainHole, { rise: RISE_FULL - 14, duration: 0.1, ease: 'power2.out' })
      .to(this.mainHole, { rise: RISE_FULL, duration: 0.24, ease: 'bounce.out' });
  }

  /**
   * Pops a modifier mole out of one of the two background holes and returns that hole, so the badge
   * and the coin trail can sit on it. The hole goes back to its idle mole afterwards.
   */
  private popModifierMole(side: 'left' | 'right', frame: MoleFrame, holdSec: number): Hole | null {
    const index = side === 'left' ? 0 : 1;
    const hole = this.decoys[index];
    if (!hole?.visible) return null;
    this.busyDecoy = index;
    gsap.killTweensOf(hole);
    hole.setFrame(this.frames, frame);
    hole.rise = RISE_HIDDEN;
    gsap.timeline()
      .to(hole, { rise: RISE_FULL, duration: 0.18, ease: 'back.out(2)' })
      .to(hole, {
        rise: RISE_HIDDEN,
        duration: 0.25,
        ease: 'power2.in',
        delay: holdSec,
        onComplete: () => {
          hole.setFrame(this.frames, 'mole-decoy-happy');
          if (this.busyDecoy === index) this.busyDecoy = null;
        },
      });
    return hole;
  }

  /** Bad mole steals half. */
  setback(from: string, to: string, cashout: string) {
    const { width: w } = this.stage.size;
    this.oldMult.text = from;
    this.oldMult.visible = this.strike.visible = true;
    this.mult.text = to;
    this.fitMult();
    this.layoutStrike();
    gsap.killTweensOf([this.oldMult, this.strike]);
    this.oldMult.alpha = this.strike.alpha = 1;
    gsap.to([this.oldMult, this.strike], {
      alpha: 0,
      delay: 1.4,
      duration: 0.3,
      onComplete: () => {
        this.oldMult.visible = this.strike.visible = false;
        this.layoutStrike();
      },
    });
    this.setbacksShown++;
    pop(this.mult, 1.25, 0.3);

    this.modSide = Math.random() < 0.5 ? 'left' : 'right';
    const bad = this.popModifierMole(this.modSide, 'mole-bad-angry', 1.1);
    const burst = new Burst(this.frames('burst-red'), 104, '-50%', 28);
    // The badge sits on the bad mole's head, clear of the multiplier and the side buttons.
    const badgeScale = this.layout === 'desktop' ? 1 : 0.72;
    const badX = bad ? bad.x + 140 * bad.scale.x : w / 2;
    const badY = bad ? bad.y + 250 * bad.scale.y : 220;
    burst.position.set(Math.min(Math.max(badX, 40), w - 40), badY);
    burst.rotation = 0.2;
    this.fx.addChild(burst);
    burst.scale.set(0.2);
    this.trackFx(gsap.timeline({ onComplete: () => burst.destroy({ children: true }) }))
      .to(burst.scale, { x: badgeScale, y: badgeScale, duration: 0.3, ease: 'back.out(3)' })
      .to(burst, { alpha: 0, duration: 0.3, delay: 1.1 });

    // The gold mole flinches and coins fly across to the bad mole.
    this.mainHole.setFrame(this.frames, 'mole-gold-shock');
    gsap.timeline()
      .to(this.mainHole, { rise: 70, duration: 0.12 })
      .to(this.mainHole, { rise: RISE_FULL, duration: 0.5, delay: 0.6, ease: 'back.out(1.5)', onStart: () => this.mainHole.setFrame(this.frames, 'mole-gold-happy') });
    this.flyCoins(bad);
    this.stage.flashHazard();
    if (this.intensityEffects) {
      tilt(this.stage, -1.4, 0.6);
      shake(this.root, 8, 0.3);
    }
    this.bigButton.setLabel(t('button.whack'), `Cash out ${cashout}`);
  }

  /** The cash-out was refused and the round continues: the button goes back to live. */
  cancelCashing(cashout: string) {
    this.phase = 'running';
    this.showSideButtons(false);
    this.bigButton.setEnabled(true);
    this.bigButton.setLabel(t('button.whack'), `Cash out ${cashout}`);
  }

  /** Optimistic whack before the server answers. */
  showCashing(cashout: string) {
    this.phase = 'cashing';
    this.bigButton.setEnabled(false);
    this.bigButton.setLabel(t('button.whack'), `Cashing out ${cashout}…`);
    this.swingHammer(false);
  }

  /**
   * A cashed-out round. `kind` decides the presentation: only a return above the stake may be
   * celebrated (UKGC RTS 14F, AGCO 2.20). At or below the stake the screen is neutral and states
   * what came back and what it cost.
   */
  showWin(multiplier: string, payout: string, big: boolean, kind: ResultKind = 'win', net = '') {
    this.phase = 'won';
    this.showSideButtons(true);
    this.resetStageFx();
    const celebrate = kind === 'win';
    this.stage.setMood(celebrate ? 'lime' : 'sun');
    this.mult.visible = this.winNow.visible = this.meter.visible = false;
    // On a win the mole keeps its running face until the hammer actually lands; see the contact
    // callback below. Every other result has no swing, so it changes straight away.
    if (!celebrate) {
      this.mainHole.setFrame(this.frames, 'mole-gold-dizzy');
      this.mainHole.riseTo(50, 0.3, 'power2.out');
    }
    this.resultTitle.text = t('result.cashedOut');
    this.resultMult.text = multiplier;
    // Net, not the gross return: "+4.20" only when the player is actually up.
    this.resultPayout.text = celebrate
      ? t('result.net', { amount: net })
      : kind === 'even'
        ? t('result.returnedEven', { amount: payout })
        : t('result.returnedBelow', { amount: payout, net });
    this.layoutResultCard();
    // The card covers the mole, so on a win it waits for the blow to land instead of hiding it.
    this.resultCard.visible = true;
    this.resultCard.scale.set(0.3);
    gsap.to(this.resultCard.scale, { x: 1, y: 1, duration: 0.4, delay: celebrate ? 0.22 : 0, ease: 'back.out(2.2)' });
    // Everything the blow causes waits for the blow. The mole used to be dizzy, and the confetti already
    // flying, before the hammer had finished its downstroke — the effect arriving ahead of its cause.
    if (celebrate) {
      this.swingHammer(true, () => {
        this.mainHole.setFrame(this.frames, 'mole-gold-dizzy');
        this.mainHole.riseTo(50, 0.3, 'power2.out');
        // Confetti and the BONK sticker are part of the arcade look; the adult skin has neither.
        if (SKIN === 'adult') return;
        this.stars();
        const hole = this.holeRect();
        // Sits across the mole's shoulder like a ribbon, overlapping it, rather than floating in the
        // space beside the hole where it read as unrelated to the hit it is marking.
        const bonk = new Burst(this.frames('burst-sky'), Math.max(78, hole.w * 0.34), t('result.bonk'), 20);
        bonk.position.set(hole.x + hole.w * 0.28, hole.y + hole.h * 0.32);
        bonk.rotation = 0.34;
        this.fx.addChild(bonk);
        this.trackFx(pop(bonk, 1.3, 0.3));
        if (this.intensityEffects) {
          this.confetti.burst({ x: this.stage.size.width / 2, y: this.stage.size.height * 0.75, count: big ? 120 : 60, speed: big ? 1300 : 950 });
        }
      });
    }
    this.bigButton.setFill(celebrate ? COLORS.lime : COLORS.sky);
    this.bigButton.setIcon(this.frames('icon-replay-cream'));
    const replay = this.quickReplay ? { label: t('button.playAgain'), sub: t('button.playAgainSub') } : { label: t('button.continue'), sub: t('button.continueSub') };
    this.bigButton.setLabel(replay.label, replay.sub);
    this.setActionLabel({ ...replay, enabled: true });
    this.bigButton.setEnabled(true);
    this.relayout(false);
  }

  showCrash(multiplier: string, lost: string, instant: boolean) {
    this.phase = 'lost';
    this.showSideButtons(true);
    this.resetStageFx();
    this.stage.setMood('coral');
    this.winNow.visible = this.meter.visible = false;
    this.mult.visible = true;
    this.mult.text = multiplier;
    this.fitMult();
    const { width: w } = this.stage.size;
    const h = this.stageH;
    const hole = this.holeRect();
    if (instant) {
      this.mainHole.setFrame(this.frames, 'mole-gold-happy');
      this.mainHole.riseTo(RISE_HIDDEN, 0.1);
      this.bustBurst.visible = true;
      this.bustBurst.position.set(w / 2, hole.y + hole.h * 0.55);
      this.bustBurst.scale.set(0.2);
      gsap.to(this.bustBurst.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(3)' });
      this.escaped.set(t('result.instantBust'));
    } else {
      // The mole got away, so it looks pleased with itself rather than startled.
      this.mainHole.setFrame(this.frames, 'mole-gold-smug');
      this.mainHole.riseTo(222, 0.22, 'power3.in');
      this.escaped.set(t('result.escaped'));
      this.puffs(hole);
    }
    this.escaped.visible = true;
    this.escaped.position.set(w / 2, (this.layout === 'desktop' ? 230 : 140) + this.hudOffset);
    this.escaped.rotation = 0.05;
    pop(this.escaped, 1.2, 0.3);
    this.lostChip.set(lost);
    this.lostChip.visible = true;
    this.lostChip.position.set(w / 2, h - 44);
    if (this.intensityEffects) shake(this.root, 6, 0.25);
    this.bigButton.setFill(COLORS.pink);
    this.bigButton.setIcon(this.frames('icon-replay-cream'));
    this.bigButton.setLabel(t('button.betAgain'), t('button.playAgainSub'));
    this.bigButton.setEnabled(true);
    this.relayout(false);
  }

  toast(message: string) {
    const { width: w } = this.stage.size;
    const label = new StickerLabel(message.toUpperCase(), COLORS.ink, () => labelStyle(14, COLORS.cream), 16, 10, 0);
    label.position.set(w / 2, this.stage.size.height / 2);
    this.fx.addChild(label);
    label.scale.set(0.5);
    this.trackFx(gsap.timeline({ onComplete: () => label.destroy({ children: true }) }))
      .to(label.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(2)' })
      .to(label, { alpha: 0, duration: 0.3, delay: 2 });
  }

  setWonPayout(multiplier: string, payout: string) {
    this.resultMult.text = multiplier;
    this.resultPayout.text = `+${payout}`;
    this.layoutResultCard();
  }

  // ---------- internals ----------

  private update(dt: number) {
    this.tickCountdown();
    this.sessionStrip.tick();
    if (this.phase === 'betting' || this.phase === 'starting') {
      // Idle breathing so the holding screen is alive: the gold mole and the background moles bob.
      this.bob += dt;
      if (!prefersReducedMotion()) {
        if (!gsap.isTweening(this.mainHole)) this.mainHole.rise = 140 + Math.sin(this.bob * 1.6) * 5;
        this.decoys.forEach((d, i) => {
          if (d.visible && !gsap.isTweening(d)) d.rise = DECOY_PEEK + Math.sin(this.bob * 1.3 + i * 1.7) * 7;
        });
      }
      return;
    }
    if (this.phase === 'running') {
      this.bob += dt * (2 + this.level * 0.6);
      if (!prefersReducedMotion() && !gsap.isTweening(this.mainHole)) {
        this.mainHole.rise = RISE_FULL + (Math.sin(this.bob * 2) + 1) * 3;
      }
      // Decoys pop more often as the round speeds up.
      this.decoyTimer -= dt;
      if (this.decoyTimer <= 0) {
        // Fixed rate: the background moles must not speed up with the round, or they read as a cue.
        this.decoyTimer = 1.1 * (0.7 + Math.random() * 0.6);
        const visible = this.decoys.filter((d, i) => d.visible && i !== this.busyDecoy);
        const d = visible[Math.floor(Math.random() * visible.length)];
        if (d && !gsap.isTweening(d)) {
          const faces: MoleFrame[] = ['mole-decoy-happy', 'mole-decoy-shock'];
          d.setFrame(this.frames, faces[Math.floor(Math.random() * 2)]!);
          gsap.timeline()
            .to(d, { rise: 20 + Math.random() * 100, duration: 0.18, ease: 'back.out(2)' })
            .to(d, { rise: RISE_HIDDEN, duration: 0.2, ease: 'power2.in', delay: 0.3 + Math.random() * 0.5 });
        }
      }
    }
  }

  private applyViewport(width: number, height: number) {
    this.bgFill.clear().rect(0, 0, width, height).fill(COLORS.sun);
    this.bgDots.width = width;
    this.bgDots.height = height;
    const desktop = width / height > 1.15 && width >= 820;
    this.layout = desktop ? 'desktop' : 'portrait';
    const design = desktop ? DESKTOP : PORTRAIT;
    // Portrait fills the width rather than letterboxing to a fixed 390x844 frame. A phone's usable
    // height changes with the browser chrome, so a uniform fit-both scale shrank everything to match
    // the height and left wide empty margins down both sides. The design height follows the viewport
    // instead, clamped so the stage cannot collapse or stretch absurdly, and the layout absorbs it.
    const scale = desktop ? Math.min(width / design.w, height / design.h) : width / design.w;
    this.designH = desktop ? design.h : Math.min(1000, Math.max(680, Math.round(height / scale)));
    this.root.scale.set(scale);
    this.root.position.set((width - design.w * scale) / 2, (height - this.designH * scale) / 2);
    this.relayout(false);
  }

  /**
   * Pixi rasterises a `Text` once at the renderer resolution, and its ancestors then scale it. Desktop
   * scales the root to fit the window AND scales some containers again on top (the READY block is 1.6x),
   * so a label could end up stretched from a bitmap less than half the size it is drawn at, reading soft
   * next to the multiplier, which is a `BitmapText` baked large. Accumulate the real world scale down the
   * tree and re-rasterise each text at the size it is actually displayed. Capped so a large window
   * cannot ask for enormous glyph textures.
   */
  private sharpenText() {
    const walk = (node: Container, scale: number) => {
      const here = scale * Math.abs(node.scale.x || 1);
      if (node instanceof Text) {
        const target = Math.min(4, Math.max(1, here));
        if (node.resolution !== target) node.resolution = target;
      }
      for (const child of node.children) walk(child as Container, here);
    };
    walk(this.root, this.game.app.renderer.resolution);
  }

  /** Positions everything for the current layout and phase. */
  private relayout(animate: boolean) {
    const desktop = this.layout === 'desktop';
    const betting = this.phase === 'betting' || this.phase === 'starting';
    this.logo.visible = this.balance.visible = !desktop;
    this.logoBig.visible = this.balanceBig.visible = desktop;
    this.panel.visible = desktop;

    if (desktop) {
      this.logoBig.position.set(24, 36);
      this.history.position.set(this.logoBig.x + this.logoBig.width + 30, 45);
      this.panel.position.set(24, 108);
      drawSticker(this.panel, 380, 768, { fill: COLORS.cream, radius: 28, border: 5, shadow: 7 });
      this.stage.position.set(428, 108);
      this.setStageSize(988, 768, false);
      const x = 46;
      const w = 336;
      this.lockedLabel.position.set(x, 130);
      this.lockedLabel.alpha = 0.6;
      this.placeBetControls(x, 160, w, true);
      this.statBet.visible = this.statAuto.visible = true;
      this.statBet.resize((w - 8) / 2, 44);
      this.statAuto.resize((w - 8) / 2, 44);
      this.statBet.position.set(x, 676);
      this.statAuto.position.set(x + (w - 8) / 2 + 8, 676);
      this.bigButton.resize(w, 116);
      this.bigButton.position.set(x, 738);
      const showPracticeDesktop = this.practiceRounds && (this.phase === 'won' || this.phase === 'lost');
      this.practiceButton.visible = showPracticeDesktop;
      if (showPracticeDesktop) {
        const gap = 8;
        const mainW = Math.round((w - gap) * 0.62);
        this.bigButton.resize(mainW, 116);
        this.practiceButton.resize(w - gap - mainW, 116);
        this.practiceButton.position.set(x + mainW + gap, 738);
      }
    } else {
      const H = this.designH;
      const top = 122;
      this.logo.position.set(PAD, 22);
      this.history.position.set(PAD, 78);
      this.history.resize(CONTENT);
      this.layoutSessionStrip();
      this.stage.position.set(PAD, top);
      this.lockedLabel.visible = false;
      // The bottom block is anchored to the viewport's bottom and the stage takes whatever is left,
      // so a short phone loses stage height instead of shrinking the whole layout.
      if (betting) {
        const btnY = H - 100;
        const controlsY = btnY - 186;
        this.setStageSize(CONTENT, Math.max(280, controlsY - 12 - top), animate);
        this.placeBetControls(PAD, controlsY, CONTENT, true);
        this.statBet.visible = this.statAuto.visible = false;
        this.bigButton.resize(CONTENT, 80);
        this.bigButton.position.set(PAD, btnY);
      } else {
        const btnY = H - 112;
        const statY = btnY - 58;
        // Offered only on a settled result, and only where the market allows it. It shares the row with
        // the primary action but stays subordinate: narrower, cream rather than lime, no icon, smaller
        // label. Sharing the row costs no stage height, so the composition is unchanged without it.
        const showPractice = this.practiceRounds && (this.phase === 'won' || this.phase === 'lost');
        this.practiceButton.visible = showPractice;
        this.setStageSize(CONTENT, Math.max(240, statY - 10 - top), animate);
        this.placeBetControls(PAD, statY, CONTENT, false);
        this.statBet.visible = this.statAuto.visible = true;
        const half = (CONTENT - 10) / 2;
        this.statBet.resize(half, 44);
        this.statAuto.resize(half, 44);
        this.statBet.position.set(PAD, statY);
        this.statAuto.position.set(PAD + half + 10, statY);
        const gap = 8;
        const mainW = showPractice ? Math.round((CONTENT - gap) * 0.62) : CONTENT;
        this.bigButton.resize(mainW, 96);
        this.bigButton.position.set(PAD, btnY);
        if (showPractice) {
          this.practiceButton.resize(CONTENT - gap - mainW, 96);
          this.practiceButton.position.set(PAD + mainW + gap, btnY);
        }
      }
    }
    this.relayoutHeader();
    // Last: every container scale is now final, so text rasterises at its true on-screen size.
    this.sharpenText();
  }

  private relayoutHeader() {
    if (this.layout === 'desktop') {
      this.balanceBig.position.set(1416, 30);
      const right = 1416 - this.balanceBig.width - 24;
      this.history.resize(Math.max(100, right - this.history.x));
      this.layoutSessionStrip();
    } else {
      this.balance.position.set(PORTRAIT.w - PAD - 6, 19);
    }
  }

  private placeBetControls(x: number, y: number, w: number, visible: boolean) {
    const controls = [this.minus, this.plus, this.amountBox, this.autoRow, ...this.chips];
    controls.forEach((c) => (c.visible = visible));
    if (!visible) return;
    this.minus.position.set(x, y);
    this.plus.position.set(x + w - 56, y);
    this.amountBox.position.set(x + 66, y);
    drawSticker(this.amountBg, w - 132, 56, { fill: this.layout === 'desktop' ? COLORS.white : COLORS.cream, radius: 16, border: 4, shadow: 5 });
    this.layoutAmount();
    const chipW = (w - 8 * 4) / 5;
    this.chips.forEach((chip, i) => {
      chip.position.set(x + i * (chipW + 8), y + 68);
      chip.resize(chipW);
    });
    this.autoRow.position.set(x, y + 124);
    drawSticker(this.autoBg, w, 54, { fill: this.layout === 'desktop' ? COLORS.white : COLORS.cream, radius: 16, border: 4, shadow: 5 });
    this.autoRow.hitArea = new Rectangle(0, 0, w, 58);
    this.autoLabel.position.set(74, 27);
    this.autoField.position.set(w - 96, 8);
  }

  private layoutAmount() {
    const w = (this.layout === 'desktop' ? 336 : CONTENT) - 132;
    const total = this.amountText.width + 8 + this.amountUnit.width;
    this.amountText.position.set((w - total) / 2 + this.amountText.width, 28);
    this.amountUnit.position.set(this.amountText.x + 8, 29);
  }

  private drawAuto(on: boolean, value: string) {
    this.autoToggle.clear()
      .roundRect(12, 11, 52, 32, 16).fill(on ? COLORS.lime : COLORS.muted).stroke({ width: 3.5, color: COLORS.ink })
      .circle(on ? 48 : 28, 27, 10).fill(COLORS.cream).stroke({ width: 3, color: COLORS.ink });
    this.autoValue.text = value;
    this.autoValue.alpha = on ? 1 : 0.4;
    this.autoFieldBg.clear().roundRect(0, 0, 86, 38, 10).fill(COLORS.white).stroke({ width: 3, color: COLORS.ink });
    this.autoValue.position.set(43, 19);
  }

  private setStageSize(w: number, h: number, animate: boolean) {
    if (animate && this.stageH !== h) {
      const state = { h: this.stageH };
      gsap.to(state, { h, duration: 0.35, ease: 'power2.inOut', onUpdate: () => this.applyStageSize(w, state.h) });
    } else {
      this.applyStageSize(w, h);
    }
    this.stageH = h;
  }

  private applyStageSize(w: number, h: number) {
    this.stage.resize(w, h);
    const desktop = this.layout === 'desktop';
    const betting = this.phase === 'betting' || this.phase === 'starting';
    // Portrait stage height now varies with the phone, so the whole composition scales with it against
    // the 424 reference. Without this a short screen keeps full-size moles in a short box and the
    // background holes collide with the main one.
    const k = desktop ? 1 : Math.min(1, h / 424);
    const s = (desktop ? 1.35 : betting ? 0.8 : 1) * k;
    const holeW = 280 * s;
    const holeH = 320 * s;
    const pad = (desktop ? 86 : betting ? 22 : 52) * k;
    this.mainHole.scale.set(s);
    this.mainHole.position.set(w / 2 - holeW / 2, h - holeH - pad);

    const decoySpots = desktop
      ? [[50, 210, 0.6], [w - 218, 230, 0.6], [120, 470, 0.55], [w - 268, 480, 0.55]]
      : // A decoy hole is 280*0.4*k wide. Keep both fully inside the stage: hanging them off the edge
        // reads as a rendering fault now that the stage runs the full width of the screen.
        [[8, 150 * k, 0.4 * k], [w - 112 * k - 8, (betting ? 170 : 176) * k, 0.4 * k]];
    this.decoys.forEach((d, i) => {
      const spot = decoySpots[i];
      // The right decoy hole makes way while the bad mole is up.
      d.visible = !!spot;
      if (spot) {
        d.position.set(spot[0]!, spot[1]!);
        d.scale.set(spot[2]!);
      }
    });

    this.fitMult();
    this.mult.position.set(w / 2, (desktop ? 30 : this.oldMult.visible ? 52 : 20) + this.hudOffset);
    this.layoutWinNow();
    this.ready.position.set(w / 2, (desktop ? 60 : 26) + this.hudOffset);
    this.ready.scale.set(desktop ? 1.6 : 1);
    this.meter.resize(desktop ? 480 : CONTENT - 32);
    this.meter.position.set(w / 2 - (desktop ? 240 : 163), h - (desktop ? 66 : 54));
    this.demo.position.set(46, 26);
    this.soundBtn.position.set(w - 56, 12);
    this.shieldBtn.position.set(w - 56, 64);
    this.helpBtn.position.set(w - 56, 116);
    this.layoutResultCard();
    this.layoutStrike();
    this.layoutSessionStrip();
  }

  /**
   * Bad mole sits behind and beside the main mole, centred in the free space on whichever side it
   * came from. Its mole body spans about x 60..225 in hole space (centre 140) and stays on screen.
   */
  /**
   * All three side buttons are hidden during a round, so nothing sits over the multiplier. The rules
   * stay reachable before every bet, which is where the information requirement bites (GLI-19 §4.4.1,
   * UK RTS 3/4, BR Portaria 1.207 art. 11, KE reg 45): a round lasts seconds and cannot be altered
   * once it starts, so there is no decision left for the rules to inform.
   */
  private showSideButtons(show: boolean) {
    this.soundBtn.visible = show;
    this.shieldBtn.visible = show;
    this.helpBtn.visible = show;
    this.helpBtn.position.set(this.stage.size.width - 56, 116);
  }

  /** Keeps the multiplier inside the stage: long values (x1,234.56) shrink instead of running off. */
  private fitMult() {
    const { width: w } = this.stage.size;
    const desktop = this.layout === 'desktop';
    const base = desktop ? 150 : 92;
    // Room for the side buttons when they are up, otherwise just a margin on each side.
    const gutter = this.soundBtn.visible ? (desktop ? 180 : 120) : 56;
    const max = w - gutter;
    this.mult.style.fontSize = base;
    if (this.mult.width > max) this.mult.style.fontSize = Math.max(28, Math.floor((base * max) / this.mult.width));
  }

  /** The pill hangs just under the multiplier, whose height changes with the number of digits. */
  private layoutWinNow() {
    const { width: w } = this.stage.size;
    this.winNow.position.set(w / 2, this.mult.y + this.mult.height + (this.layout === 'desktop' ? 26 : 20));
  }

  private layoutStrike() {
    const { width: w } = this.stage.size;
    const desktop = this.layout === 'desktop';
    this.oldMult.style.fontSize = desktop ? 44 : 30;
    this.oldMult.position.set(w / 2, (desktop ? 4 : 14) + this.hudOffset);
    this.mult.position.y = (desktop ? 30 : this.oldMult.visible ? 52 : 20) + this.hudOffset;
    const bw = this.oldMult.width + 12;
    const y = this.oldMult.y + this.oldMult.height * 0.55;
    this.strike.clear().roundRect(w / 2 - bw / 2, y - 3, bw, 6, 3).fill(COLORS.red);
    // The multiplier shifts down while the struck-through value is shown, so the pill follows it.
    this.layoutWinNow();
  }

  private layoutResultCard() {
    const { width: w } = this.stage.size;
    const desktop = this.layout === 'desktop';
    // The card must never outgrow the stage. A neutral result line ("RETURNED 4.87 · NET -5.13") is far
    // wider than a "+4.20" win, so both texts shrink to fit instead of pushing the card off screen and
    // under the side buttons. Same rule as fitMult() for the running multiplier.
    const maxCard = w - (desktop ? 120 : 28);
    const maxText = maxCard - 60;
    const fit = (node: { style: { fontSize: number }; width: number }, base: number, min: number) => {
      node.style.fontSize = base;
      if (node.width > maxText) node.style.fontSize = Math.max(min, Math.floor((base * maxText) / node.width));
    };
    this.resultPayout.style = bodyStyle(desktop ? 36 : 28);
    fit(this.resultMult, desktop ? 110 : 72, 30);
    fit(this.resultPayout, desktop ? 36 : 28, 14);
    const cw = Math.min(Math.max(this.resultMult.width, this.resultPayout.width) + 60, maxCard);
    const ch = 22 + this.resultTitle.height + this.resultMult.height + this.resultPayout.height + 12;
    drawSticker(this.resultCardBg, cw, ch, { fill: COLORS.cream, radius: 24, border: 5, shadow: 7 });
    this.resultCardBg.position.set(-cw / 2, 0);
    this.resultTitle.position.set(0, 14);
    this.resultMult.position.set(0, 14 + this.resultTitle.height + 4);
    this.resultPayout.position.set(0, this.resultMult.y + this.resultMult.height + 2);
    this.resultCard.position.set(w / 2, (desktop ? 40 : 24) + this.hudOffset);
    this.resultCard.rotation = -0.05;
  }

  /** Main hole rect at the stage's target size (the stage may still be animating). */
  private holeRect() {
    const s = this.mainHole.scale.x;
    const desktop = this.layout === 'desktop';
    const betting = this.phase === 'betting' || this.phase === 'starting';
    const pad = desktop ? 86 : betting ? 22 : 52;
    const w = this.stage.size.width;
    return { x: w / 2 - 140 * s, y: this.stageH - 320 * s - pad, w: 280 * s, h: 320 * s };
  }

  private trackFx<T extends gsap.core.Animation>(animation: T): T {
    this.fxTweens.push(animation);
    return animation;
  }

  private resetStageFx() {
    // Every round end (win, crash or back to betting) drops the rays to their idle drift.
    this.stage.idleSpin();
    this.fxTweens.forEach((t) => t.kill());
    this.fxTweens = [];
    this.fx.removeChildren().forEach((c) => {
      gsap.killTweensOf([c, c.scale, c.position]);
      c.destroy({ children: true });
    });
    this.resultCard.visible = false;
    this.escaped.visible = this.lostChip.visible = this.bustBurst.visible = false;
    this.oldMult.visible = this.strike.visible = false;
    this.stage.setMood('sun');
  }

  private flyCoins(bad: Hole | null) {
    const hole = this.holeRect();
    const from = { x: hole.x + hole.w * 0.5, y: hole.y + hole.h * 0.3 };
    const target = bad ?? this.mainHole;
    const to = { x: target.x + 140 * target.scale.x, y: target.y + 120 * target.scale.y };
    for (let i = 0; i < 6; i++) {
      const coin = new Sprite(this.frames('coin'));
      coin.anchor.set(0.5);
      coin.scale.set(0.55 + Math.random() * 0.2);
      coin.position.set(from.x + (Math.random() - 0.5) * 40, from.y + (Math.random() - 0.5) * 30);
      this.fx.addChild(coin);
      const midY = Math.min(from.y, to.y) - 60 - Math.random() * 60;
      this.trackFx(gsap.timeline({ delay: i * 0.05, onComplete: () => coin.destroy() }))
        .to(coin, { x: (from.x + to.x) / 2, y: midY, duration: 0.22, ease: 'power1.out' })
        .to(coin, { x: to.x, y: to.y, duration: 0.22, ease: 'power1.in' })
        .to(coin, { alpha: 0, duration: 0.1 });
    }
  }

  /**
   * `impact` lands the blow on the mole and shakes the screen. The bare swing is feedback for the
   * player's own action, which is honest at any outcome; the contact and the shake are emphasis, so
   * they wait until the server has answered and only play on a return above the stake (UK RTS 14F,
   * AGCO 2.20). A swing that connects before the result is known would also land on a cash-out the
   * server goes on to refuse.
   */
  private swingHammer(impact = false, onContact?: () => void) {
    const hole = this.holeRect();
    // Swung from off the top-right of the stage, not conjured beside the mole. The old version pivoted
    // about a point in mid-air with nothing holding it, appeared already in frame and vanished in place,
    // so it read as a floating mallet. The grip now sits outside the stage, the handle reaches in, and
    // the swing both enters and leaves through the same arc.
    const grip = { x: hole.x + hole.w * 1.18, y: hole.y - hole.h * 0.55 };
    const contact = { x: hole.x + hole.w * 0.5, y: hole.y + hole.h * 0.28 };
    const dx = contact.x - grip.x;
    const dy = contact.y - grip.y;
    const reach = Math.hypot(dx, dy);
    // Angle that points the handle (local +y) straight at the mole.
    const down = Math.atan2(-dx, dy);
    const headH = Math.max(34, hole.w * 0.16);
    const headW = headH * 1.9;
    const grap = Math.max(10, hole.w * 0.05);

    const hammer = new Graphics()
      .roundRect(-grap / 2, 0, grap, reach, grap / 2).fill(0xc98a55).stroke({ width: 4, color: COLORS.ink })
      .roundRect(-headW / 2, reach - headH * 0.5, headW, headH, headH * 0.28).fill(COLORS.pink).stroke({ width: 5, color: COLORS.ink })
      .roundRect(-headW / 2, reach - headH * 0.5, headW * 0.22, headH, headH * 0.2).fill(COLORS.cream).stroke({ width: 4, color: COLORS.ink });
    hammer.position.set(grip.x, grip.y);
    // Raised back over the shoulder, off the edge of the stage.
    const raised = down - 1.25;
    // A miss stops short of the mole: contact belongs to the settled result, not the optimistic swing.
    const lands = impact ? down : down - 0.16;
    hammer.rotation = raised;
    this.fx.addChild(hammer);
    const strike = () => {
      if (!impact) return;
      // The mole takes the hit: a short squash, and the shake, exactly when the head arrives.
      this.trackFx(pop(this.mainHole, 0.88, 0.16));
      if (this.intensityEffects) {
        this.shakesShown++;
        shake(this.root, 5, 0.18);
      }
      onContact?.();
    };
    this.trackFx(gsap.timeline({ onComplete: () => hammer.destroy() }))
      .to(hammer, { rotation: lands, duration: 0.11, ease: 'power3.in', onComplete: strike })
      .to(hammer, { rotation: lands - 0.18, duration: 0.1, ease: 'power2.out' })
      .to(hammer, { rotation: raised, duration: 0.24, delay: 0.12, ease: 'power2.inOut' });
  }

  private stars() {
    const hole = this.holeRect();
    const s = hole.w / 280;
    const centerX = hole.x + hole.w / 2;
    const topY = hole.y + (50 + 20) * s;
    ['star-gold', 'star-sky', 'star-pink'].forEach((f, i) => {
      const star = new Sprite(this.frames(f));
      star.anchor.set(0.5);
      star.scale.set(0.65 * s);
      this.fx.addChild(star);
      const state = { a: (i * Math.PI * 2) / 3 };
      this.fxTweens.push(gsap.to(state, {
        a: state.a + Math.PI * 4,
        duration: 2.4,
        repeat: -1,
        ease: 'none',
        onUpdate: () => {
          if (star.destroyed) return;
          star.position.set(centerX + Math.cos(state.a) * 70 * s, topY + Math.sin(state.a) * 18 * s);
        },
      }));
    });
  }

  private puffs(hole: { x: number; y: number; w: number; h: number }) {
    const s = hole.w / 280;
    const spots = [[120, 250, 26], [160, 232, 32], [206, 240, 28], [240, 258, 22], [96, 270, 18]];
    spots.forEach(([x, y, r], i) => {
      const puff = new Sprite(this.frames('puff'));
      puff.anchor.set(0.5);
      puff.position.set(hole.x + x! * s, hole.y + y! * s);
      puff.scale.set(0);
      this.fx.addChild(puff);
      const size = (r! * 2 * s) / 80;
      this.trackFx(gsap.to(puff.scale, { x: size, y: size, duration: 0.3, delay: 0.12 + i * 0.03, ease: 'back.out(2)' }));
    });
  }
}

let fontsInstalled = false;
function installFonts() {
  if (fontsInstalled) return;
  fontsInstalled = true;
  const chars = [['0', '9'], 'x.,-+%'] as (string | string[])[];
  const base = displayStyle(120, COLORS.cream, 7, 9);
  BitmapFont.install({ name: 'MultCream', style: { ...base, fontFamily: FONT_DISPLAY }, chars, resolution: 2, padding: 16 });
  BitmapFont.install({ name: 'MultPink', style: { ...displayStyle(120, COLORS.pink, 7, 8), fontFamily: FONT_DISPLAY }, chars, resolution: 2, padding: 16 });
}
