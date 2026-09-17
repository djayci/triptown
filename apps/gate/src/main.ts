import '@fontsource/lilita-one/400.css';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import { DEFAULT_CURRENCY, effectiveReveal, registerGame } from '@triptown/core';
import { AudioManager, createGameApp, loadAtlas, loadFonts, type AudioManifest } from '@triptown/engine';
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
import { STAGE_PALETTES } from './game/stage';
import { GateView } from './game/view';
import { createRoundService, demoBetMinor, DEMO } from './services';

// The shared client renders this game's words through whatever translator it is given.
setTranslator(t);

/** The horse game's registry id; it plays the Whack Crash engine's certified configurations. */
const GAME_ID = 'beat-the-gate';

const asset = (path: string) => new URL(`assets/${path}`, document.baseURI).href;

async function loadAudio(): Promise<AudioManager | null> {
  try {
    const manifest = (await fetch(asset('audio/audio.json')).then((r) => r.json())) as AudioManifest;
    const resolve = <T extends { src: string[] }>(a: T): T => ({ ...a, src: a.src.map(asset) });
    return new AudioManager({
      sfx: resolve(manifest.sfx),
      stems: { base: resolve(manifest.stems.base), drums: resolve(manifest.stems.drums), lead: resolve(manifest.stems.lead) },
      ...(manifest.lobby ? { lobby: resolve(manifest.lobby) } : {}),
      tone: resolve(manifest.tone),
    });
  } catch (err) {
    // The game stays fully playable without sound.
    console.warn('[gate] audio unavailable', err);
    return null;
  }
}

/**
 * Adult Sticker (chosen 17 Sep 2026): Whack Crash's adult skin with the values the charcoal stage needs.
 * The skin stays whatever the profile chose. The multiplier reads in cream and the money and the collect
 * button in brass; a loss card is a muted maroon. `ground` is the stage colour those values sit on, which
 * the shared theme checks for contrast.
 */
const ADULT_STICKER = {
  colors: { sun: 0xe8e3d9, lime: 0xb98a3c, lime2: 0xc99b4d, violet: 0x5a4045 },
  ground: STAGE_PALETTES.adult.night,
};

/**
 * Candy Paddock (chosen 17 Sep 2026): Whack Crash's candy palette on a yellow sunburst. Cream and lime,
 * drawn for Whack's own stage, sink into the yellow (1.3:1 and under 2:1), so the multiplier reads in a deep
 * purple and the money, the IN! button and the win card in a deep pink, both checked against the lighter
 * sunburst tone.
 */
const CANDY_PADDOCK = {
  colors: { sun: 0x6d28d9, lime: 0xd6246e, lime2: 0xe64584 },
  ground: STAGE_PALETTES.candy.night,
};

async function boot() {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  await loadFonts(['Lilita One', 'Bricolage Grotesque']);

  // The session decides the skin, so the service comes first.
  const service = await createRoundService();
  const session = await service.getSession().catch(() => null);
  const skin = session?.profile?.skin === 'adult' ? 'adult' : 'candy';
  // Gate Rush where this game's rounds reveal at IN!, Beat the Gate everywhere else (gate-odds-mvp D8).
  // Decided by effectiveReveal, the same function the server uses at START, not by the market flag alone:
  // the flag says what the market allows, effectiveReveal says what this game does. START confirms it
  // per round; this only picks the wordmark and words up front.
  registerGame(GAME_ID, 'whack-crash', { reveal: ['onCollect'] });
  const presentation = session ? effectiveReveal(GAME_ID, session.profile, session.config) : 'live';
  useSkin(skin, skin === 'adult' ? ADULT_STICKER : CANDY_PADDOCK);
  document.body.style.background = `#${STAGE_PALETTES[skin].ray.toString(16).padStart(6, '0')}`;

  const [game, frames] = await Promise.all([
    createGameApp(parent, { background: `#${STAGE_PALETTES[skin].ray.toString(16).padStart(6, '0')}` }),
    loadAtlas(asset(`atlas-${skin}.json`)),
  ]);
  const audio = await loadAudio();

  let fairness: FairnessPanel | null = null;
  let rules: RulesPanel | null = null;
  let history: HistoryPanel | null = null;
  const overlay = new Overlay();

  const controller = new GameController(game, frames, service, audio, (app, f, cb) => new GateView(app, f, cb, presentation, skin), {
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
  history = new HistoryPanel(service, () => controller.currentSession?.currency ?? DEFAULT_CURRENCY);
  // The published RTP band comes from the committed reports, looked up at the market's minimum
  // stake, so the figure can never drift from what was simulated (GLI-19 4.7.2(a)).
  rules = new RulesPanel(() => controller.currentSession, {
    bands: bands as BandsByConfig,
    version: __APP_VERSION__,
    build: __BUILD_HASH__,
    reduceEffects: controller.reduceEffects,
    onReduceEffects: (on) => controller.setReduceEffects(on),
    autoCashout: false,
  });

  // Dev hooks for the shared compliance checks. Demo builds only, never production.
  if (DEMO) {
    const w = window as unknown as Record<string, unknown>;
    if (audio) w.__triptownAudioLog = audio.log;
    w.__triptownView = () => controller.debugState();
    // Stake-free practice rounds: the shared check drives one through this hook on markets that allow them.
    w.__triptownPractice = () => void controller.bet({ practice: true });
  }

  await controller.init();
  // Effects load after the first frame so audio never delays startup.
  requestAnimationFrame(() => audio?.loadEffects());
  Object.assign(window, { __gate: controller });
}

boot().catch((err: unknown) => {
  console.error('[gate] boot failed', err);
  const el = document.getElementById('game');
  if (el) el.textContent = 'Could not load the game. Please refresh.';
});
