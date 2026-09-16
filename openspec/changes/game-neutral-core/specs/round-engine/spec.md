## MODIFIED Requirements

### Requirement: Setback events are streamed without warning
The system SHALL emit a SETBACK event at the server time each setback occurs, carrying its time and factor. The system MUST NOT send any information about future setbacks before they occur.

#### Scenario: Setback occurs
- **WHEN** a setback is scheduled at 3.2 s in a running round
- **THEN** the stream emits SETBACK with time 3.2 s and factor 0.5 at that moment, and no earlier event reveals it

### Requirement: Cash-out settles at server receive time
A cash-out SHALL be judged at the elapsed server time when the request is received, with no retroactive latency allowance. If the round has not crashed at that time, the system SHALL credit the bet multiplied by the multiplier value at that time, rounded half-up to the currency's minor unit. If the round has already crashed, the cash-out SHALL be rejected and the bet stays lost.

#### Scenario: Cash-out before crash
- **WHEN** a player with bet 10.00 cashes out and the server receives it at a time where the multiplier value is 4.2037 and the round has not crashed
- **THEN** 42.04 is credited, the round is settled as won, and the stream emits a CASHED_OUT event with the payout and the round's crash time, then closes. The server seed stays secret until the player rotates it

#### Scenario: Cash-out after crash
- **WHEN** the server receives a cash-out after the round's crash time
- **THEN** the cash-out is rejected with a round-crashed result and nothing is credited

#### Scenario: Cash-out at the same time as a setback
- **WHEN** a cash-out is received at exactly the same server time as a setback
- **THEN** the setback applies first and the payout uses the reduced value

#### Scenario: Duplicate cash-out
- **WHEN** a player sends a second cash-out for an already settled round
- **THEN** the system returns the existing settlement and credits nothing more
