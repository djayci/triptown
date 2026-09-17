import { COLORS, CrashScreen, displayStyle, drawSticker, text, type CrashViewCallbacks, type Frames, type GameStage } from '@triptown/crash-client';
import type { ResultKind, RevealMode } from '@triptown/core';
import { gsap, pop, prefersReducedMotion, type GameApp } from '@triptown/engine';
import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n/en';
import { GateStage, type StageSkin } from './stage';

/**
 * The horse game. The layout belongs to `CrashScreen` and every compliance behaviour to
 * `CrashViewBase`; this file supplies the scene, the words and a few scene cues.
 *
 * It presents one of two ways, chosen from the market (gate-odds-mvp D8):
 * - **Beat the Gate** (live reveal): the gate is on screen and slams at the crash.
 * - **Gate Rush** (deferred reveal): the horse leaves through the open gate and the gate drops out of view;
 *   IN! turns for home and the gate comes back open or shut only when the server has settled.
 *
 * The cues only tell the scene what already happened, and none of them looks at the result kind: the
 * base decides whether to celebrate.
 */
/**
 * Multiplier colour per milestone tier, and the colours the in-between numbers fly off in. Each colour keeps
 * at least 3:1 against its skin's stage (the yellow sunburst, or the charcoal one), the floor useSkin checks
 * for the multiplier, so a tier change never costs legibility.
 */
const TIERS: Record<StageSkin, { tiers: [number, number][]; minis: number[] }> = {
  candy: {
    tiers: [
      [1.5, 0x1971c2],
      [3, 0xd6246e],
      [5, 0xc92a2a],
      // Not ink: the multiplier has an ink outline, and ink on ink fills the digits in.
      [10, 0x0b7285],
      [25, 0x7048e8],
    ],
    minis: [0x1971c2, 0xd6246e, 0xc92a2a, 0x0b7285, 0x6d28d9],
  },
  adult: {
    tiers: [
      [1.5, 0xd4a85a],
      [3, 0x7cc4b2],
      [5, 0xe8907a],
      [10, 0xf0c96b],
      [25, 0x8ec5e0],
    ],
    minis: [0xd4a85a, 0x7cc4b2, 0xe8907a, 0xf0c96b],
  },
};

/** The design frame's width: effects are placed in its coordinates. */
const FRAME_W = 390;

export class GateView extends CrashScreen {
  private readonly gate: GateStage;
  private roundReveal: RevealMode;
  private readonly palette: (typeof TIERS)[StageSkin];
  /** The multiplier's colour before any milestone, restored for every new round. */
  private readonly baseFill: number;

  constructor(game: GameApp, frames: Frames, handlers: CrashViewCallbacks, presentation: RevealMode = 'live', skin: StageSkin = 'candy') {
    const gate = new GateStage(game.app, frames, skin);
    const rush = presentation === 'onCollect';
    super(
      game,
      handlers,
      {
        logo: rush ? [t('logo.gate'), t('logo.rush')] : [t('logo.beatThe'), t('logo.gate')],
        collect: t('button.collect'),
        liveLabel: rush ? t('run.ifOpen') : t('run.winNow', { amount: '' }),
        readySub: rush ? t('stage.readySubRush') : t('stage.readySub'),
        settledTitle: rush ? t('result.gateOpen') : t('result.cashedOut'),
        crashedTitle: t('result.crashed'),
      },
      gate as unknown as GameStage,
    );
    this.gate = gate;
    this.roundReveal = presentation;
    gate.setRevealMode(presentation);
    this.palette = TIERS[skin];
    this.baseFill = COLORS.sun;
  }

  /** No themed counter: the multiplier and the money are the only numbers on screen. */
  protected counterFor(): string | null {
    return null;
  }

  /** DEMO at the top, under the history, clear of the gate and the stake row. */
  protected override demoBadgeUnderHistory(): boolean {
    return true;
  }

  /** The card sits above the field, so the gate opening or staying shut is seen, not covered. */
  protected override resultCardTop(): number {
    return 262;
  }

  /** No auto cash-out: IN! is the only way a ride ends before the automatic reveal. */
  protected override hasAutoCashout(): boolean {
    return false;
  }

  /** The server says how this round reveals; the scene follows it for the round. */
  setRevealMode(mode: RevealMode): void {
    if (mode !== this.roundReveal) {
      this.roundReveal = mode;
      this.gate.setRevealMode(mode);
    }
  }

  override showBetting(): void {
    super.showBetting();
    this.multiplierText.style.fill = this.baseFill;
    this.effects.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  override showRunning(): void {
    super.showRunning();
    this.multiplierText.style.fill = this.baseFill;
    this.gate.rideOut();
  }

  /**
   * A milestone (x1.5, x2, x3, x5, x10 ...), as on Whack Crash: the multiplier changes to the tier's colour
   * and keeps it, pops, a sticker with the value flies off beside it, and the horse kicks up dust. It is
   * driven by the multiplier on screen and nothing else, so it plays the same whether or not the round has
   * already been decided. It says the value, never "win": in Gate Rush the value is paid only if the gate
   * is open, and the chance line beside it stays on screen.
   */
  override checkpoint(value: number, label: string): void {
    const mult = this.multiplierText;
    let fill = this.baseFill;
    for (const [from, colour] of this.palette.tiers) if (value >= from) fill = colour;
    mult.style.fill = fill;
    pop(mult, 1.2, 0.24);
    this.gate.kick(value >= 10 ? 1.4 : 1);
    if (prefersReducedMotion()) return;

    const badge = new Container();
    const words = text(label, displayStyle(24, COLORS.cream, 4, 0), [0.5, 0.5]);
    const w = Math.max(64, words.width + 24);
    const bg = drawSticker(new Graphics(), w, 40, { fill, radius: 12, border: 4, shadow: 4 });
    bg.position.set(-w / 2, -20);
    badge.addChild(bg, words);
    // Above the multiplier's right half and left of the control column, so no button covers it.
    const controlsLeft = FRAME_W - 12 - 40 - 8;
    badge.position.set(Math.min(mult.x + mult.width * 0.28, controlsLeft - w / 2), mult.y - 2);
    badge.rotation = -0.12;
    badge.scale.set(0.2);
    this.effects.addChild(badge);
    gsap
      .timeline({ onComplete: () => badge.destroy({ children: true }) })
      .to(badge.scale, { x: 1, y: 1, duration: 0.16, ease: 'back.out(3)' })
      .to(badge, { y: badge.y - 30, alpha: 0, duration: 0.32, delay: 0.18, ease: 'power2.in' });
  }

  /** A small in-between step: its number flies off the multiplier in a bright colour, as on Whack Crash. */
  override miniCheckpoint(label: string): void {
    if (prefersReducedMotion()) return;
    const mult = this.multiplierText;
    const colour = this.palette.minis[Math.floor(Math.random() * this.palette.minis.length)]!;
    const chip = text(label, displayStyle(24, colour, 4, 0), [0.5, 0.5]);
    const dir = Math.random() < 0.5 ? -1 : 1;
    chip.position.set(mult.x + dir * mult.width * 0.3, mult.y + mult.height * 0.55);
    chip.scale.set(0.5);
    this.effects.addChild(chip);
    gsap
      .timeline({ onComplete: () => chip.destroy() })
      .to(chip.scale, { x: 1.1, y: 1.1, duration: 0.12, ease: 'back.out(3)' })
      .to(chip, { x: chip.x + dir * 70, y: chip.y - 56, rotation: dir * 0.35, alpha: 0, duration: 0.45, ease: 'power2.out' }, 0.05);
  }

  /** Gate Rush: IN! pressed, result unknown. The same turn for home whatever happens next. */
  override showHeadingHome(multiplier: string, payoutIfWon: string): void {
    super.showHeadingHome(multiplier, payoutIfWon);
    this.gate.headHome();
  }

  /** A refused IN! (below the minimum) puts the horse back out on the field. */
  override cancelCashing(payout: string): void {
    super.cancelCashing(payout);
    if (this.roundReveal === 'onCollect') this.gate.rideOut();
  }

  override showWin(multiplier: string, payout: string, big: boolean, kind: ResultKind, net: string): void {
    super.showWin(multiplier, payout, big, kind, net);
    if (this.roundReveal === 'onCollect') this.gate.revealOpen();
    else this.gate.rideHome();
  }
}
