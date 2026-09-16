## Why

Whack Crash proves the round engine, the fairness layer and the client plumbing. The second game should test whether those parts really carry over to a new game, and it should add a decision Whack doesn't have. **Paper Route** is a crash game about delivering the morning papers. A player's stake is a bag of newspapers. An adult courier on a delivery moped rides a suburban street at sunrise, and the player banks the bag one paper at a time. That gives a *bank some now, let the rest ride* tension, while payouts stay independent of skill and strategy, as a regulated gambling game requires.

The Paper Route compliance audit (`docs/compliance/paper-route-2026-09-15.md`) reshaped the concept. The paperboy, the cartoon dog and per-paper rounding down were dropped. Partial cash-out became a per-market setting, and one-stake/one-game and round-level celebration rules were added.

## What Changes

- New **partial cash-out round rules**. One stake is split into N equal papers (default 5) inside a single game: one debit, one round id, one game cycle.
  - THROW banks one paper at the current multiplier and ALL banks every remaining paper.
  - A wipeout (the crash) loses every paper not yet thrown.
  - Profiles can turn partial cash-out off (Portugal), which makes the game a single cash-out.
  - A throw below the profile's minimum cash-out is rejected and the round continues.
- **Exact settlement, rounded once per round.** Throws accrue exact values, whole minor units are credited as they are earned, and the round total is rounded half-up once at settlement. There is a minimum paper value (default 0.20). Rounding each paper down would lose up to 1.7 percentage points at that paper value. One half-up rounding removes that one-way loss. No cent rounding can keep every single cash-out within ±0.1%, so reports publish the worst-case rounding band per stake, certification gates on the jurisdiction minimum RTP at every stake, and the rules disclose that small-stake returns vary slightly (shared decision in `compliance-baseline`).
- The shared round model in `packages/core` is **generalized from one cash-out per round to 1..N**. Whack Crash keeps working as N = 1 with unchanged behaviour.
- The RTP simulator gains **multi-throw strategies** and reports RTP both theoretically and at the minimum paper value, for `paper-route/v1` (setbacks) and `paper-route/v1-rising` (no setbacks, for regulated profiles).
- The round API and `RoundService` gain a **per-paper cash-out**: throw one or all, with idempotency and tap-time/RTT evidence. Recall records every throw.
- New **Paper Route web client** in `apps/paper-route`:
  - A real-time three.js chase camera behind the courier, in a muted, life-like take on the D1 Low-Poly Sunrise lighting.
  - Neutral throw presentation until the round's total return exceeds the stake.
  - Uniform throw landings with no targets.
  - When setbacks are on, a puddle splash with no animal.
  - It uses the shared rules/help, minimum cycle, history, session clock, net position, reality check and operator bridge from `compliance-baseline`.
- The sandbox operator page can load either game.

## Capabilities

### New Capabilities
- `partial-cashout`: rounds whose single stake is split into papers cashed out separately. Covers:
  - the one-game rule and the per-profile on/off switch;
  - throw and throw-all, minimum cash-out per throw, exact accrual with one rounding per round, and the minimum paper value;
  - wipeout with unthrown papers, auto cash-out, caps and the disconnect policy for remaining papers;
  - idempotent throws, throw-level recall and evidence;
  - crash-time secrecy, and RTP that holds for any strategy and at the minimum bet.
- `paper-route-client`: the player-facing Paper Route game. Covers:
  - betting with papers, and the riding view with the adult courier;
  - the bag, THROW/ALL and per-paper plus total display;
  - round-level result presentation, uniform throws, and no hazard hints, near misses or "would have" values;
  - setback presentation when on, intensity per profile, and the rules content specific to papers;
  - history, sound, performance tiers, embed layout, reduced motion and demo mode.

### Modified Capabilities
None registered. `round-engine`, `provably-fair` and `whack-game-client` live in the unarchived `whack-crash-mvp` change. `jurisdiction-profiles`, `responsible-play`, `game-information`, `game-recall` and `operator-bridge` live in the in-flight `compliance-baseline` change. This change adds Paper Route requirements on top of them, and deltas will be reconciled when those changes are archived:
- a `partialCashout` profile flag;
- rules items for papers;
- throw entries in round records.

## Impact

- **Depends on** `compliance-baseline`: profiles, effective config per round, `minCashout`, cycle gate, resultKind, rules generator, recall records, bridge, time source, evidence logging. It is being implemented in parallel by another session. Shared `core`/`fairness` edits here are sequenced after the matching baseline tasks to avoid conflicts.
- **Modified code:**
  - `packages/fairness`: strategies, simulator, report index entries for the Paper Route configs.
  - `packages/core`: papers, throws, settlement accrual, THROWN event, profile `partialCashout`.
  - `packages/rgs-client`: throws in the service, mock and suite.
  - `apps/api`: throw endpoint, Redis throw script.
  - `packages/engine`: audio subpath exports without Pixi.
  - `apps/sandbox`: game picker.
- **New code:** `apps/paper-route` (Vite + three.js client) and revised concept art in `design/paper-route/`.
- **New dependencies:** `three`, used by `apps/paper-route` only.
- **Out of scope:**
  - the Portugal two-independent-bets variant;
  - shared multiplayer rounds and operator wallet integration;
  - final art (character model, textures) and the final sound mix;
  - per-paper auto-throw ladders;
  - licences, hosting relocation and legal review.
