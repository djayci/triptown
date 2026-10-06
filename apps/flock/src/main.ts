import '@fontsource/anton/400.css';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import { DEFAULT_CURRENCY } from '@triptown/core';
import {
  AudioManager,
  createGameApp,
  loadAtlas,
  loadFonts,
  type AudioManifest,
} from '@triptown/engine';
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
import { HoovesPlayer, type HoovesManifest } from './audio/hooves';
import { FlockAudio } from './audio/flock-audio';
import { RanchMusic, type RanchManifest } from './audio/ranch-music';
import { t } from './i18n/en';
import { DUSK } from './game/stage';
import { DUSK_ACTION, FlockView } from './game/view';
import { createRoundService, demoBetMinor, DEMO, GAME_ID } from './services';

// The shared client renders this game's words through whatever translator it is given.
setTranslator(t);

const asset = (path: string) => new URL(`assets/${path}`, document.baseURI).href;

async function loadAudio(): Promise<{
  audio: AudioManager;
  music: RanchMusic | null;
  hooves: HoovesPlayer | null;
} | null> {
  try {
    const manifest = (await fetch(asset('audio/audio.json')).then((r) =>
      r.json(),
    )) as AudioManifest & { ranch?: RanchManifest; hooves?: HoovesManifest };
    const resolve = <T extends { src: string[] }>(a: T): T => ({ ...a, src: a.src.map(asset) });
    const audio = new FlockAudio({
      sfx: resolve(manifest.sfx),
      stems: {
        base: resolve(manifest.stems.base),
        drums: resolve(manifest.stems.drums),
        lead: resolve(manifest.stems.lead),
      },
      ...(manifest.lobby ? { lobby: resolve(manifest.lobby) } : {}),
      tone: resolve(manifest.tone),
    });
    // Flock's round music is its own tiered score; the shared stems are silence (scripts/build-audio.mjs).
    const music = manifest.ranch ? new RanchMusic(manifest.ranch, asset, audio) : null;
    // The hooves are Flock's own too; the shared tone is silence, so the hero is never heard twice.
    const hooves = manifest.hooves ? new HoovesPlayer(manifest.hooves, asset, audio) : null;
    return { audio, music, hooves };
  } catch (err) {
    // The game stays fully playable without sound.
    console.warn('[flock] audio unavailable', err);
    return null;
  }
}

/**
 * Dusk (approved 4 Oct 2026): the multiplier in warm cream and the money and every action in the dusk
 * orange, on the dark sky they sit on. The skin stays whatever the profile chose (`useSkin` never
 * reclassifies a game); Flock draws the same Dusk art under either (flock-mvp D6).
 */
const DUSK_LOOK = {
  colors: {
    sun: 0xf4ead6,
    lime: DUSK_ACTION,
    lime2: 0xf09a5a,
    pink: DUSK_ACTION,
    sky: 0x3a4266,
    violet: 0x2a2f4a,
    ink: 0x0b0d16,
    cream: 0xf4ead6,
  },
  ground: DUSK.ground,
  display: 'Anton, Impact, Arial Narrow, sans-serif',
  shape: { border: 0.5, shadow: 0.4, radius: 0.5 },
};

async function boot() {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  // 800 is the FLOCK sticker's weight: measured before it loads, the sticker would be sized for the fallback.
  await loadFonts(['Anton', { family: 'Bricolage Grotesque', weights: [500, 800] }]);

  const service = await createRoundService();
  const session = await service.getSession().catch(() => null);
  useSkin(session?.profile?.skin === 'adult' ? 'adult' : 'candy', DUSK_LOOK);

  const [game, frames] = await Promise.all([
    createGameApp(parent, { background: DUSK.sky0 }),
    loadAtlas(asset('atlas-dusk.json')),
  ]);
  const sound = await loadAudio();
  const audio = sound?.audio ?? null;
  const music = sound?.music ?? null;
  const hooves = sound?.hooves ?? null;

  let fairness: FairnessPanel | null = null;
  let rules: RulesPanel | null = null;
  let history: HistoryPanel | null = null;
  const overlay = new Overlay();

  let view: FlockView | null = null;
  const controller: GameController = new GameController(
    game,
    frames,
    service,
    audio,
    (app, f, cb) => (view = new FlockView(app, f, cb, music, hooves)),
    {
      game: GAME_ID,
      collectSfx: 'collect',
      // At each milestone (x1.5, x2, x3 …) a soft patter of hooves: more rams falling in. Driven by the
      // multiplier on screen only.
      checkpointSfx: 'join',
      clientVersion: __APP_VERSION__,
      initialBetMinor: demoBetMinor(),
      onFairness: () => void fairness?.open(),
      onRules: () => rules?.open(),
      onHistory: () => void history?.open(),
      // Player-protection gates: betting stays blocked until the player answers.
      onPause: (message) =>
        overlay.show(
          'Take a moment',
          message ?? 'Your operator has paused play for a reality check.',
          [{ label: 'Continue', primary: true, onPick: () => controller.markActivity() }],
        ),
      onOverlayClose: () => overlay.hide(),
      onClosed: () =>
        overlay.show(
          'Game closed',
          'Your operator has closed the game. Any running round has been settled.',
          [],
        ),
      onOperatorMessage: (message) =>
        overlay.show('Message', message, [{ label: 'OK', primary: true, onPick: () => {} }]),
      onIdlePrompt: (done) =>
        overlay.show(
          'Still there?',
          'You have not placed a bet for a while. Continue playing, or exit the game.',
          [
            { label: 'Continue', primary: true, onPick: done },
            {
              label: 'Exit',
              onPick: () => overlay.show('Game closed', 'You have exited the game.', []),
            },
          ],
        ),
    },
  );

  fairness = new FairnessPanel(service, () => controller.refreshSession());
  history = new HistoryPanel(
    service,
    () => controller.currentSession?.currency ?? DEFAULT_CURRENCY,
  );
  // The published RTP band comes from the committed reports at the market's minimum stake (GLI-19 4.7.2(a)).
  rules = new RulesPanel(() => controller.currentSession, {
    bands: bands as BandsByConfig,
    version: __APP_VERSION__,
    build: __BUILD_HASH__,
    reduceEffects: controller.reduceEffects,
    onReduceEffects: (on) => controller.setReduceEffects(on),
    autoCashout: false,
    game: GAME_ID,
    stakeMinor: () => controller.stakeMinor,
  });

  // Dev hooks for the shared compliance checks. Demo builds only, never production.
  if (DEMO) {
    const w = window as unknown as Record<string, unknown>;
    if (audio) {
      w.__triptownAudioLog = audio.log;
      w.__triptownAudio = audio;
    }
    w.__triptownView = () => controller.debugState();
    w.__flockScene = () => view?.debugScene();
    w.__flockMusic = () => music?.state ?? null;
    w.__flockHooves = () => hooves?.state ?? null;
    w.__triptownPractice = () => void controller.bet({ practice: true });
  }

  await controller.init();
  // Effects load after the first frame so audio never delays startup.
  requestAnimationFrame(() => {
    audio?.loadEffects();
    void music?.load();
    void hooves?.load();
  });
  Object.assign(window, { __flock: controller });
}

boot().catch((err: unknown) => {
  console.error('[flock] boot failed', err);
  const el = document.getElementById('game');
  if (el) el.textContent = 'Could not load the game. Please refresh.';
});
