## Purpose

Defines jurisdiction profile flags any game can use for markets that block regions, restrict where data is hosted, show tax notices or control social features. Also defines the first draft profiles and currency rules for Nigeria and Ghana.

## ADDED Requirements

### Requirement: Blocked regions
A profile SHALL be able to list blocked player regions as ISO 3166-2 subdivision codes. When the list is non-empty, a session SHALL be created only if the operator supplies the player's region and it is not in the list. A refused session SHALL return a region-blocked error and create no round.

#### Scenario: Player in a blocked region
- **WHEN** a profile blocks `NG-KN` and the operator creates a session for a player with region `NG-KN`
- **THEN** the session is refused with a region-blocked error

#### Scenario: Region missing
- **WHEN** a profile has a non-empty blocked-regions list and the operator creates a session without a player region
- **THEN** the session is refused with a region-required error

#### Scenario: Allowed region
- **WHEN** a profile blocks `NG-KN` and the operator creates a session for a player with region `NG-LA`
- **THEN** the session is created

### Requirement: Hosting region and data transfer basis
A profile SHALL list its allowed hosting regions. If players' personal data leaves the market, the profile SHALL name a data transfer basis. The server SHALL refuse sessions for a profile when its deployment region is not in the allowed list. Validation SHALL reject an active profile whose allowed regions lie outside the market and that names no transfer basis.

#### Scenario: Deployment outside allowed regions
- **WHEN** a profile allows only `af-south` and the deployment runs in `us-east`
- **THEN** sessions for that profile are refused with a profile-unavailable error

#### Scenario: Missing transfer basis
- **WHEN** an active profile for Nigeria allows hosting in `us-east` and names no data transfer basis
- **THEN** profile validation fails

### Requirement: Winnings withholding notice
A profile SHALL be able to enable a withholding notice. When enabled, the rules and the result screen SHALL show that winnings may be subject to withholding tax applied by the operator. The game SHALL NOT calculate or deduct tax itself.

#### Scenario: Notice enabled
- **WHEN** a session's profile enables the withholding notice and a round settles as a win
- **THEN** the result screen shows the gross return and the withholding notice, and the credited amount equals the game's settlement

### Requirement: Live bets feed off by default
Every profile SHALL set `liveBetsFeed`, defaulting to off. When it is off, the client SHALL NOT show any other player's bets, cash-outs or wins, real or simulated. No profile in this change SHALL enable it.

#### Scenario: Feed off
- **WHEN** a session's profile has `liveBetsFeed` off
- **THEN** no list, ticker or count of other players' activity appears in any game state

### Requirement: Draft Nigeria and Ghana profiles
The system SHALL provide draft profiles `ng-draft` and `gh-draft`, refused unless the dev profile override is enabled, until counsel review marks them reviewed. Both SHALL set:
- a 5,000 ms minimum cycle;
- quick replay off;
- setbacks off;
- adult skin;
- session clock and net position on;
- live bets feed off.

`ng-draft` SHALL block regions `NG-BA`, `NG-BO`, `NG-GO`, `NG-JI`, `NG-KD`, `NG-KN`, `NG-KT`, `NG-KE`, `NG-NI`, `NG-SO`, `NG-YO` and `NG-ZA`, and enable the withholding notice. Both profiles SHALL name a data transfer basis while hosting stays outside their market.

#### Scenario: Draft refused in production
- **WHEN** the profile override is disabled and an operator is configured with `ng-draft`
- **THEN** sessions are refused with a profile-unavailable error

#### Scenario: Draft usable in the sandbox
- **WHEN** the profile override is enabled and the sandbox selects `gh-draft`
- **THEN** a session is created with minimum cycle 5,000 ms, setbacks off and live bets feed off

### Requirement: Naira and cedi currency rules
The system SHALL define currency rules for NGN and GHS with two decimal places, a minimum and maximum stake, and formatting with the ₦ and GH₵ symbols. Stakes and returns SHALL be handled in integer minor units.

#### Scenario: Naira formatting
- **WHEN** a return of 395,000 minor units is formatted in NGN
- **THEN** the displayed amount is ₦3,950.00

#### Scenario: Stake below the naira minimum
- **WHEN** a bet's stake is below the NGN minimum stake
- **THEN** the round start is rejected with a stake-limit error
