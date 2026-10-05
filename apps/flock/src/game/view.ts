import {
  CrashScreen,
  type CrashViewCallbacks,
  type GameStage,
  type ScreenLook,
} from '@triptown/crash-client';
import type { ResultKind } from '@triptown/core';
import { Confetti, gsap, prefersReducedMotion, shake, type GameApp } from '@triptown/engine';
import type { HoovesPlayer } from '../audio/hooves';
import type { RanchMusic } from '../audio/ranch-music';
import { t } from '../i18n/en';
import { FlockStage, type Frames } from './stage';

/** Accent colours from the approved canvas: the dusk orange for every action, on the dark sky. */
export const DUSK_ACTION = 0xe8762b;

/**
 * Flock's layout (approved design "Flock — result on top", 5 Oct 2026), as on Gate Rush: the result card
 * takes the value's place at the top, and the controls are one row under that top block, so they sit in
 * the same place on the betting screen and the result. They step aside while a round runs
 * (`hideControlsInRound`). The row is centred on the 390 px frame: four 40 px buttons, 10 px apart.
 */
/** The betting screen's READY?, smaller than the value so it fits the frame with room either side. */
const READY_SIZE = 64;

const FLOCK_LOOK: Partial<ScreenLook> = {
  value: {
    x: 195,
    anchor: 0.5,
    valueY: 112,
    valueSize: 88,
    payoutY: 208,
    payoutSize: 34,
    labelY: 304,
    chanceY: 328,
  },
  liveText: { x: 195, width: 330 },
  controls: { x: 100, y: 248, size: 40, gap: 10, horizontal: true },
  resultCard: { x: 24, y: 112, w: 342, h: 124, titleY: 22, lineY: 76 },
  hideValueOnResult: true,
  // Betting says READY? and its line, like every other game, not x1.00 (the user, 5 Oct 2026). The
  // invitation is centred in the band between the history chips and the control row.
  hideValueWhileBetting: true,
  lobby: { top: 100, bottom: 244 },
};

/**
 * Flock. The layout belongs to `CrashScreen` and every compliance behaviour to `CrashViewBase`; this file
 * supplies the scene, the words and three scene cues: the run starts, the pace, and the pull-up.
 *
 * The pull-up plays only from `showWin`, which runs after the server settled the cash-out. A press that
 * loses the tie to the crash therefore never shows the flock stopping, only the wolf (flock-mvp D4).
 * The wolf itself is the stage's `onCrash`, which the base calls when the crash arrives and not before.
 */
export class FlockView extends CrashScreen {
  private readonly flock: FlockStage;
  /** Win confetti, on top of everything so no panel hides it. */
  private readonly confetti: Confetti;
  /** Screen shakes shown, read by the presentation check: a shake may only ever follow a celebrated win. */
  shakesShown = 0;

  constructor(
    game: GameApp,
    frames: Frames,
    handlers: CrashViewCallbacks,
    /** The tiered round music; null without audio. It hears only the run starting, the pace and the end. */
    private readonly music: RanchMusic | null = null,
    /** The hooves, one ram's to a herd's; null without audio. They hear only what the stage draws. */
    private readonly hooves: HoovesPlayer | null = null,
  ) {
    const flock = new FlockStage(frames);
    super(
      game,
      handlers,
      {
        logo: [t('logo.flock'), t('logo.sub')],
        collect: t('button.collect'),
        collectSub: t('button.collectSub'),
        // Nothing under the money while the run is on (the user, 5 Oct 2026): CASH OUT on the button says it.
        liveLabel: '',
        readySub: t('stage.readySub'),
        readyTitle: t('stage.readyTitle'),
        settledTitle: t('result.cashedOut'),
        crashedTitle: t('result.crashed'),
      },
      flock as unknown as GameStage,
      FLOCK_LOOK,
    );
    this.flock = flock;
    flock.onStride = (rams, speed) => this.hooves?.set(rams, speed);
    this.confetti = new Confetti(game.app.ticker);
    this.root.addChild(this.confetti);
  }

  /** Demo builds: what the scene shows. */
  debugScene(): ReturnType<FlockStage['debugScene']> {
    return this.flock.debugScene();
  }

  /** No themed counter: nothing stands beside the multiplier as a ram count (flock-mvp spec). */
  protected counterFor(): string | null {
    return null;
  }

  /** The control column steps aside during a round, as on every other game; it is back for every bet and result. */
  protected override hideControlsInRound(): boolean {
    return true;
  }

  /** No auto cash-out for now (the user, 5 Oct 2026): the stake fills the row, and no target is ever sent. */
  protected override hasAutoCashout(): boolean {
    return false;
  }

  protected override actionColors(): { ready: number; running: number; celebrate: number } {
    return { ready: DUSK_ACTION, running: DUSK_ACTION, celebrate: DUSK_ACTION };
  }

  override showBetting(): void {
    // READY? is wider than any value: at the value's 88 px it runs edge to edge. The base centres the
    // invitation by its drawn size, so set the size first; the next layout restores the value's.
    this.multiplierText.style.fontSize = READY_SIZE;
    super.showBetting();
    this.music?.stop();
    this.hooves?.stop(0);
  }

  override showRunning(): void {
    super.showRunning();
    this.flock.start();
    this.music?.start();
    this.hooves?.start();
  }

  override showCrash(multiplier: string, loss: string, instant: boolean): void {
    super.showCrash(multiplier, loss, instant);
    this.music?.stop(150);
    // The crash cue carries the flock scattering; the running hooves stop under it.
    this.hooves?.stop(250);
  }

  override frame(
    multiplier: string,
    payout: string,
    level: number,
    intensity: string,
    pace: number,
    belowStake: boolean,
  ): void {
    super.frame(multiplier, payout, level, intensity, pace, belowStake);
    this.flock.setPace(pace);
    // The music steps up with elapsed time only, like the run itself.
    this.music?.setPace(pace);
  }

  override showWin(
    multiplier: string,
    payout: string,
    big: boolean,
    kind: ResultKind,
    net: string,
  ): void {
    super.showWin(multiplier, payout, big, kind, net);
    this.flock.pullUp();
    this.music?.stop();
    // The one place the celebration rule lives is the base's decision: a return at or below the stake
    // gets none of this (UK RTS 14F, AGCO 2.20, and the same rule in every Triptown game).
    if (this.resultPresentation(kind, payout, net).celebrate) this.party(big);
  }

  /**
   * A celebrated win: dusk-coloured confetti from the field and one shake. Only called after the
   * celebrate decision, and skipped with reduced motion or effects off.
   */
  private party(big: boolean): void {
    if (!this.intensityEffects || prefersReducedMotion()) return;
    const colors = [0xe8762b, 0xffd79a, 0xf4ead6, 0x8c7a5e];
    // Kept below the result card so the amount won stays readable.
    this.confetti.burst({
      x: 195,
      y: 620,
      count: big ? 140 : 80,
      speed: 880,
      colors,
      outline: 0x0b0d16,
    });
    gsap.delayedCall(0.35, () => {
      this.confetti.burst({
        x: 20,
        y: 660,
        count: big ? 50 : 30,
        speed: 860,
        colors,
        outline: 0x0b0d16,
      });
      this.confetti.burst({
        x: 370,
        y: 660,
        count: big ? 50 : 30,
        speed: 860,
        colors,
        outline: 0x0b0d16,
      });
    });
    if (shake(this.root, big ? 8 : 5, 0.35)) this.shakesShown++;
  }
}
