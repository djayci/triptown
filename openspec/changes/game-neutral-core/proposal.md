## Why

`AGENTS.md` requires that shared packages never depend on one particular game. They currently do. `core`, `fairness` and `rgs-client` carry Whack Crash and Paper Route vocabulary in their public types — `GameId = 'whack-crash' | 'paper-route'` (`packages/core/src/profiles.ts`), `BAD_MOLE` in the shared event union, `papers`/`paperMinor`/`throws` on every round snapshot, `papers` as a `GameConfig` field. Commit 72ddf97 deleted the Paper Route app, but its vocabulary outlived it in the shared layer.

That blocks the thing that actually makes this business work: **one certified engine, many games, differing only in what the player sees.** A game's maths, RNG and rules are the expensive part — they are what a lab certifies and what a jurisdiction approves, and changing any of them means recertification. A new game should be a skin on an already-certified engine, not a new engine. Today it cannot be, because adding a game means editing a type in `core`.

## What Changes

- **Game-neutral vocabulary in the shared packages.** **BREAKING** for every consumer of these types.
  - `GameId` becomes an open registry rather than a closed union of two literals, so adding a game does not edit `core`.
  - `BAD_MOLE` becomes `SETBACK` and `GOOD_MOLE` becomes `BOOST`. Behaviour, payloads and emission times are unchanged.
  - `papers` / `paperMinor` / `throws` / `ThrownEvent` / `ThrowEntry` / `ThrowRequest` / `ThrowOutcome` become stake-part language that describes the model rather than a newspaper.
  - `PartialCashout = 'off' | 'papers'` becomes `'off' | 'parts'`; `GameConfig.papers` becomes `stakeParts`.
  - `PAPER_ROUTE_CONFIG` and `PAPER_ROUTE_RISING_CONFIG` are removed as exports. Their config ids stay resolvable so archived RTP reports and settled rounds still verify.

Out of scope, deliberately: **no change to the round model itself.** One bet per round, exactly as certified. No new events, no new routes, no new storage. Growth, crash sampling, setbacks, boosts and RTP are untouched, so no configuration needs a fresh proof and nothing needs recertifying.

## Capabilities

### New Capabilities
<!-- none: this change renames the shared layer and adds no behaviour -->

### Modified Capabilities
- `round-engine`: the setback event is renamed from `BAD_MOLE` to `SETBACK`, and the stale "rounded down" wording in the cash-out requirement is corrected to the half-up rounding the code already performs.

## Impact

- **Packages:** `core` (events, profiles, round, host, store, rules), `fairness` (config, strategies, simulator script), `rgs-client` (types, mock, remote, shared test suite).
- **Apps:** `apps/api` and `apps/whack` follow the renames. No gameplay or visual change.
- **Wire and export contracts:** the `THROWN` event becomes `PART_SETTLED`; CSV columns `papers`/`papers_thrown` become `stake_parts`/`parts_settled`; the partial-cash-out rules keys are part-named.
- **Storage:** none. Redis key strings keep their original spelling on purpose (design D5) so no settled round is orphaned.
- **RTP:** none. No committed report changes and no new report is needed.
- **Sequencing:** `good-mole` (session `triptown-games-ba`) handed over `core`, `rgs-client` and `apps/api` before this change resumed. `night-gallop-mvp` was waiting on a multi-wager model that this change no longer provides.
