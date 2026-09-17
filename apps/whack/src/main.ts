import '@fontsource/lilita-one/400.css';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import { AudioManager, createGameApp, loadAtlas, loadFonts, type AudioManifest } from '@triptown/engine';
import { FairnessPanel } from '@triptown/crash-client';
import { HistoryPanel } from '@triptown/crash-client';
import { Overlay } from '@triptown/crash-client';
import { RulesPanel } from '@triptown/crash-client';
import { GameController, setTranslator, useSkin } from '@triptown/crash-client';
import { t } from './i18n/en';
import bands from '@triptown/fairness/reports/bands.json';
import type { BandsByConfig } from '@triptown/fairness';
import { createRoundService } from './services';
import { GameView } from './game/view';

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
    console.warn('[whack] audio unavailable', err);
    return null;
  }
}

async function boot() {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  await loadFonts(['Lilita One', 'Bricolage Grotesque']);
  // The session decides the skin, so the service comes first and only that skin's atlas is fetched.
  const service = await createRoundService();
  const skin = (await service.getSession().catch(() => null))?.profile?.skin === 'adult' ? 'adult' : 'candy';
  useSkin(skin);
  const [game, frames, audio] = await Promise.all([createGameApp(parent), loadAtlas(asset(`atlas-${skin}.json`)), loadAudio()]);
  let fairness: FairnessPanel | null = null;
  let rules: RulesPanel | null = null;
  let history: HistoryPanel | null = null;
  const overlay = new Overlay();
  const controller = new GameController(game, frames, service, audio, (app, f, cb) => new GameView(app, f, cb), {
    collectSfx: 'whack',
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
    onOperatorMessage: (text) => overlay.show('Message', text, [{ label: 'OK', primary: true, onPick: () => {} }]),
    onIdlePrompt: (done) =>
      overlay.show('Still there?', 'You have not placed a bet for a while. Continue playing, or exit the game.', [
        { label: 'Continue', primary: true, onPick: done },
        { label: 'Exit', onPick: () => overlay.show('Game closed', 'You have exited the game.', []) },
      ]),
  });
  fairness = new FairnessPanel(service, () => controller.refreshSession());
  // The worst-case rounding band at the minimum stake comes from the committed RTP reports, so the
  // published figure can never drift from what was actually simulated (GLI-19 4.7.2(a)).
  history = new HistoryPanel(service, () => controller.currentSession?.currency ?? { code: 'USD', decimals: 2, minBetMinor: 20, maxBetMinor: 100_00 });
  rules = new RulesPanel(() => controller.currentSession, {
    bands: bands as BandsByConfig,
    version: __APP_VERSION__,
    build: __BUILD_HASH__,
    reduceEffects: controller.reduceEffects,
    onReduceEffects: (on) => controller.setReduceEffects(on),
  });
  // Dev hooks for the automated compliance checks. Demo builds only, never production.
  if (import.meta.env.VITE_DEMO === 'true') {
    const w = window as unknown as Record<string, unknown>;
    if (audio) w.__triptownAudioLog = audio.log;
    w.__triptownView = () => controller.debugState();
  }
  await controller.init();
  // Effects load after the first frame so audio never delays startup.
  requestAnimationFrame(() => audio?.loadEffects());
  Object.assign(window, { __whack: controller, __audio: audio });
}

boot().catch((err: unknown) => {
  console.error('[whack] boot failed', err);
  const el = document.getElementById('game');
  if (el) el.textContent = 'Could not load the game. Please refresh.';
});
