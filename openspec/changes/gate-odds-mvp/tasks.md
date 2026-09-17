## 1. Coordination and compliance gate

- [ ] 1.1 Agree the order of edits to `core` (RoundHost, profiles, registry) and `crash-client` (controller, CrashScreen) with the owning sessions before touching them. Verify with a note here naming the agreed order and date.
  - 2026-09-17, partial:
    - triptown-games-ba cleared `core/host.ts` and `rgs-client/src/{mock,remote}.ts`, and asked that `packages/fairness` wait until their v3/v4 PACE change lands. The odds test must target the configs profiles actually resolve (`v3-rising`, `v4-rising`) through the config object, not hard-coded rates or ids.
    - `core/profiles.ts` market flags are this change's owner's (confirmed by triptown-games-82 earlier).
    - `crash-client` (controller, CrashScreen) is waiting on triptown-games-82.
- [x] 1.2 Write the concept-stage addendum `docs/compliance/gate-rush-<date>.md` for Nigeria and Ghana. Cover:
  - classification (single horse, no race);
  - certification (Lagos Law 2021 s.59, LSLGA homologation, GCG software certificate);
  - pay-out information (Lagos s.81);
  - GLI-19 "not misleading" against live odds;
  - near miss and recall;
  - the markets where deferred reveal must stay off (Brazil 1.207 item 14(d)(iv), AGCO 2.15).

  Verify the report exists with sources and H/M/L confidence.
  - Done 2026-09-17: `docs/compliance/gate-rush-2026-09-17.md` (11 findings, sources with line references, H/M/L).

## 2. Lab question

- [ ] 2.1 Ask Lagos's designated lab and the GCG in writing whether a deferred-reveal crash round with exact live odds is accepted under their technical standard. Verify the question and any reply are recorded under `docs/compliance/`.
  - Drafted 2026-09-17: `docs/compliance/gate-rush-lab-question-2026-09-17.md`. Not sent: Triptown sends it and records the reply there.

## 3. Engine (core)

- [x] 3.1 Add `crashReveal: 'live' | 'onCollect'` to `JurisdictionProfile` (default `live`), and validation rejecting `onCollect` with setbacks or boosts on. Verify with profile tests.
  - Done 2026-09-17: `crashReveal?: RevealMode` on `JurisdictionProfile`, validated in `validateProfile`; `deferred-reveal.test.ts` covers invalid values and setbacks or boosts on.
- [x] 3.2 Let `registerGame` declare reveal support, and resolve a round's effective reveal mode from game and profile. Verify with tests for both-on, game-off and profile-off.
  - Done 2026-09-17: `registerGame(game, engine, { reveal })`, `revealModesOf`, `effectiveReveal(game, profile, config)`; tests cover both on, game off, profile off, and boosted or setback configs falling back to live.
- [x] 3.3 In RoundHost, keep a deferred round `running` past its crash time. Reveal at the first of cash-out, auto target, cap or max duration, settle won or lost by comparing the reveal with the crash time, and emit the terminal event only then. Verify with host tests for each reveal point, including a disconnected round.
  - Done 2026-09-17: `round.ts` `scheduledSettlement` and `cashout` reveal the loss at the first automatic reveal or at the cash-out time (`revealedLoss`); `host.ts` records `reveal` at round start. Host tests cover cash-out after the hidden crash, the auto target, cap and max duration, and a disconnected round.
- [x] 3.4 Make the stream, round-by-id state, balance, history and operator events identical just before and just after a hidden crash. Verify with a test capturing all four at T − ε and T + ε for the same round.
  - Done 2026-09-17: the host test compares stream event types, round state and settlement, balance and history 50 ms before and 100 ms after the hidden crash; they are identical and the round stays `running`. Operator bridge events derive from the stream in the client.
- [x] 3.5 Prove payout equivalence. Verify with a test that plays the same seeds live and deferred with cash-outs received at the same elapsed times across a sample of rounds, and asserts identical status and credit.
  - Done 2026-09-17: 300 seeded rounds × 5 cash-out times, live vs deferred, identical status and credit; unattended settlement identical too.
- [x] 3.6 Enable `crashReveal: onCollect` in `ng-draft` and `gh-draft` only, and assert no other shipped template enables it. Verify with the market-flags tests.
  - Done 2026-09-17: `ng-draft` and `gh-draft` set `crashReveal: 'onCollect'`; `market-flags.test.ts` asserts they are the only templates that do, and both validate. No game opts in yet, so nothing plays deferred until 7.1.

## 4. Round service and API

- [x] 4.1 Add deferred-reveal cases to the shared `rgs-client` service suite (hidden crash, cash-out after it, auto target after it, cap). Verify the suite passes for the mock and for the remote client against the API with memory and Redis stores.
  - Done 2026-09-17: `deferredRevealSuite` in `rgs-client/src/testing/round-service-suite.ts` covers START then nothing until the reveal, history still `running` before the reveal, a loss revealed after the crash time, a cash-out before the crash, and the auto target after a hidden crash. Passes for the mock (`mock.test.ts`) and for the remote client over HTTP with memory and Redis stores (`apps/api/src/app.test.ts`). Cap and max duration (60 s) are covered in core `deferred-reveal.test.ts`, not the timed suite.
- [x] 4.2 Make the API stream, cash-out and history routes honour deferred reveal, with no terminal event and no settled history row before the reveal. Verify with API tests over HTTP.
  - Done 2026-09-17: routes needed no change; they go through RoundHost, whose settlement honours the reveal. Evidence is the HTTP suite above; full api suite 104/104 (one earlier run had a timing flake in the unrelated below-minimum case).

## 5. Odds exactness evidence (fairness)

- [ ] 5.1 Add a committed test that simulates the shipped rising configurations and checks P(value reaches m) against RTP ÷ m for m in {1.01, 1.2, 2, 5, 10, 50, 100}, reading each config the profiles resolve (currently `v3-rising`) from the config object, with a stated tolerance. Verify the test passes and no report or config id changes (`git status packages/fairness/reports` clean).

## 6. Shared client (crash-client)

- [x] 6.1 Add an optional odds line to `CrashScreen` (chance = RTP ÷ displayed value, rounded down to one decimal, "<0.1%" below) shown only for deferred rounds. Verify with a unit test of the formatting and rounding, including 97 ÷ 3.2 → 30.3%.
  - Done 2026-09-17: `formatRevealChance` in `crash-client/src/game/display.ts` (97 ÷ 3.2 → 30.3%, 97.0% at x1.00, 0.9% at x100, <0.1% at x10,000; tested in `heading-home.test.ts`). `CrashScreen.setRevealOdds` draws it under the payout, set at START and every frame of a deferred round, and cleared on the result.
- [x] 6.2 Add the heading-home state to the controller and view contract: lock on IN!, a fixed-length state identical for every outcome, and the result only on settlement through the existing celebration rule. Verify with a test that the frames and audio log before settlement are identical for a won and a lost round with delayed settlement.
  - Done 2026-09-17: `showHeadingHome` and `setRevealMode` are optional on the view contract. The controller starts heading home on the press, holds the result until max(press + `HEADING_HOME_MS`, settlement), and holds the balance and session net until then. `heading-home.test.ts` drives the real controller with the demo mock: no result before 1,200 ms, identical view calls for a win and a loss, no balance or net update early, and slow settlement.
- [x] 6.3 Extend `presentation-check.mjs` with a deferred profile case: a shut reveal is not celebrated, and nothing differs between outcomes before settlement. Verify it passes on `apps/gate` under `ng-draft` and reports the case unreachable under live profiles.
  - Done 2026-09-17: `presentation-check.mjs` reads the profile first, presses to reveal the crash case on deferred profiles, and adds a "deferred heading home" case comparing a win and a loss 600 ms into heading home. It passes on `apps/gate` under ng-draft (`docs/compliance/evidence/2026-09-17/gate-rush-presentation-check.json`) and reports UNREACHABLE under `light`, where the other cases pass.
- [x] 6.4 Make history and recall show the reveal value and OPEN/SHUT for deferred rounds, never the crash value. Verify with a HistoryPanel test on a lost deferred round.
  - Done 2026-09-17: core snapshots carry `reveal`. `resultText` shows "Lost at x5.00" for a deferred loss, and the detail view drops the crash point for deferred rounds; tested in `history-panel.test.ts`. The history strip uses the reveal value from the settlement.

## 7. `apps/gate` Gate Rush

- [x] 7.1 Register the horse game with deferred-reveal support and choose Gate Rush or Beat the Gate from the session's effective reveal mode. Verify under `ng-draft` and a live profile in the demo.
  - Done 2026-09-17: `registerGame('beat-the-gate', 'whack-crash', { reveal: ['onCollect'] })` in `apps/api` and the gate demo. `GateView` takes the presentation from the profile (GATE RUSH wordmark and words under ng-draft, BEAT THE GATE otherwise) and follows START's reveal mode. Checked in the demo under ng-draft and `light`.
- [ ] 7.2 Build the Gate Rush scene and screens from the canvas:
  - while out: no gate, fog to the left;
  - heading home: the turn for home, fixed length;
  - revealed open: gate open, horse through;
  - revealed shut: gate shut, horse stopped out in the field facing away.

  Verify headless screenshots at 390x844 for each state, reviewed with the user.
  - In progress 2026-09-17: Gate Rush states captured from the demo under ng-draft (betting, riding with odds, heading home, gate open, gate shut). Waiting for the user's review.
- [ ] 7.3 Add the catalogue: odds labels, heading-home copy, reveal titles, and the rules with the odds table and fixed-result and decoration statements. Verify `pnpm check:copy` passes and a fixture with "almost" or "just missed" fails.
  - In progress 2026-09-17: catalogue keys for odds, heading home and reveal titles are added and copy-check passes. Still missing: the odds table and Gate Rush wording in the shared RulesPanel. The rules must also say the chance comes from the nominal RTP, while the published figure is the measured band at the minimum stake (raised in triptown-games-82's review), so a lab doesn't read the two as inconsistent.
- [x] 7.4 Run the shared checks on the Gate Rush demo. Verify timing-check and presentation-check pass under `ng-draft`, with evidence under `docs/compliance/evidence/<date>/`.
  - Done 2026-09-17: under ng-draft, timing-check worst gap was 5,152 ms against a 5,000 ms minimum, and hold-to-repeat did not start a round (`gate-rush-timing-check.json`). presentation-check passed (`gate-rush-presentation-check.json`). Both runs used the strict argument parser, with `--profile` as its own argument.

## 8. Closing

- [ ] 8.1 Run the full workspace gate. Verify `pnpm turbo run lint typecheck test` passes for every package.
- [ ] 8.2 Re-run the compliance audit on the built game. Verify a dated report marks each concept-stage finding.
- [ ] 8.3 Update AGENTS.md: deferred reveal as an opt-in engine mode and the markets where it is allowed. Verify the text matches the implemented flag and validation.
