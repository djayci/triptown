import { Container, Graphics, type Application, type Text, type Texture } from 'pixi.js';
import type { ResultKind } from '@triptown/core';
import { gsap, prefersReducedMotion, type GameApp } from '@triptown/engine';
import { t } from '../i18n';
import { BalancePill, HistoryStrip, Logo, SessionStrip } from '../ui/hud';
import { IconButton, StatBox, StickerButton, bodyStyle, displayStyle, drawSticker, labelStyle, text } from '../ui/primitives';
import { COLORS, onStage, readableOn } from '../theme';
import { CrashViewBase, type ActionControl } from './view-base';
import type { BetUi, CrashView, CrashViewCallbacks, Frames, SessionHud } from './view-contract';

const W = 390;
const H = 844;
/** The stake row's top, and how far it drops to leave the screen while a round runs. */
const STAKE_ROW_Y = H - 168;
const STAKE_ROW_DROP = H + 20 - STAKE_ROW_Y;
const PAD = 12;
/** Stake row widths: [-] 44, stake, [+] 44, auto, with 6 px gaps inside and 8 before auto. */
const STAKE_W = 150;
const AUTO_W = W - PAD * 2 - (44 + 6 + STAKE_W + 6 + 44 + 8);
/** Without auto the stake box takes the whole row between the buttons. */
const STAKE_W_ALONE = W - PAD * 2 - (44 + 6 + 6 + 44);

type IconName = 'sound' | 'muted' | 'rules' | 'fairness' | 'history' | 'minus' | 'plus';

/** A named rectangle in the 390x844 frame, for the layout audit. */
export interface LayoutBox {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where the shared HUD sits in the 390x844 frame. The defaults are the Candy Arcade Pop layout; a game with
 * its own grid passes the numbers it designed to. It is given to the constructor, not read from a hook, so
 * the first layout already has it: a hook on a subclass field runs before that field exists.
 */
export interface ScreenLook {
  /** With w and h, the wordmark is a flat box of that size; otherwise the tilted sticker. */
  logo: { x: number; y: number; w?: number; h?: number };
  /** Right-anchored. `compact` is a single 32px line filling `width`. */
  balance: { x: number; y: number; width: number; compact: boolean };
  /** The history strip's top when no session strip shows; it drops 32 when one does. */
  history: { x: number; y: number };
  /** The DEMO badge's rectangle; `underHistory` puts it just below the history strip instead. */
  demo: { x: number; y: number; w: number; h: number; underHistory: boolean };
  /** The sound, fairness, rules and history controls: a column by default, or a row. */
  controls: { x: number; y: number; size: number; gap: number; horizontal: boolean };
  /** The value and the money: anchor 0.5 centres them on x, 1 right-aligns them to x. */
  value: { x: number; anchor: number; valueY: number; valueSize: number; payoutY: number; payoutSize: number; labelY: number; chanceY: number };
  /** The caption and chance lines: centred on x when the value is centred, right-aligned to value.x otherwise. */
  liveText: { x: number; width: number };
  resultCard: { x: number; y: number; w: number; h: number; titleY: number; lineY: number };
  /** True when the result card states the value itself, so the big value and the money are not also drawn. */
  hideValueOnResult: boolean;
  /** True when the betting screen is only an invitation to play, as on Whack Crash: no x1.00 until the round starts. */
  hideValueWhileBetting: boolean;
  /** Draw the action button's second line (what the press does, "Same bet"), not only read it out. */
  buttonSub: boolean;
  /** Slide the stake row away behind the action button while a round runs, and bring it back with the result. */
  hideStakeInRound: boolean;
  /** The empty band the lobby invitation is centred in: from the last HUD row above it to the scene below. */
  lobby: { top: number; bottom: number };
}

export const DEFAULT_LOOK: ScreenLook = {
  logo: { x: PAD, y: 14 },
  balance: { x: W - PAD, y: 14, width: Infinity, compact: false },
  history: { x: PAD, y: 64 },
  demo: { x: PAD, y: H - 208, w: 62, h: 24, underHistory: false },
  controls: { x: W - PAD - 40, y: 136, size: 40, gap: 10, horizontal: false },
  value: { x: W / 2, anchor: 0.5, valueY: 150, valueSize: 88, payoutY: 246, payoutSize: 34, labelY: 294, chanceY: 318 },
  liveText: { x: W / 2, width: 2 * (W - PAD - 40 - 8 - W / 2) },
  resultCard: { x: 28, y: 360, w: 334, h: 118, titleY: 20, lineY: 70 },
  hideValueOnResult: false,
  hideValueWhileBetting: false,
  buttonSub: false,
  hideStakeInRound: false,
  lobby: { top: 150, bottom: 340 },
};

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
  /** Optional line under the verb saying what the press does, for a game whose verb alone would not. */
  collectSub?: string;
  /** Label under the live payout while a round runs. */
  liveLabel: string;
  /** Subtitle on the betting screen. */
  readySub: string;
  /** Optional title in the value's place on the betting screen, for a look that hides the value there (e.g. READY?). */
  readyTitle?: string;
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
  private readonly balance: BalancePill;
  protected readonly look: ScreenLook;
  private readonly renderer: Application['renderer'];
  /** How far the value's texture was shifted to centre its ink (lobby title); the audit box is the ink. */
  private multInkShift = 0;
  private readonly session = new SessionStrip();
  readonly history = new HistoryStrip(W - PAD * 2);

  private readonly mult = text('x1.00', displayStyle(88, COLORS.sun, 6, 7), [0.5, 0]);
  /**
   * A layer for a game's own effects around the multiplier (milestone badges, flying numbers). It sits above
   * the live values and below the result card, the stake row and the button, so no effect can hide those.
   */
  protected readonly effects = new Container();
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
  private controlsHidden = false;
  private audioAvailable = true;
  private readonly minusBtn: IconButton;
  private readonly plusBtn: IconButton;
  private stakeRowHidden = false;
  /** True while the row is sliding, so a layout in between leaves its y to the slide. */
  private stakeRowSliding = false;
  /** The last stake row state, and the stake the running round was placed at, for the result button. */
  private lastBetUi: BetUi | null = null;
  private roundStake: string | null = null;
  private readonly bigButton: StickerButton;

  private multiplier = 1;
  private withholding = false;

  protected constructor(
    game: GameApp,
    handlers: CrashViewCallbacks,
    private readonly words: ScreenWords,
    stage: GameStage,
    look: Partial<ScreenLook> = {},
  ) {
    super(handlers);
    const { app } = game;
    this.stage = stage;
    this.look = { ...DEFAULT_LOOK, ...look };
    this.renderer = app.renderer;
    this.balance = new BalancePill(false, this.look.balance.compact);
    const logoBox = this.look.logo.w && this.look.logo.h ? { w: this.look.logo.w, h: this.look.logo.h } : undefined;
    this.logo = new Logo(words.logo[0], words.logo[1], logoBox ? 16 : 22, logoBox);

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
      ...(this.look.buttonSub ? { sub: '' } : {}),
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
      this.effects,
      this.counter,
      this.demoBadge,
      this.resultCard,
      ...this.controls,
      this.bigButton,
      // The stake row is drawn over the button: it slides down past it and off the screen during a round.
      this.statBet,
      this.minusBtn,
      this.plusBtn,
      this.statAuto,
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
   * The action button's fill in each state: ready to bet, running (collect), and a celebrated result. A game
   * whose language has one action colour returns it for all three. The celebrate decision itself stays in
   * the base: this only says what colour it is drawn in.
   */
  protected actionColors(): { ready: number; running: number; celebrate: number } {
    return { ready: COLORS.sky, running: COLORS.lime, celebrate: COLORS.lime };
  }

  get offersAutoCashout(): boolean {
    return this.hasAutoCashout();
  }

  /**
   * How far a rendered text's ink centre sits from its texture centre, in px. Centring the texture is not
   * centring what the player sees: a trailing "?" leaves more room on its right, and the text renderer's
   * padding is not always even. Read from the pixels actually drawn, so it is right for any face.
   */
  private inkCentreOffset(txt: Text): number {
    try {
      const { pixels, width, height } = this.renderer.extract.pixels({ target: txt, resolution: 1 });
      let first = -1;
      let last = -1;
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          if (pixels[(y * width + x) * 4 + 3]! > 40) {
            if (first < 0) first = x;
            last = x;
            break;
          }
        }
      }
      if (first < 0) return 0;
      return ((first + last + 1) / 2 - width / 2) / txt.scale.x;
    } catch {
      return 0;
    }
  }

  /** Boxes a game draws on top of the shared HUD, for the layout audit. */
  protected extraBoxes(): LayoutBox[] {
    return [];
  }

  /**
   * Every visible HUD element as a rectangle in the 390x844 frame. Demo builds expose it so the layout
   * audit can check the running game the way it checks the design boards: no two boxes may intersect.
   */
  layoutBoxes(): LayoutBox[] {
    const out: LayoutBox[] = [];
    const add = (name: string, obj: Container, when = true) => {
      if (!when || !obj.visible || obj.alpha === 0) return;
      const gb = obj.getBounds();
      const tl = this.root.toLocal({ x: gb.x, y: gb.y });
      let box = { name, x: tl.x, y: tl.y, w: gb.width / this.root.scale.x, h: gb.height / this.root.scale.y };
      // A Text's bounds include its texture padding (room for the stroke and shadow); the ink is inside it.
      const pad = 'style' in obj && typeof (obj as { style?: { padding?: number } }).style?.padding === 'number' ? (obj as { style: { padding: number } }).style.padding : 0;
      if (pad) box = { ...box, x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad };
      if (box.w <= 0 || box.h <= 0) return;
      out.push(box);
    };
    add('logo', this.logo);
    add('balance', this.balance);
    add('session', this.session);
    add('history', this.history, this.history.children.length > 0);
    add('demo', this.demoBadge);
    this.controls.forEach((c, i) => add(`control-${i}`, c));
    add('value', this.mult, this.mult.text !== '');
    const value = out.find((b) => b.name === 'value');
    // The texture was moved by -shift to centre the ink, so the ink sits +shift from the texture's box.
    if (value) value.x += this.multInkShift;
    add('payout', this.payout, this.payout.text !== '');
    add('payout-label', this.payoutLabel, this.payoutLabel.text !== '');
    add('chance-line', this.revealChance, this.revealChance.text !== '');
    add('result', this.resultCard);
    add('stake', this.statBet);
    add('minus', this.minusBtn);
    add('plus', this.plusBtn);
    add('auto', this.statAuto);
    add('action', this.bigButton);
    return [...out, ...this.extraBoxes()];
  }

  private layout(): void {
    const { look } = this;
    this.logo.position.set(look.logo.x, look.logo.y);
    this.balance.position.set(look.balance.x, look.balance.y);
    this.session.position.set(PAD, 64);
    this.placeHistory();
    const live = look.liveText;
    const value = look.value;
    const metrics = look.value;
    this.mult.style.fontSize = metrics.valueSize;
    this.payout.style.fontSize = metrics.payoutSize;
    this.mult.anchor.set(value.anchor, 0);
    // Placed by the ink, not the texture: the texture has padding for the stroke and shadow around it, so
    // a right-anchored text's ink sits a padding short of the anchor unless it is pushed back out.
    const pad = (txt: Text) => txt.style.padding ?? 0;
    const inkY = (txt: Text, y: number) => y - pad(txt);
    const inkX = (txt: Text, x: number) => (value.anchor === 1 ? x + pad(txt) : x);
    this.mult.position.set(inkX(this.mult, value.x), inkY(this.mult, metrics.valueY));
    this.payout.anchor.set(value.anchor, 0);
    this.payout.position.set(inkX(this.payout, value.x), inkY(this.payout, metrics.payoutY));
    this.payoutLabel.position.set(value.anchor === 1 ? inkX(this.payoutLabel, value.x) : live.x, inkY(this.payoutLabel, metrics.labelY));
    // Centred, so it wraps inside the control column on both sides rather than running under the icons.
    for (const line of [this.payoutLabel, this.revealChance]) {
      line.anchor.set(value.anchor, 0);
      Object.assign(line.style, { wordWrap: true, wordWrapWidth: live.width, align: value.anchor === 1 ? 'right' : 'center' });
    }
    this.revealChance.position.set(value.anchor === 1 ? inkX(this.revealChance, value.x) : live.x, inkY(this.revealChance, metrics.chanceY));

    // Above the stake row rather than beside the wordmark: a longer two-word logo collided with it
    // there, and this spot is free on every screen of every game regardless of name length.
    this.demoBg.clear();
    drawSticker(this.demoBg, look.demo.w, look.demo.h, { fill: COLORS.pink, radius: 8, border: 3, shadow: 3 });
    this.demoBg.position.set(-look.demo.w / 2, -look.demo.h / 2);
    if (!look.demo.underHistory) this.demoBadge.position.set(look.demo.x + look.demo.w / 2, look.demo.y + look.demo.h / 2);

    this.counter.position.set(W / 2 - 46, 312);
    this.counterBg.clear();
    drawSticker(this.counterBg, 92, 28, { fill: COLORS.cream, radius: 8, border: 3, shadow: 3 });
    // Both sit inside the 92x28 sticker: caption left, value right-aligned against the inner edge.
    // The caption used to be added at the container origin and never positioned, so its first letter
    // fell outside the box.
    this.counterCaption.position.set(11, 9);
    this.counterValue.position.set(81, 5);

    this.resultCard.position.set(look.resultCard.x, look.resultCard.y);
    this.resultTitle.position.set(look.resultCard.w / 2, look.resultCard.titleY);
    this.resultLine.position.set(look.resultCard.w / 2, look.resultCard.lineY);

    // Stake row: [-] stake [+] auto, or [-] stake [+] across the row when the game offers no auto. A row
    // on its way off or back on to the screen keeps the y its slide has reached (showRunning lays out
    // right after showStarting starts the slide).
    const rowY = this.stakeRowSliding ? this.minusBtn.y : STAKE_ROW_Y + (this.stakeRowHidden ? STAKE_ROW_DROP : 0);
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
    drawSticker(this.resultBg, this.look.resultCard.w, this.look.resultCard.h, { fill, radius: 16, border: 5, shadow: 6 });
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
    this.audioAvailable = available;
    this.applyControls();
  }

  /**
   * Whether the control column steps aside while a round runs, as Whack Crash does, leaving the stage to the
   * round. Rules, fairness and history stay reachable before every bet and on the result, which is what
   * GLI-19 4.4.1 and UK RTS 3 ask for; sound also has its own place in the operator's wrapper.
   */
  protected hideControlsInRound(): boolean {
    return false;
  }

  private applyControls(): void {
    for (const b of this.controls) b.visible = !this.controlsHidden && (b !== this.soundBtn || this.audioAvailable);
    this.placeControls();
  }

  /**
   * A look may take the stake row off the screen while the horse is out: it slides down past the action
   * button and off the bottom, fading, and slides back with the result so the next stake can be set there.
   * Stepping the stake is refused by the controller during a round anyway; this only clears the space.
   */
  private setStakeRowHidden(hidden: boolean): void {
    if (!this.look.hideStakeInRound || hidden === this.stakeRowHidden) return;
    this.stakeRowHidden = hidden;
    // The auto box only exists for a game that offers auto cash-out; it must not reappear otherwise.
    const parts = [this.minusBtn, this.statBet, this.plusBtn, ...(this.hasAutoCashout() ? [this.statAuto] : [])];
    const y = STAKE_ROW_Y + (hidden ? STAKE_ROW_DROP : 0);
    gsap.killTweensOf(parts);
    this.stakeRowSliding = false;
    if (!hidden) for (const p of parts) p.visible = true;
    if (prefersReducedMotion()) {
      for (const p of parts) {
        p.y = y;
        p.alpha = 1;
        p.visible = !hidden;
      }
      return;
    }
    this.stakeRowSliding = true;
    gsap.to(parts, {
      y,
      alpha: hidden ? 0 : 1,
      duration: 0.45,
      ease: hidden ? 'power2.in' : 'power2.out',
      onComplete: () => {
        this.stakeRowSliding = false;
        if (hidden) for (const p of parts) p.visible = false;
      },
    });
  }

  private setControlsHidden(hidden: boolean): void {
    const next = hidden && this.hideControlsInRound();
    if (next === this.controlsHidden) return;
    this.controlsHidden = next;
    this.applyControls();
  }

  /** The history chips move up into the session strip's row when a market shows no clock or net. */
  private placeHistory(): void {
    const { look } = this;
    const historyY = this.session.visible ? look.history.y + 32 : look.history.y;
    this.history.position.set(look.history.x, historyY);
    // Chips are 30 px tall with a 3 px shadow; the badge sits a small gap below them.
    if (look.demo.underHistory) this.demoBadge.position.set(look.demo.x + look.demo.w / 2, historyY + 33 + 8 + look.demo.h / 2);
  }

  private placeControls(): void {
    const { x, y, size, gap, horizontal } = this.look.controls;
    this.controls.forEach((b) => b.resize(size));
    this.controls.filter((b) => b.visible).forEach((b, i) => {
      if (horizontal) b.position.set(x + i * (size + gap), y);
      else b.position.set(x, y + i * (size + gap));
    });
  }

  setMuted(muted: boolean): void {
    this.soundBtn.setTexture(muted ? this.icons.muted : this.icons.sound, muted ? 'Sound off' : 'Sound on');
  }

  setBalance(amount: string, currency: string): void {
    this.balance.set(amount, currency, this.look.balance.width);
  }

  setBetUi(ui: BetUi): void {
    this.lastBetUi = ui;
    this.statBet.set(t('label.stake'), ui.bet);
    this.statAuto.set(t('label.auto'), ui.autoOn ? ui.auto : '—');
    if (this.phase === 'won' || this.phase === 'lost') {
      // The stake can be changed on the result screen; the button says what the next tap will bet.
      this.setActionLabel(this.resultAction());
    } else if (this.phase !== 'betting') return;
    else this.setActionLabel({ label: ui.reason ?? t('button.bet', { amount: ui.bet }), sub: '', enabled: ui.canBet });
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
    this.setControlsHidden(false);
    this.setStakeRowHidden(false);
    this.revealChance.text = '';
    this.resultCard.visible = false;
    this.payout.text = '';
    this.payoutLabel.text = this.words.readySub;
    this.mult.text = 'x1.00';
    // As on Whack Crash, a look can make the lobby an invitation: READY? and one line, centred where the
    // value will be, and no value until the round starts. showRunning puts the value back in its column.
    const invite = this.look.hideValueWhileBetting && !!this.words.readyTitle;
    this.mult.visible = !this.look.hideValueWhileBetting || invite;
    if (invite) {
      this.mult.text = this.words.readyTitle!;
      this.mult.anchor.set(0.5, 0);
      this.multInkShift = this.inkCentreOffset(this.mult);
      this.mult.position.x = W / 2 - this.multInkShift;
      this.payoutLabel.anchor.set(0.5, 0);
      this.payoutLabel.style.align = 'center';
      this.payoutLabel.style.wordWrapWidth = W - PAD * 2;
      // The title and its line, as one block, centred in the lobby band by their drawn heights.
      const gap = 14;
      const titlePad = this.mult.style.padding ?? 0;
      const linePad = this.payoutLabel.style.padding ?? 0;
      const titleH = this.mult.height - 2 * titlePad;
      const lineH = this.payoutLabel.height - 2 * linePad;
      const { top, bottom } = this.look.lobby;
      const y0 = top + (bottom - top - (titleH + gap + lineH)) / 2;
      this.mult.position.y = y0 - titlePad;
      this.payoutLabel.position.set(W / 2, y0 + titleH + gap - linePad);
    }
    this.multiplier = 1;
    this.stage.setMultiplier(1);
    this.stage.reset();
    this.stage.setEffectsEnabled(this.intensityEffects);
    this.bigButton.setFill(this.actionColors().ready);
  }

  showStarting(): void {
    this.phase = 'starting';
    this.resultCard.visible = false;
    this.roundStake = this.lastBetUi?.bet ?? null;
    this.setControlsHidden(true);
    this.setStakeRowHidden(true);
    // A quick-replay profile goes straight from a settled round to the next one without passing
    // through the betting screen, so this is the only place every new round is guaranteed to reach.
    // Resetting the scene only in `showBetting` left the previous round's state — a crashed scene, a
    // finished animation — visible underneath the new round on every market with quick replay on.
    this.multiplier = 1;
    this.stage.setMultiplier(1);
    this.stage.reset();
    this.stage.setEffectsEnabled(this.intensityEffects);
  }

  showRunning(): void {
    this.phase = 'running';
    this.resultCard.visible = false;
    this.mult.visible = true;
    this.multInkShift = 0;
    // Back to the look's own places after the lobby's centred invitation.
    this.layout();
    this.bigButton.setFill(this.actionColors().running);
    const sub = this.words.collectSub ?? '';
    this.bigButton.setLabel(this.words.collect, sub);
    this.bigButton.setEnabled(true);
    this.setActionLabel({ label: this.words.collect, sub, enabled: true });
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
    this.setControlsHidden(false);
    this.setStakeRowHidden(false);
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
    // A card that states the settled line itself does not also draw the value and the money under it.
    this.payout.text = this.look.hideValueOnResult ? '' : line;
    this.mult.visible = !this.look.hideValueOnResult;
    this.payout.style.fill = celebrate ? COLORS.lime : COLORS.cream;
    this.payoutLabel.text = '';
    this.replay(celebrate);
  }

  showCrash(multiplier: string, loss: string, instant: boolean): void {
    this.phase = 'lost';
    this.setControlsHidden(false);
    this.setStakeRowHidden(false);
    this.mult.visible = !this.look.hideValueOnResult;
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

  /**
   * What the button offers on the result screen. With quick replay: the same stake again, or, once the
   * stake has been stepped there, the new amount, so the tap never bets a figure the button did not show.
   * Without it: back to the betting screen, one deliberate bet each round.
   */
  private resultAction(): { label: string; sub: string; enabled: boolean } {
    if (!this.quickReplay) return { label: t('button.continue'), sub: t('button.continueSub'), enabled: true };
    const ui = this.lastBetUi;
    if (ui?.reason) return { label: ui.reason, sub: '', enabled: false };
    const same = ui === null || ui.bet === this.roundStake;
    return { label: t('button.playAgain'), sub: same ? t('button.playAgainSub') : t('button.bet', { amount: ui.bet }), enabled: ui?.canBet ?? true };
  }

  private replay(celebrate: boolean): void {
    const next = this.resultAction();
    this.bigButton.setFill(celebrate ? this.actionColors().celebrate : this.actionColors().ready);
    this.bigButton.setLabel(next.label, next.sub);
    this.bigButton.setEnabled(next.enabled);
    this.setActionLabel(next);
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

  /** The multiplier text, for a game that animates it (a pop or a tier colour). Its text belongs to the screen. */
  protected get multiplierText(): Text {
    return this.mult;
  }

  checkpoint(_value: number, _label: string): void {}

  miniCheckpoint(_label: string): void {}

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
