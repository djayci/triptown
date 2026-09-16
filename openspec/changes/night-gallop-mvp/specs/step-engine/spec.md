## Purpose

Defines how a solo step round runs on the server: difficulty paytables, placing the bet, taking fences one decision at a time, collecting, the finish line, abandoned rounds and what the client may learn while a round runs.

## ADDED Requirements

### Requirement: Difficulty paytables
Each step configuration SHALL have an id, a number of fences, an RTP, and a paytable of multipliers (one per fence) in increasing order.
- The chance of clearing fence k SHALL be the previous multiplier divided by multiplier k, with the RTP standing in for the multiplier before fence 1. Stopping after any fence therefore returns exactly the RTP.
- A configuration whose paytable is not strictly increasing, or implies a clear chance of 1 or more, MUST be rejected.

The published configurations SHALL be Easy, Medium and Hard, each with 10 fences and RTP 97%.

#### Scenario: Medium paytable
- **WHEN** the Medium configuration is loaded
- **THEN** its multipliers are 1.21, 1.52, 1.89, 2.37, 2.96, 3.70, 4.63, 5.78, 7.23 and 9.03, and the clear chance of fence 1 is 0.97 / 1.21

#### Scenario: Invalid paytable rejected
- **WHEN** a configuration lists multiplier 1.52 before 1.21
- **THEN** it is rejected before any round can use it

### Requirement: Step round start
A player SHALL start a step round with one stake and a difficulty.
- The system SHALL check the stake against the currency limits and the kill switches.
- It SHALL claim the player's single active round and the profile's minimum gap between round starts.
- It SHALL debit the stake once and derive all fence results from the session's seeds and the next nonce, before responding.
- The response SHALL carry the round id, stake, difficulty, paytable, seed commit, client seed and nonce, and MUST NOT carry any fence result.

#### Scenario: Successful start
- **WHEN** a player with balance 10,000.00 starts a Medium round with stake 500.00
- **THEN** the balance becomes 9,500.00, the round is running with 0 fences cleared, and the response shows the paytable and no fence results

#### Scenario: Too soon after the previous start
- **WHEN** the profile's minimum gap is 5,000 ms and a player starts a round 3,000 ms after their previous start
- **THEN** the request is rejected with a cycle-too-soon error carrying the remaining wait, and nothing is debited

#### Scenario: Round already running
- **WHEN** a player starts a round while one of their step rounds is still running
- **THEN** the request is rejected with a round-in-progress error

### Requirement: Jump judged by the server
While a round runs, a JUMP request with a unique action key SHALL reveal the result of the next fence only.
- **Cleared:** the cleared count increases and the response carries the new multiplier and the next one.
- **Refused:** the round settles as lost and the response carries the refused fence.
- **Last fence cleared:** the round settles as finished at the top multiplier.
- A repeated action key SHALL return the recorded result without advancing.

#### Scenario: Fence cleared
- **WHEN** a Medium round has cleared 3 fences and the next fence's derived result is cleared
- **THEN** the response shows 4 fences cleared, current multiplier 2.37 and next multiplier 2.96, and the round keeps running

#### Scenario: Refusal
- **WHEN** a round has cleared 2 fences and the next fence's derived result is refused
- **THEN** the round settles as lost at fence 3 with nothing credited

#### Scenario: Finish line
- **WHEN** a Medium round clears fence 10
- **THEN** the round settles as finished and credits the stake times 9.03, rounded half-up once to the minor unit

#### Scenario: Duplicate jump
- **WHEN** a JUMP repeats an action key already recorded
- **THEN** the recorded result is returned and no further fence is revealed

### Requirement: Collect
While a running round has cleared at least one fence, a COLLECT request SHALL settle the round as collected and credit the stake times the current multiplier, rounded half-up once. A COLLECT with no fence cleared SHALL be rejected. A collect on a settled round SHALL return the existing settlement.

#### Scenario: Collect after four fences
- **WHEN** a Medium round with stake 500.00 has cleared 4 fences and the player collects
- **THEN** 1,185.00 is credited and the round settles as collected

#### Scenario: Nothing to collect
- **WHEN** a player collects before clearing any fence
- **THEN** the request is rejected with a nothing-to-collect error and the round keeps running

### Requirement: Abandoned rounds settle on the server
If a running round has no action for the profile's abandonment time, the system SHALL settle it the next time it is touched, and in a scheduled sweep, without a client:
- with at least one fence cleared, it SHALL be collected at the current multiplier with reason abandoned;
- with no fence cleared, it SHALL be voided and the stake refunded.

A player returning before that time SHALL be able to fetch and continue the round.

#### Scenario: Abandoned after two fences
- **WHEN** a round with stake 500.00 has cleared 2 fences on Medium and no action arrives for the abandonment time
- **THEN** the round settles as collected with reason abandoned and 760.00 is credited

#### Scenario: Abandoned before any jump
- **WHEN** a round has no action at all for the abandonment time
- **THEN** the round is voided and the 500.00 stake is refunded

#### Scenario: Returning player continues
- **WHEN** a player reloads during a running round before the abandonment time
- **THEN** fetching the round shows the cleared count, current and next multipliers, and JUMP and COLLECT are available

### Requirement: Nothing about future fences leaks
While a round runs, no response, event, snapshot or history entry SHALL contain the result of any fence not yet taken, the index of the refusing fence, or the server seed. Settled rounds SHALL show only the fences actually taken.

#### Scenario: Snapshot mid-round
- **WHEN** a client fetches a running round with 3 fences cleared
- **THEN** the snapshot shows 3 cleared and the paytable, and no field reveals whether fence 4 would be cleared

#### Scenario: Settled after collecting
- **WHEN** a round was collected after 4 fences
- **THEN** its record shows fences 1–4 cleared and does not show what fence 5 would have been

### Requirement: Results and recall
A settled step round SHALL record:
- the stake, difficulty and config id;
- each action (type, action key, server time, fence, result);
- the outcome (collected, finished, lost, abandoned or void) and the payout;
- the net result and result kind, where only a return above the stake is a win.

Records SHALL be available to the in-game history and the operator history API, newest first.

#### Scenario: History after a refusal
- **WHEN** an operator fetches a round refused at fence 3
- **THEN** the record lists jumps 1 and 2 cleared and jump 3 refused, payout 0, net −500.00 and result kind loss
