## Why

A player who wants to see how the game behaves has only one option today: bet money. The outcome of a round is fixed before it starts and no skill affects it, so there is nothing about a round that has to be paid for in order to be watched. Offering a stake-free round costs the studio nothing in edge, gives a player somewhere to go other than the next bet, and makes the "the outcome is already decided" claim in the rules something a player can see rather than take on trust.

The reason this needs a spec rather than a quick button is that a practice round touches the part of the system where a mistake is unrecoverable. Every round's outcome comes from `HMAC(serverSeed, clientSeed:nonce:stream:i)`. If a practice round peeks at the next nonce, or replays one, a player can watch a round for free, learn its crash point, and then bet on it. That is not an information leak, it is a solved game, and it would be indistinguishable from an honest implementation until someone exploited it.

## What Changes

- A session can start a **practice round**: no stake, no debit, no payout, same maths, same config id, same seed stream.
- A practice round **consumes a nonce and is persisted exactly like a paid round**. It is distinguished only by a flag, never by being absent from the record.
- Practice rounds are subject to the profile's `minCycleMs` gap, so they cannot be used to play faster than a paying player.
- Practice rounds appear in per-round history and in operator recall records, marked as practice, so a dispute can be reconstructed and an operator can tell paid volume from unpaid.
- A new jurisdiction profile flag gates the feature. It defaults **off**, including for `light`, and each market turns it on deliberately.
- The client gains a second action on the result screen beside PLAY AGAIN, and the rules screen gains a line describing what a practice round is and is not.
- **No money is shown at any point in a practice round**: no stake, no running payout, no "+" amount, no balance movement, and above all no statement of what a bet would have returned.

## Capabilities

### New Capabilities

- `practice-rounds`: a round played with no stake — how it is started, how it consumes randomness, how it is recorded, how it is gated per market, and the presentational limits that stop it becoming an advertisement for the paid game.

### Modified Capabilities

- `round-engine`: the debit requirement currently reads that the system SHALL debit the full bet before a round starts, which admits no stake-free round. It needs to say that a round is either staked — and then debited in full before it starts — or explicitly a practice round carrying no stake, with no third case.
- `whack-game-client`: the cashed-out and crashed states currently specify a single play-again action. They need to allow a second, clearly subordinate action, and to forbid money in a practice round's presentation.

## Impact

- **`packages/core`** — `host.ts` (round start, nonce advance, debit, settlement), `store.ts` (round record), `profiles.ts` (the new flag and its validation), `rules.ts` (the rules line).
- **`packages/rgs-client`** — the `RoundService` start input and history entry types, `MockRoundService`, and the shared round-service test suite, so the mock and the future remote service are held to the same behaviour.
- **`apps/api`** — the start-round route and the recall/history routes.
- **`apps/whack` and `packages/crash-client`** — the result-screen action, the running presentation with money suppressed, and the history panel's practice marker.
- **Compliance** — `presentation-check.mjs` must cover a practice round producing no win cue and no money; `timing-check.mjs` must show a practice round obeying `minCycleMs`. Both are release gates.
- **No change to** the maths, the config ids, the RNG, or any committed RTP report. A practice round plays an already-certified config unchanged, so nothing here needs recertification.
