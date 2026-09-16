## Purpose

Defines rounds whose single stake is split into equal papers that the player cashes out one at a time or all at once, while every other round rule (path, setbacks, crash, fairness) stays the same. Players, operators and test labs rely on these rules for every Paper Route payout.

## ADDED Requirements

### Requirement: One stake, one game
A partial cash-out round SHALL be a single game: one stake debited once at start, one round id, one game-cycle record and one settlement. The system MUST NOT accept a second stake for a round, and the minimum game cycle and one-active-round rules SHALL apply to the round as a whole. The round ends only when every paper is settled.

#### Scenario: Throws do not start new games
- **WHEN** a player throws 2 of 5 papers during a round
- **THEN** the round keeps one round id and one debit, and a new round can start only after all papers are settled and the profile's minimum cycle has passed

### Requirement: Bet is split into papers
A partial cash-out game's configuration SHALL define a paper count N of 1 or more. A bet SHALL be split into N papers of equal value. The system SHALL reject a bet that is not an exact multiple of N minor units, or whose paper value is below the configured minimum paper value (default 0.20 in the currency).

#### Scenario: Valid bet
- **WHEN** a player bets 10.00 in a game with 5 papers
- **THEN** the round starts with 5 papers worth 2.00 each, and START carries the paper count and paper value

#### Scenario: Bet not divisible into papers
- **WHEN** a player bets 10.01 in a game with 5 papers
- **THEN** the request is rejected with a bet-limit error and no round is created

#### Scenario: Paper value below minimum
- **WHEN** the minimum paper value is 0.20 and a player bets 0.50 in a game with 5 papers
- **THEN** the request is rejected with a bet-limit error and no round is created

### Requirement: Partial cash-out can be turned off per profile
The jurisdiction profile SHALL control whether partial cash-out is available (`partialCashout: off | papers`). With `off`, every round SHALL use a single paper, so the whole stake is cashed out at once and the game behaves as a single cash-out crash game.

#### Scenario: Portugal-style profile
- **WHEN** a session bound to a profile with `partialCashout: off` bets 10.00
- **THEN** the round has one paper worth 10.00, THROW cashes out the whole stake, and the round ends

### Requirement: Throw banks one paper at server receive time
A throw SHALL be judged at the elapsed server time when the request is received, with no retroactive latency allowance. If the round has not crashed, at least one paper is unthrown, and the multiplier is at or above the profile's minimum cash-out, the system SHALL settle exactly one paper at the multiplier at that time, and the round keeps running.

#### Scenario: Throw before crash
- **WHEN** a player with 5 papers of 2.00 throws and the server receives it where the multiplier is 3.4012
- **THEN** that paper's exact return 6.8024 is recorded, 4 papers remain unthrown, the round keeps running, and the stream emits THROWN with the paper's time, multiplier, its return and the remaining count

#### Scenario: Throw at the same time as a setback
- **WHEN** a throw is received at exactly the same server time as a setback
- **THEN** the setback applies first and the paper's return uses the reduced value

#### Scenario: Throw below the minimum cash-out
- **WHEN** a profile sets a minimum cash-out of 1.10 and a throw is received where the multiplier is 1.05
- **THEN** the throw is rejected with a below-minimum result, no paper is settled, and the round continues

#### Scenario: Throw after crash
- **WHEN** the server receives a throw after the round's crash time
- **THEN** the throw is rejected with a round-crashed result and nothing is credited

### Requirement: Throw all banks every remaining paper
A throw-all SHALL settle every unthrown paper at the same server receive time, using the same rules as a single throw applied to each paper.

#### Scenario: Throw all mid-round
- **WHEN** 3 papers of 2.00 are unthrown and a throw-all is received where the multiplier is 3.40
- **THEN** the 3 papers return 20.40 in total, no papers remain, and the round ends as cashed out

### Requirement: Exact accrual with one rounding per round
The system SHALL record each settled paper's exact return, meaning paper value times multiplier without rounding. During the round, the credited balance SHALL be the whole minor units of the running exact total, rounded down. At settlement, the round's total return SHALL be the exact total rounded half-up to the minor unit once, and the difference SHALL be credited or held back so that the credits equal that rounded total. Rounding MUST NOT happen per paper.

#### Scenario: Credits during the round
- **WHEN** papers of 2.00 are thrown at 3.4012 and then at 1.2345
- **THEN** the running exact total is 9.2714 and 9.27 has been credited

#### Scenario: Final rounding up
- **WHEN** a round settles with an exact total of 9.2754 and 9.27 already credited
- **THEN** the round total is 9.28 and a final 0.01 is credited

#### Scenario: Final rounding down
- **WHEN** a round settles with an exact total of 9.2714 and 9.27 already credited
- **THEN** the round total is 9.27 and nothing more is credited

### Requirement: Throws are idempotent and carry evidence
Every throw request SHALL carry a client-generated throw id, and MAY carry the client tap time and measured round-trip time. Repeating a throw id SHALL return the original result and settle nothing more. A throw when no paper is unthrown SHALL be rejected without crediting anything. Tap time and round-trip time SHALL be stored as evidence only and MUST NOT affect settlement.

#### Scenario: Retried throw
- **WHEN** a client resends a throw with the same throw id after a network timeout
- **THEN** the system returns the first throw's result and the unthrown count does not change again

#### Scenario: Throw with an empty bag
- **WHEN** a throw is received for a round with no unthrown papers
- **THEN** the throw is rejected with a no-papers-left result

### Requirement: Round ends when the bag is empty or at wipeout
A round SHALL end as cashed out when its last paper is thrown, and as a wipeout when it reaches its crash time with unthrown papers. At wipeout every unthrown paper is lost. The terminal event SHALL carry the crash time, the round's total return, and the counts of thrown and lost papers.

#### Scenario: Last paper thrown
- **WHEN** a player throws their fifth and final paper before the crash
- **THEN** the stream emits THROWN for that paper followed by CASHED_OUT with the round total and the crash time, then closes

#### Scenario: Wipeout with papers banked
- **WHEN** a round with 2 papers thrown (exact returns 3.20 and 6.80) and 3 unthrown reaches its crash time
- **THEN** the stream emits CRASH with total return 10.00, 2 papers thrown and 3 lost, then closes

#### Scenario: Instant bust
- **WHEN** a round's derived crash time is 0
- **THEN** the stream emits START immediately followed by CRASH with all papers lost

### Requirement: Crash time stays secret while papers remain
The system MUST NOT reveal the crash time, or any future setback, in a throw result, THROWN event, snapshot, history entry or recall record while the round is running. The crash time SHALL be revealed only in the terminal event and in settled round data.

#### Scenario: Throw response during a running round
- **WHEN** a player throws one of 5 papers and the round keeps running
- **THEN** the throw result and the THROWN event contain no crash time and no future setback

### Requirement: Auto cash-out applies to remaining papers
A player SHALL be able to set one auto cash-out target at or above the profile's minimum cash-out before the round starts. The system SHALL settle every unthrown paper at the first server time the multiplier reaches the target, if that is before the crash.

#### Scenario: Target reached with papers already thrown
- **WHEN** a player set auto cash-out 5.00, threw 1 paper at 1.60, and the multiplier reaches 5.00 before the crash
- **THEN** the remaining 4 papers settle at 5.00 and the round ends as cashed out, marked as automatic

### Requirement: Caps apply to remaining papers
The system SHALL settle every unthrown paper when the multiplier reaches the effective max multiplier (the lower of config and profile), paying each paper at exactly that cap. It SHALL also settle every unthrown paper at the configured max round duration.

#### Scenario: Max win reached
- **WHEN** the multiplier reaches the effective max multiplier with 2 papers unthrown
- **THEN** both papers settle at the capped value and the round ends marked as capped

#### Scenario: Max duration reached
- **WHEN** a round still has unthrown papers at the max duration
- **THEN** those papers settle at the multiplier at that time and the round ends

### Requirement: Disconnect settles remaining papers by profile policy
A round SHALL keep running on the server if the player's stream disconnects, and papers already thrown SHALL stay credited. Unthrown papers SHALL follow the profile's `disconnectPolicy`: with `lose` they ride until auto cash-out, a cap or the crash; with `cashout-at-disconnect` they settle at the multiplier at the server time the disconnect is detected, if that is before the crash. The player SHALL be able to fetch the round's current or final state, including every thrown paper.

#### Scenario: Disconnect after one throw under `lose`
- **WHEN** a player throws 1 paper, disconnects, and the round later crashes
- **THEN** fetching the round returns the one settled paper and the 4 lost papers

#### Scenario: Disconnect under `cashout-at-disconnect`
- **WHEN** a player with 3 unthrown papers disconnects and the server detects it at multiplier 2.40 before the crash
- **THEN** the 3 papers settle at 2.40 with reason disconnect and the round ends

### Requirement: Throws are recorded for recall
Each settled round's record SHALL list every paper settlement:
- throw id;
- server time and multiplier;
- papers settled;
- exact return;
- reason (manual, all, auto, cap, max duration, disconnect);
- client tap time and round-trip time when provided.

It SHALL also include the credited amounts, the final rounding adjustment and the counts of thrown and lost papers. Recall views SHALL show each paper's stake and return as well as the round total.

#### Scenario: Recall of a mixed round
- **WHEN** a support agent opens the record of a round with 2 manual throws and a wipeout
- **THEN** it shows both throws with time, multiplier and return, 3 lost papers, the rounded total, the crash time and the setbacks

### Requirement: Single-paper games keep single cash-out behaviour
A game configured with one paper SHALL behave exactly like a single cash-out round: one cash-out settles the whole stake and ends the round, and its events match the single cash-out rules.

#### Scenario: Whack Crash unchanged
- **WHEN** a Whack Crash round with one paper is cashed out at 4.2037 on a 10.00 bet
- **THEN** the round ends with one cash-out and the stream emits CASHED_OUT without any THROWN event

### Requirement: Strategy-independent RTP, including rounding
Every published partial cash-out configuration, with setbacks and without, SHALL give a theoretical return to player of 97% for any throw strategy. That includes:
- throwing all papers at a fixed target;
- splitting throws across targets;
- throwing papers at fixed times;
- throwing right after a setback;
- never throwing.

Rounding to the currency unit cannot keep every individual cash-out within ±0.1%. The published reports SHALL therefore also give, for each stake level from the minimum paper value upward, the expected RTP with one rounding per round and the worst-case rounding band. The rounded RTP at every allowed stake MUST stay at or above the strictest jurisdiction minimum in use. A configuration that breaks the model's validity constraints MUST be rejected.

#### Scenario: Theoretical simulation
- **WHEN** at least 10 million rounds are simulated for each of those strategies with `paper-route/v1` and `paper-route/v1-rising`
- **THEN** each measured theoretical RTP is within 97% ± 0.1%

#### Scenario: Minimum-bet simulation
- **WHEN** the same strategies are evaluated with one rounding per round at paper values of 0.20, 1.00 and 10.00
- **THEN** the report lists each expected RTP and the worst-case band per stake next to the theoretical figures, and every rounded RTP is at or above 85%

#### Scenario: Instant bust share
- **WHEN** at least 10 million rounds are simulated
- **THEN** the share of rounds crashing at time 0 is within 3% ± 0.05%
