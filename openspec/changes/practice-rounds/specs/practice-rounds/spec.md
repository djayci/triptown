## Purpose

A round played with no stake, so a player can see how the game behaves without betting. The outcome of any round is fixed before it starts and no skill affects it, so nothing about watching one has to be paid for. This capability covers how a practice round is started, how it draws randomness, how it is recorded, how each market gates it, and the presentational limits that stop a free round becoming an advertisement for the paid one.

## ADDED Requirements

### Requirement: Practice rounds consume randomness like any other round
A practice round SHALL advance the session's nonce and SHALL derive its outcome from the same `HMAC(serverSeed, clientSeed:nonce:stream:i)` construction, config id and seed stream as a staked round. The system MUST NOT derive a practice round from a nonce it will later reuse, and MUST NOT expose the outcome of any nonce before a round has been started against it.

This is the requirement the whole capability rests on. A practice round that peeked at the next nonce, or replayed one, would let a player watch a round for free, learn its crash point and then stake on it.

#### Scenario: Nonce advances
- **WHEN** a session plays a practice round
- **THEN** the session's nonce advances by exactly the same amount as for a staked round

#### Scenario: A practice round cannot predict a later one
- **WHEN** a player plays a practice round and records its crash point, then starts any further round
- **THEN** the further round's outcome is independent of the practice round's and cannot be derived from it

#### Scenario: Verifiable after the fact
- **WHEN** the server seed is later revealed
- **THEN** a practice round can be verified from its seeds exactly as a staked round can, using its recorded config id, client seed and nonce

### Requirement: Practice rounds are recorded, not hidden
A practice round SHALL be persisted as a round record carrying every field a staked round carries, plus a flag marking it as practice, with a stake of zero and a return of zero. It SHALL appear in the player's per-round history and in the operator recall record, marked as practice in both.

A practice round MUST NOT be omitted from any record. An operator SHALL be able to separate staked from practice volume, and a dispute about a practice round SHALL be reconstructable on the same evidence as any other.

#### Scenario: In the player's history
- **WHEN** a player opens the round history after playing a practice round
- **THEN** the practice round is listed in order with its multiplier and result, marked as practice, showing no money

#### Scenario: In the operator recall record
- **WHEN** an operator fetches the recall record for a practice round
- **THEN** it carries the round id, config id, seed commit, client seed, nonce, crash point, modifier times and settlement, with stake and return of zero and the practice flag set

#### Scenario: Separable from staked play
- **WHEN** an operator reports on a session's activity
- **THEN** practice rounds can be counted and excluded from staked turnover without inspecting anything but the flag

### Requirement: Practice rounds obey the market's pacing
A practice round SHALL be subject to the same minimum gap between round starts as a staked round, measured across all rounds regardless of type, and SHALL require the same deliberate release-and-press to begin.

A player MUST NOT be able to use practice rounds to experience a faster cycle than a paying player, or to fill the enforced gap between staked rounds with continuous play.

#### Scenario: Gap enforced across the mix
- **WHEN** a player alternates staked and practice rounds
- **THEN** every consecutive pair of round starts is at least the profile's minimum gap apart, whatever their types

#### Scenario: Practice cannot fill the wait
- **WHEN** a staked round settles and the player immediately asks for a practice round
- **THEN** it is refused until the minimum gap has elapsed, exactly as a staked round would be

### Requirement: Each market decides whether practice rounds exist
Whether practice rounds are offered SHALL be a jurisdiction profile flag, defaulting to off. Turning it on for a market SHALL be a deliberate, recorded decision, not a default inherited by new profiles. The behaviour SHALL never be forked per market.

Free play is treated as advertising in several markets, which brings age-gating and content rules with it, and those obligations differ by jurisdiction.

#### Scenario: Off by default
- **WHEN** a new jurisdiction profile is created from the base template
- **THEN** practice rounds are not permitted until the profile explicitly enables them

#### Scenario: Server refuses what the profile forbids
- **WHEN** a practice round is requested for a session whose profile does not permit it
- **THEN** the server refuses it, independently of whether the client offered the control

### Requirement: A practice round shows no money and promises nothing
A practice round SHALL display the multiplier and the crash point exactly as a staked round does, and SHALL display no money at any point: no stake, no running payout, no "+" amount and no balance movement. It MUST NOT state or imply what a staked bet would have returned, at any multiplier.

The rules screen SHALL describe what a practice round is, state that it involves no stake and no payout, and state that its odds are identical to a staked round.

#### Scenario: No counterfactual winnings
- **WHEN** a practice round reaches x50 and is cashed out
- **THEN** the screen shows the multiplier and that the round was practice, and at no point shows or implies a monetary amount that could have been won

#### Scenario: Described in the rules
- **WHEN** a player opens the rules under a profile that permits practice rounds
- **THEN** the rules state that a practice round carries no stake, pays nothing, and runs on exactly the same odds as a staked round

#### Scenario: Not described where unavailable
- **WHEN** a player opens the rules under a profile that does not permit practice rounds
- **THEN** the rules make no mention of practice rounds
