## Context

See proposal.md for the why. The facts that shape the approach:
- **`registerGame(game, engine)`** (`packages/core/src/profiles.ts`) binds a skin to the engine's certified ids. `baseConfigId` then picks `v3-rising` or `v3` from the profile's `setbacksMode`.
- **`@triptown/crash-client`** owns the layout (`CrashScreen`), every compliance behaviour (`CrashViewBase`) and the controller.
  - A game supplies a `GameStage`. It gets the multiplier through `setMultiplier`, a per-frame `update`, `onCrash` and `reset`, and never the crash time.
  - The view also receives `frame(…, pace, …)`, where `pace` is computed from elapsed time and the config.
  - `apps/gate` is the worked example.
- **The approved canvas** (in the session scratchpad; `world2.js`, `flock.js`, `boards3.mjs`) is Canvas 2D code. The production client is PixiJS v8 on low-end Android, so the drawing is ported, not reused as is.
- **Audio rules** (project memory): each game synthesizes its own audio in its own `scripts/synth.mjs`. Nothing is copied or derived from another game. `packages/engine/src/audio.ts` is not changed for one game.

## Goals / Non-Goals

**Goals**
- The flock is the visible multiplier, sized by a pure function of the value, and works at 30 fps with up to ~230 rams on a low-end phone.
- The approved canvas's look and motion are carried into Pixi: dusk field, hero ram in a clear lane, rams catching up from behind, pull-up on pen, and the wolf and bolt.
- Audio and music that belong to Flock alone.

**Non-Goals**
- The canvas HUD is not reproduced. The shared `CrashScreen` layout is the HUD, as for every game.
- No new GameStage inputs and no `crash-client` changes. If a needed cue is missing, it is raised with the crash-client owner rather than worked around.
- No themed counter (`counterLabel` stays unset), so nothing stands beside the multiplier as a ram count.

## Decisions

### D1. A skin on whack-crash, live reveal only
`registerGame('flock', 'whack-crash')` in `apps/api/src/app.ts`, beside the other skins, with no `reveal` option. `ng-draft` and `gh-draft` therefore play `whack-crash/v3-rising`, and the unregulated `light` test profile (setbacks `halve`, boosts on) plays `whack-crash/v4`. All are committed and banded. A boost (+5%) needs no event path either: the value rises, so a few more rams join (verified by listing `effectiveConfig('flock', p)` for every template, 4 Oct 2026).

*Why:* the flock fantasy needs nothing the engine lacks. Leaving deferred reveal unregistered keeps Flock from duplicating Gate Rush's one differentiator in the same markets.

### D2. Flock size is `flockCount(multiplier)`, a pure function over a fixed slot table
- `flockCount(v) = floor(24 · ln(v)^1.6)`, taken from the canvas. That gives 0 at x1.00, 4 by x1.5, ~28 at x3, ~90 at x10, and fills the 205-place table past about x46.
- Slots are a fixed table of depth rows, with seeded jitter and a stable join order: nearest the hero first, out to the horizon last.
- The stage tracks one state per slot: out, joining, in, leaving or fleeing. Join and leave animations are transient.
- The *target* is always `flockCount(current multiplier)`. Two rounds at the same multiplier converge to the same flock.

*Why:* it satisfies the "same multiplier, same scene" requirement by construction, and `stage.test.ts` can pin it as gate's does.

*Alternative considered:* add rams by elapsed time. Rejected because the flock *is* the multiplier, and a split must shrink it.

### D3. Pace from the shared `pace`; the hero holds his place and the world scrolls
- The view passes the controller's `pace` (elapsed time and config) to the stage.
- The camera speed and the gait rate of the hero and every joined ram follow it.
- The hero stays at a fixed screen position in a lane kept clear of slots. Ground, speed lines and parallax hills scroll at camera speed.

*Why:* this is what was approved. The user's rule from the cattle round was that only the runners speed up and the world stays put, and here the runners are the flock. A slot table with a fixed hero means the lane never has to be cleared dynamically.

### D4. Pull-up waits for settlement; the wolf comes in through `onCrash` only
- CASH OUT locks the value at once, through the shared behaviour.
- The view starts the pull-up only from `showWin`, which runs after settlement: the flock decelerates and stands.
- `onCrash` brings the wolf in from ahead to a stop point clear of every ram. Joined rams switch to fleeing: flipped to face left, gait fast, fading out.

*Why:* the same tie argument as gate D4. A pull-up that started on the press and was then overtaken by a crash would play a near miss.

### D5. A split is just the target count falling
When a setback lowers the multiplier, the slots above the new count become "leaving". During a run they peel away outward and drop back while still facing forward. Once stopped, they turn and walk off.

*Why:* there is no special event path. The stage only sees the multiplier, and every ram faces the way it moves, per the user's direction-of-travel rule.

### D6. Art: SVG paths to atlas frames, one Dusk look for every skin value
- Port the canvas paths (hero ram, flock ram, wolf) into `apps/flock/art/art.mjs`. The `build-atlas.mjs` pipeline renders them to an atlas, as gate's does.
- **Ram frames:** a gallop cycle of about 8 frames and a standing frame. The hero gets his own fleece, and the flock gets near and far tones. Two rendered tones plus a Pixi tint carry the depth mix.
- **Wolf frames:** standing, plus a short entry stride.
- Flock renders the Dusk look for both the `candy` and `adult` profile skins.

*Why:* 230 Graphics redraws a frame won't hold 30 fps on the reference device, whereas atlas sprites will. The Dusk art is already the adult treatment (no faces, grown animals), so there is no candy variant to maintain.

*Alternative considered:* a candy Flock. Rejected because cartoon characters are banned outright in Ghana (GCG Underage ii) and Kenya (LN 112 reg 92(1)(d)).

*Cultural rule* (audit `docs/compliance/flock-2026-10-04.md`, fixes 1–3):
- Rams never butt, clash or square up.
- No sacrifice, slaughter, Sallah or Eid cues: the ram is the Eid el-Kabir animal in Nigeria (Lagos reg 7(1)(t)).
- The ram never faces the wolf down: no toughness framing (reg 7(1)(q)).

### D7. Audio: Flock's own synth and a score that speeds up
`apps/flock/scripts/` holds `synth.mjs` (the effects' instruments), `music.mjs` (the music and its stings, with its own instruments) and `build-audio.mjs`, all written new for this game. They produce WebM/Opus and an MP3 fallback under `apps/flock/public/assets/audio/`. A fixed `MUSIC_SEED` is pinned before the music, so re-voicing effects never changes it. Every file is listed in `SOURCES.md`.

- **The round music** follows the user's briefs: "country / ranch music, uplifting, upbeat, exciting, speeds up over time" (4 Oct 2026), "make it sound like Cotton Eye Joe", and "uplifting and sound quite good, be melodic" (5 Oct 2026). It was rewritten from scratch after seven rejected scores, all deleted.
  - "Stampede" is a hoedown on a dance floor in D major: a fiddle section plays an 8-bar hook (a two-bar call, an answer, the call again climbing higher, home to D) over a four-on-the-floor kick, claps, off-beat open hats, an off-beat bass and a banjo roll. It is rendered at four tempos (138, 144, 150 and 156 BPM), each adding to the band.
  - The fiddles are three bowed voices a few cents apart, each one continuous bow (scoops, bow changes, delayed vibrato, a fiddle-body filter). Oscillators are band-limited (PolyBLEP), the banjo is a tuned Karplus-Strong string, the bass and kick carry harmonics a phone speaker can play. The mix is glued and limited, with no saturation.
  - `src/audio/ranch-music.ts` steps up a tier on the next bar line as the shared `pace` (elapsed time) passes each threshold, carrying on from the same bar. The pitch stays fixed (user, 4 Oct 2026).
  - It plays on Howler's audio context and master gain, so the shared mute, music volume and hidden-page suspend apply to it.
  - The shared stems are silence. The shared player in `packages/engine` is not modified.
  - The lobby is 16 bars at 126 BPM: the banjo has the hook while the fiddles hold the chords, then the fiddles take it over the full groove.
- **The hooves** (user, 5 Oct 2026: a steps sound that builds up as the sheep join): `src/audio/hooves.ts` plays the hero's gallop plus three flock layers (5, 26 and 110 rams). Each layer comes in with the rams the stage has on screen, and all play at one rate that keeps step with the legs (`strideCadence`). The inputs are the on-screen count (from the multiplier) and the run speed (from elapsed time), never the crash. The shared tone is silence.
- **The effects:** a gate-latch pen, a ram-joining patter at milestones, the split, a hard band stop, a far-off wolf howl and the flock scattering, and win stingers played on the same ranch band.

*Why:* the user's standing rule that every game has its own audio, and three rejected scores (dark, then pop, then too slow) that led to the brief above. A bleat is left out on purpose, because it is the cutest sound a sheep makes. The music stays in the game: Kenya's Advertising Regs reg 9(j) bans jingles and hooks in adverts, so no Flock trailer for Kenya reuses it.

*Alternative considered:* a smooth playback-rate climb on one loop. It is cheaper on the budget, but raises the pitch with the speed, and the user asked for the pitch fixed. Four tiers fit the budget with stereo Opus at 52 kbps (constrained VBR) and a mono MP3 fallback.

### D8. Copy and the site
- The catalogue lives in `src/i18n/en.ts`, with `copy-banned.json` holding skill, speed and near-miss words.
- The site gets an `in-development` entry and a `.tile-flock` theme in Dusk colours, matching the game's wordmark. That keeps it off the deployment until the user flips it.

## Risks / Trade-offs

- **Sheep and wolf read as child-appealing** → the concept-stage audit (task 1.1) runs before any atlas art is final. The fallbacks are more silhouette, a heavier horn, and no near-flock fleece detail.
- **Sprite count on low-end Android** → the slot table is capped, far rows use the smallest frames, and frame rate is measured on the reference device (task 6.2). If it falls short, far rows become a pre-rendered band per count tier.
- **The joined flock's pace hides the speed-up** → speed lines and ground scroll carry the speed, as approved. This is checked in the demo review.
- **A view cue fired before settlement would create a near miss** → a forced-tie test asserts no pull-up frame.

## Migration Plan

This is additive. Rollback is to unregister `flock` and drop the site entry. No stored rounds, config ids or reports change.
