## MODIFIED Requirements

### Requirement: Bad mole setback feedback
When a SETBACK event arrives, the game SHALL play a setback moment. It SHALL show the previous multiplier crossed out, the new halved multiplier, a "-50%" marker and the bad mole snatching coins. The WHACK button SHALL update to the reduced cash-out value.

#### Scenario: Setback shown
- **WHEN** a SETBACK event arrives while the displayed multiplier is 4.20
- **THEN** the game shows 4.20 crossed out, 2.10 as the current multiplier and the WHACK button reads the halved cash-out value

### Requirement: Sound for every game moment
The game SHALL play a distinct sound for: placing a bet, the whack, a bad mole setback, a win (with a bigger variant at x10 or more), a crash, and bet control taps. While a round runs, it SHALL play a music loop that adds layers as intensity rises, and a rising tone whose pitch goes up with the multiplier and drops when a setback halves it.

#### Scenario: Whack sound is immediate
- **WHEN** the player taps WHACK
- **THEN** the whack sound starts on the tap, before the server settles the cash-out

#### Scenario: Setback sound
- **WHEN** a SETBACK event arrives
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

### Requirement: Embed-ready responsive layout
The game SHALL render correctly in portrait phone viewports from 360 px wide and in desktop viewports. It SHALL run inside a cross-origin iframe or native webview without needing access to the parent page. Interactive targets SHALL be at least 44 px.

The portrait and desktop presentations SHALL be supplied by the shared crash-game shell rather than implemented in this game. Moving to the shared shell SHALL NOT change what the player sees or does: at every viewport, every element SHALL keep its position, size, colour and behaviour.

#### Scenario: Phone portrait
- **WHEN** the game loads in a 390×844 viewport
- **THEN** the full betting and running layouts are visible without scrolling

#### Scenario: Desktop
- **WHEN** the game loads in a 1440×900 viewport
- **THEN** the bet panel is shown beside a larger stage

#### Scenario: Embedded in iframe
- **WHEN** the sandbox page embeds the game in a cross-origin iframe
- **THEN** the game loads and completes a round without errors

#### Scenario: Appearance is unchanged by the move to the shared shell
- **WHEN** the same round is played before and after the game moves onto the shared shell, at 390×844 and at 1440×900
- **THEN** the betting, running, setback, boost, cashed-out and crashed presentations are visually identical

## ADDED Requirements

### Requirement: Shared market disclosures
The game SHALL show the market disclosures the shared client provides: the withholding-tax notice on a settled winning round where the profile requires it, and the state of audio availability. The game SHALL NOT be able to omit a disclosure by not implementing it.

#### Scenario: Withholding notice appears
- **WHEN** a profile that requires the withholding-tax notice is loaded and a round settles as won
- **THEN** the result states that tax may apply, alongside the multiplier and the net

#### Scenario: Audio unavailable is shown
- **WHEN** the browser blocks audio
- **THEN** the sound control shows that audio is unavailable rather than offering a control that does nothing
