## 1. Pre-flight: evidence and the comparison harness

- [ ] 1.1 Record a pre-change compliance baseline: run `presentation-check` and `timing-check` for every active profile of both games, and commit the JSON under `docs/compliance/evidence/<date>/`. Verify both pass for every profile before anything is touched, so "it passed before" is recorded rather than assumed.
- [ ] 1.2 Agree and write down the pixel-comparison state list (design D5) as a committed `scripts/pixel-states.json`: betting idle, betting with the stake stepped, running at a forced multiplier, setback, boost, cashed-out above stake, returned below stake, returned even, crashed, instant bust, the min-gap countdown, the demo badge, and each of the four dialogs — for both skins. Verify a reviewer signs off the list before any baseline is captured.
- [ ] 1.3 Build `scripts/pixel-compare.mjs` on `playwright-core`: drives a game's demo build with `?force=`, forces `prefers-reduced-motion`, walks `pixel-states.json` at 390×844 and 1440×900, and writes one PNG per state. Verify running it twice against an unchanged build produces zero diffs above the tolerance.
- [ ] 1.4 Add a `--baseline` / `--against <dir>` mode that reports a per-state pass/fail table and a non-zero exit on any structural difference. Verify it fails when pointed at a build with one control deliberately shifted 2 px, and passes on an unmodified rebuild.

## 2. Corrections that change what a build displays

Each task in this group is its own commit with before/after evidence, landed before the refactor that would hide it (design D6).

- [ ] 2.1 Fix Gate's below-stake result line so a loss states a negative net, matching Whack. Verify by settling a Gate round below the stake and reading the result line; capture before/after screenshots into the compliance evidence folder.
- [ ] 2.2 Replace "Bad moles" / "Good moles" in `packages/crash-client/src/dom/history-panel.ts` and "Bad / good moles" in `fairness-panel.ts` with catalogue keys defaulting to the model's words. Verify by opening both panels in Gate and confirming no mole vocabulary appears, and in Whack that the game may still override the wording.
- [ ] 2.3 Make the four DOM panels (`rules`, `history`, `fairness`, `overlay`) read `theme.ts` instead of hard-coded hexes and display face. Verify by loading an `adult`-skin profile and opening each of the four dialogs: each is drawn in the adult palette, and the `candy` renders unchanged against a screenshot taken first.
- [ ] 2.4 Add `escapeHtml` to `history-panel.ts` for every interpolated value, notably the player-controlled client seed. Verify a client seed containing HTML renders as text and executes nothing.
- [ ] 2.5 Add the release-manifest step to Gate's `build` and the build hash to Gate's `loadAtlas` call. Verify a Gate production build writes a manifest and that the atlas request carries the build identifier.
- [ ] 2.6 Re-run `presentation-check` and `timing-check` for every active profile of both games and commit the evidence. Verify every profile still passes after the corrections.
- [ ] 2.7 Capture the pixel baseline for both games at both viewports with `scripts/pixel-compare.mjs --baseline`. Verify every state in `pixel-states.json` produced an image.

## 3. One message catalogue

- [ ] 3.1 Add `BASE_EN` to `packages/crash-client/src/i18n.ts` covering every key the shared client looks up, using the 32 byte-identical values as defaults. Verify a test asserts every `t('...')` literal in `packages/crash-client/src` resolves in `BASE_EN`.
- [ ] 3.2 Move the single `t()` into `crash-client` with Whack's missing-parameter behaviour (a missing parameter stays visible) plus a dev-mode warning (design D7). Verify unit tests cover a missing key, a missing parameter and a present parameter.
- [ ] 3.3 Reduce `apps/whack/src/i18n/en.ts` and `apps/gate/src/i18n/en.ts` to their own words spread over `BASE_EN`, and delete Whack's 11 dead `error.*` keys. Verify `pnpm --filter @triptown/whack build && pnpm --filter @triptown/gate build` succeed and no raw key renders in any panel.
- [ ] 3.4 Move the player-protection overlay copy (operator pause, game closed, operator message, idle prompt) out of both `main.ts` files into `BASE_EN`. Verify each prompt still displays identically by triggering all four through the operator bridge.
- [ ] 3.5 Run `pixel-compare` against the baseline for both games. Verify zero differences.

## 4. One build layer

- [ ] 4.1 Create `packages/game-build` (Node-only, no browser imports, not a runtime dependency of any app). Verify `pnpm lint typecheck` passes for the new package and that no app bundle gains a dependency on it.
- [ ] 4.2 Move `svg()`, the shared icon set and the particle sprites (`star`, `coin`, `puff`, `starburst`) into an art kit, keeping every game's own shapes in its own `art.mjs`. Verify both games' atlases rebuild byte-identical to the committed PNG and JSON.
- [ ] 4.3 Extract `packAtlas()` from the two `build-atlas.mjs` copies, adopting Gate's `buildSprites(skin)` parameter form over Whack's mutable `useSkin()` global. Verify each app's `atlas` script produces byte-identical output to the committed files.
- [ ] 4.4 Extract the nine duplicated DSP primitives into a synth kit, taking Gate's loop-seam-safe `lowpass` (design D9). Verify each game's `audio` script produces byte-identical output to the committed audio, confirming Whack's sounds are unchanged by the better filter.
- [ ] 4.5 Extract `buildAudioBundle()` from the two `build-audio.mjs` copies, leaving each game only its effects map and loop table. Verify both games' audio manifests and files rebuild byte-identical.
- [ ] 4.6 Move `check-no-mock.mjs` and `check-audio-budget.mjs` to root `scripts/` and point both apps at them; fix the stale "whack-game-client spec" comment. Verify a deliberately mock-tainted build of each game fails the gate.
- [ ] 4.7 Add root `vite.game.config.ts` and `tsconfig.game.json`; reduce each app's files to a thin extension carrying only its port and title. Verify both games build and typecheck, and that the demo builds still run.
- [ ] 4.8 Run `pixel-compare` against the baseline for both games. Verify zero differences.

## 5. The shell learns Whack's presentations

- [ ] 5.1 Add the declared-presentation hook to `CrashScreen`, defaulting to today's fixed-frame portrait (design D1). Verify Gate declares nothing, and a test asserts a game declaring nothing gets the current fit at every viewport.
- [ ] 5.2 Replace the module constants `W`/`H` in `layout()` with a resolved frame, keeping every portrait expression character-for-character (design D2). Verify Gate's `pixel-compare` shows zero differences at 390×844.
- [ ] 5.3 Add the elastic portrait fit, porting Whack's `applyViewport` clamp and the reason recorded in its comment. Verify a game declaring it fills the width at 390×844 and 390×720 with no side margins, and that Gate is unaffected.
- [ ] 5.4 Add the desktop placement branch and its frame. Verify a game declaring it shows the stake controls beside a larger stage at 1440×900, every control reachable in portrait is reachable, and Gate at 1440×900 is unchanged against its baseline.
- [ ] 5.5 Add `stageFrame()` and the tweened stage-height seam, plus `GameStage.resize(width, height)` as an optional member. Verify `GateStage` compiles unchanged and Gate's scene still fills its frame.
- [ ] 5.6 Move Whack's `sharpenText` and the multiplier / result-card text auto-shrink into `CrashScreen` (design, Risks). Verify a long multiplier and a long payout fit their boxes in both games without clipping.
- [ ] 5.7 Add the secondary-control seam so a game can offer the practice button `CrashViewBase` already supports, disabled by the min-gap countdown. Verify the countdown disables both controls and restores both.
- [ ] 5.8 Add the effects-layer lifecycle (`trackFx` / `resetStageFx`) to `CrashScreen`, replacing Gate's hand-rolled clear. Verify Gate's milestone badges still clear between rounds and `pixel-compare` shows zero differences.
- [ ] 5.9 Move the milestone badge and flying mini-number animation into `CrashScreen`, taking a per-game tier table (audit item 6). Verify both games' milestone pops are unchanged against the baseline at x1.5, x3, x5, x10 and x25.
- [ ] 5.10 Run `pixel-compare` and both compliance checks for Gate across every active profile. Verify zero pixel differences and both checks pass.

## 6. One bootstrap

- [ ] 6.1 Move `createRoundService()` and `demoBetMinor()` into `packages/rgs-client` with a per-game demo-profile hook (design D8). Verify the mock is still reachable only behind the demo flag through a dynamic import, and that a production build of each game fails the mock gate when tainted.
- [ ] 6.2 Add `bootCrashGame()` to `crash-client` covering translator installation, fonts, atlas and audio loading, panel construction and the player-protection prompts. Verify both games boot through it and complete a round.
- [ ] 6.3 Reduce both apps' `main.ts` to their own configuration only. Verify neither file contains a copy of the boot sequence, and both games still load fonts, atlas, audio and all four panels.
- [ ] 6.4 Collapse the three copies of the `beat-the-gate` registration (`apps/api/src/app.ts`, `apps/gate/src/main.ts`, `apps/gate/src/services.ts`) to one shared fact. Verify client and server agree on the reveal mode in a deferred-reveal round.
- [ ] 6.5 Run `pixel-compare` and both compliance checks for both games. Verify zero differences and all checks pass.

## 7. Whack's scene becomes a GameStage

- [ ] 7.1 Add `setIntensity(level)` to the `GameStage` contract, documented as the readout the player can already see (design D4). Verify the contract's doc states that the crash time, the time remaining and future modifiers never reach a scene.
- [ ] 7.2 Create `WhackStage implements GameStage`, moving the holes, the meter, the decoys and the stage scaling from `view.ts:945-994` and `ui/stage.ts` inside it. Verify it compiles against `GameStage` with no cast.
- [ ] 7.3 Move Whack's scene choreography into the stage: the idle bob and decoy pops, the setback and boost moments, the hammer swing and contact, the coins, the stars and the BONK. Verify each plays identically against the baseline states.
- [ ] 7.4 Route Whack's spin speed through `setIntensity` with the same value the meter renders, replacing the `pace` path. Verify the meter and the scene agree at every intensity, and that the scene is unchanged against the baseline during a setback.
- [ ] 7.5 Assert the no-advance-warning property directly: a test that drives a scene through a round and asserts no crash time, time-remaining or future-modifier value is ever passed to it. Verify the test fails if such a value is reintroduced.
- [ ] 7.6 Run `pixel-compare` for Whack with the stage swapped in behind the existing view. Verify zero differences.

## 8. Whack onto the shell

- [ ] 8.1 Implement the four contract members Whack lacks — `setDisclosures`, `setAudioAvailable`, `setRevealOdds`, `showHeadingHome` — and verify the withholding notice appears on a settled winning round under a profile that requires it, and that a blocked-audio session shows the sound control as unavailable.
- [ ] 8.2 Change `GameView` to `extends CrashScreen`, supply Whack's `ScreenWords`, declare its elastic portrait and desktop presentations, and pass `WhackStage`. Verify it compiles and a round plays end to end.
- [ ] 8.3 Delete the duplicated layout, HUD wiring, bet-panel wiring, result-card presentation, replay labelling and side-control policy from `view.ts`, including the locally re-derived celebrate decision that bypasses `resultPresentation`. Verify `grep resultPresentation apps/whack` now hits, and that no `celebrate` is computed in game code.
- [ ] 8.4 Delete the dead `setWonPayout` (no callers, and it writes an unconditional `+`). Verify nothing references it.
- [ ] 8.5 Remove the half-present auto-cash-out row Whack builds, wires and then hides, using the shell's `hasAutoCashout()` instead. Verify the stake box widens exactly as the shell does it and the controller sends no auto target.
- [ ] 8.6 Run `pixel-compare` for Whack at 390×844 and 1440×900 across every state and both skins. Verify zero structural differences against the baseline captured in 2.7 — this is the central claim of the change.
- [ ] 8.7 Run `presentation-check` and `timing-check` for every active Whack profile and diff against the 2.6 evidence. Verify identical results.

## 9. The site's tile becomes data

- [ ] 9.1 Add `tile` colours to the catalogue `Entry` and emit them as CSS custom properties from `LogoTile`, replacing the `TileTheme` union with one generic `.tile` rule (design D10). Verify both existing tiles render identically against a screenshot taken first.
- [ ] 9.2 Update `checks.ts` so a live entry must carry tile colours, and add a test that a new entry needs no stylesheet edit. Verify the site build fails for a live entry with no tile colours.
- [ ] 9.3 Run `pnpm --filter @triptown/site check:layout`, `check:motion` and `e2e`. Verify all pass and the 18+ gate still refuses every file under `/play/`.

## 10. Release verification

- [ ] 10.1 Run `pnpm lint typecheck test` across every touched package. Verify all pass.
- [ ] 10.2 Run `pnpm build` from the root, including the site's turbo pipeline. Verify both games' demo builds are produced, both emit a release manifest, and the site assembles them.
- [ ] 10.3 Confirm no mock marker is in either production bundle and both DEMO badges show in the demo builds. Verify by grepping each bundle and loading each demo.
- [ ] 10.4 Count the lines removed and confirm the duplication the audit measured is gone: the two build gates, the two config files, the DSP primitives, the bootstrap, the catalogue defaults and Whack's duplicated screen. Verify by listing the deleted files and the remaining per-game line counts.
- [ ] 10.5 Write the change into the compliance record: the five corrections, the evidence for each, and the pixel-identity result for the migration. Verify the record names every regulated build whose display changed.
- [ ] 10.6 Update `AGENTS.md` so its description of the architecture matches the code — both games are now skins, and the worked example is no longer only Gate. Verify the claim "a game is a skin, not a product" is true of every app in the tree.
