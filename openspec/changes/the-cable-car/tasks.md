## 1. Gate

- [ ] 1.1 Run the `game-compliance-audit` skill on The Cable Car, concept stage, Nigeria and Ghana in depth, with the deferred reveal as the thing under examination; verify a dated report exists at `docs/compliance/the-cable-car-<date>.md` and that it carries forward the four items still open from `the-lift-2026-09-17.md` (marketing framing, Nigerian Code Art. 54, ARCON/GCG pre-approval, minors appeal) rather than starting a clean sheet. Nothing below starts until this is read
- [ ] 1.2 Confirm with the `gate-odds-mvp` session that the shared deferred-reveal client APIs have landed; verify `git log -S showHeadingHome -- packages/crash-client/src/game/screen.ts` returns a commit, and that `formatRevealChance`, `HEADING_HOME_MS`, `setRevealOdds` and `showHeadingHome` are all present at HEAD. Until this passes, no task in group 4 may start and no file in `packages/crash-client` may be edited by this change

## 2. Register the game

- [ ] 2.1 Register The Cable Car on the Whack Crash engine with `reveal: ['onCollect']`, in the app and in the API host map; verify a test asserts `effectiveConfig('cable-car', p)` equals `effectiveConfig('whack-crash', p)` for every shipped profile, and that `effectiveReveal('cable-car', p, c)` is `onCollect` on `ng-draft` and `gh-draft` and `live` elsewhere (spec: The Cable Car plays a certified engine's configuration)
- [ ] 2.2 Confirm no new configuration id and no new report; verify `git status packages/fairness/` is clean after a full test run, and that a profile resolving this game to an id without a passing report refuses to start a round (spec: No configuration without a report)

## 3. `apps/cable-car`

- [ ] 3.1 Create `@triptown/cable-car`: Vite + PixiJS v8 consuming the shared client, `services.ts` picking `MockRoundService` only under `VITE_DEMO` through a dynamic import, `allowOverride` and `playerRegion` set so the Nigeria and Ghana profiles actually run, per-market currency and balance, `build:demo`, and a visible DEMO label; verify `pnpm --filter @triptown/cable-car build` passes `check-no-mock.mjs`, and that the demo boots on `light`, `ng-draft` and `gh-draft` — the Lift shipped for a day with regulated profiles that threw at boot
- [ ] 3.2 Build the ride seen from the side: rope, pylons, cabin with riders, valley below, cloud above, each layer looping without a seam; verify a headless capture at two points one loop apart is pixel-identical
- [ ] 3.3 Drive every animated property from the multiplier alone; verify a test renders two rounds that reach x4.00 with different crash times and asserts identical scene state (spec: The ride conveys progress but never the outcome)
- [ ] 3.4 Build the station ladder as pure functions of the multiplier — VALLEY, PINE HALT, MIDWAY, CLOUD DECK, EAGLE POINT, OPEN SKY — with the names in the message catalogue, not the scene; verify `copy-check.mjs` passes and a test asserts each name resolves through the catalogue (design D9)
- [ ] 3.5 Confirm nothing reveals the end: no terminus, summit, final station or progress bar, and the rope leaves frame into cover at every value; verify a review of every drawn element recorded in the change, plus a test that the scene at the last tick before a crash matches the same multiplier in a surviving round (spec: The line has no visible end)
- [ ] 3.6 Put the altitude readout on the cabin and omit the shared themed counter; verify `counterFor()` returns null, no HUD counter renders, and a layout test asserts the multiplier and the money are the two largest values at 390x844 and 1440x900 (design D10, spec: the multiplier is the value)
- [ ] 3.7 Keep the car intact and occupied in every state and asset: no snapped rope, no fall, no impact, no falling point of view, riders reading as adults; verify a review of every drawn element recorded in the change (spec: Nothing in the scene is harmed, design D6)
- [ ] 3.8 Make the ending abrupt: the stop sets a flag and the doors open after it, with no deceleration, chime or light before; verify a test asserts no scene property changes in the tick before the crash that does not change identically in a surviving round at the same value (spec: The stop is abrupt, design D7)
- [ ] 3.9 Write the message catalogue with no near-miss, skill or "would have reached" copy, no wording inherited from another game, and a `rules.decoration` entry stating that the stations and the altitude are decoration and that where the ride ends cannot be predicted; verify `copy-check.mjs` passes on the catalogue and fails on a fixture containing banned wording — The Lift shipped describing "a bad mole" in a game with no moles
- [ ] 3.10 Expose the demo-only hooks the shared checks need (`__triptownView`, `__triptownAudioLog`); verify `presentation-check.mjs` and `timing-check.mjs` both run against this game rather than failing for want of a hook

## 4. The deferred collect (blocked on 1.2)

- [ ] 4.1 Wire the collect to the shared heading-home state; verify a test drives the real controller with the mock service and asserts the reveal lands at `max(press + HEADING_HOME_MS, settlement)` for a settlement arriving both before and after that duration (spec: The collect asks for the next stop, design D2)
- [ ] 4.2 Assert the wait is indistinguishable either way; verify a test captures every value the view is given between the press and the reveal for a won and a lost round at the same value, and asserts the two sequences are equal (spec: The same wait either way)
- [ ] 4.3 Confirm the wait is not tied to the scene; verify a test collects immediately after a station and immediately before one and asserts the same duration, and that no scene value feeds the reveal timer (spec: The wait is not tied to the scenery, design D3)
- [ ] 4.4 Present the locked value as not yet won — the styling for unsettled values, a caption saying the amount is conditional, and no balance, net position or history movement until the reveal; verify a test asserts the balance and net are unchanged when a settlement arrives during the wait (spec: A locked value is never presented as won)
- [ ] 4.5 Show the live win chance while a deferred round runs, and restate it in the past tense once pressed; verify a test asserts 39.1% at x2.48 on a 97% return, that a chance below 0.1% is shown as such and never as 0.0%, and that the wording changes tense at the press (spec: The live win chance is shown, design D4 and D5)
- [ ] 4.6 Carry the missing-band marker into the chance line; verify that with no measured band for the configuration in play the chance is marked incomplete or withheld, never shown as an authoritative figure (spec: No published band, no bare figure)
- [ ] 4.7 State the deferred reveal in the rules: that the outcome is fixed at round start, that asking for the next stop locks the value without ending the uncertainty, that the chance is derived from the nominal return, that chance × value equals that return at every value so no stopping point returns more, and what auto cash-out does and does not guarantee; verify the rules panel renders all five before any bet (spec: The player can read the rules, design D4 and D11)

## 5. Information and skins

- [ ] 5.1 Build the candy and regulated skins from the approved canvas, declaring this game's `ground` to `useSkin` so the contrast floor is actually checked; verify the multiplier and the money clear 3:1 on both skins — the adult multiplier was 1.42:1 in The Lift and no check caught it because none declared a ground
- [ ] 5.2 Make the rules, fairness and history reachable before any bet and while a round runs; verify by opening each one in the built client under a regulated profile, not by reading the code — The Lift built all three panels and shipped with nothing able to open them
- [ ] 5.3 Wire one bet, a fresh press per round and repeated-tap collapse; verify `timing-check.mjs` shows holding the control starts one round and the worst gap meets each market's minimum

## 6. Retire The Lift

- [ ] 6.1 Remove `apps/cable-car`'s predecessor: delete `apps/lift`, drop it from the workspace and the API host map, and archive `the-lift-mvp`; verify `pnpm build lint typecheck test` is green across the workspace with no reference to `@triptown/lift` remaining
- [ ] 6.2 Keep what the Lift earned: confirm `docs/compliance/the-lift-2026-09-17.md` stays in the tree as the record of its audit, and that the new report references it for the items carried forward rather than repeating them

## 7. Closing checks

- [ ] 7.1 Run the full gate; verify `pnpm turbo run lint typecheck test` passes for every package
- [ ] 7.2 Run the client compliance checks on every active profile; verify `presentation-check.mjs` and `timing-check.mjs` pass on `light`, `ng-draft` and `gh-draft`, with the deferred case actually exercised rather than reported unreachable, and the evidence committed under `docs/compliance/evidence/`
- [ ] 7.3 Re-run the compliance audit against the built game and confirm the concept-stage findings are closed; verify the updated report marks each critical fix PASS or records why it is deferred, and that it states plainly which surfaces the automated checks cannot see — a check that plays rounds cannot see a control no round touches, which is how The Lift shipped with unreachable rules
- [ ] 7.4 Update `AGENTS.md` with the new app, the retired one, and deferred reveal as a per-market presentation flag; verify the described layout matches `apps/` and `packages/`
