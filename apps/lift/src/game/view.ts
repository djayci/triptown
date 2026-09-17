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
        counterLabel: t('label.floor'),
      },
      new LiftScene(game.app) as unknown as GameStage,
    );
  }

  /** Floors are decoration over the same multiplier; the multiplier is the value. */
  protected counterFor(multiplier: number): string {
    return String(Math.max(0, Math.round((multiplier - 1) * 10)));
  }
}
