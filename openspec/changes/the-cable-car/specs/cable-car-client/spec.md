## Purpose

How The Cable Car presents a crash round whose outcome is revealed on the player's collect rather than as it happens: what each state shows, what the ride may never reveal about where it ends, and what the player must be told while a locked value is on screen but not yet won. The maths is the shared engine's; this capability covers only what the player sees and can do.

## ADDED Requirements

### Requirement: The Cable Car plays a certified engine's configuration
The Cable Car SHALL be registered against the Whack Crash engine and SHALL resolve its round configuration through the same profile machinery as any other game. It MUST NOT introduce a configuration id of its own, and MUST NOT start a round on a configuration that has no committed passing RTP report.

#### Scenario: Same configuration as the engine
- **WHEN** The Cable Car and Whack Crash are bound to the same jurisdiction profile
- **THEN** both resolve the same configuration id, and the player's chance of any outcome is identical

#### Scenario: No configuration without a report
- **WHEN** a profile would resolve The Cable Car to a configuration with no passing RTP report
- **THEN** the game refuses to start a round under that profile

### Requirement: The collect asks for the next stop, and the wait reveals nothing
When the profile resolves this game to a deferred reveal, collecting SHALL lock the displayed value at the moment of the press and enter a waiting state before any result is shown. That state SHALL last a fixed duration measured from the press, and the result SHALL be shown at the later of that duration and the arrival of the settlement. Every observable property of the waiting state — its length, its animation, its sound, its text and the value it shows — SHALL be identical for a round that won and a round that lost.

The wait MUST NOT be derived from the scene: it may not end when the car reaches a drawn station, nor vary with the distance to one. A wait whose length depended on the outcome, or on where the player pressed relative to the scenery, would either leak the result or make one stopping point better than another.

#### Scenario: The same wait either way
- **WHEN** two rounds are collected at the same value, one that had already crashed and one that had not
- **THEN** the two screens are indistinguishable from the press until the result is shown, and the result appears no sooner for one than the other

#### Scenario: The wait is not tied to the scenery
- **WHEN** the player collects immediately after passing a station and again immediately before reaching one
- **THEN** the waiting state lasts the same fixed time in both cases

#### Scenario: A settlement that arrives late
- **WHEN** the settlement arrives after the fixed duration has already elapsed
- **THEN** the result is shown as soon as it arrives, and the waiting state is not extended beyond it

### Requirement: A locked value is never presented as won
While a round is waiting to be revealed, the client SHALL show the locked multiplier and the amount that would be paid if the round is live, and SHALL make plain that neither has been won. It MUST NOT style that amount as a settled win, MUST NOT play a win cue, and MUST NOT change the balance or the net position until the result is shown.

#### Scenario: The money during the wait
- **WHEN** the player has asked for the next stop at x2.48 on a $10.00 stake
- **THEN** the screen shows x2.48 and $24.80 in the styling used for values not yet won, with a caption stating the amount is conditional, and the balance still shows the stake as spent

#### Scenario: No early result through the session figures
- **WHEN** a settlement arrives during the waiting state
- **THEN** the balance, the net position and the round history are unchanged until the result is shown

### Requirement: The live win chance is shown while a round runs
Because the multiplier continues to climb after a crash the player cannot see, the client SHALL display the probability that the round is still live at the value shown, derived from the published return to player divided by that value. It SHALL be present whenever a deferred-reveal round is running, and SHALL be shown to at least one tenth of a percent, with values below that floor shown as such rather than rounded to zero.

The rules SHALL state that this figure is derived from the nominal return to player, and that the chance multiplied by the value equals that same figure at every value, so that no stopping point returns more than any other over time.

#### Scenario: The chance is shown with the value
- **WHEN** a deferred-reveal round is running at x2.48 with a 97% published return
- **THEN** the screen shows a live chance of 39.1%

#### Scenario: A vanishing chance is not shown as zero
- **WHEN** the value has climbed far enough that the chance falls below one tenth of a percent
- **THEN** the screen says so explicitly rather than displaying 0.0%

#### Scenario: No published band, no bare figure
- **WHEN** no measured return band exists for the configuration in play
- **THEN** the chance is shown with the same incompleteness marker the published return carries, or not at all, and never as an authoritative figure

### Requirement: The line has no visible end
The client MUST NOT draw a terminus, a summit, a final station, a progress bar toward the maximum win, or any other indication of where or when the ride ends. The rope SHALL continue out of frame into cover at all times.

#### Scenario: Nothing marks the end
- **WHEN** any running state is shown, at any value
- **THEN** no element on screen indicates how much of the ride remains

### Requirement: The ride conveys progress but never the outcome
The client SHALL animate a continuous ride while a round runs. Speed, colour, particle density and every other animated property SHALL be a function of the current multiplier only. They MUST NOT vary with the crash time, the remaining time, or any value the player cannot already read on screen. Nothing may slow, chime, flicker, fray or otherwise change to indicate that the round is about to end.

#### Scenario: Two rounds at the same value look the same
- **WHEN** two rounds reach x4.00 with different crash times
- **THEN** the scene is in the same state in both, including the part of the building passed and every effect

#### Scenario: The stop is abrupt
- **WHEN** a round ends
- **THEN** no deceleration, sound, light or animation preceded it

### Requirement: The stations are scenery and never cash-out points
The client SHALL show named stations passing as the value climbs, each entered at a multiplier. They SHALL NOT gate, time or otherwise restrict collecting: the player may collect at any instant a round is running. No station SHALL be presented as a better or safer place to collect.

#### Scenario: Collecting between stations
- **WHEN** the player collects at any moment while a round runs
- **THEN** the collect is accepted on the same terms wherever the car is in the scene

#### Scenario: Stations follow the value
- **WHEN** two rounds reach the same value
- **THEN** both have passed the same stations

### Requirement: Nothing in the scene is harmed
The ride SHALL end by arriving. The client MUST NOT depict the rope breaking, the car falling, an impact, or a point of view riding the car down, in the game or in any promotional asset. People MAY be shown in the car, and MUST read as adults.

#### Scenario: The ending
- **WHEN** a round ends
- **THEN** the car comes to a stop and its doors open, and nothing falls or is damaged

#### Scenario: The riders
- **WHEN** the car is shown
- **THEN** the people in it read as adults, with adult proportions and no cute or childlike styling

### Requirement: The player can read the rules before betting
The client SHALL make the rules, the fairness verification and the round history reachable from the betting screen before any bet is placed, and while a round runs. The rules SHALL cover the deferred reveal explicitly: that the outcome is fixed when the round starts, that asking for the next stop locks the value but does not end the round's uncertainty, and that where the ride ends cannot be predicted and nothing the player taps changes it.

#### Scenario: Rules before any bet
- **WHEN** the game has loaded and no bet has been placed
- **THEN** a control opens the rules, and the rules describe the deferred reveal

#### Scenario: The fairness claim is true
- **WHEN** the rules say a round can be verified from its seeds
- **THEN** a control on the same screen opens the fairness panel

### Requirement: Results are shown without celebrating a loss
A return at or below the stake SHALL NOT be celebrated. No win sound, no confetti, no emphasis and no "+amount" on those rounds; the net result is shown instead. This applies to the revealed result of a deferred round exactly as it does to a live one.

#### Scenario: A return equal to the stake
- **WHEN** a round is revealed as returning exactly the stake
- **THEN** no win cue plays and the screen shows the net result

#### Scenario: The ride ended before the press
- **WHEN** a round is revealed as lost
- **THEN** the screen states the loss plainly, shows no amount as though it had been won, and nothing on screen suggests how close the player came
