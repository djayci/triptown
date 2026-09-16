## Purpose

Defines what players see and do in the Whack Crash web game, from betting through the golden mole round to the result. The game is built to run inside operator websites and native webviews.

## Requirements

### Requirement: Betting controls
In the betting state, the game SHALL show the player's balance, a bet amount with decrease and increase controls, quick bet chips, an auto cash-out toggle with a target multiplier, and a bet button labelled with the bet amount. Controls outside the configured limits SHALL be disabled.

#### Scenario: Adjust bet with chip
- **WHEN** the player taps the 50 chip
- **THEN** the bet amount shows 50.00 and the bet button reads "BET 50.00"

#### Scenario: Bet above balance
- **WHEN** the bet amount exceeds the balance
- **THEN** the bet button is disabled and the game indicates insufficient balance

#### Scenario: Controls locked during a round
- **WHEN** a round is running
- **THEN** the bet amount, chips and auto cash-out controls cannot be changed

### Requirement: Running round display
While a round runs, the game SHALL show the golden mole risen from its hole, the current multiplier as the dominant element, the current cash-out value, an intensity meter that rises with growth speed, decorative decoy moles, and a WHACK button labelled with the cash-out value.

#### Scenario: Multiplier updates
- **WHEN** the round is running
- **THEN** the displayed multiplier and cash-out value update every rendered frame from the server start time and the setbacks received so far

#### Scenario: Decoys are cosmetic
- **WHEN** the player taps a decoy mole
- **THEN** nothing about the bet or round changes

### Requirement: WHACK cashes out
Tapping the WHACK button or the golden mole during a running round SHALL send one cash-out request. It SHALL immediately play the whack animation with an optimistic payout, then show the server-settled payout. On desktop, the Space key SHALL do the same.

#### Scenario: Successful whack
- **WHEN** the player whacks and the server settles the round as won
- **THEN** the cashed-out state shows the settled multiplier and payout, and the balance updates

#### Scenario: Whack arrives too late
- **WHEN** the player whacks but the server reports the round already crashed
- **THEN** the game shows the crashed state with the crash multiplier and no payout

#### Scenario: Repeated taps
- **WHEN** the player taps WHACK several times quickly
- **THEN** only one cash-out request is sent

### Requirement: Bad mole setback feedback
When a BAD_MOLE event arrives, the game SHALL play a setback moment. It SHALL show the previous multiplier crossed out, the new halved multiplier, a "-50%" marker and the bad mole snatching coins. The WHACK button SHALL update to the reduced cash-out value.

#### Scenario: Setback shown
- **WHEN** a BAD_MOLE event arrives while the displayed multiplier is 4.20
- **THEN** the game shows 4.20 crossed out, 2.10 as the current multiplier and the WHACK button reads the halved cash-out value

### Requirement: Result states
The game SHALL show a cashed-out state (dizzy golden mole, confetti, multiplier and payout, play-again action) after a win, and a crashed state (mole dives into its hole, "MOLE ESCAPED", crash multiplier, amount lost, bet-again action) after a loss. It SHALL also show a distinct instant-bust presentation when the round crashes at 1.00.

#### Scenario: Win result
- **WHEN** a round settles as won at 3.86 with bet 10.00
- **THEN** the game shows "CASHED OUT", x3.86 and +38.60

#### Scenario: Instant bust result
- **WHEN** a round crashes at 1.00
- **THEN** the mole never rises and the game shows the instant-bust presentation instead of the normal dive

### Requirement: Round history and verification access
The game SHALL show a strip of the player's recent round results, coloured by multiplier band, and a fairness control that opens the seed commit, the client seed and the verification details for settled rounds.

#### Scenario: History updates
- **WHEN** a round settles
- **THEN** its final multiplier is added to the front of the history strip

#### Scenario: Open fairness panel
- **WHEN** the player taps the shield control
- **THEN** the game shows the current server seed commit, the client seed with an option to change it, and the nonce

### Requirement: Sound for every game moment
The game SHALL play a distinct sound for: placing a bet, the whack, a bad mole setback, a win (with a bigger variant at x10 or more), a crash, and bet control taps. While a round runs, it SHALL play a music loop that adds layers as intensity rises, and a rising tone whose pitch goes up with the multiplier and drops when a setback halves it.

#### Scenario: Whack sound is immediate
- **WHEN** the player taps WHACK
- **THEN** the whack sound starts on the tap, before the server settles the cash-out

#### Scenario: Setback sound
- **WHEN** a BAD_MOLE event arrives
- **THEN** the setback sting plays, the music briefly cuts out, and the rising tone's pitch drops to match the halved multiplier

#### Scenario: Music builds with intensity
- **WHEN** the intensity meter moves from Calm to Fast to FRENZY
- **THEN** music layers are added at each level and stay in time with each other

#### Scenario: Big win
- **WHEN** a round is cashed out at x10 or more
- **THEN** the big-win fanfare plays instead of the normal win sound

#### Scenario: Crash sound
- **WHEN** the round crashes
- **THEN** the dive sound plays and the music and rising tone stop

### Requirement: Audio controls and browser behaviour
The game SHALL provide a mute toggle and separate music and effects volume controls, remembered on the device between sessions. Audio SHALL start only after the player's first interaction, pause while the page or webview is hidden, and resume when it becomes visible. The game SHALL remain fully playable when audio is unavailable. Total audio download SHALL NOT exceed 1.5 MB.

#### Scenario: Mute remembered
- **WHEN** the player mutes the game and reloads it
- **THEN** the game starts muted

#### Scenario: Separate volumes
- **WHEN** the player sets music volume to 0 and leaves effects on
- **THEN** effects still play and no music is heard

#### Scenario: First interaction unlocks audio
- **WHEN** the game loads and the player has not interacted yet
- **THEN** no audio plays, and audio starts working from the first tap

#### Scenario: Page hidden
- **WHEN** the player switches tabs or backgrounds the app mid-round
- **THEN** audio pauses, and resumes in sync with the round when they return

#### Scenario: Audio unavailable
- **WHEN** the browser blocks audio or storage is not available
- **THEN** rounds play normally with default audio settings and no errors

#### Scenario: Audio budget
- **WHEN** the production build is created
- **THEN** the total size of audio assets is 1.5 MB or less

### Requirement: Embed-ready responsive layout
The game SHALL render correctly in portrait phone viewports from 360 px wide and in desktop viewports. It SHALL run inside a cross-origin iframe or native webview without needing access to the parent page. Interactive targets SHALL be at least 44 px.

#### Scenario: Phone portrait
- **WHEN** the game loads in a 390×844 viewport
- **THEN** the full betting and running layouts are visible without scrolling

#### Scenario: Desktop
- **WHEN** the game loads in a 1440×900 viewport
- **THEN** the bet panel is shown beside a larger stage

#### Scenario: Embedded in iframe
- **WHEN** the sandbox page embeds the game in a cross-origin iframe
- **THEN** the game loads and completes a round without errors

### Requirement: Reconnect recovery
If the round stream drops, the game SHALL reconnect or fetch the round by id and show the correct current or final state.

#### Scenario: Stream drops mid-round
- **WHEN** the stream disconnects while a round is running and the round crashes before reconnect
- **THEN** after reconnecting the game shows the crashed state for that round

### Requirement: Reduced motion
When the user's system requests reduced motion, the game SHALL turn off screen shake, stage tilt and confetti while keeping all state information visible.

#### Scenario: Reduced motion enabled
- **WHEN** reduced motion is requested and a setback occurs
- **THEN** the setback is shown without shake or tilt, with the multiplier change still displayed

### Requirement: Demo mode labelling
When the game uses the in-browser mock round service, it SHALL show a visible "DEMO" label. Production builds MUST NOT include the mock service.

#### Scenario: Demo build
- **WHEN** the game runs with the mock round service
- **THEN** a "DEMO" label is visible on every state
