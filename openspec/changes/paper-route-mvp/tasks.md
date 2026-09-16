## 1. Fairness: papers and multi-throw RTP

- [x] 1.1 Add `papers` (integer ≥ 1, default 1) to `GameConfig` and its validator, and add the `paper-route/v1` config with 5 papers; verify config unit tests accept 1..10 papers, reject 0 and fractional counts, and that `whack-crash/v1` is unchanged
- [x] 1.2 Extend strategies to lists of (paper count, stop rule) pairs with per-paper rounding helpers; verify unit tests where a one-paper strategy gives the same estimate as the existing single-stop strategy
- [x] 1.3 (after compliance-baseline go-ahead on `fairness`) Add the Paper Route strategies from design D6 to the simulator, using compliance-baseline's rounding mode (task 3.8) for the minimum-value figures; run 10M rounds for `paper-route/v1` and `paper-route/v1-rising` and register both reports in the report index; verify every strategy is within 97% ± 0.1% theoretically, the rounded reports at the 0.20, 1.00 and 10.00 paper values publish the worst-case band per stake and stay at or above the 85% jurisdiction minimum, and instant bust is 3% ± 0.05%

## 2. Concept art revision (audit fixes F1, D6)

- [x] 2.1 Rework the three.js concept renderer and `design/paper-route/` canvas: adult courier (about 7.5 heads, age cues, hi-vis, helmet, courier bag) on a delivery moped, no animals, no mailboxes or targets, irregular house spacing, muted life-like sunrise palette; render riding, splash setback, below-stake result and wipeout frames with the regulated HUD (RETURN NOW, per-paper stake/return, neutral result with net, no crash point); verify each frame against a checklist of audit items F1, D1 and D6 written into the canvas notes

## 3. Paper Route client: foundation

- [x] 3.1 Scaffold `apps/paper-route` (Vite, three, fonts, DEMO flag, `check-no-mock` build step, lint/typecheck/test scripts); verify `pnpm turbo run build lint typecheck test --filter=@triptown/paper-route` passes and the production build contains no mock markers
- [x] 3.2 Implement `game/display.ts` (multiplier, riding/banked/total return, `liveLabel` RETURN NOW vs WIN NOW, win-presentation gate on round total > stake, speed and sun from growth with intensity on/off); verify unit tests for 3.40 / 3 riding = 20.40, the 0.95 below-stake label, no win gate for a 10.00 total on a 10.00 stake, constant speed with intensity off, and sun elevation clamping short of a "full day" state
- [x] 3.3 Implement WebGL detection and the not-supported screen; verify that with WebGL disabled in devtools the message shows and BET is unavailable

## 4. Paper Route client: 3D scene

- [x] 4.1 Build `scene/world.ts` (renderer, chase camera rig, sunrise sky shader, fog, sun and hemisphere light, bloom) from the revised concept; verify a side-by-side screenshot matches the approved riding frame from 2.1 at 390×844
- [x] 4.2 Build `scene/street.ts` with procedural low-poly chunks (road, sidewalks, houses with porches at irregular spacing, trees, lamps, hedges; no mailboxes or targets) merged per chunk and recycled by distance; verify a 60 s scripted ride holds under 150 draw calls with constant memory, and a spacing test shows no fixed house interval
- [x] 4.3 Build `scene/courier.ts` (adult courier on a moped, idle ride motion tied to speed, bag showing one roll per unthrown paper, wobble and fall poses); verify roll counts for 5, 3 and 0 papers and an art checklist pass for audit item F1
- [x] 4.4 Implement quality tiers (high/medium/low per design D8) with frame-time step-down; verify with 6× CPU throttling that the tier drops within ~2 s and the HUD keeps updating

## 5. Core: rounds with several throws (after compliance-baseline go-ahead on `core`)

- [x] 5.1 Add paper bet validation (bet divisible by papers, paper value ≥ `minPaperMinor` 20) and wire the profile's `partialCashout` so `off` starts single-paper rounds; verify unit tests for 10.00/5 accepted, 10.01/5 and 0.50/5 rejected, and a `partialCashout: off` session starting a one-paper round
- [x] 5.2 Add `papers`, `throws`, `creditedMinor` to `RoundRecord` and totals (`papersThrown`, `papersLost`, `roundingAdjustMinor`) to `Settlement`, aligned with compliance-baseline's cash-out list in round records; verify types compile across core, rgs-client and api with `pnpm typecheck`
- [x] 5.3 Use the shared settlement function from compliance-baseline task 3.8 (exact value per cash-out, round total half-up once) for throws, crediting whole units as they are earned and the final adjustment at settlement; verify paper cases: 3.4012 × 2.00 then 1.2345 × 2.00 crediting 9.27, final totals 9.28 (from 9.2754) and 9.27 (from 9.2714)
- [x] 5.4 Implement `throwPapers` (one or all, server receive time, setback-first ties, profile `minCashout`, duplicate throwId, no papers left, crashed) and keep `cashout` as throw-all; verify unit tests for every throw scenario in the partial-cashout spec
- [x] 5.5 Make scheduled settlement (auto, effective cap, max duration, `disconnectPolicy`) settle all remaining papers and compute papers lost at wipeout; verify unit tests for auto-with-papers-thrown, capped, `cashout-at-disconnect` at 2.40, and wipeout-with-banked scenarios
- [x] 5.6 Add the THROWN event and totals on CASHED_OUT/CRASH, emit THROWN only when papers > 1, and keep crash time out of throw results, THROWN, snapshots and recall of running rounds; verify tests asserting no `crashTime` key while running and that a papers = 1 round emits the exact pre-change event sequence
- [x] 5.7 Add atomic, idempotent `recordThrow` to `RoundStore`/`MemoryRoundStore` and wire it into `RoundHost` (credit delta after append, audit entry with evidence, finalize on the last paper, lose the race to a lazy crash settlement); verify host tests with two concurrent throws for the last paper and a throw racing the crash

## 6. Round service and API (after compliance-baseline go-ahead on `rgs-client` and `api`)

- [x] 6.1 Add `throwPapers(roundId, { count })` to `RoundService` (throwId generation, retry with the same id, tap time and RTT) and implement it in `MockRoundService`; verify the shared suite passes unchanged for Whack Crash and new cases cover throw, throw-all, below-minimum, duplicate, rounding adjustment and wipeout with papers banked
- [x] 6.2 Implement `recordThrow` in the Redis store as a Lua script and add `POST /v1/rounds/:id/throws` (evidence fields), keeping `/cashout` as throw-all; verify API tests for throw, throw-all, retry with the same throwId, empty bag, below-minimum and concurrent last-paper throws against local Redis
- [x] 6.3 Stream THROWN over SSE and include throws in snapshots, `GET /v1/rounds` summaries and operator recall/CSV; verify API tests for disconnect after one throw then crash under `lose`, `cashout-at-disconnect` settling remaining papers, and no crash data while running
- [x] 6.4 Implement throws in `RemoteRoundService`; verify the shared suite, including the paper cases, passes against a local API

## 7. Engine subpaths without Pixi

- [x] 7.1 (after compliance-baseline adds `bridge.ts`) Add subpath exports `@triptown/engine/audio`, `/audio-settings`, `/motion` and `/bridge` whose modules don't import Pixi; verify a small Vite build importing only those subpaths contains no Pixi code (grep the output)

## 8. Paper Route client: gameplay

- [x] 8.1 Build the DOM HUD (balance, bet with paper steps and paper stake, auto cash-out at or above `minCashout`, BET with cycle countdown and fresh-press arming, multiplier, riding pill with RETURN NOW/WIN NOW, bag tiles with per-paper stake and return, round total, THROW/ALL, session clock and net position per profile, safe-area layout, single-stake layout when `partialCashout` is off); verify the betting-controls scenarios and that all controls fit at 360×640, are at least 44 px tall, and the clock and net position are visible
- [ ] 8.2 Implement the controller state machine and riding loop (server-anchored clock, profile-aware speed and sun from `display.ts`, bridge events `roundStarted`/`roundEnded`/`balance`); verify in a mock round that the multiplier updates every frame, speed is constant under an intensity-off profile, and bridge events arrive in order with correct net
- [x] 8.3 Implement the optimistic throw queue, THROW/Space (re-armed on release) and ALL, the uniform porch throw, neutral throw sound and reconciliation; verify the single throw, rapid taps (≤ unthrown requests, distinct throwIds), throw-rejected (crashed and below-minimum) and throw-all scenarios with the mock, and that two throws at different moments render identical effects
- [x] 8.4 Implement round-level result presentation (win effects only when the round total exceeds the stake; neutral "RETURNED x · NET −y" otherwise; no crash point or "would have" values on result screens); verify with a headless presentation check for forced rounds returning 6.00, 10.00 and 24.00 on a 10.00 stake that the audio log and view state show win effects only for 24.00
- [x] 8.5 Implement the setback splash (only under setbacks-on profiles and only on the event: splash, wobble, crossed-out value, −50%, new riding value); verify with a forced setback in the mock under a light profile, a rising-only profile showing no splash ever, and a recorded mock round where nothing spawns before the event
- [x] 8.6 Implement the result states (all thrown ride-on, wipeout with banked, wipeout with none, instant bust) and the neutral route back to betting per `quickReplay`; verify each with forced mock rounds and screenshots under `light` and `regulated-uk`
- [x] 8.7 Add the rules panel with the Paper Route items (papers, throw timing, minimum paper and cash-out, round rounding, wipeout, disconnect, landing is decoration) on top of `describeRules`, plus history entries listing every paper and the fairness panel; verify rules open before betting with values from config and profile, and a settled paper round verifies its crash time and setbacks
- [x] 8.8 Implement reconnect and recovery, including throws made before the drop; verify dropping the network after one throw and restoring it after the crash shows the wipeout with that paper's return under `lose`
- [x] 8.9 Implement reduced motion and "Reduce effects" (no shake, streaks, wobble or scatter; steady camera), sound default per profile, the idle prompt and reality-check pause from the bridge, and the DEMO label; verify with emulated reduced motion, a `regulated-uk` start muted, a bridge `pause` blocking the next bet after the current round, and the DEMO label in every demo state but not in production

## 9. Paper Route client: audio

- [x] 9.1 Generate placeholder sounds (bet, neutral throw, paper land, round win, neutral return, wipeout, splash, UI ticks, riding loop) within the 1.5 MB audio budget, and record sources and licences in `apps/paper-route/assets/audio/SOURCES.md`; verify the size check fails above budget
- [x] 9.2 Wire sounds to events (neutral throw on tap, land on arc end, splash on setback when enabled, win only on a round total above stake, riding loop pitch only with intensity on, mute and volume controls with safe storage); verify the throw sound plays before the server responds, no win sound plays in the 6.00/10.00 forced rounds, and audio works with storage blocked in a sandboxed iframe

## 10. Integration, evidence and release

- [x] 10.1 Add a game picker to the sandbox that creates a session per game and profile and embeds the chosen client; verify full Whack Crash and Paper Route rounds complete inside the cross-origin iframe with no console errors under `light` and `regulated-uk`
- [x] 10.2 Add a bundle budget check for `apps/paper-route` (initial download ≤ 1.5 MB excluding audio, no Pixi); verify CI fails when a 2 MB dummy asset is imported
- [x] 10.3 Run the timing check (≥ 5000 ms between round starts under `regulated-uk`, including rounds with several throws) and the presentation check for every active profile, saving outputs under `docs/compliance/evidence/<date>/`; verify all pass
- [ ] 10.4 Deploy `paper-route` as a Vercel preview project against the preview API; verify a 60 s round with throws completes on preview and Whack Crash on preview still passes its smoke round
- [ ] 10.5 End-to-end check on real phones (iOS Safari, Android Chrome) through the sandbox: throws, throw-all, setback splash under `light`, rising-only under `regulated-uk`, wipeout with papers banked, reconnect, and ≥ 30 fps on a mid-range Android; verify all pass and record frame rate and p95 throw latency
- [ ] 10.6 Re-run the `game-compliance-audit` skill on Paper Route for `light`, `regulated-uk`, `regulated-br` and `pt-draft`, and update `AGENTS.md` and the report; verify the audit's critical fixes #1–#10 show as PASS or are listed as legal or lab confirmations only
