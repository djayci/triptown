import '@fontsource/lilita-one/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/800.css';
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
import { HEADING_CUE, STAGE_PALETTES } from './game/stage';
import { TRACK_CARD, trackCheckpoints } from './game/track';
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

/**
 * Broadcast (chosen 19 Sep 2026): the ride as sports television. A floodlit pitch under a night sky, flat
 * panels instead of stickers (shape weights at a third of the sticker look, no drop shadow), condensed
 * display type, and the broadcast accents: white value, amber money, red action. `ground` is the night sky
 * the values sit on, which the shared theme contrast-checks.
 */
const BROADCAST = {
  colors: { sun: 0xffffff, lime: 0xffd166, lime2: 0xffdd8f, violet: 0xd90429, sky: 0xd90429, pink: 0xd90429 },
  ground: STAGE_PALETTES.broadcast.night,
  display: 'Barlow Condensed, Barlow, Arial Narrow, sans-serif',
  shape: { border: 0.3, shadow: 0, radius: 0.25 },
};

/**
 * Dirt Track (chosen 24 Sep 2026), in the Gold & Racing Red colours (S1, 24 Sep): Whack Crash's sticker
 * language on a gold sunburst card, in racing colours rather than candy ones. The multiplier is a deep
 * racing red: cream on gold reads only through its outline (1.7:1), under the 3:1 floor useSkin enforces,
 * and ink fills in against its own ink outline. Money in bottle green, DEMO racing red, the small buttons
 * gold; the wordmark's colours are the view's look. The action colours are the view's.
 */
const DIRT_TRACK = {
  colors: { sun: 0xa3201a, lime: 0x1f6b3a, lime2: 0x2f8a3e, violet: 0xb3261e, sky: 0xffd24a, pink: 0xc8261e, ink: 0x1a1614, cream: 0xfff4dc },
  // The card's darker ray, the stricter of the two golds the values sit on.
  ground: TRACK_CARD.ray,
  shape: { border: 0.85, shadow: 0.85, radius: 0.8 },
};

async function boot() {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  await loadFonts(['Lilita One', 'Bricolage Grotesque', { family: 'Barlow Condensed', weights: [600, 800] }]);

  // The session decides the skin, so the service comes first.
  const service = await createRoundService();
  const session = await service.getSession().catch(() => null);
  // The look is the game's own presentation; the skin still says what a market allows (candy or adult art).
  // Dirt Track ships as the look (user decision, 25 Sep 2026); `?look=broadcast` keeps Broadcast, the look
  // before it, and `?look=paddock` the earlier Candy Paddock, for comparison.
  const profileSkin = session?.profile?.skin === 'adult' ? 'adult' : 'candy';
  const look = new URLSearchParams(location.search).get('look');
  const skin = look === 'paddock' ? profileSkin : look === 'broadcast' ? 'broadcast' : 'track';
  // Gate Rush where this game's rounds reveal at IN!, Beat the Gate everywhere else (gate-odds-mvp D8).
  // Decided by effectiveReveal, the same function the server uses at START, not by the market flag alone:
  // the flag says what the market allows, effectiveReveal says what this game does. START confirms it
  // per round; this only picks the wordmark and words up front.
  registerGame(GAME_ID, 'whack-crash', { reveal: ['onCollect'] });
  const presentation = session ? effectiveReveal(GAME_ID, session.profile, session.config) : 'live';
  const options = skin === 'broadcast' ? BROADCAST : skin === 'track' ? DIRT_TRACK : skin === 'adult' ? ADULT_STICKER : CANDY_PADDOCK;
  useSkin(skin === 'broadcast' || skin === 'track' ? 'adult' : skin, options);
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

  let view: GateView | null = null;
  const controller: GameController = new GameController(game, frames, service, audio, (app, f, cb) => (view = new GateView(app, f, cb, presentation, skin, () => controller.currentSession?.config)), {
    game: GAME_ID,
    collectSfx: 'collect',
    // Gate Rush's suspense: a fixed ride home from every press, whatever the result (user decision,
    // 23 Sep 2026), with its own drumroll in place of the round music. The length comes from the cue file
    // the sound is built from, so the wait, the screen's build and the drumroll can't drift apart.
    headingHomeMs: HEADING_CUE.seconds * 1000,
    headingHomeSfx: 'heading',
    // Dirt Track: its own checkpoints, closer together as the value climbs, each with a happy chime; the
    // painted lines are the same values (track.ts), so line, badge and sound land together.
    ...(skin === 'track' ? { checkpoints: trackCheckpoints, checkpointSfx: 'checkpoint' } : {}),
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
    game: GAME_ID,
    stakeMinor: () => controller.stakeMinor,
  });

  // Dev hooks for the shared compliance checks. Demo builds only, never production.
  if (DEMO) {
    const w = window as unknown as Record<string, unknown>;
    if (audio) {
      w.__triptownAudioLog = audio.log;
      // Read-only access for checks of the music layers.
      w.__triptownAudio = audio;
    }
    w.__triptownView = () => controller.debugState();
    w.__gateScene = () => view?.debugScene();
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
