## MODIFIED Requirements

### Requirement: Multiplier path
During a round, the multiplier value at elapsed server time t SHALL equal the growth value at t multiplied by the setback factor for each setback that has occurred at or before t, and by the boost factor for each good mole boost that has occurred at or before t. Growth SHALL start at 1.00 and never decrease. Its growth rate SHALL ramp up over time and never exceed the configured maximum rate. When a setback and a boost fall on the same time, the setback SHALL be applied first.

#### Scenario: No setbacks
- **WHEN** no setback and no boost has occurred by time t
- **THEN** the multiplier value at t equals the growth value at t

#### Scenario: One setback
- **WHEN** the growth value at t is 4.20 and exactly one setback occurred before t
- **THEN** the multiplier value at t is 2.10

#### Scenario: One boost
- **WHEN** the growth value at t is 4.20, the boost factor is 1.05 and exactly one boost occurred before t
- **THEN** the multiplier value at t is 4.41

#### Scenario: A boost and a setback
- **WHEN** the growth value at t is 4.20 and one setback and one boost occurred before t
- **THEN** the multiplier value at t is 2.21 (4.20 × 0.5 × 1.05, rounded for display only)

#### Scenario: Speed cap
- **WHEN** the round has passed the ramp period
- **THEN** the multiplier grows by no more than the configured maximum rate (default about 10% per 100 ms)

### Requirement: Setback events are streamed without warning
The system SHALL emit a BAD_MOLE event at the server time each setback occurs, carrying its time and factor, and a GOOD_MOLE event at the server time each boost occurs, carrying its time and factor. The system MUST NOT send any information about future setbacks or boosts before they occur.

#### Scenario: Setback occurs
- **WHEN** a setback is scheduled at 3.2 s in a running round
- **THEN** the stream emits BAD_MOLE with time 3.2 s and factor 0.5 at that moment, and no earlier event reveals it

#### Scenario: Boost occurs
- **WHEN** a boost is scheduled at 5.4 s in a running round
- **THEN** the stream emits GOOD_MOLE with time 5.4 s and factor 1.05 at that moment, and no earlier event reveals it

#### Scenario: Reconnect replays past modifiers only
- **WHEN** a player reconnects at 6 s to a round that had a boost at 2 s and has a setback scheduled at 9 s
- **THEN** the replay contains the boost at 2 s and nothing about the setback at 9 s

## ADDED Requirements

### Requirement: Boosts are settled like any other modifier
A cash-out, an auto cash-out, a max win cap and a crash SHALL all value the round using the modifiers that occurred at or before the settled time, boosts included. A boost scheduled after the settled time MUST NOT affect the payout, and a boost at exactly the settled time SHALL count.

#### Scenario: Boost just before cash-out
- **WHEN** a boost occurs at 4.0 s and the server receives the cash-out at 4.2 s
- **THEN** the payout uses the boosted value

#### Scenario: Boost after the crash
- **WHEN** a round crashes at 3.0 s and a boost would have occurred at 3.5 s
- **THEN** the round is a loss, the boost is not emitted, and the record contains no boost after the crash time

#### Scenario: Boost reaches the max win cap
- **WHEN** a boost takes the value above the configured maximum win multiplier
- **THEN** the round settles at the maximum win multiplier at that moment, and the excess above the cap is not paid
