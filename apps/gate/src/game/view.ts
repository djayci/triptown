import { CrashScreen, type CrashViewCallbacks, type Frames, type GameStage } from '@triptown/crash-client';
import type { ResultKind } from '@triptown/core';
import type { GameApp } from '@triptown/engine';
import { t } from '../i18n/en';
import { GateStage } from './stage';

/**
 * Beat the Gate. The layout belongs to `CrashScreen` and every compliance behaviour to
 * `CrashViewBase`; this file supplies the scene, the words and two scene cues.
 *
 * The cues only tell the scene what already happened. `showRunning` rides the horse out once the
 * round has started, and `showWin` rides it home once the server has settled the cash-out, so the
 * gate can never shut in the horse's face (beat-the-gate-mvp D4). Neither looks at the result kind;
 * whether to celebrate is still decided in the base.
 */
export class GateView extends CrashScreen {
  private readonly gate: GateStage;

  constructor(game: GameApp, frames: Frames, handlers: CrashViewCallbacks) {
    const gate = new GateStage(game.app, frames);
    super(
      game,
      handlers,
      {
        logo: [t('logo.beatThe'), t('logo.gate')],
        collect: t('button.collect'),
        liveLabel: t('run.winNow', { amount: '' }),
        readySub: t('stage.readySub'),
        settledTitle: t('result.cashedOut'),
        crashedTitle: t('result.crashed'),
      },
      gate as unknown as GameStage,
    );
    this.gate = gate;
  }

  /** No themed counter: the multiplier and the money are the only numbers on screen. */
  protected counterFor(): string | null {
    return null;
  }

  override showRunning(): void {
    super.showRunning();
    this.gate.rideOut();
  }

  override showWin(multiplier: string, payout: string, big: boolean, kind: ResultKind, net: string): void {
    super.showWin(multiplier, payout, big, kind, net);
    this.gate.rideHome();
  }
}
