# Tasks

Order matters: the server must refuse what the profile forbids before any client offers it, and the nonce behaviour must be proven before anything is built on top of it.

## 1. The nonce rule, proven first

- [x] 1.1 Add `practice?: true` to the start input in `packages/core/src/host.ts` (`startRound`, :351). The practice branch skips `validateBet` (`money.ts:94` rejects a zero stake and must keep doing so) and asserts `betMinor === 0`; a request with `practice: true` and a non-zero stake is an error, never normalised. Verify with unit tests for both rejections.
- [x] 1.2 Skip `store.debit` (`host.ts:385`) and its release path for a practice round, leaving the active-round claim, rotation check, `addPending`, `takeNonce` (`host.ts:400`) and `recordStart` untouched. Verify that a practice round leaves the balance unchanged at start and at settlement.
- [x] 1.3 **Verify the nonce directly, not by inference:** a test that reads the session's nonce, plays a practice round, and asserts it advanced by exactly what a staked round advances it by. A second test plays a practice round, records its crash time, then starts a staked round and asserts the outcomes are independent. This is the task the whole change rests on — if only one test in this change survives review, it is this one.
- [x] 1.4 Refuse a practice round when the session's profile does not permit it, before any nonce is taken or record written. Verify that a refused request leaves the nonce and the round index untouched.

## 2. Recording and the market flag

- [x] 2.1 Add optional `practice` to `RoundRecord` (`packages/core/src/round.ts:17`) and `RoundSnapshot` (`packages/core/src/events.ts:154`), absent meaning staked. Verify existing records deserialise unchanged.
- [x] 2.2 Add `practiceRounds?: boolean` to `JurisdictionProfile` following the `crashReveal` convention (`packages/core/src/profiles.ts:110`): optional, doc comment stating that absent means off, **not** added to `base` or any template, validated in `validateProfile`, resolved through a named helper that applies the default. Verify every existing profile still validates and none permits practice rounds.
- [x] 2.3 Carry the flag into history and recall: `host.history`, `host.playerRounds`, and a new column in `apps/api/src/round-csv.ts:3`. Verify an operator export distinguishes practice from staked rows, and that staked turnover summed from the export excludes practice rounds.
- [x] 2.4 Add `practice` to the start route body in `apps/api/src/app.ts:304` and to `StartRoundInput` (`packages/rgs-client/src/types.ts:43`). Verify through the shared round-service suite (`packages/rgs-client/src/testing/round-service-suite.ts`) so the mock and the future remote service are held to the same behaviour.
- [x] 2.5 Add the rules line via `describeRules`, present only when the profile permits practice rounds: no stake, no payout, identical odds. Verify the rules omit it entirely under a profile that forbids practice rounds.

## 3. Client

- [x] 3.1 Add an optional secondary action to the view contract: a callback on `CrashViewCallbacks`, an optional member on `CrashView`, and a `practiceRounds` entry in `PresentationFlags` (`packages/crash-client/src/game/view-contract.ts:29`). Optional so The Lift and Beat the Gate still compile without offering one. Verify both other games typecheck untouched.
- [x] 3.2 Render the secondary action on the result screen in `apps/whack/src/game/view.ts` (beside the play-again control, visually subordinate, labelled as carrying no stake) and hide it entirely when the profile forbids it. Verify by driving the client under a permitting and a forbidding profile.
- [x] 3.3 Make the between-rounds countdown disable the secondary control as well as the primary one (`view-base.ts:105` borrows only the primary). Verify that a practice round cannot be started during the enforced gap.
- [x] 3.4 Suppress money at source for a practice round (design D5): the controller does not feed stake, running payout, `+` amount or balance update. Branch on the practice flag **before** `resultKind` (`money.ts:76` returns `'even'` at a zero stake, which would otherwise tell the player they broke even on a bet they never placed). Verify no monetary string appears anywhere on screen during or after a practice round.
- [x] 3.5 Mark practice rounds in the history panel (`packages/crash-client/src/dom/history-panel.ts`), showing the multiplier and result but no money. Verify a mixed history reads correctly and a practice row shows no stake.

## 4. Proving it

- [x] 4.1 Add `practice` to `controller.debugState()` (`packages/crash-client/src/game/controller.ts:456`) and push practice starts into `startLog` (`controller.ts:401`). Verify by deleting the `startLog` push in a scratch build and confirming the timing check **fails** rather than passing — a check that cannot see a practice round must not report green on one.
- [x] 4.2 Add a demo-only way for the checks to start a practice round directly (a query parameter, not fixed coordinates: coordinates stop hitting anything when a layout changes and the check then proves nothing while still passing). Verify it is gated behind `VITE_DEMO` like the existing hooks and absent from a production bundle.
- [x] 4.3 Extend `presentation-check.mjs` with a practice scenario asserting no win cue, no confetti, no shake and no money, and that the round genuinely settled. Verify it fails against a build that shows a payout during a practice round.
- [x] 4.4 Extend `timing-check.mjs` to a mixed sequence — staked, practice, staked — asserting every consecutive pair of starts is at least `minCycleMs` apart. Verify against `light` and one regulated profile with practice enabled in a scratch profile.
- [x] 4.5 Run the full workspace `lint typecheck test build`, both check scripts for every active profile, and save outputs under `docs/compliance/evidence/<date>/`. Verify all pass.

## 5. Documentation

- [x] 5.1 Record in `AGENTS.md` that a stake-free round must consume its nonce and be recorded like any other, and why: a practice round that skips the nonce lets a player watch a round free, learn its crash point and stake on it. Verify the rule names the failure, not just the requirement.
- [x] 5.2 Note in the compliance section that free play is advertising in several markets (UK CAP, Brazil 1.231), that `practiceRounds` defaults off, and that enabling it for a market is a decision needing its own legal check rather than a config change.
