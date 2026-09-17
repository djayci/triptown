## MODIFIED Requirements

### Requirement: Cash-out settles at server receive time
A cash-out SHALL be judged at the elapsed server time when the request is received, with no retroactive latency allowance. If the round has not crashed at that time, the system SHALL credit the bet multiplied by the multiplier value at that time, rounded down to the currency's minor unit. If the round has already crashed, a live-reveal round SHALL reject the cash-out and the bet stays lost; a deferred-reveal round SHALL settle as lost at that moment and reveal the result in the cash-out response.

#### Scenario: Cash-out before crash
- **WHEN** a player with bet 10.00 cashes out and the server receives it at a time where the multiplier value is 4.2037 and the round has not crashed
- **THEN** 42.03 is credited, the round is settled as won, and the stream emits a CASHED_OUT event with the payout and the round's crash time, then closes. The server seed stays secret until the player rotates it

#### Scenario: Cash-out after crash
- **WHEN** the server receives a cash-out after the crash time of a live-reveal round
- **THEN** the cash-out is rejected with a round-crashed result and nothing is credited

#### Scenario: Cash-out after a hidden crash
- **WHEN** the server receives a cash-out after the crash time of a deferred-reveal round
- **THEN** the round settles as lost, nothing is credited, the response and the stream reveal the loss with the cash-out time and value, and the stream closes

#### Scenario: Cash-out at the same time as a setback
- **WHEN** a cash-out is received at exactly the same server time as a setback
- **THEN** the setback applies first and the payout uses the reduced value

#### Scenario: Duplicate cash-out
- **WHEN** a player sends a second cash-out for an already settled round
- **THEN** the system returns the existing settlement and credits nothing more

### Requirement: Crash ends the round
When a live-reveal round reaches its crash time without a cash-out, the system SHALL settle the round as lost, emit a CRASH event with the crash time and the multiplier value at that time, and close the stream. A deferred-reveal round SHALL instead stay open to the player until its reveal, and SHALL settle and emit its terminal event only at the reveal.

#### Scenario: Round crashes
- **WHEN** a live-reveal round reaches its crash time and the player has not cashed out
- **THEN** the stream emits CRASH, nothing is credited, and the stream closes

#### Scenario: Instant bust
- **WHEN** a live-reveal round's derived crash time is 0
- **THEN** the stream emits START immediately followed by CRASH at multiplier 1.00 and the bet is lost

#### Scenario: Hidden crash
- **WHEN** a deferred-reveal round passes its crash time and the player has not cashed out
- **THEN** the stream emits nothing new, the round is still reported as running, and nothing is settled until the reveal

## ADDED Requirements

### Requirement: Deferred reveal is opt-in, exact and silent
A round SHALL play in deferred-reveal mode only when its game declares support for deferred reveal and the session's jurisdiction profile sets `crashReveal` to `onCollect`; every other round SHALL play in live-reveal mode. Profile validation SHALL reject `crashReveal: onCollect` unless setbacks and boosts are both off. In deferred-reveal mode:
- the round SHALL reveal at the first of a received cash-out, the auto cash-out target, the max win cap, or the max duration, whether or not a client is connected;
- the settlement SHALL be won at the multiplier value at the reveal time if the reveal time is before the crash time, and lost otherwise;
- until the reveal, the round's stream, state by id, balance, history, operator events and any other player-visible output SHALL be identical to those of a round whose crash time is later than the current time.

#### Scenario: Opt-in on both sides
- **WHEN** a game that supports deferred reveal starts a round under a profile with `crashReveal: onCollect`
- **THEN** the round plays in deferred-reveal mode

#### Scenario: Game without support
- **WHEN** a game that does not declare deferred reveal starts a round under a profile with `crashReveal: onCollect`
- **THEN** the round plays in live-reveal mode

#### Scenario: Exact odds only
- **WHEN** a profile sets `crashReveal: onCollect` with setbacks or boosts enabled
- **THEN** profile validation fails

#### Scenario: Nothing leaks at the hidden crash
- **WHEN** a deferred-reveal round is observed through its stream, its state by id, the session balance and history at a moment just before its crash time and again just after it
- **THEN** both observations are identical apart from elapsed time

#### Scenario: Auto target after a hidden crash
- **WHEN** a deferred-reveal round has auto cash-out 3.00 and its crash time falls before the value reaches 3.00
- **THEN** the round reveals as lost at the moment the value reaches 3.00, with nothing credited

#### Scenario: Same payout as live
- **WHEN** the same seeds are played once in live-reveal mode and once in deferred-reveal mode, with the player's cash-out received at the same elapsed server time
- **THEN** both rounds settle with the same status and the same credited amount
