## 1. Fairness maths (packages/fairness)

- [x] 1.1 Add `boostRate` and `boostFactor` to `GameConfig`, replace `setbackDrag` with `modifierDrift(config) = lambda*(1-setbackFactor) - boostRate*(boostFactor-1)`, and use it in `logExpectedMultiplier`, `survival` and `crashTimeFromUniform` (D3). Verify with unit tests: drift matches the formula for boosted and unboosted configs, and `survival` still inverts `crashTimeFromUniform` to 1e-9 across the ramp and the linear region for both.
- [x] 1.2 Extend `assertValidConfig` (D4): `boostRate >= 0`, `boostFactor > 1` whenever `boostRate > 0`, and `r0 > modifierDrift`. Verify with unit tests for each rejection and for a legal negative-drift config.
- [x] 1.3 Derive boosts in `deriveRound` from a new `boosts` stream with the same exponential-gap generator and horizon as setbacks, and add `boosts: number[]` to `RoundOutcome` and `verifyRound` (D1). Verify with tests: fixed seed vectors reproduce boost times, boosts stay strictly below `min(crashTime, tMax)`, the crash time for given seeds is unchanged when only boost settings change, and a config with `boostRate: 0` yields an empty list.
- [x] 1.4 Register `whack-crash/v2` (setbacks + boosts) and `whack-crash/v2-rising` (boosts only) in `GAME_CONFIGS`, leaving `v1` ids untouched, and keep `cappedConfigId`/`resolveConfigId` working for the new ids (D6). Verify with tests: all four ids resolve, validate, and `+cap100` derivation still works on the new ids.

## 2. Proving the RTP (packages/fairness)

- [x] 2.1 Teach `scripts/simulate-rtp.ts` about boosts: apply them in the path value, add a `cashOutAfterBoost` strategy, and report mean and median round length next to the RTP (D11). Verify with a short run (100k rounds) that prints the new strategy and the length stats.
- [x] 2.2 Run and commit 10M-round reports for `whack-crash/v2` and `whack-crash/v2-rising`: every strategy within 97% ± 0.1% and instant bust 3% ± 0.05%. Verify that both reports are committed under `packages/fairness/reports/` and appear in `reports/index.json` with `pass: true`.
- [x] 2.3 Run and commit the half-up rounding band at stakes 0.20, 0.50 and 1.00 for both new ids (compliance-baseline D23). Verify that each run passes its band check and the worst-case band is recorded in the report.
- [x] 2.4 Record the round-length comparison (v1 vs v2, v1-rising vs v2-rising) in the v2 reports so the shorter-round trade-off is documented. Verify that both v2 reports state mean and median length against their v1 counterpart.

## 3. Round model and rules (packages/core)

- [x] 3.1 Apply boosts in `multiplierAt` and everywhere the path is valued (snapshot, settlement, auto cash-out, max win), with setbacks applied before boosts at equal times (D5). Verify with core tests: growth 4.20 with one setback and one boost values at 2.625, a boost at exactly the settled time counts, and a boost after the crash time does not.
- [x] 3.2 Add the `GOOD_MOLE` event to the `RoundEvent` union and stream it at its time in `streamRound`, replaying past boosts on reconnect and never revealing future ones (D8). Verify with core tests: event order across a mixed round, and a reconnect at 6 s that replays a 2 s boost but nothing about a 9 s setback.
- [x] 3.3 Carry `boosts` on `RoundRecord`, `RoundSnapshot`/`RoundSummary` and the settlement path, filtered by the same visibility rule as setbacks. Verify with core tests: a running round exposes only past boosts, a settled round exposes all of them.
- [x] 3.4 Add `boostsMode: 'off' | 'boost'` to `JurisdictionProfile`, default `boost` for `light` and `off` for every regulated template, and make `effectiveConfig` resolve the two-axis table in D6 with the existing report gating. Verify with core tests: each of the four combinations resolves to the expected id, and a profile naming a boosted id with no report fails validation.
- [x] 3.5 Add the `boosts { ratePerSecond, factor, warning: false }` item to `describeRules`, emitted only when the effective config has `boostRate > 0` (D10). Verify with core tests: boosted configs include it right after `setbacks`, unboosted configs omit it.

## 4. Transport and clients (apps/api, packages/rgs-client)

- [x] 4.1 Stream `GOOD_MOLE` over SSE and include `boosts` in round snapshots, history and the operator JSON, plus a `boosts` column in the CSV export. Verify with API tests: a boosted round streams the event at its time, the running-round response contains no future boost, and the CSV has the new column populated.
- [x] 4.2 Add the event to `RoundService` types, a `boost` scenario to `MockRoundService`, and shared-suite coverage that a boost raises the value and is reflected in history. Verify that the shared suite passes for the mock and for the remote client on both stores.

## 5. Whack client (apps/whack)

- [x] 5.1 Apply boosts in `displayMultiplier` and the optimistic payout, driven by the boost count received so far. Verify with display tests: one boost multiplies the displayed value by the factor, and a setback plus a boost compose in either order to the same value.
- [x] 5.2 Add the good mole presentation (D9): green burst with the +5% gain badge, a small hop, opposite side from the last bad mole where possible, no shake, no tilt, no hazard flash, and no interactive affordance. Verify with headless screenshots at 390×844 and 1440×900 that the good mole is fully on screen, behind the main mole, and that the badge does not cover the multiplier.
- [x] 5.3 Add a rising boost blip to the sfx sprite via `scripts/synth.mjs` and `pnpm --filter @triptown/whack audio`, and play it on `GOOD_MOLE`. Verify that the rebuilt sprite lists the new name in `audio.json`, the audio folder stays under 1.5 MB, and `SOURCES.md` records it.
- [ ] 5.4 Show boosts in the history entry and the verification panel next to setbacks, labelled as past-round data. Verify with a demo-build check that a boosted round lists its boost times in both panels. **Verification panel done** (bad/good mole counts per round, and a boost-time mismatch now fails the check). **History entry blocked**: the in-game history dialog is compliance-baseline 7.x and does not exist yet; `RoundSummary.boosts` is already carried, so it renders there when that dialog lands.
- [x] 5.5 Honour reduced motion: value updates with no flying badge and no hop, sound unchanged. Verify with a headless run under `prefers-reduced-motion: reduce` that no boost tween runs and the value still updates.

## 6. Compliance record (docs, AGENTS.md)

- [x] 6.1 Add the good mole to the rules copy and to `docs/compliance/whack-crash-2026-09-15.md` (modifier list, config ids, report references), and note in AGENTS.md that boosted ids need their own lab acceptance before regulated use. Verify that the audit doc lists all four config ids with their report files.
- [x] 6.2 Run `pnpm turbo run lint typecheck test` across the workspace and confirm the report index gate blocks any profile referencing an unproven id. Verify that all package tasks pass and a deliberate unproven-id profile fails validation in a test.
