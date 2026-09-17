## Purpose

How Beat the Gate presents a crash round: what each state shows, how the lapping horse and the fixed yard gate convey progress without revealing the outcome, how cash-out and crash are shown so neither reads as a near miss, and what a player can reach before betting. The maths is the shared engine's; this capability covers only what the player sees and can do.

## ADDED Requirements

### Requirement: Beat the Gate plays a certified engine's configuration
Beat the Gate SHALL be registered against the Whack Crash engine and SHALL resolve its round configuration through the same profile machinery as any other game. It MUST NOT introduce a configuration id of its own, and MUST NOT start a round on a configuration that has no committed passing RTP report.

#### Scenario: Same configuration as the engine
- **WHEN** Beat the Gate and Whack Crash are bound to the same jurisdiction profile
- **THEN** both resolve the same configuration id

#### Scenario: No configuration without a report
- **WHEN** a profile would resolve Beat the Gate to a configuration with no passing RTP report
- **THEN** the game refuses to start a round under that profile

### Requirement: The multiplier and the money are the primary values
Throughout a running round the client SHALL display the current multiplier and the return the player would receive on cashing out, in the session's currency, as the two most prominent values. No themed element SHALL be styled as a money value or replace the multiplier.

#### Scenario: Running round
- **WHEN** a round is running at x1.42 on a ₦500.00 stake
- **THEN** the screen shows x1.42 and ₦710.00 as its two largest values

### Requirement: The gate and the horse never reveal the outcome
The yard gate SHALL stay fixed and unchanged from the start of a round until the crash event arrives. The horse's lap SHALL follow a loop whose position depends only on elapsed time modulo a fixed period, and lap speed, crowd effects, meter and music intensity SHALL depend only on the current multiplier. Nothing in the scene may move, sound or change to indicate that the round is about to end.

#### Scenario: Same multiplier, different crash times
- **WHEN** two rounds reach x4.00 and one crashes a tick later while the other continues
- **THEN** the gate, the meter and the intensity effects are identical in both at x4.00

#### Scenario: Gate at rest until the crash
- **WHEN** a round is one tick before its crash time
- **THEN** the gate is drawn exactly as it was when the round started

#### Scenario: Intensity respects the profile and the player
- **WHEN** the profile sets `intensityEffects` off, or the player's system requests reduced motion
- **THEN** the lap plays at a constant baseline with no escalation, and with reduced motion no element shakes and no particles play

### Requirement: Cash-out and crash never read as a near miss
Pressing IN! SHALL lock the displayed value immediately and send exactly one cash-out, however many times the control is pressed. The ride home through the gate SHALL play only after the server confirms the cash-out. When a round crashes, the client SHALL show the gate shut with the horse clearly out in the field, SHALL NOT show the horse moving towards or reaching the gate, and SHALL NOT use copy about how close the round came.

#### Scenario: Cash-out confirmed
- **WHEN** the player presses IN! at x5.80 and the server settles the cash-out
- **THEN** the horse rides home through the open gate and the result shows the settled return

#### Scenario: Press loses the tie
- **WHEN** the player presses IN! and the server reports the crash first
- **THEN** no ride-home animation starts, the gate shuts with the horse out in the field, and the result shows the stake lost

### Requirement: Results are shown without celebrating a loss
When a round settles, the client SHALL show the amount returned and the net result. Win effects, meaning celebration animation, win sound or a gain-styled label, SHALL play only when the return is strictly greater than the stake. A return equal to or below the stake SHALL be presented neutrally.

#### Scenario: A win
- **WHEN** a round returns ₦2,900.00 on a ₦500.00 stake
- **THEN** the result celebrates and shows a net gain of ₦2,400.00

#### Scenario: A crash
- **WHEN** a round crashes on a ₦500.00 stake
- **THEN** no win effect plays and the result shows a net loss of ₦500.00

### Requirement: Adult, harm-free art and non-racing copy
The jockey SHALL read as an adult and the horse SHALL be drawn with realistic proportions, not as a cute animal. No state SHALL show a whip, a fall, an injury or a distressed horse. Player-facing copy SHALL NOT use the words race, odds, starting gate, finish or bet slip, nor any skill or speed language.

#### Scenario: Copy check
- **WHEN** the message catalogue is scanned by the copy check
- **THEN** it contains none of the banned words, and the check fails on a fixture that does

### Requirement: Rules and market notices before any bet
The rules SHALL be reachable before any bet and SHALL state:
- the RTP band from the committed report;
- that the outcome of every round is fixed when it starts;
- that the gate, the horse and the crowd are decoration and pressing faster changes nothing;
- the maximum win, rounding, and the disconnect policy.

When the session's profile enables the withholding notice, the rules and every winning result SHALL show it.

#### Scenario: Rules before betting
- **WHEN** the player opens the rules before placing a bet
- **THEN** the rules show the RTP band for the resolved configuration and the decoration statement, and no bet is placed

#### Scenario: Withholding notice
- **WHEN** a session under `ng-draft` settles a winning round
- **THEN** the result shows the withholding notice alongside the gross return
