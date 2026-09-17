## Context

See proposal.md — Why.

The shape of `RoundHost.startRound` (`packages/core/src/host.ts:351`) decides most of this design. Its current order is: claim the active-round slot and the pacing clock, **debit** (`host.ts:385`), rotate the seed if due, then `addPending`, then `takeNonce` (`host.ts:400`), then `recordStart`. Two properties of that order matter here:

- The **nonce is taken from the store**, not computed by the caller (`store.takeNonce(sessionId)`). Nothing outside the store can see the next nonce, and taking one is what advances it. A practice round therefore gets an honest nonce for free, provided it goes through the same path.
- The **debit is the only step that involves money**, and it happens before the nonce is taken. A failed debit releases the slot and restores the previous start time (`host.ts:387`), so the pacing clock is not consumed by a round that never started.

The client side is already shaped for this: `RoundService.history(limit)` returns `RoundSummary[]` (`packages/rgs-client/src/types.ts:75`), and `describeRules` generates the rules screen from config and profile, so a new rules line is data rather than copy.

## Goals / Non-Goals

**Goals:**

- A practice round is the same code path as a staked round, differing only in that the stake is zero and the debit is skipped.
- The nonce behaviour is impossible to get wrong by accident, and a regression is caught by a test rather than by a player.
- An operator can separate practice from staked volume with one field.
- The client cannot show money during a practice round, by construction rather than by remembering to hide it.

**Non-Goals:**

- No change to the maths, config ids, RNG or committed RTP reports. A practice round plays a certified config unchanged.
- No "free bet" or bonus mechanic. A practice round pays nothing; this is not a promotional balance and must not become the foundation for one.
- No separate practice *mode* the player enters and leaves. It is one round at a time, started from a result screen.
- Not offered in any regulated market in this change. The flag ships defaulting to off everywhere, including `light`.

## Decisions

### D1. Practice is a property of the round, not of the session

`startRound` takes `input.betMinor` (`host.ts:351`); practice becomes `input.practice === true` with `betMinor` required to be absent or zero. The alternative — a session-level "practice mode" the player toggles — was rejected because it creates a state in which the client believes one thing and the server another, and because every record then has to be interpreted against a session flag rather than read on its own. A round record that says what it is needs no context to audit.

Validation is explicit rather than inferred: a request with `practice: true` and a non-zero `betMinor` is an error, not a request to be normalised. Silently coercing it is how a paid round becomes free, or a free round becomes paid.

A practice round must **bypass `validateBet` rather than satisfy it**. `validateBet` (`packages/core/src/money.ts:94`) rejects any stake at or below zero with `invalid_bet`, and it should keep doing so — loosening it to admit zero would make every staked path accept a free round by omission. The practice branch skips it and asserts `betMinor === 0` instead.

### D2. Skip only the debit, never the nonce

The single rule this change lives by: a practice round takes the same path through `startRound` and skips exactly one step, the `store.debit` call. It still claims the active-round slot, still respects the pacing clock, still calls `addPending`, still calls `takeNonce`, still calls `recordStart`.

The tempting shortcut — derive the outcome without taking a nonce, since nothing is at stake — is the failure mode the whole spec exists to prevent. If a practice round does not consume its nonce, the next staked round uses the nonce the player has just watched play out, and the game is solved. This must be asserted directly by a test that plays a practice round and checks the session's nonce advanced, not merely implied by the round working.

Skipping the debit also means skipping the failure path that releases the pacing claim (`host.ts:387`), since there is no debit to fail. Everything after it — rotation check, `addPending`, `takeNonce` (`host.ts:400`), `recordStart` — is shared unchanged.

### D3. Zero stake, not absent stake, and a flag that reaches every record

`RoundRecord` (`packages/core/src/round.ts:17`) and `RoundSnapshot` (`packages/core/src/events.ts:154`) both gain an optional `practice` flag, absent meaning a staked round, so every existing record stays valid. The operator CSV (`apps/api/src/round-csv.ts:3`) gains a matching column: an export that cannot distinguish practice from staked turnover is worse than no export, because it looks authoritative.

A practice round is persisted with `betMinor: 0` and `returnMinor: 0` rather than with the stake fields omitted or nulled. Every consumer that sums turnover keeps working without a special case, and one that forgets the flag counts a practice round as a zero-value staked round — wrong in the harmless direction. Nullable stakes would instead force every reader to handle a case only practice rounds produce.

One consequence to handle deliberately: `resultKind(stakeMinor, returnMinor)` (`money.ts:76`) returns `'even'` for a practice round, since return and stake are both zero. That is arithmetically right and presentationally useless. The client must branch on the practice flag **before** `resultKind`, not after, or a practice round will be described to the player as having broken even on a bet they never placed.

### D4. The profile flag is `practiceRounds`, default off, and the server is the authority

Added to `JurisdictionProfile` as an optional boolean alongside the other market flags, absent meaning off, so every existing profile — including `light` — is unchanged by this change landing. The base template does not set it.

The server refuses a practice round the profile does not permit, independently of whether the client offered the control. The client hiding the button is presentation; the refusal is the rule. This matters because free play is advertising in several markets, and "the button was hidden in that build" is not a defence.

### D5. Money is suppressed at the source, not at each call site

Rather than teaching each display to check a practice flag, the controller stops sending money for a practice round: the stake display, the running payout, the `+` amount and the balance update are simply not fed. A display that receives nothing cannot leak anything, whereas a display that receives a value and is trusted to hide it will eventually be reached by a path that forgot.

This is the same reasoning as D24 in compliance-baseline (client compliance is proven by driving the client): the check can only see what the client does, so the client should have nothing to reveal.

### D6. Never state the counterfactual

No "you would have won", no shadow payout, no greyed-out amount. This is the near-miss presentation AGCO 2.15 and UK RTS 7C exist to prohibit, and it is the single most likely thing for a well-meaning implementation to add, because it feels informative. The multiplier and the crash point are shown; what a bet would have returned is not, at any multiplier, in any styling.

### D7. Pacing is measured across all round starts

The minimum gap is already enforced on the active-round claim, which a practice round also makes, so this falls out of D2 rather than needing its own mechanism. The test that matters is the mixed sequence: staked, practice, staked, each pair at least `minCycleMs` apart. Without that, practice rounds become a way to fill the enforced wait with play, which is the opposite of what the gap is for.

### D8. A second result-screen action has to be built, not configured

There is no secondary CTA anywhere in the client today. `actionControl()` (`packages/crash-client/src/game/view-base.ts:46`) returns exactly one control, and the between-rounds countdown borrows and restores that one control's label, sub and enabled state (`view-base.ts:105`). The result screen sets it through `setActionLabel` in both implementations (`crash-client/src/game/screen.ts:366`, `apps/whack/src/game/view.ts:612`).

So this change adds an optional secondary action to the view contract rather than overloading the existing button: a new callback on `CrashViewCallbacks`, an optional member on `CrashView` so games that do not implement it still compile, and a `practiceRounds` entry in `PresentationFlags` (`view-contract.ts:29`) so the control's existence follows the profile. Optional, because The Lift and Beat the Gate must not be forced to grow a button they do not offer.

The countdown must leave the secondary control alone: it borrows the primary one. A practice action that survives the enforced wait would let a player start a practice round during the gap, which D7 exists to prevent — so the secondary control is disabled by the same countdown that disables the primary.

### D9. The checks must be able to see a practice round

Both compliance scripts drive the real client through fixed-coordinate clicks and read `controller.debugState()`. To be covered, a practice round needs three things:

- a `practice` field on `debugState()` (`crash-client/src/game/controller.ts:456`), so `presentation-check` can assert that a practice round produced no win cue, no confetti, no shake **and no money**;
- its start pushed into `startLog` (`controller.ts:401`), which is the array `timing-check` reads to measure gaps — a practice round missing from it would be invisible to the pacing check while still being playable, exactly the vacuous-pass shape this repo has been bitten by twice;
- a way for the scripts to reach the control. The scripts click a fixed point (`195, 783`); the secondary action is elsewhere, so the practice scenario needs either its own coordinates or a demo-only query parameter that starts a practice round directly. A query parameter is preferable: coordinates silently stop hitting anything when a layout changes, and the check then proves nothing while still passing.

## Risks / Trade-offs

- **The nonce rule is invisible when correct and catastrophic when wrong.** Nothing about a broken implementation looks broken: the practice round plays, the staked round plays, and only a player who thinks to compare them finds it. Mitigated by asserting nonce advancement directly, and by a test that plays a practice round followed by a staked round and shows the outcomes are unrelated.
- **Practice rounds inflate round counts.** Anything reporting rounds-per-session or using round volume for monitoring will move when this is enabled. The flag makes them separable, but downstream consumers have to actually use it. Worth flagging to any operator before enabling.
- **A free round is a retention mechanic whether or not it is framed as one.** The honest version — no money, no counterfactual, same pacing — is defensible. The same feature with a "you would have won x50" label is a different product and a regulatory problem. The line is thin, deliberate, and worth restating in review rather than assuming it holds.
- **Seed rotation interacts with practice rounds.** Rotation is due by round count (`host.ts:141`, nonces `0..roundsPlayed-1`), so practice rounds bring rotation forward. That is correct — they consume randomness — but it means a player who practises heavily rotates seeds faster, and the reveal covers rounds they were not paid on. No action needed; recorded so it is not later mistaken for a bug.
