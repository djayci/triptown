## Purpose

Lets one game build serve many regulated markets. The server holds a named profile per market or operator that controls pacing, math variant, presentation and player-protection settings, without forking the game.

## ADDED Requirements

### Requirement: Server-authoritative profiles
The system SHALL define named jurisdiction profiles on the server. Each profile SHALL specify at least: `minCycleMs`, `quickReplay`, `setbacksMode` (`off` or `halve`), `maxMultiplier`, `minCashout`, `skin`, `soundDefault`, `intensityEffects`, `showRtpInGame`, `showSessionClock`, `showNetPosition`, `idlePromptMs`, `disconnectPolicy`, `language` and `operatorOrigins`. Every session SHALL be bound to exactly one profile when it is created, and the client SHALL receive the profile read-only as part of the session. The client MUST NOT be able to change any profile value.

#### Scenario: Session created with a named profile
- **WHEN** a session is created for an operator configured with profile `regulated-uk`
- **THEN** the session info includes that profile's values and every round in the session follows them

#### Scenario: Default profile
- **WHEN** a session is created without an operator profile
- **THEN** the session is bound to the deployment's configured default profile

#### Scenario: Client tampering ignored
- **WHEN** a client sends a request that includes different profile values
- **THEN** the server ignores them and applies the bound profile

### Requirement: Profile validation
The system MUST reject an invalid profile at startup, before any session can use it. At minimum these are invalid:
- `minCycleMs` below 0;
- `minCashout` below 1.00;
- `maxMultiplier` at or below `minCashout`;
- an unknown `setbacksMode`, `skin` or `disconnectPolicy`;
- a regulated profile without any `operatorOrigins`.

#### Scenario: Invalid profile blocks startup
- **WHEN** a profile sets `maxMultiplier` to 1.00
- **THEN** the API fails to start and reports which profile field is invalid

### Requirement: Math variant per setbacks mode
Each combination of game and `setbacksMode` SHALL use its own game config id. `setbacksMode: off` SHALL use a rising-only multiplier with no setbacks, and `halve` SHALL use the existing x0.5 setbacks. Each config id MUST have its own committed RTP simulation report showing every simulated strategy within 97% ± 0.1% before a profile may reference it. Rounds SHALL record the config id they were played with.

#### Scenario: Regulated profile plays rising-only rounds
- **WHEN** a round is played under a profile with `setbacksMode: off`
- **THEN** no BAD_MOLE events occur, the multiplier never decreases, and the round records the rising-only config id

#### Scenario: Light profile keeps setbacks
- **WHEN** a round is played under a profile with `setbacksMode: halve`
- **THEN** setbacks occur as specified in the existing round rules and the round records the halving config id

#### Scenario: Config without report rejected
- **WHEN** a profile references a config id that has no committed RTP report
- **THEN** profile validation fails

### Requirement: Maximum multiplier cap
The system SHALL cash out a round automatically when the multiplier reaches the profile's `maxMultiplier`, settling at exactly that multiplier, if this happens before the crash.

#### Scenario: Cap reached
- **WHEN** a profile sets `maxMultiplier` to 100 and a round's multiplier reaches 100 before the crash
- **THEN** the round settles as won at x100 with reason `maxWin`

### Requirement: Minimum cash-out
The system SHALL reject a manual cash-out while the current multiplier is below the profile's `minCashout`, and the round SHALL continue. Auto cash-out targets below `minCashout` MUST be rejected when the round starts.

#### Scenario: Cash-out below minimum
- **WHEN** a profile sets `minCashout` to 1.10 and a player cashes out at x1.05
- **THEN** the cash-out is rejected with a `below_min_cashout` result and the round keeps running

#### Scenario: Cash-out at minimum
- **WHEN** the multiplier is x1.10 or higher under the same profile
- **THEN** the cash-out settles normally

### Requirement: Kill switch
An operator-level control SHALL disable new rounds for a game, a config id or a profile. Rounds already running when the switch is set SHALL still settle normally.

#### Scenario: Game disabled mid-session
- **WHEN** the kill switch is set for `whack-crash` while a player has a running round
- **THEN** the running round settles normally, and the player's next bet is rejected with `game_disabled`
