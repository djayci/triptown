import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource/barlow-condensed/900-italic.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import { AudioManager, createGameApp, loadFonts, type AudioManifest } from '@triptown/engine';
import { GameController } from './game/controller';
import { t } from './i18n/en';
import { DEMO, createStepService } from './services';

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
    console.warn('[gallop] audio unavailable', err);
    return null;
  }
}

async function boot() {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  // Fonts load before any text is drawn so labels never render in a fallback face.
  await Promise.all([
    loadFonts(['Barlow Condensed', 'Barlow']),
    document.fonts?.load('italic 900 32px "Barlow Condensed"'),
    document.fonts?.load('italic 800 32px "Barlow Condensed"'),
    document.fonts?.load('700 32px "Barlow"'),
  ]);
  const [game, service, audio] = await Promise.all([createGameApp(parent, { background: '#030712' }), createStepService(), loadAudio()]);
  const controller = new GameController(game, service, DEMO, audio);
  await controller.init();
  // Effects and music load after the first frame so audio never delays startup.
  requestAnimationFrame(() => {
    audio?.loadEffects();
    audio?.loadMusic();
  });
  game.onVisibility((visible) => audio?.setVisible(visible));
  Object.assign(window, { __gallop: controller, __audio: audio });
}

boot().catch((err: unknown) => {
  console.error('[gallop] boot failed', err);
  const el = document.getElementById('game');
  if (el) el.textContent = t('bootFailed');
});
