import '@fontsource/bungee/400.css';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
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
import { GateView } from './game/view';
import { createRoundService, DEMO } from './services';

// The shared client renders this game's words through whatever translator it is given.
setTranslator(t);

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
 * Floodlight Gold (beat-the-gate-mvp D5). The skin stays whatever the profile chose; only the colour
 * tokens and the display face change, so the primary values read on the night stage. `ground` is the
 * stage colour those values sit on, which the shared theme checks for contrast.
 */
const FLOODLIGHT_GOLD = {
  colors: { sun: 0xffc414, sun2: 0xe0a800, cream: 0xfff4d6, lime: 0x8ce99a, sky: 0x1c3a7a, violet: 0xf1a9a0 },
  display: 'Bungee, Arial Black, sans-serif',
  ground: 0x101b44,
};

async function boot() {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  await loadFonts(['Bungee', 'Lilita One', 'Bricolage Grotesque']);

  // The session decides the skin, so the service comes first.
  const service = await createRoundService();
  const skin = (await service.getSession().catch(() => null))?.profile?.skin === 'adult' ? 'adult' : 'candy';
  useSkin(skin, FLOODLIGHT_GOLD);

  const [game, frames] = await Promise.all([
    createGameApp(parent, { background: '#0a1030' }),
    loadAtlas(asset('atlas.json')),
  ]);
  const audio = await loadAudio();

  let fairness: FairnessPanel | null = null;
  let rules: RulesPanel | null = null;
  let history: HistoryPanel | null = null;
  const overlay = new Overlay();

  const controller = new GameController(game, frames, service, audio, (app, f, cb) => new GateView(app, f, cb), {
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
    if (audio) w.__triptownAudioLog = audio.log;
    w.__triptownView = () => controller.debugState();
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
