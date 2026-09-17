import { CrashScreen, type CrashViewCallbacks, type Frames, type GameStage } from '@triptown/crash-client';
import type { ResultKind, RevealMode } from '@triptown/core';
import type { GameApp } from '@triptown/engine';
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
export class GateView extends CrashScreen {
  private readonly gate: GateStage;
  private roundReveal: RevealMode;

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

  override showRunning(): void {
    super.showRunning();
    this.gate.rideOut();
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
