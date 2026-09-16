## Purpose

Keeps a complete, retrievable record of every round, so players can review past play and operators, support staff and test labs can reconstruct any result (GLI-19 §4.14 and §2.8, Portugal R37, Brazil items 54–55).

## ADDED Requirements

### Requirement: Round records
The system SHALL store a record for every round with at least:
- round id, session id and player id;
- game id, config id and profile name;
- client version;
- start time and settlement time (server time);
- stake, and balance before and after;
- auto cash-out target;
- the settlement's status and reason;
- each cash-out's time and multiplier;
- total return and net;
- crash time and crash multiplier;
- setback times;
- seed commit, client seed and nonce;
- void or refund status.

A record SHALL NOT be changed after settlement except to add a void or refund entry.

#### Scenario: Record after a win
- **WHEN** a round is cashed out at x2.40 with stake 10.00 and balance before 100.00
- **THEN** the stored record shows balance before 100.00, balance after 114.00, return 24.00, net +14.00, the cash-out time and multiplier, the crash time and the seed commit

#### Scenario: Records hide outcome data while running
- **WHEN** a round is still running and its record is requested through any API
- **THEN** the crash time and future setbacks are not included

### Requirement: In-game history view
The game SHALL offer a history view listing at least the player's last 50 settled rounds, newest first. Each entry SHALL show date and time, stake, result (cashed out at xN, crashed at xN, or void), return, net, and crash point. Selecting an entry SHALL show its full record, clearly labelled as a past round. Results SHALL be shown in text, not only by colour.

#### Scenario: Open history
- **WHEN** a player who has played 3 rounds opens the history view
- **THEN** 3 entries appear with date and time, stake, result text, return, net and crash point

#### Scenario: Colour-independent result
- **WHEN** the history strip or view is rendered in greyscale
- **THEN** each result is still identifiable as cashed out, crashed or void, and net positive or negative

### Requirement: Operator history API and export
The API SHALL provide an authenticated operator endpoint that returns round records for a session or player within a time range, with pagination. It SHALL also offer a CSV export with one row per round containing every record field.

#### Scenario: Export a player's rounds
- **WHEN** an operator requests a CSV export for a player for the last 7 days
- **THEN** the response is a CSV with a header row and one row for each round that player settled in that range

#### Scenario: Unauthorised access
- **WHEN** a request without valid operator credentials asks for round records
- **THEN** it is rejected with 401 and no records are returned

### Requirement: Retention
Round records SHALL be kept for at least the longest retention period among the profiles in use, and never less than 5 years for profiles that require it. Retention SHALL be configurable per deployment.

#### Scenario: Record older than a year
- **WHEN** an operator requests a round settled 13 months ago
- **THEN** the record is returned intact
