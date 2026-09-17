## MODIFIED Requirements

### Requirement: Result states
The game SHALL show a cashed-out state (dizzy golden mole, confetti, multiplier and payout, play-again action) after a win, and a crashed state (mole dives into its hole, "MOLE ESCAPED", crash multiplier, amount lost, bet-again action) after a loss. It SHALL also show a distinct instant-bust presentation when the round crashes at 1.00.

Where the profile permits practice rounds, the result screen SHALL also offer a second, visually subordinate action that starts a practice round. It SHALL be clearly labelled as carrying no stake, SHALL never be the primary action, and SHALL be absent entirely where the profile does not permit practice rounds.

During and after a practice round the game SHALL show no money of any kind: no stake, no running payout, no "+" amount, no balance change, and no statement or implication of what a staked bet would have returned. The multiplier and the crash point SHALL be shown exactly as in a staked round.

#### Scenario: Win result
- **WHEN** a round settles as won at 3.86 with bet 10.00
- **THEN** the game shows "CASHED OUT", x3.86 and +38.60

#### Scenario: Instant bust result
- **WHEN** a round crashes at 1.00
- **THEN** the mole never rises and the game shows the instant-bust presentation instead of the normal dive

#### Scenario: Practice round shows no money
- **WHEN** a practice round runs and settles at any multiplier
- **THEN** no stake, payout, "+" amount or balance movement appears at any point, and the screen never states what a bet would have returned

#### Scenario: Practice round is never celebrated
- **WHEN** a practice round reaches a high multiplier and is cashed out
- **THEN** no win sound, confetti or other celebration cue plays, because nothing was won

#### Scenario: Practice action hidden where the market forbids it
- **WHEN** the game runs under a profile that does not permit practice rounds
- **THEN** the result screen offers only the play-again action and no practice control exists anywhere in the interface
