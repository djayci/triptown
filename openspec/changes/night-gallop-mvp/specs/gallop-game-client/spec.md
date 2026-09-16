## Purpose

Defines what players see, hear and can do in Night Gallop: Fence Run: the Prime Time Chase broadcast scene, the jump and refusal moments, the ladder and buttons, results, copy and art limits, and budgets for low-end phones.

## ADDED Requirements

### Requirement: Broadcast steeplechase scene
The client SHALL render one horse with one adult jockey in a floodlit steeplechase shot like a TV broadcast.
- The scene includes brush fences with each fence's multiplier shown above it, a finish post after the last fence, and a LIVE chyron.
- It MUST NOT show other runners, placings or odds.
- Values SHALL be shown as multipliers such as x2.37.

#### Scenario: Waiting to jump
- **WHEN** a round has cleared 3 Medium fences and waits for a decision
- **THEN** the screen shows one horse and jockey, current value x1.89, the next fence labelled x2.37, and no other runner or odds

### Requirement: Jump presentation is the same every time
Every JUMP SHALL play the same approach and jump animation, whatever the outcome.
- The outcome is shown only after the server's response arrives: a clean landing with a burst of turf and a zoom punch, or a refusal.
- Nothing before the response may differ between a jump that will be cleared and one that will be refused.

#### Scenario: No early tell
- **WHEN** the headless presentation check forces one cleared jump and one refused jump
- **THEN** the recorded animation frames are identical until the server response is applied

### Requirement: Refusal presentation
On a refusal the horse SHALL stop at the fence with the rider still on, and the fence shakes.
- The horse MUST NOT fall, stumble or appear injured, and no whip SHALL be shown in any state.
- The result SHALL show REFUSED, the fence number, the stake lost and the net result.
- It MUST NOT show the values of later fences or what collecting earlier would have returned.

#### Scenario: Refused at fence 3
- **WHEN** a round with stake 500.00 is refused at fence 3
- **THEN** the result shows REFUSED at fence 3, stake 500.00 lost and net −500.00, with no "would have" amount

### Requirement: Ladder and buttons
While a round runs, the client SHALL show:
- a ladder of fence values with cleared, next and upcoming states;
- a JUMP button labelled with the next value;
- a COLLECT button with the current return, disabled until at least one fence is cleared.

There SHALL be no auto-jump, auto-collect target or autoplay control. The difficulty and stake SHALL be editable only before the round starts.

#### Scenario: Before the first jump
- **WHEN** a round has started and no fence is cleared
- **THEN** JUMP shows "to x1.21", COLLECT is disabled, and no auto-play control exists

### Requirement: One request per press
Each press of JUMP or COLLECT SHALL send exactly one request with a new action key. Further presses SHALL be ignored until the response arrives, and a lost response SHALL be retried with the same action key.

#### Scenario: Repeated taps
- **WHEN** a player taps JUMP five times within 300 ms
- **THEN** exactly one jump request is sent and at most one fence is revealed

### Requirement: Win effects only above the stake
The finish line and a collect SHALL show the return and net gain, and win effects are allowed only when the return exceeds the stake. A refusal SHALL show a neutral result with no win effect, win sound, flash or "+" label.

#### Scenario: Collect above the stake
- **WHEN** a round with stake 500.00 is collected at x2.37
- **THEN** the result shows WIN 1,185.00 and net +685.00, and win effects are allowed to play

#### Scenario: Refusal is neutral
- **WHEN** a round is refused
- **THEN** no win effect, win sound, flash or "+" label plays

### Requirement: Casino vocabulary only
All player-facing text SHALL come from the message catalogue. It MUST NOT use racing or sportsbook vocabulary:
- race, racing, racecourse, meet, derby, furlong, tote, slip, odds, favourite;
- "stakes" used as a race name.

It MUST NOT use skill, luck or wealth wording (skill, timing, lucky, luck, fortune, rich, boss). The rules SHALL state that the game is a casino game decided by the server's random number generator, and that it has no race result.

#### Scenario: Catalogue check
- **WHEN** the vocabulary check scans the catalogue and the built bundle's strings
- **THEN** none of the forbidden words appear, except "stake" meaning the amount bet

### Requirement: Rules content
The rules SHALL be available from every state without a bet. They SHALL explain:
- JUMP and COLLECT, and that a refusal ends the round with the stake lost;
- that the finish line collects the top prize;
- the paytable for each difficulty;
- that every fence is decided by the server when the round starts, and that pressing faster, slower or at any moment changes nothing;
- that every way of playing returns 97%;
- the abandonment rule;
- that there is no race result and the horse, crowd and lights are decoration;
- the RTP at the minimum stake and the withholding notice when the profile enables it.

#### Scenario: Rules before betting
- **WHEN** a player opens the rules before any bet
- **THEN** every item above is shown with values from the session's configuration and profile, and the balance is unchanged

### Requirement: Adult, realistic art and audio
The horse SHALL be a realistic adult horse, and the jockey a realistic adult with visible adult age cues and standard riding kit. The client and its marketing assets MUST NOT use cartoon or mascot styling, wealth or luxury imagery, falls, whips, festival or durbar horse imagery, or references to national power grids or utilities.

#### Scenario: Art review before atlas commit
- **WHEN** the horse and jockey sprite sheets are added
- **THEN** a checklist in the art source records the review against each item above

### Requirement: Low-end device budgets
The client SHALL render its first playable frame with no more than 4 MB transferred, excluding audio loaded later. It SHALL keep audio within 1.5 MB, cap device pixel ratio at 2, pause rendering when hidden, and hold at least 30 frames per second during a jump on the reference low-end Android device.

#### Scenario: Load budget
- **WHEN** the production build is loaded with an empty cache
- **THEN** the bytes transferred before the first playable frame are at most 4 MB

#### Scenario: Frame rate during jumps
- **WHEN** ten consecutive jumps are forced on the reference device
- **THEN** the measured frame rate stays at or above 30 fps
