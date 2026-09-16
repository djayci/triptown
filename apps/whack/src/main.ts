import '@fontsource/lilita-one/400.css';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import { AudioManager, createGameApp, loadAtlas, loadFonts, type AudioManifest } from '@triptown/engine';
import { FairnessPanel } from './dom/fairness-panel';
import { GameController } from './game/controller';
import { createRoundService } from './services';

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
  const [game, frames, service, audio] = await Promise.all([
    createGameApp(parent),
    loadAtlas(asset('atlas.json')),
    createRoundService(),
    loadAudio(),
  ]);
  let fairness: FairnessPanel | null = null;
  const controller = new GameController(game, frames, service, audio, {
    onFairness: () => void fairness?.open(),
  });
  fairness = new FairnessPanel(service, () => controller.refreshSession());
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
