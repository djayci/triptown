import '@fontsource/chivo/latin-400.css';
import '@fontsource/chivo/latin-700.css';
import '@fontsource/chivo/latin-800.css';
import '@fontsource/chivo/latin-900.css';
import '@fontsource/chivo-mono/latin-400.css';
import '@fontsource/chivo-mono/latin-600.css';
import { PaperRouteAudio } from './audio';
import { FairnessPanel } from './dom/fairness-panel';
import { HistoryPanel } from './dom/history-panel';
import { RulesPanel } from './dom/rules-panel';
import { SettingsPanel } from './dom/settings-panel';
import { Controller } from './game/controller';
import { Hud } from './hud/hud';
import { Courier } from './scene/courier';
import { Fx } from './scene/fx';
import { initialTier } from './scene/quality';
import { Street } from './scene/street';
import { createWorld } from './scene/world';
import { createRoundService, DEMO } from './services';
import { hasWebGL, showUnsupported } from './webgl';

async function boot() {
  const sceneEl = document.getElementById('scene');
  const hudEl = document.getElementById('hud');
  if (!sceneEl || !hudEl) throw new Error('#scene or #hud missing');
  if (!hasWebGL()) {
    // Stop before any service or betting UI exists.
    showUnsupported(hudEl);
    return;
  }
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const world = createWorld(sceneEl, initialTier(isTouch));
  const street = new Street();
  const courier = new Courier();
  const fx = new Fx({ reducedMotion });
  world.scene.add(street.group, courier.group, fx.group);
  const resize = () => world.resize(sceneEl.clientWidth, sceneEl.clientHeight);
  addEventListener('resize', resize);
  resize();

  const service = await createRoundService();
  const session = await service.getSession();
  const audio = await PaperRouteAudio.load({ soundDefault: session.profile.soundDefault, intensityEffects: () => session.profile.intensityEffects && !(controller?.effectsReduced ?? false) });
  // Browsers allow audio only after a gesture; any first tap or key unlocks it.
  const unlock = () => audio?.manager.unlock();
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
  // Pauses sound when the page or webview goes to the background.
  document.addEventListener('visibilitychange', () => audio?.manager.setVisible(document.visibilityState === 'visible'));
  requestAnimationFrame(() => audio?.manager.loadEffects());
  let controller: Controller | null = null;
  const build = { version: import.meta.env.VITE_BUILD_ID ?? 'dev', hash: import.meta.env.VITE_BUILD_HASH ?? 'local' };
  const rules = new RulesPanel(build);
  const history = new HistoryPanel(service);
  const fairness = new FairnessPanel(service);
  (window as unknown as { __paperRoutePanels: unknown }).__paperRoutePanels = { rules, history, fairness };
  const settings = new SettingsPanel(audio?.manager ?? null, { get: () => controller?.effectsReduced ?? false, set: (on) => controller?.setReduceEffects(on) });
  const hud = new Hud(hudEl, {
    bet: () => void controller?.bet(),
    changeBet: (d) => controller?.changeBet(d),
    changeAutoCashout: (d) => controller?.changeAutoCashout(d),
    throwOne: () => controller?.throwOne(),
    throwAll: () => controller?.throwAll(),
    continue: () => controller?.continue(),
    exit: () => controller?.exit(),
    dismissNotice: () => controller?.dismissNotice(),
    openRules: () => void service.getSession().then((s) => rules.open(s, () => void fairness.open())),
    openHistory: () => void service.getSession().then((s) => history.open(s)),
    openSettings: () => settings.open(),
  });
  controller = new Controller({ service, world, street, courier, fx, hud, reducedMotion, isTouch, demo: DEMO, version: import.meta.env.VITE_BUILD_ID ?? 'dev', ...(audio && { sounds: audio }) });
  (window as unknown as { __paperRouteAudio: PaperRouteAudio | null }).__paperRouteAudio = audio;
  (window as unknown as { __paperRoute: Controller }).__paperRoute = controller;
  await controller.start();
}

void boot();
