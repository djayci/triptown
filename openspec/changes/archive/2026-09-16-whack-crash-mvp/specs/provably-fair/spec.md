## Purpose

Lets players and auditors verify that every Whack Crash round outcome (crash time and bad mole setbacks) was fixed before the round began, and guarantees the advertised return to player whatever strategy they use.

## ADDED Requirements

### Requirement: Seed commitment before play
The system SHALL generate a secret server seed for each player session and publish its SHA-256 hash before any round uses it. Each round SHALL use the session's server seed, a player-controllable client seed and an incrementing nonce.

#### Scenario: Commit shown before first round
- **WHEN** a player opens a new session
- **THEN** the system returns the server seed hash, the current client seed and nonce 0 before any bet is placed

#### Scenario: Player changes client seed
- **WHEN** a player sets a new client seed between rounds
- **THEN** the next round uses the new client seed and the nonce sequence continues

#### Scenario: Nonce increments
- **WHEN** a round using nonce 4 starts
- **THEN** the next round in that session uses nonce 5

### Requirement: Deterministic outcome derivation
A round's crash time and setback schedule SHALL be a deterministic function of the server seed, the client seed, the nonce and the published game configuration. Nothing else SHALL influence them, including player actions.

#### Scenario: Same inputs, same outcome
- **WHEN** the derivation runs twice with identical seeds, nonce and configuration
- **THEN** both runs produce the identical crash time and identical setback times

#### Scenario: Player actions do not change outcome
- **WHEN** two rounds with identical seeds and nonce are played with different cash-out timing
- **THEN** both rounds have the same crash time and setback schedule

### Requirement: Seed reveal and verification
The system SHALL reveal a server seed when the player rotates it. For every settled round, a verifier SHALL recompute the crash time and setback schedule from the revealed seed, client seed, nonce and configuration.

#### Scenario: Rotation reveals previous seed
- **WHEN** a player rotates their server seed
- **THEN** the previous server seed is revealed, it hashes to the previously published commit, and a new commit is published

#### Scenario: Round verifies
- **WHEN** a player enters a settled round's revealed server seed, client seed and nonce into the verifier
- **THEN** the verifier shows the same crash time, setback times and settlement result the round had

#### Scenario: Tampered seed fails
- **WHEN** a revealed server seed does not hash to the published commit
- **THEN** the verifier reports the round as not verified

### Requirement: Outcome secrecy during the round
The system MUST NOT disclose the crash time, future setback times or the unrevealed server seed to the client before the round is settled.

#### Scenario: Running round inspection
- **WHEN** a client inspects all data it has received during a running round
- **THEN** it contains only past events, the seed commit and public configuration

### Requirement: Strategy-independent RTP
The published configuration SHALL give an expected return to player of 97% for any cash-out strategy, including fixed auto cash-out targets, cash-out at fixed times, cash-out right after a setback, and never cashing out. A configuration that breaks the model's validity constraints MUST be rejected.

#### Scenario: Simulation confirms RTP
- **WHEN** at least 10 million rounds are simulated for each of those strategies with the published configuration
- **THEN** each measured RTP is within 97% ± 0.1%

#### Scenario: Instant bust share
- **WHEN** at least 10 million rounds are simulated
- **THEN** the share of rounds crashing at time 0 is within 3% ± 0.05%

#### Scenario: Invalid configuration rejected
- **WHEN** a configuration sets a growth rate lower than the setback drag at any time
- **THEN** the configuration is rejected before any round can use it
