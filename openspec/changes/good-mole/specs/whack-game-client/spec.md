## MODIFIED Requirements

### Requirement: Bad mole setback feedback
When a BAD_MOLE event arrives, the game SHALL show the value dropping: the previous value struck through, the new value, a red badge with the factor, and the bad mole appearing beside the main mole. When a GOOD_MOLE event arrives, the game SHALL show the value rising with its own feedback, which SHALL be visibly calmer than the setback: no screen shake, no stage tilt and no hazard flash. Neither mole SHALL be tappable or respond to input, and neither SHALL be announced before its event arrives.

#### Scenario: Setback shown
- **WHEN** a BAD_MOLE event arrives while the displayed multiplier is 4.20
- **THEN** the game shows 4.20 crossed out, 2.10 as the current multiplier and the WHACK button reads the halved cash-out value

#### Scenario: Boost arrives
- **WHEN** a GOOD_MOLE event arrives during a round
- **THEN** the multiplier jumps to the new value, a green badge shows the gain (+5%), a rising blip plays, and the good mole pops from one side without shaking or tilting the stage

#### Scenario: Moles are decoration
- **WHEN** the player taps a good mole or a bad mole
- **THEN** nothing happens to the round, and no copy suggests the tap mattered

#### Scenario: Reduced motion
- **WHEN** the player has reduced motion enabled and a boost arrives
- **THEN** the value updates with no flying badge and no hop, and the sound still plays

## ADDED Requirements

### Requirement: Boosts in history and verification
The round history entry and the verification panel SHALL list the round's boost times and factor alongside its setbacks, labelled as past-round data.

#### Scenario: Open a boosted round in history
- **WHEN** a player opens a settled round that had two boosts
- **THEN** both boost times and the boost factor are shown next to the setbacks, the crash point and the return
