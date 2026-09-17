## 1. Shelve Fence Run

- [x] 1.1 Commit the Fence Run working-tree state to branch `shelf/fence-run` from a separate git worktree, so the shared working tree never switches branch. Include `packages/steps`, `apps/gallop`, the rgs-client step service, `apps/api/src/steps`, `openspec/changes/night-gallop-mvp`, the step addendum, the built-game audit and their evidence. Verify `git show --stat shelf/fence-run` lists them.
  - Done 2026-09-17: commit `10cd365` on `shelf/fence-run`, 21 files on top of `f2eb775`.
- [x] 1.2 Remove Fence Run from the working tree:
  - `packages/steps`;
  - `apps/gallop`;
  - the step exports and files in `rgs-client`;
  - `/v1/steps` and the step sweep in `apps/api`, keeping `/v1/ping` and the region gate;
  - the `eslint.config.js` entry;
  - `stepAbandonAfterMs` in `core`;
  - `openspec/changes/night-gallop-mvp`.

  Verify `grep -r "@triptown/steps"` finds nothing outside `node_modules`, and `pnpm turbo run lint typecheck test` is green for core, rgs-client, api, fairness, engine, crash-client and whack.
  - Done 2026-09-17: no references remain. rgs-client, fairness, engine, crash-client and whack are green. Core and api still fail, but only in tests another session is changing for the v3/v4 boost configs: `profiles.test.ts`, `boosts.test.ts`, the `whack-crash/v3-rising` report missing, and app test 7.4. None touches the removed code.
- [x] 1.3 Point the shelved references at this change: `ng-draft` sources, AGENTS.md compliance paragraph and project memory. Verify no live file cites `night-gallop-steps-2026-09-16.md` or `night-gallop-2026-09-16.md` except as shelved.

## 2. Market profile flags (moved from `night-gallop-mvp`, already implemented)

- [x] 2.1 Agree the order of `core` edits with the `compliance-baseline` and `core` owners. Agreed 2026-09-16 with triptown-games-ba and triptown-games-82 (was `night-gallop-mvp` 5.1).
- [x] 2.2 Add `blockedRegions`, `hostingRegions`, `dataTransferBasis`, `withholdingNotice` and `liveBetsFeed` with validation. Verified by `packages/core/src/market-flags.test.ts` (was 5.2).
- [x] 2.3 Add draft profiles `ng-draft` and `gh-draft` and NGN/GHS currency rules. Verified by tests for override refusal, loading and ₦3,950.00 formatting (was 5.3).
- [x] 2.4 Enforce `blockedRegions` and `hostingRegions` at session creation. Verified by the region cases in `market-flags.test.ts` and the API session tests (was 5.4).

## 3. Compliance gate

- [ ] 3.1 Run the `game-compliance-audit` skill, concept stage, on Beat the Gate for Nigeria and Ghana. Cover the gate theme, horse depiction, the Floodlight Gold outline style against minors-appeal rules, vocabulary and near-miss risk, and reuse the 16 Sep research. Verify `docs/compliance/beat-the-gate-<date>.md` exists and that its critical fixes are folded into this change before art is final.

## 4. Register the game

- [x] 4.1 Register `beat-the-gate` on the `whack-crash` engine and add it to the API host map. Verify a test asserts `effectiveConfig('beat-the-gate', p)` equals `effectiveConfig('whack-crash', p)` for every shipped profile.
  - Done 2026-09-17: `apps/api/src/app.ts` registers it next to The Lift. `apps/api/src/gate-registration.test.ts` passes.
- [x] 4.2 Confirm no new configuration id and no new report. Verify `git status packages/fairness/reports/` is clean after a full test run.
  - Done 2026-09-17: this change adds no config id and no report. The report edits currently in the working tree (`index.json`, `rtp-whack-crash-v4.*`) belong to another session's v3/v4 work.

## 5. `apps/gate`

- [ ] 5.1 Create `@triptown/gate`: Vite + PixiJS v8 on `@triptown/crash-client`, own catalogue via `setTranslator`, `Logo('BEAT THE', 'GATE')`, `services.ts` with the mock only under `VITE_DEMO`, `build:demo` and a DEMO label. Verify `pnpm --filter @triptown/gate build` passes `check-no-mock.mjs`.
- [ ] 5.2 Port the canvas art into an atlas pipeline: horse (gallop, canter, standing), adult jockey, yard gate (open, shut), barn, floodlights, crowd band and turf tiles. Verify the atlas is committed with an art checklist against the adult-art requirement.
- [ ] 5.3 Build the stage: night field with looping parallax, the horse's lap on a fixed-period loop, a static gate, and crowd flashes and meter driven by the multiplier behind `intensityEffects`. Verify a test renders two rounds reaching x4.00 with different crash times and asserts identical scene state at that multiplier.
- [ ] 5.4 Build the cash-out and crash sequences: IN! locks the value, the ride home starts only after settlement, and the crash shuts the gate with the horse out in the field. Verify a forced tie (cash-out and crash in the same tick) records no ride-home frame and shows the gate shut.
- [ ] 5.5 Wire rounds through the shared controller and view once `the-lift-mvp` 2.3/2.4 land, with no result-kind, disarm or countdown logic in `apps/gate`. Verify `presentation-check.mjs` and `timing-check.mjs` pass for the gate demo, and `grep resultKind apps/gate/src` finds nothing.
- [ ] 5.6 Add the message catalogue with the gate rules text, decoration statement and withholding notice. Verify `copy-check.mjs` passes and fails on a fixture containing race, odds, starting gate, finish or bet slip.
- [ ] 5.7 Add audio (gallop loop, gate open, gate slam, ride-home, win) within 1.5 MB with sources in `SOURCES.md`. Verify the audio budget check, and that no sound changes with anything but the multiplier.
- [ ] 5.8 Show the playable demo to the user at 390x844 before any polish beyond the canvas. Verify the user's go/no-go is recorded here.

## 6. Closing checks

- [ ] 6.1 Run the full gate. Verify `pnpm turbo run lint typecheck test` passes for every package.
- [ ] 6.2 Measure frame rate on the reference low-end Android device. Verify ≥30 fps recorded under `docs/compliance/evidence/<date>/`.
- [ ] 6.3 Re-run the compliance audit on the built game. Verify the report marks each concept-stage fix PASS or records why it is deferred.
- [ ] 6.4 Update `AGENTS.md` with `apps/gate`. Verify the layout section matches `apps/` and `packages/`.
