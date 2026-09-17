## 1. Gate

- [x] 1.1 Run the `game-compliance-audit` skill on The Lift, concept stage, Nigeria and Ghana in depth; verify a dated report exists at `docs/compliance/the-lift-<date>.md` and that its critical fixes are folded back into this change before any art is final. Nothing below starts until this is read
- [x] 1.2 Confirm with the `beat-the-gate-mvp` session that the `ng-draft`/`gh-draft` profiles and the NGN/GHS currency rules have landed in `core`; verify `profileFromTemplate('ng-draft')` resolves and `validateProfile` passes for both

## 2. Extract the game-neutral client

- [x] 2.1 Agree the sequencing with the session running `compliance-baseline` groups 5-9 before moving a file; verify in writing that `apps/whack/src/ui/**` and `game/controller.ts` are not being edited during the extraction window
- [x] 2.2 Move `ui/hud.ts`, `ui/primitives.ts`, `theme.ts` and `game/display.ts` into the shared crash-client package unchanged. `ui/stage.ts` STAYS in `apps/whack` — it is the mole stage (47 game-specific references in 264 lines), and each game brings its own; verify `pnpm turbo run lint typecheck test` is green and `git diff` shows the moved files byte-identical apart from import paths
- [x] 2.3 Move `game/controller.ts` and `game/display.ts` into the shared package **whole** — it now holds the player-protection state machine (pause/resume, closeGame, stake and loss limits with the `loss_limit` event, idle prompt, session clock, net position, operator-bridge lifecycle, latency probe), none of which is game-specific; verify `display.test.ts` passes unmoved and `apps/whack` still plays a full round in the demo build
- [x] 2.4 Split `game/view.ts` rather than leaving it whole: the four compliance behaviours inside it move to a shared view — `showWin(multiplier, payout, big, kind, net)` splitting presentation on `resultKind` (RTS 14F), `disarm()`/`isArmed` with the keyup and pointerup listeners (RTS 14G release-and-press), `setBetCountdown`'s snapshot-and-restore of the action button (a countdown must not leave the control disabled or overwrite a result label), and `setPresentation({ quickReplay, intensityEffects, setbacks, boosts })`. Only art and scene stay per game. Verify each of the four is called through the shared view in both games, and that `presentation-check.mjs` and `timing-check.mjs` pass for a game that implements no compliance logic of its own
- [x] 2.5 Confirm the shared package is game-neutral; verify no symbol named for a mole, burrow, decoy, lift, shaft or floor appears in it
- [x] 2.6 Preserve the demo-only hooks the shared checks depend on, `window.__triptownAudioLog` and `window.__triptownView` (compliance-baseline design D24), through the move; verify they are still present in a demo build of `apps/whack` and absent from the production bundle
- [x] 2.6a Make the shared check harness fail loudly instead of passing vacuously: assert the hooks exist and that each scenario reached a `settled` round before it may report a pass. A missing hook or an unsettled round is a FAILURE, never a silent skip — `presentation-check` passed trivially for an afternoon during `compliance-baseline` because the round never settled. Verify by deleting a hook in a scratch build and confirming the check fails rather than passing
- [x] 2.7 Confirm the extraction changed no behaviour; verify `presentation-check.mjs`, `timing-check.mjs` and `copy-check.mjs` give identical results before and after the move

## 3. Register the game

- [x] 3.1 Register The Lift on the Whack Crash engine and add it to the API's host map; verify a test asserts `effectiveConfig('the-lift', p)` equals `effectiveConfig('whack-crash', p)` for every shipped profile (spec: The Lift plays a certified engine's configuration)
- [x] 3.2 Confirm no new configuration id and no new report; verify `git status packages/fairness/reports/` is clean after a full test run, and that a profile resolving The Lift to an id without a passing report refuses to start a round

## 4. `apps/lift`

- [x] 4.0 Checked: The Lift needs no atlas at all. Its shaft is generated at runtime as Pixi `Graphics` and `TilingSprite` textures, so there are no sprite frames to pack and the `art.mjs` + `useSkin` + atlas pipeline has nothing to do. It still honours the profile skin through the shared `useSkin`, which is where the palette lives. A game with character art would use the pipeline; this one does not have any
- [x] 4.1 Create `@triptown/lift`: Vite + PixiJS v8 consuming the shared client, `services.ts` picking `MockRoundService` only under `VITE_DEMO` through a dynamic import, `build:demo`, and a visible DEMO label; verify `pnpm --filter @triptown/lift build` passes `check-no-mock.mjs`
- [x] 4.1a Keep the car empty and keep it empty everywhere (audit fix 1): no rider, silhouette or hand at the glass, in the game, the tile and the trailer. Portugal Reg. 308/2023 Rule 7(b) protects the dignity and integrity of persons, and this is the single line separating the JetX family from games with no regulated-market presence. Verify by a review of every art asset, recorded in the change
- [x] 4.1b Let the car leave the frame rather than land, and never ride it down (audit fix 2); verify no impact frame and no falling point of view exists in any state or capture
- [x] 4.2 Build the ascent: floor numerals, floor bands with lit windows, speed streaks, dust motes and transom slats, each looping by exactly one tile; verify a headless capture at two points one loop apart is pixel-identical, so no seam is visible
- [x] 4.3 Drive speed, streak density, particle rate and glow from the multiplier alone (design D3); verify a test renders two rounds that reach x4.00 with different crash times and asserts identical scene state at that multiplier (spec: The ascent conveys progress but never the outcome)
- [x] 4.4 Honour `intensityEffects` and `prefers-reduced-motion`; verify a headless test under a profile with intensity off shows constant baseline speed, and a reduced-motion test shows no animation, no shake and no particles
- [x] 4.5 Render the multiplier and the currency return as the two largest values with the floor subordinate (spec: The multiplier and the money are the primary values); verify a layout test asserts both font size and z-order at 390x844 and 1440x900
- [x] 4.6 Confirm nothing reveals the end: no top floor, no progress bar toward max win, no pre-crash cue (spec: The shaft has no visible end); verify a review of every animated property against the crash time, recorded in the change, plus a test that the scene at the last tick before a crash matches the same multiplier in a surviving round
- [x] 4.7 Build the settled states, including the at-or-below-stake return as its own screen with no celebration (spec: Results are shown without celebrating a loss); verify `presentation-check.mjs` — the shared check, not a new one — over forced below-stake, even, win and crash rounds shows no win cue on the first two
- [x] 4.8 Add the message catalogue with no near-miss, skill or "would have reached" copy, and expose `window.__triptownAudioLog` and `window.__triptownView` in demo builds so the shared checks can run against this game (design D24); verify `copy-check.mjs` passes on the catalogue and fails on a fixture containing banned wording

## 5. Skins and information

- [x] 5.1 Build the candy and adult skins as separate asset sets selected by the profile (design D6); verify a headless network log under an adult profile requests no candy asset
- [x] 5.2 Build the rules screen from the active config and profile, reading the published RTP band from `@triptown/fairness/reports/bands.json` so the figure always comes from a committed report, and stating that the floor is decoration and that tapping does nothing (spec: The player can read the rules before betting); verify opening it mid-round leaves the balance unchanged and the round running, and that the displayed band matches the committed report for the resolved config id
- [x] 5.3 Wire one bet, a fresh press per round and repeated-tap collapse (spec: One bet, one deliberate action per round); verify `timing-check.mjs` shows holding the control starts one round and the worst gap between starts meets each market's minimum
- [x] 5.4 Use `RoundService.ping()` for the latency estimate rather than adding a transport of this game's own; verify the slow-connection notice appears under injected delay and clears when latency recovers

## 5b. Shared compliance surfaces (added during implementation)

- [x] 5b.1 Move the DOM compliance panels — rules, history, fairness and the overlay — into the shared client rather than letting each game hand-write them; verify both games import them from `@triptown/crash-client` and the workspace gate passes
- [x] 5b.2 Stop the rules panel silently publishing a bare RTP when no measured band exists: say on screen that the figure is incomplete and log an error, because rounding costs measurable RTP at the minimum stake and GLI-19 4.7.1(a) requires the minimum to be met at any single bet level; verify the missing-band path renders the marker instead of a clean number
- [x] 5b.3 Extract the shared screen layout (header, bet controls, stage sizing, multiplier block, result card) so a game supplies only a stage Container; verify a game implementing no layout still passes `presentation-check.mjs` and `timing-check.mjs`

## 6. Closing checks

- [x] 6.1 Run the full gate; verify `pnpm turbo run lint typecheck test` passes for every package
- [x] 6.2 Re-run the compliance audit against the built game and confirm the concept-stage findings are closed; verify the updated report marks each critical fix PASS or records why it is deferred
- [x] 6.3 Update `AGENTS.md` with the new app and the skin-on-an-engine pattern; verify the described layout matches `apps/` and `packages/`
