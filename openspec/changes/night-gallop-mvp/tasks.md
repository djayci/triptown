## 1. Step engine package (packages/steps)

- [x] 1.1 Create `@triptown/steps` (pure, in `PURE_PACKAGES`) with configs Easy, Medium and Hard, paytable validation and clear chances (design D2). Verify with tests: Medium paytable values, `clearChance(1) = 0.97/1.21`, stopping RTP = 0.97 for every fence and difficulty, invalid paytables rejected.
- [x] 1.2 Implement fence derivation and `verifyStepRound` on the `fences` HMAC stream (design D3). Verify with a committed fixed test vector, determinism tests, and a check that derivation uses no other randomness.
- [x] 1.3 Implement the pure round model: `createStepRound`, `judgeJump`, `judgeCollect`, `settleIfAbandoned`, `snapshotOf` (design D4, D5). Verify with tests for every step-engine spec scenario (cleared, refusal, finish, duplicate key, collect, nothing to collect, abandoned with and without fences, snapshot without outcome).
- [x] 1.4 Implement `StepHost` over `RoundStore` plus `MemoryStepRoundStore` with compare-and-set: sessions, start (bet validation, kill switch, cycle claim, single debit, nonce), jump, collect, credit once, totals, release, history, abandonment sweep. Verify with host tests: debit and credit amounts, cycle-too-soon, round-in-progress, concurrent jump and collect settle once, abandoned sweep.
- [x] 1.5 Add the step simulator script and run ≥10M rounds per strategy per difficulty. Verify with a committed report in `packages/steps/reports/` showing every stop's theoretical RTP within 97% ± 0.1% and every strategy within 4 standard errors of 97%.
- [x] 1.6 Run lint, typecheck and test for `@triptown/steps`. Verify that all pass and that `eslint.config.js` lists `packages/steps/**` as pure.

## 2. Step round service (rgs-client)

- [x] 2.1 Add `StepRoundService` types (`src/steps.ts`) and export entries (design D7). Verify with typecheck of `rgs-client`.
- [x] 2.2 Add `MockStepRoundService` (`src/steps-mock.ts`) with the mock build marker and `forceNext({ refuseAt })`. Verify with tests that a forced refusal at fence 3 refuses there and the marker is set.
- [x] 2.3 Add the shared suite `testing/step-service-suite.ts` covering start, jump, collect, refusal, finish, duplicate key, nothing to collect, cycle gap and history. Verify that the suite passes against the mock.
- [x] 2.4 Add `RemoteStepRoundService` (`src/steps-remote.ts`) over the step routes with retries using the same action key. Verify by running the shared suite against the API in `apps/api` tests (task 3.4).

## 3. Step API module (apps/api)

- [x] 3.1 Add `RedisStepRoundStore` with Lua compare-and-set in `apps/api/src/steps/`. Verify with `redis-store`-style tests against the test Redis client: CAS rejects a stale version and two concurrent actions record once.
- [x] 3.2 Add the step routes (design D6) as a Hono sub-app using existing session auth, and mount it in `app.ts`. Verify with route tests for start, jump, collect, round fetch, active round, history and error codes.
- [x] 3.3 Run the abandonment sweep from the existing reconcile cron. Verify with a test that an abandoned round with 2 fences is collected and one with none is refunded.
- [x] 3.4 Run the shared step suite against `RemoteStepRoundService` over the in-process app. Verify that it passes with the same scenarios as the mock.

## 4. Fence Run client (apps/gallop)

- [x] 4.1 Replace the crash controller and HUD with the step flow on `StepRoundService` (mock under `VITE_DEMO`), keeping the no-mock and vocabulary checks. Verify that `pnpm --filter @triptown/gallop build` passes both checks and the demo shows DEMO.
- [x] 4.2 Build the Prime Time Chase scene (stadium bokeh, crowd, turf, brush fences with values, finish post, rail posts, horse placeholder) and the `JumpSequence` (design D8). Verify with 390×844 and 1440×900 screenshots of waiting, mid-jump, cleared, refused and finished states.
- [x] 4.3 Build the HUD: LIVE chyron, multiplier, ladder strip, JUMP and COLLECT, stake and difficulty before the round, result banners, session clock and net, with bundled fonts. Verify with screenshots matching the client spec scenarios and a check that no text uses a fallback monospace font.
- [x] 4.4 Enforce one request per press with action keys and retry of lost responses. Verify with a test: five taps in 300 ms send one jump request.
- [x] 4.5 Add `scripts/presentation-check.mjs`: forced cleared and refused jumps have identical frames until the response, and win effects fire only on collect or finish above the stake. Verify that the check passes and its log is saved.
- [x] 4.6 Add rules content in the client catalogue covering the rules requirement, available before a bet. Verify with a headless check that the rules open in the betting state and the balance is unchanged.
- [x] 4.7 Run lint, typecheck, test and build for `@triptown/gallop`. Verify that all pass.

## 5. Shared profile flags, currencies and rules (core)

- [ ] 5.1 Agree the order with the owner of `compliance-baseline` and `core` for edits to `core/profiles.ts`, `core/money.ts` and `core/rules.ts`. Verify with a note here naming what lands first and the date agreed.
- [ ] 5.2 Add `blockedRegions`, `hostingRegions`, `dataTransferBasis`, `withholdingNotice`, `liveBetsFeed` and `stepAbandonAfterMs` to `JurisdictionProfile` with validation and defaults. Verify with `profiles.test.ts`.
- [ ] 5.3 Add draft profiles `ng-draft` and `gh-draft` and NGN/GHS currency rules. Verify with tests for override refusal, loading and ₦3,950.00 formatting.
- [ ] 5.4 Enforce `blockedRegions` and `hostingRegions` at session creation. Verify with `app.test.ts` cases.

## 6. Compliance, art and evidence

- [x] 6.1 Write the step-mechanic compliance addendum `docs/compliance/night-gallop-steps-2026-09-16.md`. Verify that it covers classification, player-choice disclosure, incomplete games, cycle gap, near-miss and difficulty levels, with sources.
- [ ] 6.2 Choose and license a rigged adult horse and jockey model, render sprite sheets (gallop, take-off, landing, refusal stop), and commit the atlas with an art checklist. Verify against the client spec art requirement.
- [x] 6.3 Add audio within 1.5 MB with sources in `SOURCES.md`. Verify with the audio budget check.
- [ ] 6.4 Measure frame rate during jumps on the reference low-end Android device (needs the user's device). Verify with ≥30 fps recorded under `docs/compliance/evidence/<date>/`.
- [ ] 6.5 Re-run the `game-compliance-audit` skill on the built game. Verify with a new dated report.
