## Purpose

Lets one game build serve many regulated markets. The server holds a named profile per market or operator that controls pacing, math variant, presentation and player-protection settings, without forking the game.

## ADDED Requirements

### Requirement: Math variant per boosts mode
Each profile SHALL carry a `boostsMode` of `off` or `boost`. The effective game config id SHALL be chosen from `setbacksMode` and `boostsMode` together, so that each of the four combinations has its own id. `boostsMode: off` SHALL use a config whose boost rate is zero, and `boost` SHALL use a config whose good mole multiplies the value up at the configured rate and factor. A profile MAY only reference a config id that has a committed RTP simulation report showing every simulated strategy within 97% ± 0.1%. Rounds SHALL record the config id they were played with.

#### Scenario: Boosted profile
- **WHEN** a round is played under a profile with `setbacksMode: halve` and `boostsMode: boost`
- **THEN** boosts occur at the configured rate and the round records a config id distinct from the unboosted variant of the same setbacks mode

#### Scenario: Boosted rising profile
- **WHEN** a round is played under a profile with `setbacksMode: off` and `boostsMode: boost`
- **THEN** no BAD_MOLE events occur, boosts still occur, and the round records the boosted rising config id

#### Scenario: Unboosted profile is unchanged
- **WHEN** a round is played under a profile with `boostsMode: off`
- **THEN** no GOOD_MOLE events occur and the round records the same config id it used before this change

#### Scenario: Boosted config without report rejected
- **WHEN** a profile sets `boostsMode: boost` for a game whose boosted config id has no committed RTP report
- **THEN** profile validation fails
