## MODIFIED Requirements

### Requirement: Strategy-independent RTP
The published configuration SHALL give an expected return to player of 97% for any cash-out strategy, including fixed auto cash-out targets, cash-out at fixed times, cash-out right after a setback, cash-out right after a boost, and never cashing out. The crash hazard SHALL be derived from the expected multiplier including both setback drag and boost lift, so that adding boosts changes round length but not return. A configuration that breaks the model's validity constraints MUST be rejected.

#### Scenario: Simulation confirms RTP
- **WHEN** at least 10 million rounds are simulated for each of those strategies with the published configuration
- **THEN** each measured RTP is within 97% ± 0.1%

#### Scenario: Instant bust share
- **WHEN** at least 10 million rounds are simulated
- **THEN** the share of rounds crashing at time 0 is within 3% ± 0.05%

#### Scenario: Boosts do not pay for themselves
- **WHEN** the boosted configuration and the unboosted configuration are each simulated for at least 10 million rounds
- **THEN** both measure 97% ± 0.1% and the boosted one has the shorter mean round length

#### Scenario: Invalid configuration rejected
- **WHEN** a configuration sets a growth rate lower than the net modifier drift at any time, or a boost factor at or below 1, or a negative boost rate
- **THEN** the configuration is rejected before any round can use it

### Requirement: Deterministic outcome derivation
A round's crash time, setback schedule and boost schedule SHALL be a deterministic function of the server seed, the client seed, the nonce and the published game configuration, each drawn from its own named stream. Nothing else SHALL influence them, including player actions.

#### Scenario: Same inputs, same outcome
- **WHEN** the derivation runs twice with identical seeds, nonce and configuration
- **THEN** both runs produce the identical crash time, identical setback times and identical boost times

#### Scenario: Player actions do not change outcome
- **WHEN** two rounds with identical seeds and nonce are played with different cash-out timing
- **THEN** both rounds have the same crash time, setback schedule and boost schedule

#### Scenario: Streams are independent
- **WHEN** boosts are derived for a round
- **THEN** they come from the boost stream only, and changing the boost configuration does not change the crash time drawn from the crash stream for the same seeds

## ADDED Requirements

### Requirement: Boost times are verifiable after the round
The verifier SHALL reproduce boost times from the revealed server seed, the client seed, the nonce and the published config id, and SHALL report a mismatch when any boost time differs from the one recorded for the round.

#### Scenario: Player verifies a boosted round
- **WHEN** a player verifies a settled round that had boosts, using the revealed seed and the round's config id
- **THEN** the verifier reproduces the same boost times and marks the round verified

#### Scenario: Tampered boost list
- **WHEN** a round record lists a boost time that the seeds do not produce
- **THEN** verification fails
