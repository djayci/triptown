## 1. Profiles and math variants (packages/fairness, packages/core)

- [x] 1.1 Add `JurisdictionProfile`, `validateProfile` and the `PROFILES` registry (`light`, `regulated-uk`, `regulated-on`, `regulated-br`, `pt-draft` with `status: draft`, `reviewed: false`, `sources`) in `packages/core/src/profiles.ts`. Verify with unit tests: each invalid-field case is rejected, and a regulated profile without origins fails.
- [x] 1.2 Register the rising-only configs (`whack-crash/v1-rising`, `lambda: 0`), and add `effectiveConfig(base, profile)` that derives `+capN` ids when `maxMultiplier` is below the base cap. Keep compatibility with the `papers` field. Verify with unit tests: ids, `lambda`, caps, and that `paper-route` configs still validate.
- [x] 1.3 Extend the RTP simulator with `--config <id>` and generate `packages/fairness/reports/index.json`. Run 10M rounds for `whack-crash/v1`, `whack-crash/v1-rising` and `whack-crash/v1-rising+cap100`. Verify: all strategies land on 97% ± 0.1% and the reports and index are committed.
- [x] 1.4 Make `validateProfile` fail when an effective config id has no passing entry in the report index. Verify with a unit test using a fake index that lacks the id.
- [x] 1.5 Bind a profile when a session is created in `RoundHost`: operator config, then `DEFAULT_PROFILE`, then the dev-only override. Refuse `draft` profiles unless the override is enabled. Put the profile in `SessionInfo`, and select the effective config per round. Verify with host tests for binding, override refusal in prod mode, and a rising profile producing no setbacks.
- [x] 1.6 Add `minCashout` to cash-out judging (`below_min_cashout`, round continues) and reject auto targets below the minimum at start. Verify with core tests at x1.05/x1.10, and a simulator strategy run showing RTP unchanged with `minCashout` 1.10.
- [x] 1.7 Add a kill switch per game, config and profile (store flag plus admin endpoint), with `game_disabled` on start while running rounds still settle. Verify with a host test and an API test.

## 2. Identity, pacing and time (packages/core, apps/api)

- [x] 2.1 Add `playerId` to sessions and move the active-round lock and `lastStartAt` to player scope in both stores (Redis as one Lua script). Verify with host and API tests: a second session for the same player gets `round_in_progress`.
- [x] 2.2 Enforce `minCycleMs` in `startRound` with `cycle_too_soon { retryAfterMs }`, including after an instant bust. Verify with virtual-clock host tests at 1.2 s (rejected, ~3.8 s remaining) and 5.0 s (accepted).
- [x] 2.3 Implement the API `TimeSource` (sync with Redis `TIME` at cold start and every 10 s, clock = `Date.now()` + offset, log and audit drift over 100 ms). Verify with a unit test using a fake Redis `TIME` with offset and drift events.
- [x] 2.4 Accept `{ clientTapAt, rttMs }` on cash-out and store it as evidence on the round record without affecting settlement. Verify with an API test: evidence is stored and payout is based on receive time.

## 3. Platform integrity (packages/fairness, packages/core, apps/api)

- [x] 3.1 Add an injectable `HmacSha256`/SHA-256 provider to `fairness` derivation and commits (pure default), plus a `node:crypto` provider in the API. Verify with an API test over 100k random seed/client/nonce triples giving bit-identical crash times and setbacks, and confirm `fairness` lint stays clean.
- [x] 3.2 Add automatic seed rotation after 1,000 rounds or 24 h (configurable), keep the last 20 revealed seeds, and add `GET /v1/session/seeds`. Verify with host tests: the 1,001st round uses a new commit published first, and the revealed seed verifies earlier rounds.
- [x] 3.3 Add a `SeedCipher` interface, an AES-256-GCM WebCrypto implementation (`SEED_ENCRYPTION_KEY`) and a pass-through cipher for tests. Store only ciphertext in sessions and rounds, and add a redaction helper for logs. Verify with a test that scans raw store values for any hex server seed (none found) and a test that startup fails without the key when `VERCEL_ENV` is set.
- [x] 3.4 Add the `AuditSink` interface and a Redis hash-chained implementation with compare-and-set retry, emit all audit event types, and add `pnpm --filter @triptown/api audit:verify`. Verify with tests: a full round writes the expected chain, and altering, removing or reordering an entry is detected.
- [x] 3.5 Add `scripts/release-manifest.mjs` (SHA-256 per file for the api function and whack dist, Ed25519-signed) and `GET /v1/admin/integrity` (recompute, verify signature, compare). Run the check at cold start and daily via Build Output API `crons`. On failure set `integrity_blocked`, which is cleared through the admin endpoint. Verify with tests: pass on an unmodified build, and a tampered file blocks new rounds and writes an audit entry.
- [x] 3.6 Implement void and refund: a failure after debit refunds and voids; settle-then-credit with a `credited` flag; reconciliation for rounds settled but not credited and for rounds stuck past `tMax + 120 s`; a `VOID` terminal event. Verify with store fault-injection tests for each path, with balance and audit entries correct.
- [x] 3.8 Replace per-cash-out round-down with exact accrual and one half-up rounding of the round total at settlement, shared by both games (N cash-outs), and raise the minimum stake (Whack) / paper value (Paper Route) to 0.20. Verify with a simulator mode that applies the settlement rounding at stakes 0.20, 0.50 and 1.00. For `whack-crash/v1`, `whack-crash/v1-rising` and the Paper Route configs, every strategy's measured RTP must stay within the computed worst-case rounding band for that stake and at or above the 85% jurisdiction minimum. The band is published in the report so the rules can disclose it (user decision 2026-09-15).
- [x] 3.7 Implement `disconnectPolicy`: `lose` (existing) and `cashout-at-disconnect` via SSE abort plus a 2 s heartbeat backstop, with reason `disconnect`. Verify with API virtual-clock tests: an aborted stream settles at detection time before the crash, a crash-first round is lost, and `lose` is unchanged.

## 4. Recall and records (packages/core, apps/api, packages/rgs-client)

- [x] 4.1 Extend `RoundRecord` (player, profile, client version, balance before/after, evidence, void) and add session counters (`startedAt`, `stakedMinor`, `returnedMinor`). Add `resultKind(stake, return)` to `core`. Verify with core tests for record contents after win, even, loss and void, and resultKind boundaries.
- [x] 4.2 Add a per-player round index (sorted set by start time) with `ROUND_RETENTION_DAYS` TTL, plus a public `RoundSummary` on `GET /v1/rounds` that includes settled fields only. Verify with API tests: ordering, limit 50, and running rounds without crash data.
- [x] 4.3 Add `GET /v1/operator/rounds` (player, from, to, cursor, `format=json|csv`) authenticated with operator API keys from `OPERATORS`. Verify with API tests: 401 without a key, pagination, and a CSV header plus one row per round in range.
- [x] 4.4 Extend `RoundService`, `MockRoundService`, `RemoteRoundService` and the shared suite with: profile in session, `cycle_too_soon`, `below_min_cashout`, `VOID`, history fields and seeds list. Verify that the shared suite passes for the mock and for the remote client on both stores.

## 5. Client results, pacing and skill framing (apps/whack, packages/engine)

- [x] 5.1 Split the result screen by `resultKind`: neutral "RETURNED x · NET −y" / "CRASHED" with no confetti, BONK or win sound, and win showing net gain. Switch the live label between RETURN NOW and WIN NOW. Add a neutral `return` sfx to the synth and audio build. Verify with `scripts/presentation-check.mjs` for forced below-stake, even and win rounds: the audio log and view state show no win effects on the first two.
- [x] 5.2 Add a BET countdown from `cycle_too_soon` and the local `minCycleMs`, and an `InputArm` that requires release before re-arming (pointer, Space, no auto-repeat). Verify with `scripts/timing-check.mjs`: 50 fastest rounds under `regulated-uk` all have ≥5000 ms start intervals, under `regulated-on` ≥2500 ms, and holding Space starts no new round.
- [ ] 5.3 Implement `quickReplay: false`: the result screen shows Continue back to betting, with change-bet and exit at least as prominent. Keep one-tap replay only for `light`. Verify with screenshots of both profiles' result screens checked against the spec scenario.
- [ ] 5.4 Apply `intensityEffects` and `soundDefault` from the profile, and add a "Reduce effects" toggle to the sound panel. Verify in the headless check under `regulated-uk`: starts muted, no stems or tone after unmute, and no shake or tilt.
- [ ] 5.5 Make decoys non-interactive with a fixed pop rate independent of intensity, rename the meter to SPEED, move all copy into the catalogue with neutral wording, and never show the crash point on result screens. Verify with a headless test (tapping a decoy changes nothing) and a copy review listing every string checked against the no-skill scenario.

## 6. Game information (packages/core, apps/whack)

- [x] 6.1 Add `describeRules(config, profile, currency)` to `core`, returning structured items with message keys and params. Verify with unit tests: the rising profile has no setback or below-stake items, the halve profile includes the rate and x0.5, the numbers come from config, and `maxMultiplier` 100 is reflected.
- [ ] 6.2 Add a message catalogue (`i18n/en.ts`) with English fallback and dev warnings for missing keys, and move every player-facing string of the whack client into it. Verify with a lint/grep check that no display strings are left in `view.ts`/`controller.ts` and a test for the fallback warning.
- [ ] 6.3 Build the rules panel (DOM dialog) opened from a "?" button in every state without betting, showing version, build hash, config id and profile. Show RTP on the betting screen when `showRtpInGame`. Verify with headless screenshots under `light` and `regulated-br`, and confirm the balance is unchanged after opening the rules.
- [ ] 6.4 Add RTT measurement (`GET /v1/ping` every 10 s plus cash-out timings, EWMA) and a slow-connection notice above 300 ms. Verify with a headless test using route delay injection: the notice appears above 300 ms and clears when latency recovers.

## 7. History view (apps/whack)

- [ ] 7.1 Build the in-game history dialog: last 50 rounds with time, stake, result text, return, net and crash point, and a detail view labelled "Past round". Verify with a headless test after 3 forced rounds showing 3 correct entries.
- [ ] 7.2 Add text or icon result markers to history strip chips (cashed out, crashed, void) and a net sign. Verify with a greyscale screenshot where results are still distinguishable.

## 8. Player protection and operator bridge (packages/engine, apps/whack, apps/sandbox)

- [ ] 8.1 Add the session clock and net-position HUD strip, driven by session counters and profile flags. Verify with a headless test under `regulated-uk`: net shows +4.00 after stakes of 10.00×2 with returns 24.00 and 0.00, and the clock ticks during a round.
- [ ] 8.2 Implement `packages/engine/src/bridge.ts` (versioned envelope, origin allow-list, explicit targetOrigin) and remove the `'*'` post. Emit gameReady, balance, roundStarted, roundEnded and error. Verify with a sandbox test: events arrive in order with correct net, and a page from a non-listed origin gets nothing and its commands are ignored.
- [ ] 8.3 Handle inbound `pause`/`resume` (reality check after the current round), `closeGame`, `setLimits` (stake and loss limits with `loss_limit` error) and `showMessage`. Verify with sandbox tests for each scenario in the operator-bridge spec.
- [ ] 8.4 Add the idle prompt from `idlePromptMs`, blocking BET until Continue or Exit (Exit sends closeGame). Verify with a headless test under `pt-draft` using a shortened timer.
- [ ] 8.5 Update the sandbox: operator controls (pause, resume, close, limits, message) and a profile picker using the dev override. Verify by playing a round per profile in the sandbox with no console errors.

## 9. Adult skin (apps/whack)

- [ ] 9.1 Split the art into `art/skins/candy.mjs` and `art/skins/adult.mjs`, build `atlas-candy`/`atlas-adult`, and move the theme into skin modules. Adult skin: charcoal, teal and brass; natural mole proportions without crown, blush or buck teeth; no rays, confetti or BONK. Verify with an atlas build for both skins and a checklist header in `adult.mjs` reviewed against audit item F1.
- [ ] 9.2 Load only the profile's skin atlas and theme at boot. Verify with a headless network log under `regulated-uk` showing no `atlas-candy` request, plus screenshots of betting, running, result and rules screens for the adult skin.

## 10. End-to-end verification and audit refresh

- [ ] 10.1 Run the full monorepo `lint typecheck test build`, the timing and presentation checks for every active profile, and the RTP simulator for every referenced config id. Verify that all pass and outputs are saved under `docs/compliance/evidence/<date>/`.
- [ ] 10.2 Re-run the `game-compliance-audit` skill on Whack Crash for the `regulated-uk`, `regulated-on`, `regulated-br` and `light` profiles, and update `AGENTS.md` and the report. Verify that the new report shows the audit's critical fixes #1–#3 and #5–#10 as PASS, with #4 PASS for regulated profiles, and lists the remaining legal and hosting items.
