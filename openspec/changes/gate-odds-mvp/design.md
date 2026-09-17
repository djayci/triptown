## Context

See `proposal.md` — Why. The facts the design rests on:
- **The survival probability is exact.** On a configuration with no setbacks and no boosts, the round's crash distribution satisfies P(value reaches *m*) = RTP ÷ *m*. That is how the martingale is built (`fairness/src/model.ts`), and a quick simulation confirmed it.
- **Crashes are streamed today.** `RoundHost.streamRound` emits CRASH at the crash time and a cash-out after it is rejected (`round-engine` spec).
- **The client stack is shared.** Games are skins on `@triptown/crash-client`: `CrashScreen` plus `CrashViewBase`, with the controller shared.
- **Market flags already exist.** `ng-draft` and `gh-draft` live in `core/profiles.ts`, added by `beat-the-gate-mvp`.

## Goals / Non-Goals

**Goals**
- The same certified round, with the loss revealed at the player's reveal and not before, and nothing observable at the hidden crash time.
- Odds on screen that equal the engine's real probability at the displayed value.
- Opt-in per game and per market, so no other game or market changes behaviour.

**Non-Goals**
- No new configuration id, RNG stream or RTP report.
- No gamble or double-up feature.
- No live-reveal changes: Whack Crash, The Lift and Beat the Gate under `live` profiles are untouched.

## Decisions

### D1. Deferred reveal is the certified round with a later reveal, not new maths
The crash time is derived exactly as today. Settlement compares the reveal time *r* with the crash time *T*:
- *r* < *T*: won at the value at *r*, with the same payout and rounding as a live cash-out;
- otherwise lost.

*Why:* every strategy's payout is identical to the live game. A live player can't act after a crash either, so the committed reports for the rising configurations remain the evidence and no recertification of the maths is needed.

*Alternative rejected:* a fresh RNG draw at cash-out (a real coin flip). That is new maths with a new report, and a fixed 50/50 breaks RTP invariance.

### D2. Nothing observable happens at the hidden crash time
Until the reveal, a deferred round shows no change at *T* in any of:
- the stream (same keep-alive cadence, no terminal event);
- the balance;
- round state by id (still `running`);
- history and recall;
- the operator bridge (`roundEnded` is sent at the reveal);
- the audit log's player-visible projections.

The settlement is computed at the reveal.

*Why:* any side channel (a stream that closes, a balance refresh, a history row) would tell a player the gate has shut before they press. That would be an outcome leak (hard rule 3), and it would make waiting informative, which breaks strategy-independence.

### D3. Reveal points
The round reveals at the first of:
- a cash-out received;
- the auto cash-out target time;
- the max win cap time;
- the max duration;
- for a disconnected round, the same automatic points, so money always settles on the server (hard rule 4).

A cash-out received after *T* settles as a revealed loss, not a rejection.

*Why:* this keeps every existing settlement path and only changes what the client is told and when.

### D4. Opt-in by game and market, restricted to exact-odds configurations
- **Game:** `registerGame(game, engine, { reveal: ['live', 'onCollect'] })` declares support.
- **Market:** the profile flag `crashReveal: 'live' | 'onCollect'` (default `live`) selects it.
- **Resolution:** a round plays deferred only when both allow it. Otherwise it plays live.
- **Validation:** profile validation rejects `onCollect` with `setbacksMode` other than `off` or `boostsMode` other than `off`, and the host refuses such a round.
- **Enabled in:** `ng-draft` and `gh-draft` only.

*Why:* compliance rule 8 (flags, not forks). Only those two draft profiles enable it, because Brazil 1.207 item 14(d)(iv) and AGCO 2.15 read against a hidden crash (`gate-odds` concept note). With setbacks or boosts the survival probability is not RTP ÷ value, so the odds on screen would be wrong.

### D5. The odds on screen are RTP ÷ displayed value, never rounded up
The displayed chance is `floor(1000 × RTP ÷ value) / 10` percent (one decimal), shown as `<0.1%` below that, and updated with the value.

*Why:* GLI-19 requires rules and displays that are not misleading. Rounding down never overstates the chance.

*Latency:* the server judges at receive time, so the value is slightly higher and the chance slightly lower than the tap showed. The return is still RTP, and the existing latency disclosure covers it.

### D6. "Heading home" is a locked, outcome-free state
On IN! the client:
- locks the displayed value;
- shows "Locked · heading home";
- plays the turn for home.

It shows the result only when the settlement arrives, using the base's celebration rule. The heading-home animation is fixed-length and identical for both outcomes, and the reveal never shows the hidden crash value or how close it was.

*Why:* a delay that differs by outcome, or copy about closeness, is a tell or a near miss (AGENTS compliance rule 5; the `beat-the-gate-mvp` D4 reasoning).

### D7. Recall shows the player's reveal, not the hidden crash
History and recall show OPEN or SHUT at the value the player chose, the stake, the return and the net. The crash time remains in the round record and in provably-fair verification after seed rotation, but the game UI never draws it.

*Why:* GLI-19 recall needs the outcome and player choices, and those are the choice and the result. Drawing "the gate shut at x4.90" next to "you went in at x5.00" is a near-miss reveal.

### D8. One app, two presentations
`apps/gate` renders Gate Rush when the session's effective reveal is `onCollect` and Beat the Gate when it is `live`. Only the scene and words differ; the stage and art are shared.

*Why:* one certified client per game, per compliance rule 8.

## Risks / Trade-offs

- **Side channels in the stream or API leak the crash** → D2 is a spec requirement with a test comparing a deferred round's observable stream and state before and after *T*.
- **Labs or regulators read a hidden crash as misleading** → exact live odds and the rules text address GLI-19. It stays Africa-only by flag, and task 2.1 asks Lagos's lab directly before build.
- **Shared-code ownership** (`core`, `crash-client`) → task 1.1 agrees the order with the owning sessions, and every shared edit is opt-in and additive for existing games.
- **Players ride a lost round to max duration** → the round length is bounded by the existing max duration and cap, and the stake is already committed. Rules state the result is fixed at the start.

## Migration Plan

Additive:
- `crashReveal` defaults to `live`;
- existing games register without the reveal option;
- existing profiles don't set the flag.

Enable `onCollect` in the two draft profiles last. Rollback is removing the flag from those profiles, and rounds then play live.

## Open Questions

- **Does Lagos's designated lab accept a deferred reveal with live odds against its technical standard?** *Decides:* the lab (task 2.1). It doesn't change the build, only whether it ships.
- **What is the product name?** "Gate Rush" (user, 17 Sep 2026; read from "Gate rish") is the working title. *Decides:* the user, with a trademark check.
