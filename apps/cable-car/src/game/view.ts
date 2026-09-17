import { CrashScreen, type CrashViewCallbacks, type Frames, type GameStage } from '@triptown/crash-client';
import type { RevealMode } from '@triptown/core';
import type { GameApp } from '@triptown/engine';
import { t } from '../i18n/en';
import { CableCarScene } from './scene';

/**
 * The Cable Car. Everything on screen except the ride belongs to `CrashScreen` and every compliance
 * behaviour to `CrashViewBase` — so this game implements no layout and no rules, only its scene and
 * its words. The presentation and timing rules hold here because they are not written here.
 *
 * On a deferred-reveal market the collect asks for the next stop: the value locks, the car keeps
 * going, and the result arrives when the shared client reveals it. The only thing this file adds to
 * that is the lamp on the car, which reports what the PLAYER did and never anything about the
 * outcome — every visible consequence of the press is identical for a win and a loss.
 */
export class CableCarView extends CrashScreen {
  private readonly ride: CableCarScene;

  constructor(game: GameApp, _frames: Frames, handlers: CrashViewCallbacks, presentation: RevealMode = 'live') {
    const ride = new CableCarScene(game.app);
    const deferred = presentation === 'onCollect';
    super(
      game,
      handlers,
      {
        logo: [t('logo.the'), t('logo.lift')],
        collect: t('button.collect'),
        liveLabel: deferred ? t('run.headingHome') : t('run.winNow', { amount: '' }),
        readySub: t('stage.readySub'),
        settledTitle: t('result.cashedOut'),
        crashedTitle: t('result.crashed'),
      },
      ride as unknown as GameStage,
    );
    this.ride = ride;
  }

  /**
   * No themed counter. The height is drawn on the car, where a vehicle carries its own readout,
   * rather than in a HUD chip belonging to no part of the picture. The multiplier is the value.
   */
  protected counterFor(): string | null {
    return null;
  }

  /** Back to a fresh ride: the lamp goes out with everything else. */
  override showBetting(): void {
    super.showBetting();
    this.ride.setStopRequested(false);
  }

  /**
   * The value has locked and the car is still moving. Lighting the lamp is the scene's whole part
   * in this state — it says the stop was requested, which the player already knows, and says
   * nothing about whether the ride is still running.
   */
  override showHeadingHome(multiplier: string, payoutIfWon: string): void {
    this.ride.setStopRequested(true);
    super.showHeadingHome(multiplier, payoutIfWon);
  }
}
