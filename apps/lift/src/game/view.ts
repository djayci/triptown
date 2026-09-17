import { CrashScreen, type CrashViewCallbacks, type Frames, type GameStage } from '@triptown/crash-client';
import type { GameApp } from '@triptown/engine';
import { t } from '../i18n/en';
import { LiftScene } from './scene';

/**
 * The Lift. Everything on screen except the shaft belongs to CrashScreen, and every compliance
 * behaviour to CrashViewBase — so this game implements no layout and no rules, only its scene and
 * its words. That is the whole point of the seam: the presentation and timing rules hold here
 * because they are not written here.
 */
export class LiftView extends CrashScreen {
  constructor(game: GameApp, _frames: Frames, handlers: CrashViewCallbacks) {
    super(
      game,
      handlers,
      {
        logo: [t('logo.the'), t('logo.lift')],
        collect: t('button.collect'),
        liveLabel: t('run.winNow', { amount: '' }),
        readySub: t('stage.readySub'),
        settledTitle: t('result.cashedOut'),
        crashedTitle: t('result.crashed'),
      },
      new LiftScene(game.app) as unknown as GameStage,
    );
  }

  /**
   * No shared counter: The Lift draws its floor on the car itself, where a lift shows it, rather
   * than in a HUD pill that belongs to no part of the picture. The multiplier remains the value.
   */
  protected counterFor(): string | null {
    return null;
  }
}
