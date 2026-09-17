## Purpose

How The Lift presents a crash round: what each state shows, how the ascent conveys progress without ever revealing the outcome, and what a player can reach before betting. The maths is the shared engine's; this capability covers only what the player sees and can do.

## ADDED Requirements

### Requirement: The Lift plays a certified engine's configuration
The Lift SHALL be registered against the Whack Crash engine and SHALL resolve its round configuration through the same profile machinery as any other game. It MUST NOT introduce a configuration id of its own, and MUST NOT start a round on a configuration that has no committed passing RTP report.

#### Scenario: Same configuration as the engine
- **WHEN** The Lift and Whack Crash are bound to the same jurisdiction profile
- **THEN** both resolve the same configuration id, and the player's chance of any outcome is identical

#### Scenario: No configuration without a report
- **WHEN** a profile would resolve The Lift to a configuration with no passing RTP report
- **THEN** the game refuses to start a round under that profile

### Requirement: The multiplier and the money are the primary values
Throughout a running round the client SHALL display the current multiplier and the return the player would receive if they collected now, in the session's currency. Both SHALL be more prominent than any themed element. The floor number is decoration and SHALL be visually subordinate to both, never styled as a money value.

#### Scenario: Running round
- **WHEN** a round is running at x2.41 on a ₦100.00 stake
- **THEN** the screen shows x2.41 and ₦241.00 as its two largest values, with the floor number smaller and plainly not a currency amount

#### Scenario: Floor never substitutes for the multiplier
- **WHEN** any state of the game is shown
- **THEN** the multiplier is present as a multiplier, and the floor number never appears in its place

### Requirement: The ascent conveys progress but never the outcome
The client SHALL animate a continuous ascent while a round runs. The speed and intensity of that animation SHALL be a function of the current multiplier only. It MUST NOT vary with the crash time, the remaining time, or any value the player cannot already read on screen. Nothing in the scene may fray, flicker, slow, sound or otherwise change to indicate that the round is about to end.

#### Scenario: Intensity follows the multiplier
- **WHEN** two rounds reach the same multiplier
- **THEN** the ascent looks and sounds the same at that moment in both, regardless of when each round ends

#### Scenario: No cue before the crash
- **WHEN** a round is one tick from its crash time
- **THEN** the scene is indistinguishable from the same multiplier in a round that continues

#### Scenario: Intensity respects the profile
- **WHEN** the active profile sets `intensityEffects` off
- **THEN** the ascent plays at a constant baseline with no escalation, and the round is otherwise unchanged

#### Scenario: Reduced motion
- **WHEN** the player's system requests reduced motion
- **THEN** the ascent, streaks and particles stop, no element shakes, and every value stays legible

### Requirement: The shaft has no visible end
The client MUST NOT show a top floor, a final floor number, a progress bar toward a maximum, or any other element from which a player could infer how far the round can still go.

#### Scenario: Unbounded floors
- **WHEN** a round reaches a high multiplier
- **THEN** the floor count continues without approaching a displayed ceiling

### Requirement: Results are shown without celebrating a loss
When a round settles, the client SHALL show the amount returned and the net result for the round. Win effects — celebratory animation, sound or a gain-styled label — SHALL play only when the return is strictly greater than the total staked. A return equal to or below the stake SHALL be presented neutrally, and a crash SHALL state the outcome without dramatising how close the round came to anything.

#### Scenario: A win
- **WHEN** a round returns ₦300.00 on a ₦100.00 stake
- **THEN** the result celebrates and shows the net gain

#### Scenario: A return at or below the stake
- **WHEN** a round returns ₦72.00 on a ₦100.00 stake
- **THEN** no celebratory animation or sound plays, no gain-styled label appears, and the screen shows the amount returned and the net loss

#### Scenario: A crash
- **WHEN** the cable goes with the stake still in play
- **THEN** the result states that the round ended and the stake was not returned, with no near-miss framing and no statement of what the round would have reached

### Requirement: The player can read the rules before betting
The client SHALL make the full rules reachable from every state without placing a bet and without changing the balance. The rules SHALL state how the prize is calculated, that the floor number is decoration tracking the same multiplier, the return to player and how it was derived, the maximum win, the maximum round duration, the minimum and maximum stake, the minimum cash-out, how returns are rounded, the timing and disconnect policy, the share of rounds that end immediately, and that the outcome is fixed when the round starts and nothing the player taps can change it.

#### Scenario: Rules from a running round
- **WHEN** a player opens the rules while a round is running
- **THEN** the rules are shown in full, the round continues on the server, and the balance is unchanged

#### Scenario: Rules state the decoration
- **WHEN** a player reads the rules
- **THEN** they state plainly that the floor number carries no separate value and that tapping the scene does nothing

### Requirement: Skin follows the profile
The client SHALL select its art, palette and audio from the active jurisdiction profile's skin, and MUST NOT load assets for a skin the profile did not select.

#### Scenario: Regulated profile
- **WHEN** a session is bound to a profile whose skin is `adult`
- **THEN** the client loads only the adult skin's assets and no candy-skin asset is requested

### Requirement: One bet, one deliberate action per round
A round SHALL carry exactly one bet. Starting the next round SHALL require a fresh, deliberate press after the profile's minimum cycle has elapsed; holding the control MUST NOT start successive rounds, and the client MUST NOT offer auto-rebet. A player MAY set an auto cash-out target before the round starts.

#### Scenario: Holding the control
- **WHEN** a player holds the start control down
- **THEN** exactly one round starts, and the next needs a release and a fresh press

#### Scenario: Repeated collect taps
- **WHEN** a player taps collect several times quickly
- **THEN** exactly one collect request is sent
