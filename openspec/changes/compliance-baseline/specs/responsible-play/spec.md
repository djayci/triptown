## Purpose

Defines how Triptown games present results, pacing and intensity, so that they don't disguise losses as wins, encourage impulsive repeat play, or suggest skill where there is none. This follows regulator game-design rules such as UKGC RTS 14, AGCO 2.15–2.22 and Portugal Reg. 308/2023.

## ADDED Requirements

### Requirement: No celebration at or below stake
In every profile, a settled round whose total return is less than or equal to the stake MUST NOT show win effects: no confetti, win or big-win sounds, celebratory animations, "+" amounts or win colours. It SHALL show a neutral result with the amount returned and the net amount. Only a return greater than the stake SHALL use win presentation, and that presentation SHALL show the net gain.

#### Scenario: Return below stake
- **WHEN** a player with stake 10.00 cashes out for 6.00
- **THEN** the result reads "RETURNED 6.00 · NET −4.00" with neutral colours and sound, and no confetti or win sound plays

#### Scenario: Return equal to stake
- **WHEN** a player with stake 10.00 cashes out for exactly 10.00
- **THEN** the result is neutral and shows net 0.00

#### Scenario: Return above stake
- **WHEN** a player with stake 10.00 cashes out for 24.00
- **THEN** the win presentation plays and shows "+14.00" net

#### Scenario: Live value below stake
- **WHEN** a round is running and the current cash-out value is at or below the stake
- **THEN** the live label reads "RETURN NOW" in neutral styling rather than "WIN NOW"

### Requirement: Minimum game cycle
The server SHALL reject a new round start for a player if less than the profile's `minCycleMs` has passed since that player's previous round started, and SHALL return the remaining wait time. This SHALL hold even when the previous round ended instantly. The client SHALL show a countdown and keep the bet control disabled until the wait has passed.

#### Scenario: Bet after instant bust in a 5 s profile
- **WHEN** a round under a profile with `minCycleMs` 5000 busts at t=0 and the player bets again 1.2 s after that round started
- **THEN** the API rejects the bet with `cycle_too_soon` and a remaining wait of about 3.8 s, and the client shows a countdown

#### Scenario: Bet after the minimum
- **WHEN** the player bets 5.0 s or more after the previous round started
- **THEN** the bet is accepted

#### Scenario: Automated timing verification
- **WHEN** the automated browser timing test plays 50 consecutive rounds as fast as input allows under a 5 s profile
- **THEN** every measured interval between round starts is at least 5000 ms

### Requirement: Fresh press to start
Starting a round SHALL require a new press. A held key or held pointer MUST NOT start consecutive rounds. Keyboard and pointer input SHALL re-arm only after release.

#### Scenario: Space held down
- **WHEN** the player holds the Space key through a round's end and past the minimum cycle
- **THEN** no new round starts until Space is released and pressed again

### Requirement: Quick replay control
When the profile's `quickReplay` is false, the result screen MUST NOT offer a one-tap bet with the same stake. It SHALL offer a neutral route back to the betting screen, with the exit and change-bet options at least as prominent as betting again. When `quickReplay` is true, a same-stake button MAY be shown, still subject to the minimum cycle.

#### Scenario: Regulated profile result screen
- **WHEN** a round ends under a profile with `quickReplay: false`
- **THEN** the result screen offers "Continue" back to the betting screen and no same-bet button

### Requirement: Session clock and net position
When the profile enables them, the game SHALL continuously show the elapsed session time and the session net position (total returns minus total stakes since the session started) in the account currency, on every screen including during rounds.

#### Scenario: Net position after rounds
- **WHEN** a player in a profile with `showNetPosition: true` stakes 10.00 twice and receives returns of 24.00 and 0.00
- **THEN** the net position shows +4.00

#### Scenario: Clock visible during a round
- **WHEN** a round is running in a profile with `showSessionClock: true`
- **THEN** the elapsed session time stays visible and keeps updating

### Requirement: Reality check pause
The game SHALL support a pause requested by the operator. While paused, new bets MUST be blocked. A running round SHALL continue until it settles, with its result shown, and the pause message SHALL appear only after that. Play SHALL resume only after the player acknowledges the message or the operator sends a resume.

#### Scenario: Pause during a round
- **WHEN** the operator sends a reality-check pause while a round is running
- **THEN** the round finishes and shows its result, then the reality-check message blocks the bet control until acknowledged

### Requirement: Idle prompt
When the profile sets `idlePromptMs`, the game SHALL show a prompt asking whether the player wants to continue after that long without a bet. It SHALL block betting until the player answers.

#### Scenario: Idle for three minutes
- **WHEN** a profile sets `idlePromptMs` to 180000 and the player places no bet for 3 minutes
- **THEN** a continue-or-exit prompt appears and betting is blocked until the player chooses

### Requirement: No illusion of skill
The game MUST NOT present outcome-irrelevant elements as interactive or skill-based. Decorative moles MUST NOT respond to taps, and their activity MUST NOT depend on hidden round data. Game copy MUST NOT claim or suggest that reflexes, speed or skill change the outcome. Intensity indicators SHALL use neutral names (not "FRENZY"). No animation MAY hint at an upcoming crash or setback.

#### Scenario: Tapping a decorative mole
- **WHEN** a player taps a decorative mole during a round
- **THEN** nothing happens: no animation, sound or state change

#### Scenario: Copy review
- **WHEN** the rules, betting screen and result screen text are reviewed
- **THEN** none of them state or imply that timing skill or reflexes improve returns

### Requirement: Crash point placement
The result screen after a manual or auto cash-out MUST NOT show what multiplier the round would have reached. The crash point SHALL be available in round history and the fairness panel.

#### Scenario: Cash-out result
- **WHEN** a player cashes out at x2.10 in a round that would have crashed at x47.00
- **THEN** the result screen shows only the player's own result, and x47.00 appears only in the round's history entry

### Requirement: Intensity and sound defaults
The profile's `intensityEffects` flag SHALL control screen shake, tilt, rising music layers and the rising-pitch tone. When it is false, none of these play. The profile's `soundDefault` SHALL set the starting mute state for a player with no saved preference. An in-game "reduce effects" toggle SHALL turn off shake, tilt and confetti regardless of the system reduced-motion setting.

#### Scenario: Regulated profile first launch
- **WHEN** a new player opens the game under a profile with `soundDefault: muted` and `intensityEffects: false`
- **THEN** the game starts muted, and when sound is enabled no music layers or pitch tone play and the screen never shakes or tilts

### Requirement: Skin selection
The game SHALL render with the skin set by the profile (`candy` or `adult`). The adult skin MUST NOT use cartoon mascots with exaggerated baby-like features, candy or sweet motifs, crowns or storybook characters, or saturated toy palettes.

#### Scenario: Adult skin under a regulated profile
- **WHEN** the game loads under a profile with `skin: adult`
- **THEN** all game art, icons and effects come from the adult skin, and no Candy assets are loaded
