## 1. Compliance gate and design sources

- [x] 1.1 Run the `game-compliance-audit` skill, concept stage, on Flock for the profile set (`light`, `ng-draft`, `gh-draft` and the BR/PT templates). Cover:
  - a flock of sheep and a wolf against CAP under-18 §13/§14, including the "cuddly animals" and fairy-tale examples;
  - PT R7c, BR 1.231 and Kenya reg 95;
  - harm imagery at the crash and near-miss risk in the pen and wolf sequences;
  - vocabulary, and the split under setbacks.

  Verify `docs/compliance/flock-<date>.md` exists and its critical fixes are folded into this change before atlas art is final.
  - Done 2026-10-04: `docs/compliance/flock-2026-10-04.md`, re-scoped by the user to Nigeria, Ghana and Kenya. No rule on sheep, rams or wolves in any of them. Fixes folded into the spec (life-like art, no ram fights or festival cues, no toughness framing), design D6/D7, tasks 3.2/4.1/7.1 and `copy-banned.json`. Kenya reg numbering (92, LN 112) and Lagos reg 7 letters corrected in `jurisdictions.md` and AGENTS.md.
- [x] 1.2 Copy the approved canvas sources into `design/flock/`: `world2.js`, `flock.js` and the board generators, with a README linking the canvas. Verify `ls design/flock` lists them and the README names the approved page.
  - Done 2026-10-04: `design/flock/` has `world2.js`, `flock.js`, `build.mjs` (regenerates `boards/`) and a README linking the approved page.

## 2. Register the game

- [x] 2.1 Register `flock` on the `whack-crash` engine in `apps/api/src/app.ts`, with no reveal option. Verify a test asserts that `effectiveConfig('flock', p)` equals `effectiveConfig('whack-crash', p)` for every shipped profile, and that `effectiveReveal` is `live` under a profile with `crashReveal: 'onCollect'`.
  - Done 2026-10-04: `apps/api/src/app.ts` registers it; `apps/api/src/flock-registration.test.ts` passes (3 tests). Hosts come from `registeredGames()`, so no host map edit was needed.
- [x] 2.2 Confirm no new config id and no new report. Verify `git status packages/fairness/reports/` shows no change from this work after a full test run.
  - Done 2026-10-04: `pnpm --filter @triptown/api test` 107/107 passed; `git status packages/fairness/reports/` is clean.

## 3. `apps/flock` scaffold

- [x] 3.1 Create `@triptown/flock`, modelled on `apps/gate`'s package shape:
  - Vite + PixiJS v8 on `@triptown/crash-client`, port 5179;
  - the catalogue set through `setTranslator`, and `Logo` FLOCK;
  - `services.ts` with the mock only under `VITE_DEMO`;
  - `build:demo` with a DEMO label;
  - the `check-no-mock` and audio-budget scripts.

  Verify `pnpm --filter @triptown/flock build` passes `check-no-mock.mjs` and the dev server shows an empty stage.
  - Done 2026-10-04: `apps/flock` (port 5179) on the shared client. `pnpm --filter @triptown/flock build` reports "No mock code in 15 bundle files"; the demo build serves the full scene at 390x844 (fonts Anton and Bricolage Grotesque).
- [x] 3.2 Add the message catalogue in `src/i18n/en.ts`:
  - CASH OUT, CASHED OUT, WOLF and RUN OVER (PEN THEM and PENNED until 5 Oct 2026, replaced as confusing);
  - the rules text with the decoration statement and the split explanation;
  - the withholding keys.

  Add `copy-banned.json` with skill, speed and near-miss words (`faster`, `hurry`, `close call`, `nearly`; `almost` is already banned by the shared check), harm words (`caught`, `killed`, `eaten`, `lamb`), and toughness words (`brave`, `fearless`, `tough`, `bold`; Lagos reg 7(1)(q)). Verify `pnpm --filter @triptown/flock check:copy` passes and fails on a fixture containing "almost".

  - Done 2026-10-04: catalogue in `src/i18n/en.ts`; `copy-banned.json` also carries the audit's harm and toughness words. `check:copy` passes; a fixture line "So brave, almost penned" fails it on both words.
## 4. Art

- [x] 4.1 Port the hero ram, flock ram and wolf paths from `design/flock/` into `apps/flock/art/art.mjs`:
  - a gallop cycle of about 8 frames and a standing frame for the hero and for the flock's near and far tones;
  - wolf standing and entry frames;
  - ground, hills and fence tiles.

  Add `build-atlas.mjs`, and keep a checklist in `art/CHECKLIST.md` against the adult-art requirement (horn, nose, fleece, no eyes or face, no lamb), the life-like test (realistic proportions, muted palette, no exaggerated features; GH Underage ii, KE reg 92(1)(d)), and the cultural rule (no butting rams, no sacrifice or festival cues; Lagos reg 7(1)(t)). Verify the atlas files are committed and the checklist is filled.

  - Done 2026-10-04 (placeholder art): `art/art.mjs` ports the canvas paths; `pnpm atlas` writes `atlas-dusk` (41 frames, 2048x2048): hero and flock stand, brake, 8 trot and 8 gallop frames each, wolf stand and 4 stride frames. Checklist filled in `art/CHECKLIST.md`.
## 5. Stage

- [x] 5.1 Build `FlockStage` implementing `GameStage`:
  - the slot table and stable join order;
  - `flockCount(multiplier)`;
  - per-slot join and leave state, with joiners running in from the left facing right;
  - the hero fixed in his clear lane;
  - parallax ground, hills and fence;
  - reduced motion (fades) and `intensityEffects`.

  Verify `stage.test.ts` asserts:
  - `flockCount(1) === 0` and `flockCount(1.5) >= 1`, non-decreasing;
  - two stages fed the same multiplier sequence to x4.00 hold identical slot states once settled;
  - no slot rectangle overlaps the hero's lane at the largest flock.
  - Done 2026-10-04: model in `src/game/flock.ts` (205 slots, join order, per-slot states, hero lane), drawn by `src/game/stage.ts`. `flock.test.ts` pins `flockCount(1) = 0`, company before x1.50, monotonic, full field by x50; two different paths to x4.00 settle into identical slot states; no slot in the hero's lane.
- [x] 5.2 Drive the running pace from the view's `pace`: camera speed, hero and flock gait rate, speed lines and dust. Verify a test asserts the scene's pace state is a function of the `pace` input only, and the dev demo shows the flock speeding up with the world scrolling under it.
  - Done 2026-10-04: `FlockView.frame` passes the shared `pace` to the stage; run speed, gait rate, speed lines and dust follow it. `flock.test.ts` "the run speed follows the shared pace and nothing else" (x1.2 and x9 at the same pace run at the same speed). Seen in the demo: speed 251 at x1.46, 389 at x4.32.
- [x] 5.3 Split under setbacks: when the multiplier falls, the excess slots leave, peeling outward and dropping back while facing forward during a run. Verify a test feeds x3.00 then x1.50 and asserts the in-flock count settles to `flockCount(1.5)` and every leaving ram faces right while the camera runs.
  - Done 2026-10-04: `flock.test.ts` feeds x3.00 then x1.50: exactly `flockCount(3) - flockCount(1.5)` rams leave, all facing right while the run goes on, and the flock settles to `flockCount(1.5)`.
- [x] 5.4 Pen and wolf sequences:
  - the view starts the pull-up only from `showWin`;
  - `onCrash` brings the wolf in to a stop point clear of every ram, and the flock flees facing left;
  - `reset` clears both.

  Verify a forced tie (press and crash in the same tick) records no pull-up frame and shows the wolf and the scatter, and that the wolf sprite is never visible before `onCrash`.

  - Done 2026-10-04: `stage.test.ts`: the wolf stays hidden for a 60 s round until `onCrash`; a lost tie goes running → crashed with no pull-up and every ram gone; `pullUp` is called once, from `showWin` only. The wolf stops `WOLF_GAP` = 55 px clear of the hero's nose (demo screenshot, forced `quickCrash`).
## 6. View, audio and checks

- [x] 6.1 `FlockView` extends `CrashScreen`. It supplies the stage, the words and the pull-up and scatter cues. It has no result-kind, disarm or countdown logic, and calls the base's celebrate decision for any win effect. Verify `grep -n resultKind apps/flock/src` finds nothing, `presentation-check.mjs` passes under `light` and `ng-draft`, and `timing-check.mjs --profile ng-draft --min-ms 5000` passes, with evidence under `docs/compliance/evidence/<date>/`.
  - Done 2026-10-04: `src/game/view.ts`; `grep resultKind apps/flock/src` finds nothing. presentation-check PASS under `light` (win celebrated; below stake after a setback, even and crash not) and `ng-draft` (win celebrated, crash not; below-stake and even UNREACHABLE: setbacks off, minimum x1.01). timing-check `ng-draft` PASS: 20 starts, worst gap 5,030 ms, hold-to-repeat false. Evidence: `docs/compliance/evidence/2026-10-04/flock-{presentation-check-light,presentation-check-ng-draft,timing-check}.json`.
- [x] 6.2 Write Flock's own audio from scratch in `apps/flock/scripts/synth.mjs` and `build-audio.mjs`:
  - a hoof loop following pace;
  - a dusk music bed whose layers follow the multiplier;
  - join, pen, wolf-and-scatter and win sounds.

  Pin `MUSIC_SEED`, list every file in `public/assets/audio/SOURCES.md`, and play through the unchanged shared player. Verify:
  - the audio budget check passes (≤ 1.5 MB);
  - the win sound plays only on a result the base celebrates;
  - `git status apps/whack apps/gate packages/engine` is clean after the audio build.
  - Done 2026-10-04: synthesized from scratch in `scripts/synth.mjs` and `build-audio.mjs` (encoded with ffmpeg). 969.7 KB of the 1,500 KB budget; `SOURCES.md` lists every file. `win` played only on the celebrated result in both presentation checks. `git status apps/whack packages/engine packages/crash-client` is clean; the only change in `apps/gate` is another session's edit to `view.ts`, which predates this work. Not yet heard by the user: task 6.4.
  - Re-scored 2026-10-04 after the user's review ("very dark. All games should be thrilling, uplifting"): D major at 132 BPM, D–A–Bm–G loop with a V turnaround, four-on-the-floor hand drums with claps, a bouncing bass, a whistle lead; a warm lobby; and the win sting moved from D minor to D major. 955.2 KB of the budget.
  - Re-scored again 2026-10-04 ("It has to sound like country music, ranch, etc very uplifting"): bluegrass in G major at 128 BPM. The bed is an upright bass and boom-chick guitar on G–C–G–D; the second layer adds a brushed train beat and banjo rolls; the top layer is a fiddle hoedown. The lobby is fingerpicked guitar; bet, win and bigwin are re-voiced on the same band. New instruments in `synth.mjs`: banjo, fiddle, strum, upright, brush. 1,013.7 KB of the 1,500 KB budget.
  - Faster on request ("much faster. Something like the horse game"): 168 BPM, 16 bars (A and B parts), stems encoded at 32 kbps Opus / 48 kbps MP3. Gate Rush's tempo was read only as a number (150 BPM), with no audio, code or synth reused. 1,182.6 KB of the budget.
  - Rebuilt from scratch 2026-10-04 on the user's brief ("country / ranch music, uplifting, upbeat, exciting, speeds up over time"): `scripts/score.mjs`, a western two-step in five tiers (140→188 BPM, the last up a whole step), played by `src/audio/ranch-music.ts`, which steps up a tier on a bar line as the shared pace passes each threshold. `ranch-music.test.ts` (5 tests) pins the tier choice and the bar-line switch. In the demo, a long round climbed tiers 1→4 by 11 s and stopped at the crash. presentation-check under `light` still passes. 1,294.9 KB of the budget.
  - Faster start ("still too slow at start"): the tiers are now 168, 178, 188, 198 and 210 BPM, with the train-beat snare from the first bar and a stomp on every beat from tier 4. 1,176.7 KB of the budget.
  - Lobby rebuilt ("too stale, weak"): a 150 BPM two-step in D major with a fiddle tune, banjo rolls and the full rhythm section, in place of the 112 BPM pedal-steel shuffle. RMS 0.10 → 0.20. 1,129.6 KB of the budget.
  - Third score, from scratch on both the round and the lobby ("still not great. Start from scratch"): a stereo line-dance hoedown. Four-on-the-floor kick, claps, hats, eighth-note bass, banjo rolls and a fiddle riff in A; five tiers at 168, 176, 184, 192 and 204 BPM; the lobby a banjo tune in D at 150 BPM. Encoded at 56 kbps stereo Opus with a 48 kbps MP3 fallback (the mono 32–40 kbps encodes had made every earlier score sound thin). Tiers climb 1→4 by 12 s in the demo; presentation-check `light` PASS. 1,300.9 KB of the budget.
  - Restyled on request ("make it sound like Cotton Eye Joe"): the eurodance hoedown, with the kick pumping the band, an offbeat octave bass, and an original fiddle riff in A mixolydian over A–G (no melody or recording of the song used). The lobby is the same stomp in D at 150 BPM. Tier ladder unchanged. 1,327.7 KB of the budget.
  - Rewritten from scratch again ("still sounds disgusting ... not even catchy"). The user declined reuse of Gate's toolkit. New band-limited instruments in `scripts/band.mjs` (the old naive-saw oscillators aliased) with compressor and limiter glue. The round is "Run With Them", a 16-bar fiddle tune in D at 168 BPM in two stems (core and lift); the lobby is "Pen Gate Duet", a banjo/fiddle call and answer in G at 150 BPM. `ranch-music.ts` now raises the playback rate 1.0 → 1.22 and fades the lift in with pace (`ranch-music.test.ts` rewritten, 2 tests). In the demo: rate 1.13 and lift full by 10 s. presentation-check `light` PASS. 1,253.3 KB of the budget.
  - Pitch fixed ("keep the pitch fixed when it speeds up"): the rate climb is replaced by four tiers (168, 180, 192 and 205 BPM) switched on bar lines; `ranch-music.test.ts` covers tier choice and the bar-line switch (4 tests). In the demo: 168 → 180 → 192 BPM within 9 s. 1,333.5 KB of the budget.
  - Rewritten from scratch 2026-10-05 ("erase everything ... it has to be uplifting and sound quite good, be melodic"): `score.mjs` and `band.mjs` deleted. New `scripts/music.mjs`, "Open Range" in A major: tuned Karplus-Strong guitars and banjo (the old strings were out of tune at the top), an additive lead with a picked twang, reverb and echo sends, kick ducking, glue and limiter. Four tiers at 168, 180, 192 and 204 BPM, each adding layers; the lobby is the tune whistled at 140 BPM. Round −13.2 LUFS, lobby −14.5 LUFS. 1,435.4 KB of the budget.
  - Hooves that build up with the flock (user idea, 2026-10-05): `src/audio/hooves.ts`, four layers (the hero, then 5, 26 and 110 rams) mixed in by the stage's on-screen count and re-rated to the legs; `hooves.test.ts` (4 tests). In the demo: hero only at x1.07, then layers 1, 1, 0.31 at 18 rams, then 1, 1, 1, 0.34 at 87 rams, with the rate 0.76 → 1.38. The shared tone is now silence; lobby Opus 48 → 44 kbps to fit. 1,493.8 KB of the budget.
  - Rewritten from scratch again 2026-10-05 ("scratch all the music again, retry from scratch"): "Open Range" deleted. New `scripts/music.mjs`, "Stampede", a hoedown dance in D after the "Cotton Eye Joe" brief: a three-voice bowed fiddle section on an 8-bar hook, banjo rolls, four-on-the-floor kick, off-beat bass and hats, claps. Tiers at 138, 144, 150 and 156 BPM, 8-bar loops; the lobby is 16 bars at 126 BPM. Round −13.4 LUFS, lobby −14.8 LUFS. Tiers at 64 kbps Opus / 40 kbps mono MP3, the lobby at 56 / 32. 1,371.0 KB of the budget.
  - Demo feedback 2026-10-05:
    - A new start-round cue (0.75 s: banjo pickup into one band hit), so it no longer clashes with the round music.
    - A new crash cue: a hard band stop, a far-off howl and the flock scattering.
    - `src/audio/flock-audio.ts` holds the lobby until a result cue ends, less 300 ms, so the lobby fades in under the howl's tail. In the demo the crash was at 4.24 s and the lobby started at 6.59 s.
    - The control column hides while a round runs (`hideControlsInRound`), the same as every other game.
    - No auto cash-out for now (`hasAutoCashout` false).
    - The shared `Logo` centres a one-word mark (no gap left for an empty second word).
    - 1,357.2 KB of the budget.
    - Betting says READY? (64 px, so it fits the frame) instead of x1.00, as in the other games; nothing is shown under the money while a round runs.
    - "PEN" read as confusing (the user): the button is now CASH OUT and the result CASHED OUT, and every rules and status line follows. copy-check PASS.
    - The flock waits on the field (design "Flock — the flock waits", https://claude.ai/artifact/E6NsQaEGRcZ6q62nUHuLbL, approved).
      - Every round starts from a grazing herd of 70 rams round him (new `flock-graze` frame, atlas rebuilt), a replay from the result too.
      - Only he sets off; the herd is left standing as the camera goes with him.
      - It is scenery: never counted in `present()` (so the hooves ignore it), with no part in `flockCount`. The rams that join still come from the multiplier alone.
      - Pinned by four tests in `stage.test.ts` (28 in all).
      - In the demo, a replay from the result screen showed 70 grazing, 61 at x1.09 with nobody beside him, and 3 at x1.46 with 5 beside him.
 in place of the value, and the controls are one centred row under it, on the betting screen and the result (design "Flock — result on top", https://claude.ai/artifact/Ao4nwh4kjytDPf8gj2Cf5E, approved). This is Flock's `FLOCK_LOOK`; the shared screen is unchanged. layout-check: no two boxes intersect in any state. It still exits FAILED, only on its edge-to-edge row rule (the DEMO badge, and the centred control row the design asks for).
- [x] 6.3 Check the layout at 390×844 and 1440×900 with `layout-check.mjs`. Verify the evidence is written under `docs/compliance/evidence/layout/flock` and the hero is unobstructed by the HUD.
  - Done 2026-10-04: evidence in `docs/compliance/evidence/layout/flock/` (six state screenshots). No two HUD boxes intersect in any state. The check still exits FAILED on its side-margin rule (rows must span 14..376), which only a gridded look can meet: the failing rows are the shared `CrashScreen` default layout (centred value, right-hand control column, DEMO at x 12), not anything Flock adds. The hero stays clear of the HUD at 390x844 and in the letterboxed 1440x900 frame.
- [ ] 6.4 Show the playable demo to the user at 390×844, with audio, before any polish beyond the canvas. Verify the user's go/no-go is recorded here.

## 7. Site and closing checks

- [x] 7.1 Add Flock to the studio site:
  - an `in-development` catalogue entry;
  - logo words;
  - a `.tile-flock` theme in the Dusk palette, matching the game's wordmark;
  - its `build:demo` in `@triptown/site#build` in `turbo.json`.

  Verify `pnpm turbo run build --filter=@triptown/site` passes its copy and tile checks, and the game is absent from the live listing while `in-development`. No Flock tile, link or trailer goes public before ARCON, GCG or GRA vetting (audit fix 4).
  - Done 2026-10-05, as a `live` entry on the user's instruction ("make sure you also add this to the website"). On this site `in-development` would take it off entirely.
    - It is held to the same terms as Whack Crash and Gate Rush: behind the 18+ gate, unindexed, B2B only. Audit fix 4 still applies to anything beyond that.
    - Tile `flock-dusk`: the dusk sky, the low sun, the dirt field and the one-word orange sticker in Anton, with no ram and no wolf. The site's sticker no longer leaves a gap for an empty second word.
    - `build:demo` added to `@triptown/site#build`.
    - `check-site` ok (3 entries), 75 site tests, `e2e` all passed (its counts now follow the live games; its atlas check accepts Gate Rush's `atlas-track`, which it had been failing on since the Dirt Track default), `check:layout` and `check:motion` PASS. The demo opens from the site with the herd grazing.
- [x] 7.2 Update `AGENTS.md` with `apps/flock` in the layout and the skin list. Verify the layout section matches `apps/`.
  - Done 2026-10-04: `flock/` added to the AGENTS.md layout and to the skin examples (`registerGame('flock', 'whack-crash')`, live reveal only).
- [x] 7.3 Run the full gate. Verify `pnpm turbo run lint typecheck test` passes for every package.
  - Done 2026-10-04: `pnpm turbo run lint typecheck test --concurrency=2` 33/33 tasks successful, exit 0; re-run for `@triptown/flock` after Prettier, green. Note: one `@triptown/api` test failed once when api and flock ran in parallel (the suite ran 2x slower); alone it passes 107/107 three times. Its name was not captured: a timing-sensitive test under load, not a Flock change.
- [ ] 7.4 Measure frame rate with the largest flock on the reference low-end Android device. Verify ≥30 fps is recorded under `docs/compliance/evidence/<date>/`.
- [ ] 7.5 Re-run the compliance audit on the built game. Verify the report marks each concept-stage fix PASS or records why it is deferred.
