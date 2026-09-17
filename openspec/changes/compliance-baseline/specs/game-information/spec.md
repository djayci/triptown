## Purpose

Gives players complete, accurate game information before they commit to a bet: rules, return to player, limits, and the latency and disconnect policies. Test labs and regulators require this (GLI-19 §4.4, UKGC RTS 3/4, MGA PPD art. 7, Brazil Portaria 1.207 art. 11, Kenya Reg 45).

## ADDED Requirements

### Requirement: Rules available before betting
The game SHALL provide a rules and help screen that opens from the betting screen without placing a bet, reachable in one tap from every state in which the player can still act: before a bet, between rounds, and on a result. The control MAY be hidden while a round is running, because the wager is already committed, the outcome is fixed before the round starts and the round cannot be altered, so no decision remains for the rules to inform; it SHALL reappear the moment the round settles. Its content SHALL be generated from the active game config and profile, never hard-coded. It SHALL cover at least:
- how the multiplier grows and speeds up;
- whether setbacks are on, and if so their average rate, their effect (halving) and that they give no warning;
- the instant bust probability;
- RTP and the fact that it is the same for any cash-out strategy;
- the maximum multiplier and win;
- the maximum round duration;
- the minimum cash-out;
- how auto cash-out works;
- that payouts are rounded down to the currency unit;
- that a cash-out may return less than the stake (only when setbacks are on);
- the minimum time between rounds;
- how provably fair verification works;
- that the outcome is fixed before the round starts and tapping decorations has no effect.

#### Scenario: Open rules without betting
- **WHEN** a new player opens the game and taps the rules control before any bet
- **THEN** the full rules open without a wager and without changing the balance

#### Scenario: Rules return as soon as the round settles
- **WHEN** a round is running and the rules control is hidden, and the round then settles as a win, a below-stake return or a crash
- **THEN** the rules control is visible again before the player can place the next bet, and opening it shows the same content as before the round

#### Scenario: Rules follow the profile
- **WHEN** the rules are opened under a profile with `setbacksMode: off` and `maxMultiplier` 100
- **THEN** they say there are no setbacks, state x100 as the maximum multiplier, and do not mention below-stake returns caused by setbacks

#### Scenario: Numbers match config
- **WHEN** the RTP, instant bust probability, setback rate or caps in the config change
- **THEN** the values in the rules change to match without any copy edits

### Requirement: RTP and maximum win display
The rules SHALL always show the RTP and maximum win. When the profile's `showRtpInGame` is true, the RTP SHALL also be visible on the main game screen.

#### Scenario: In-game RTP required
- **WHEN** the game runs under a profile with `showRtpInGame: true`
- **THEN** "RTP 97.00%" is visible on the betting screen without opening the rules

### Requirement: Latency and server-time disclosure
The rules SHALL state that cash-outs are judged at the moment the server receives them, that network delay may lead to a higher or lower cash-out value or to missing a cash-out before the crash, and that auto cash-out is settled entirely on the server. When measured round-trip time is above 300 ms, the game SHALL show a connection warning.

#### Scenario: Slow connection
- **WHEN** the measured round-trip time to the API is above 300 ms
- **THEN** a visible "slow connection, cash-outs may land later" notice appears until the latency recovers

### Requirement: Disconnect and failure disclosure
The rules SHALL describe what happens when the player disconnects mid-round, according to the profile's `disconnectPolicy`. They SHALL also describe what happens if the system fails: the round is voided and the stake is refunded.

#### Scenario: Disconnect policy shown
- **WHEN** the rules are opened under a profile with `disconnectPolicy: cashout-at-disconnect`
- **THEN** they state that a disconnected round is cashed out at the multiplier shown when the connection dropped

### Requirement: Version identification
The rules screen SHALL show the game name, client version, client build hash, game config id and profile name.

#### Scenario: Version shown
- **WHEN** a player or tester opens the rules
- **THEN** the client version, build hash, config id and profile name are listed

### Requirement: Localisable text
All player-facing text SHALL come from a message catalogue keyed by the profile's `language`, with English as the fallback. No player-facing string MAY be hard-coded in rendering code.

#### Scenario: Missing translation
- **WHEN** a profile sets a language whose catalogue lacks a key
- **THEN** that key renders in English, and the missing key is reported in development builds
