## Context

See `proposal.md` — Why. The shared packages export one game's nouns as public types, which makes every new game an edit to `core`. This change renames them and changes nothing else. The whack-crash-mvp decisions D1–D10 and the `good-mole` maths are not reopened.

## Goals / Non-Goals

**Goals**
- A game can be added without editing a type in `core` or `fairness`.
- The change is a rename, so it can be reviewed as one.

**Non-Goals**
- No change to the round model. One bet per round, as certified.
- No change to growth, hazard, setbacks, boosts or RTP, and no new events, routes or storage.
- Partial cash-out is renamed, not redesigned or removed. It stays on the compliance watch list, and no game ships on it here.
- No deprecation window. The packages export source directly and have no external consumers, so the rename is a single atomic edit.

## Decisions

### D1. `GameId` becomes an open registry
Games register at startup rather than being listed in a union in `core`.

*Why:* a closed union makes every new game a `core` edit, which is exactly what stops a new game being a skin on a certified engine. The union still listed `paper-route`, a game deleted in 72ddf97 — the failure mode was already visible.

*Alternative considered:* a plain `string`. Rejected — it loses the startup validation that catches an unknown game before a session can use it.

**A registry of names was not enough.** Registering `going-viral` still resolved `going-viral/v1`, which does not exist, so a new game would have needed its own config id — and therefore its own RTP report and its own lab acceptance. That is the recertification cost this change exists to avoid, so a game now registers *the engine it plays*: `registerGame('going-viral', 'whack-crash')` gives it Whack Crash's certified config ids and committed reports unchanged. The engine defaults to the game itself, so a game that genuinely brings new maths still can. Caught by a test written against the wrong assumption, not by review.

### D2. Retired config ids stay resolvable
`PAPER_ROUTE_CONFIG` and `PAPER_ROUTE_RISING_CONFIG` are removed as exports, but `resolveConfigId` still answers for their ids from a retired-config table that is not in `GAME_CONFIGS`.

*Why:* archived RTP reports and any settled round reference `paper-route/v1`. The verifier must stay able to check a historical round. A config id is a permanent public fact, not a build-time constant. Keeping them out of `GAME_CONFIGS` means they resolve but no new round can start on one.

### D3. The round-engine rounding requirement is corrected while it is open
`round-engine` said returns are "rounded down to the currency's minor unit". Hard rule 5 and `compliance-baseline` D23 require exact accrual rounded half-up once per round, and Nevada GCB Notice 2026-14 bans one-way rounding down.

*This is a spec correction, not a behaviour change* — `packages/core/src/money.ts:21` already rounds half-up. Flagged because it edits a requirement this change did not otherwise need to open, including its worked example (42.03 becomes 42.04 on a 4.2037 multiplier).

### D4. Neutral names describe the model, not a theme
`SETBACK` not `BAD_MOLE`, `BOOST` not `GOOD_MOLE`, stake *parts* not *papers*. Game flavour lives in the app's presentation layer.

*Why:* every themed name in the shared layer is a future rename, and a game's own vocabulary belongs in `apps/<game>` where a skin can change it without touching a certified package.

### D5. Storage key strings keep their original spelling
The Redis key builders in `apps/api/src/redis-store.ts` are renamed; the key suffixes they produce (`:throws`, `:tpapers`, `:texact`, `:tcredited`) are not.

*Why:* those strings address stored data. A settled round is an audit record (GLI-19 §4.14, five-year retention in Brazil), and renaming the keys would orphan every round already written. This change promised no data migration, and this is where that promise has to hold. A comment in the file says so, so the mismatch is not later "tidied".

## Risks / Trade-offs

- **A wide breaking rename across four packages lands in one commit** → it is mechanical and type-driven; `pnpm turbo run lint typecheck test` is the gate, and the shared round-service suite runs against both the mock and the remote service, so a missed rename fails there rather than in a game.
- **A pattern-based rename can typecheck and still be wrong** → it already did: `{ throws }` shorthand in `redis-store.ts` passed typecheck and broke seven API tests. Tests, not the compiler, are the gate for this change.
- **Wire and export contracts change** (`PART_SETTLED`, CSV columns, rules keys) → no operator has integrated yet, and the proposal declares them BREAKING.

## Migration Plan

Rename bottom-up: `fairness`, then `core`, then `rgs-client`, then the apps. Rollback is a revert — no stored round changes shape, and no report changes.

## Open Questions

- **Does a future game need more than one bet per round?** Night Gallop's two slips and Portugal's R12-13 allowance both point that way, but it is not needed to ship a game on this engine and it is not in this change. It would be its own proposal, with its own RTP proof.
