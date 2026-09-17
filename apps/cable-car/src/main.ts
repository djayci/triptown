import '@fontsource/lilita-one/400.css';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import { createGameApp, loadFonts } from '@triptown/engine';
import { effectiveReveal, registerGame } from '@triptown/core';
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
import { CableCarView } from './game/view';
import { createRoundService, demoBetMinor, DEMO, GAME_ID } from './services';

// The shared client renders this game's words through whatever translator it is given.
setTranslator(t);

/**
 * The ground this game draws on, per skin, and the tokens that have to read against it.
 *
 * The stage is a dark mountainside, so the multiplier and the money sit on `ink` rather than on
 * artwork. Passing `ground` is what makes `useSkin` check that claim instead of trusting it: the
 * adult palette's charcoal `sun` is 1.42:1 here — the primary value, invisible — and its `lime`
 * only 3.08:1. Brass (7.83:1) and a lighter teal (6.87:1) read while staying muted.
 */
const CANDY_GROUND = { ground: 0x1d1424 };
const ADULT_MOUNTAIN = { colors: { sun: 0xd2a34a, lime: 0x5cae99 }, ground: 0x14161a };

async function boot() {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  await loadFonts(['Lilita One', 'Bricolage Grotesque']);

  // The session decides the skin and the reveal, so the service comes first.
  const service = await createRoundService();
  const session = await service.getSession().catch(() => null);
  const skin = session?.profile?.skin === 'adult' ? 'adult' : 'candy';
  // Decided by effectiveReveal, the same function the server uses at START, not by the market flag
  // alone: the flag says what the market allows, effectiveReveal says what this game does. START
  // confirms it per round; this only picks the words up front.
  registerGame(GAME_ID, 'whack-crash', { reveal: ['onCollect'] });
  const presentation = session ? effectiveReveal(GAME_ID, session.profile, session.config) : 'live';
  useSkin(skin, skin === 'adult' ? ADULT_MOUNTAIN : CANDY_GROUND);

  const game = await createGameApp(parent);
  // The Cable Car draws with vector shapes and requests no atlas frames.
  const frames = (() => {
    throw new Error('The Cable Car requests no atlas frames');
  }) as never;

  let fairness: FairnessPanel | null = null;
  let rules: RulesPanel | null = null;
  let history: HistoryPanel | null = null;
  const overlay = new Overlay();

  const controller = new GameController(game, frames, service, null, (app, f, cb) => new CableCarView(app, f, cb, presentation), {
    collectSfx: 'collect',
    clientVersion: __APP_VERSION__,
    initialBetMinor: demoBetMinor(),
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
    // The Cable Car ships no audio, so this log is empty by construction rather than by accident.
    // It is still exposed, because the shared check treats a missing hook as a build it cannot
    // judge — and reports a game with no cue channel as such, so an empty log is never read as proof.
    w.__triptownAudioLog = [];
    w.__triptownView = () => controller.debugState();
  }

  await controller.init();
  Object.assign(window, { __cableCar: controller });
}

void boot();
