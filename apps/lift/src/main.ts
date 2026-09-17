import '@fontsource/lilita-one/400.css';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import { createGameApp, loadFonts } from '@triptown/engine';
import {
  FairnessPanel,
  GameController,
  HistoryPanel,
  Overlay,
  RulesPanel,
  setTranslator,
  useSkin,
} from '@triptown/crash-client';
import bands from '@triptown/fairness/reports/bands.json';
import type { BandsByConfig } from '@triptown/fairness';
import { t } from './i18n/en';
import { LiftView } from './game/view';
import { createRoundService, DEMO } from './services';

// The shared client renders this game's words through whatever translator it is given.
setTranslator(t);

async function boot() {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  await loadFonts(['Lilita One', 'Bricolage Grotesque']);

  // The session decides the skin, so the service comes first.
  const service = await createRoundService();
  const skin = (await service.getSession().catch(() => null))?.profile?.skin === 'adult' ? 'adult' : 'candy';
  useSkin(skin);

  const game = await createGameApp(parent);
  // The Lift draws with vector shapes and requests no atlas frames.
  const frames = (() => {
    throw new Error('The Lift requests no atlas frames');
  }) as never;

  let fairness: FairnessPanel | null = null;
  let rules: RulesPanel | null = null;
  let history: HistoryPanel | null = null;
  const overlay = new Overlay();

  const controller = new GameController(game, frames, service, null, (app, f, cb) => new LiftView(app, f, cb), {
    collectSfx: 'collect',
    clientVersion: __APP_VERSION__,
    onFairness: () => void fairness?.open(),
    onRules: () => rules?.open(),
    onHistory: () => void history?.open(),
    // Player-protection gates: betting stays blocked until the player answers.
    onPause: (message) =>
      overlay.show('Take a moment', message ?? 'Your operator has paused play for a reality check.', [
        { label: 'Continue', primary: true, onPick: () => controller.markActivity() },
      ]),
    onOverlayClose: () => overlay.hide(),
    onClosed: () => overlay.show('Game closed', 'Your operator has closed the game. Any running round has been settled.', []),
    onOperatorMessage: (message) => overlay.show('Message', message, [{ label: 'OK', primary: true, onPick: () => {} }]),
    onIdlePrompt: (done) =>
      overlay.show('Still there?', 'You have not placed a bet for a while. Continue playing, or exit the game.', [
        { label: 'Continue', primary: true, onPick: done },
        { label: 'Exit', onPick: () => overlay.show('Game closed', 'You have exited the game.', []) },
      ]),
  });

  fairness = new FairnessPanel(service, () => controller.refreshSession());
  history = new HistoryPanel(service, () => controller.currentSession?.currency ?? { code: 'NGN', decimals: 2, minBetMinor: 100_00, maxBetMinor: 1_000_000_00 });
  // The published RTP band comes from the committed reports, looked up at the market's minimum
  // stake, so the figure can never drift from what was simulated (GLI-19 4.7.2(a)).
  rules = new RulesPanel(() => controller.currentSession, {
    bands: bands as BandsByConfig,
    version: __APP_VERSION__,
    build: __BUILD_HASH__,
    reduceEffects: controller.reduceEffects,
    onReduceEffects: (on) => controller.setReduceEffects(on),
  });

  // Dev hooks for the shared compliance checks. Demo builds only, never production.
  if (DEMO) {
    const w = window as unknown as Record<string, unknown>;
    w.__triptownView = () => controller.debugState();
  }

  await controller.init();
  Object.assign(window, { __lift: controller });
}

void boot();
