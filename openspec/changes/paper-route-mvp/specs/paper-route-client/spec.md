## Purpose

Defines the player-facing Paper Route game: an adult courier delivering the morning papers on a moped down a suburban street at sunrise, shown from behind in real-time 3D, where the player banks a bag of newspapers one throw at a time. The rules here keep what the game shows honest to the server's round, and meet the presentation rules regulators apply to casino games.

## ADDED Requirements

### Requirement: Betting controls
Before a round, the game SHALL let the player set a bet in steps of whole paper values at or above the minimum paper value, and show the paper count and the value of each paper. It SHALL let the player optionally set an auto cash-out target at or above the profile's minimum cash-out, and start the round with a fresh BET press. The game SHALL disable BET and explain why when the bet exceeds the balance or the currency limits, or while the profile's minimum cycle is still running. When the profile turns partial cash-out off, the game SHALL show a single stake without papers.

#### Scenario: Bet shows papers
- **WHEN** the player sets the bet to 10.00 in a 5-paper game
- **THEN** the bag shows 5 papers, each labelled with a 2.00 stake

#### Scenario: Insufficient balance
- **WHEN** the bet is higher than the balance
- **THEN** BET is disabled and the game shows an insufficient-balance message

#### Scenario: Partial cash-out off
- **WHEN** the session's profile sets `partialCashout: off`
- **THEN** the bag and ALL control are hidden, and a single cash-out control is shown

### Requirement: Riding view
While a round runs, the game SHALL show:
- a chase camera behind the courier moving down a sunrise street;
- the current multiplier;
- the number of unthrown papers and their current combined return;
- each settled paper's stake, multiplier and return;
- the round's total return so far.

The multiplier SHALL update every frame from the server-anchored round clock. The live label for the unthrown papers SHALL read "RETURN NOW" while the round's total return including them would be at or below the stake, and "WIN NOW" only above it.

#### Scenario: Multiplier and bag update
- **WHEN** the round is running at multiplier 3.40 on a 10.00 stake with 2 papers returning 3.20 and 6.80 and 3 unthrown papers of 2.00
- **THEN** the game shows x3.40, "3 riding" returning 20.40, the two settled papers with stake 2.00 and their returns, total returned 10.00, and the label WIN NOW

#### Scenario: Below-stake label
- **WHEN** the round is at multiplier 0.95 with nothing thrown on a 10.00 stake
- **THEN** the riding value reads RETURN NOW 9.50 in neutral styling

### Requirement: Adult, non-childlike presentation
The courier SHALL read unambiguously as an adult:
- realistic body proportions;
- visible adult age cues;
- work clothing with helmet and high-visibility vest;
- a licensed motor vehicle such as a delivery moped.

The game MUST NOT include children or characters who seem under 25, animals, mascots, toy-like props, candy colours or slapstick. The same rules SHALL apply to lobby tiles, thumbnails and demo builds.

#### Scenario: Art review
- **WHEN** the release art checklist is run against the in-game scene and the lobby tile
- **THEN** every item passes: adult courier, no animals or mascots, no toy-like or candy styling

### Requirement: THROW banks one paper
The game SHALL provide a THROW control and a matching key (Space, re-armed only after release) that each send one throw request with a new throw id, the client tap time and the latest round-trip time. Each tap SHALL immediately play the same throw animation, then show the paper's return once the server confirms it. The game SHALL NOT send more throws than the unthrown papers it knows about.

#### Scenario: Single throw
- **WHEN** the player taps THROW once with 3 papers unthrown
- **THEN** one throw request is sent, a paper is thrown, and the bag shows 2 unthrown papers once the server confirms

#### Scenario: Rapid taps
- **WHEN** the player taps THROW 5 times quickly with 3 papers unthrown
- **THEN** at most 3 throw requests are sent, each with a distinct throw id

#### Scenario: Throw rejected
- **WHEN** a throw's server result is round-crashed or below-minimum
- **THEN** the paper returns to the bag display (below-minimum) or is shown as lost in the wipeout (crashed), and no return is shown for it

### Requirement: ALL banks every remaining paper
The game SHALL provide an ALL control that shows the combined current return of the unthrown papers and sends one throw-all request.

#### Scenario: Throw all
- **WHEN** the player taps ALL with 3 unthrown papers returning 20.40 in total
- **THEN** one throw-all request is sent, all 3 papers are thrown, and the round shows as ended once confirmed

### Requirement: Throws look the same whatever the timing
Every throw SHALL use the same animation and land at the porch of the house alongside the courier at that moment. House spacing SHALL be irregular. The street MUST NOT contain mailboxes, targets, bullseyes or any object that suggests aiming. Throws MUST have no hit, miss, "perfect" or distance variants. The game MUST NOT accept steering, swipe, tilt or lane input.

#### Scenario: Throws at different moments
- **WHEN** the player throws one paper between two houses and another directly beside a house
- **THEN** both play the identical animation and both land at a porch, with no difference in effect or sound

### Requirement: Nothing hints at a hazard ahead
The game MUST NOT show or play anything that predicts a setback or the crash before its server event arrives: no obstacles, vehicles, sounds, slowdowns, wobbles or colour changes tied to upcoming events.

#### Scenario: Street before a setback
- **WHEN** a setback will occur 2 seconds from now
- **THEN** the street and the audio look and sound the same as in a round with no upcoming setback

### Requirement: Round-level result presentation
The game MUST NOT use win presentation (win sounds, confetti, celebratory animation, "+" amounts or win colours) for any single throw. A throw SHALL use a neutral sound and show the paper's return.
- When the round ends with a total return greater than the stake, the game SHALL use win presentation that shows the net gain.
- When the total return is at or below the stake, it SHALL show a neutral result with the amount returned and the net.

The result screen MUST NOT show the crash point, or what unthrown papers would have returned. The crash point SHALL be available in history and the fairness panel only.

#### Scenario: Throw while total is below stake
- **WHEN** on a 10.00 stake the player throws one paper returning 4.00
- **THEN** a neutral throw sound plays and the paper shows 4.00, with no win sound, confetti or "+" amount

#### Scenario: Wipeout with papers banked below stake
- **WHEN** a round on a 10.00 stake ends in a wipeout with 6.00 returned from 2 papers and 3 papers lost
- **THEN** the result reads "RETURNED 6.00 · NET −4.00" in neutral styling, with 3 papers marked lost and no crash point

#### Scenario: Round above stake
- **WHEN** a round on a 10.00 stake ends with a total return of 24.00
- **THEN** the win presentation plays once and shows "+14.00"

#### Scenario: All papers thrown
- **WHEN** the last paper is thrown before the crash
- **THEN** the courier rides on, the round result shows the total returned and the net, and no crash point or "would have" value is shown

### Requirement: Setback presentation when enabled
Setbacks SHALL appear only in profiles whose setbacks mode is on. When a setback event arrives, the game SHALL show a puddle splash and a short wobble of the courier, the previous multiplier crossed out, the new multiplier, and a −50% marker. The new return of the unthrown papers SHALL be shown immediately. The setback MUST NOT involve an animal or anything that looks avoidable, and it SHALL never appear before its event.

#### Scenario: Setback on
- **WHEN** a setback arrives while the multiplier is 4.20 with 3 papers unthrown under a setbacks-on profile
- **THEN** a splash and wobble play, x4.20 is crossed out, x2.10 and −50% are shown, and the riding value shows 12.60

#### Scenario: Rising-only profile
- **WHEN** a round runs under a profile with setbacks off
- **THEN** no splash, wobble or −50% marker ever appears and the multiplier never decreases

### Requirement: Intensity follows the profile
When the profile enables intensity effects, riding speed and the rising pitch of the riding loop MAY increase with the multiplier. When it disables them, riding speed and pitch SHALL stay constant. In every profile the scene MUST NOT present a goal, finish line or "end of route" that implies a target multiplier.

#### Scenario: Intensity off
- **WHEN** a round runs under a profile with intensity effects off and the multiplier climbs from 1.00 to 8.00
- **THEN** the riding speed and loop pitch stay the same throughout

### Requirement: Paper Route rules content
The rules screen provided by the shared game-information capability SHALL, for Paper Route, add:
- how papers split the stake;
- that THROW settles one paper and ALL settles the rest at the moment the server receives the request;
- the minimum paper value and minimum cash-out;
- that the round total is rounded half-up once to the currency unit, so returns at small stakes can vary slightly from the stated RTP, with the published band;
- that unthrown papers are lost at wipeout;
- how unthrown papers are handled on disconnect;
- that where a paper lands and what the courier does are decoration and have no effect on the result.

#### Scenario: Rules mention papers
- **WHEN** a player opens the rules before betting in a partial cash-out profile
- **THEN** the paper, throw, rounding, wipeout, disconnect and decoration items are all present with values taken from config and profile

### Requirement: Round history and verification access
The game SHALL show recent rounds using the shared history view. Each entry SHALL include the stake, total return, net, the result text, and every thrown paper with its stake, multiplier and return. The game SHALL give access to the fairness panel, which verifies settled rounds including their crash time and setbacks.

#### Scenario: History entry
- **WHEN** a round returns 10.00 on a 10.00 stake from 2 thrown papers
- **THEN** its history entry shows net 0.00 with both papers listed, and its result is not styled as a win

### Requirement: Sound for game moments
The game SHALL play sounds for bet, each throw, a paper landing, the round ending above stake (win), the round ending at or below stake (neutral), a wipeout, a setback when enabled, and UI ticks. The throw sound SHALL be neutral and play on tap without waiting for the server. Sound SHALL start in the profile's default state.

#### Scenario: Throw sound
- **WHEN** the player taps THROW
- **THEN** the neutral throw sound plays immediately, and no win sound plays until a round ends above stake

### Requirement: Performance on mid-range phones
The game SHALL keep at least 30 frames per second on a mid-range phone in portrait. When frame times stay high, it SHALL step down its render quality (shadows, pixel ratio, draw distance) without affecting the round display or controls. The initial download before the first playable frame SHALL be at most 1.5 MB, excluding audio.

#### Scenario: Slow device
- **WHEN** the average frame time exceeds 33 ms for 2 seconds
- **THEN** the game lowers its render quality tier, and the multiplier and controls keep updating

#### Scenario: WebGL unavailable
- **WHEN** the device cannot create a WebGL context
- **THEN** the game shows a message that the device is not supported and does not let the player bet

### Requirement: Embed-ready layout
The game SHALL fill its iframe or webview in portrait and landscape, keep controls at least 44 px tall, respect safe-area insets, and keep these visible without scrolling at 360×640 and larger:
- the multiplier;
- the bag;
- THROW;
- the session clock and net position when the profile enables them.

#### Scenario: Small portrait embed
- **WHEN** the game loads in a 360×640 iframe under a profile showing clock and net position
- **THEN** the multiplier, bag, THROW, ALL, clock and net position are all visible without scrolling

### Requirement: Reconnect recovery
If the event stream drops mid-round, the game SHALL reconnect and restore the round from the server, including thrown papers, past setbacks and the final result if the round ended meanwhile.

#### Scenario: Drop after a throw
- **WHEN** the connection drops after one throw and returns after the round crashed under a `lose` profile
- **THEN** the game shows the wipeout result with that one paper's return and 4 papers lost

### Requirement: Reduced motion
When the player's system requests reduced motion, or the player turns effects down, the game SHALL turn off camera shake, speed streaks, wobble and paper-scatter effects, and SHALL keep the camera steady while still showing every event.

#### Scenario: Reduced motion setback
- **WHEN** a setback arrives with reduced motion enabled
- **THEN** the value change and −50% marker are shown without wobble or camera shake

### Requirement: Demo mode labelling
When the game runs against the in-browser demo round service, it SHALL show a visible DEMO label in every state. Production builds MUST NOT include the demo service.

#### Scenario: Production build
- **WHEN** the production bundle is built
- **THEN** the build fails if demo service code is present in the output
