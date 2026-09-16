## Purpose

Defines how a solo Whack Crash round runs on the server: the bet, how the multiplier path evolves, the setbacks, cash-out, crash and settlement. Players and operators rely on these rules for every payout.

## Requirements

### Requirement: Round start debits the bet
The system SHALL debit the full bet from the player's balance before a round starts. The system MUST NOT start a round if the debit fails.

#### Scenario: Successful start
- **WHEN** a player with balance 100.00 starts a round with bet 10.00
- **THEN** the balance becomes 90.00 and the round stream emits a START event with a round id, the seed commit and the server start time

#### Scenario: Insufficient balance
- **WHEN** a player with balance 5.00 starts a round with bet 10.00
- **THEN** the request is rejected with an insufficient-funds error and no round is created

#### Scenario: Bet outside limits
- **WHEN** a player starts a round with a bet below the minimum or above the maximum configured for their currency
- **THEN** the request is rejected with a bet-limit error and no round is created

### Requirement: Multiplier path
During a round, the multiplier value at elapsed server time t SHALL equal the growth value at t multiplied by 0.5 for each setback that has occurred at or before t. Growth SHALL start at 1.00 and never decrease. Its growth rate SHALL ramp up over time and never exceed the configured maximum rate.

#### Scenario: No setbacks
- **WHEN** no setback has occurred by time t
- **THEN** the multiplier value at t equals the growth value at t

#### Scenario: One setback
- **WHEN** the growth value at t is 4.20 and exactly one setback occurred before t
- **THEN** the multiplier value at t is 2.10

#### Scenario: Speed cap
- **WHEN** the round has passed the ramp period
- **THEN** the multiplier grows by no more than the configured maximum rate (default about 10% per 100 ms)

### Requirement: Setback events are streamed without warning
The system SHALL emit a BAD_MOLE event at the server time each setback occurs, carrying its time and factor. The system MUST NOT send any information about future setbacks before they occur.

#### Scenario: Setback occurs
- **WHEN** a setback is scheduled at 3.2 s in a running round
- **THEN** the stream emits BAD_MOLE with time 3.2 s and factor 0.5 at that moment, and no earlier event reveals it

### Requirement: Cash-out settles at server receive time
A cash-out SHALL be judged at the elapsed server time when the request is received, with no retroactive latency allowance. If the round has not crashed at that time, the system SHALL credit the bet multiplied by the multiplier value at that time, rounded down to the currency's minor unit. If the round has already crashed, the cash-out SHALL be rejected and the bet stays lost.

#### Scenario: Cash-out before crash
- **WHEN** a player with bet 10.00 cashes out and the server receives it at a time where the multiplier value is 4.2037 and the round has not crashed
- **THEN** 42.03 is credited, the round is settled as won, and the stream emits a CASHED_OUT event with the payout and the round's crash time, then closes. The server seed stays secret until the player rotates it

#### Scenario: Cash-out after crash
- **WHEN** the server receives a cash-out after the round's crash time
- **THEN** the cash-out is rejected with a round-crashed result and nothing is credited

#### Scenario: Cash-out at the same time as a setback
- **WHEN** a cash-out is received at exactly the same server time as a setback
- **THEN** the setback applies first and the payout uses the reduced value

#### Scenario: Duplicate cash-out
- **WHEN** a player sends a second cash-out for an already settled round
- **THEN** the system returns the existing settlement and credits nothing more

### Requirement: Crash ends the round
When the round reaches its crash time without a cash-out, the system SHALL settle the round as lost, emit a CRASH event with the crash time and the multiplier value at that time, and close the stream.

#### Scenario: Round crashes
- **WHEN** a round reaches its crash time and the player has not cashed out
- **THEN** the stream emits CRASH, nothing is credited, and the stream closes

#### Scenario: Instant bust
- **WHEN** a round's derived crash time is 0
- **THEN** the stream emits START immediately followed by CRASH at multiplier 1.00 and the bet is lost

### Requirement: Auto cash-out
A player SHALL be able to set an auto cash-out target multiplier greater than 1.00 before a round starts. The system SHALL settle the round at the first server time the multiplier value reaches the target, if that happens before the crash.

#### Scenario: Target reached
- **WHEN** a player bets 10.00 with auto cash-out 5.00 and the multiplier value reaches 5.00 before the crash
- **THEN** the round settles as won with 50.00 credited and the stream emits CASHED_OUT marked as automatic

#### Scenario: Target not reached
- **WHEN** the round crashes before the multiplier value reaches the target
- **THEN** the round settles as lost

### Requirement: Max win and max duration caps
The system SHALL automatically cash out a round when the payout reaches the configured max win, or when elapsed time reaches the configured max round duration, whichever comes first.

#### Scenario: Max win reached
- **WHEN** the payout at the current multiplier value reaches the configured max win
- **THEN** the round settles as won at exactly the max win and the stream emits CASHED_OUT marked as capped

#### Scenario: Max duration reached
- **WHEN** a round is still running at the configured max duration
- **THEN** the round settles as won at the multiplier value at that time

### Requirement: Rounds continue after disconnect
A round SHALL keep running on the server if the player's stream disconnects. The player SHALL be able to fetch the round's current or final state by round id.

#### Scenario: Disconnect without auto cash-out
- **WHEN** a player disconnects mid-round without auto cash-out and the round later crashes
- **THEN** the round settles as lost and fetching it returns the crash result

#### Scenario: Disconnect with auto cash-out
- **WHEN** a player disconnects mid-round with auto cash-out 3.00 and the multiplier value reaches 3.00 before the crash
- **THEN** the round settles as won and fetching it returns the payout

### Requirement: One active round per session
The system SHALL allow at most one unsettled round per player session.

#### Scenario: Second start while running
- **WHEN** a player starts a round while another of their rounds is unsettled
- **THEN** the request is rejected with a round-in-progress error
