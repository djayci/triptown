## Purpose

How the horse game presents a deferred-reveal round as Gate Rush: live odds that equal the engine's real probability, a locked heading-home state, an open or shut reveal that never reads as a near miss, recall that never shows the hidden crash, and the odds a player can read before betting.

## ADDED Requirements

### Requirement: Presentation follows the effective reveal mode
The horse game client SHALL present Gate Rush when the session's effective reveal mode is deferred, and Beat the Gate when it is live. Both presentations SHALL use the same shared layout and compliance behaviour.

#### Scenario: Deferred market
- **WHEN** a session under `ng-draft` starts the horse game
- **THEN** the client shows Gate Rush, with no gate drawn while the horse is out

#### Scenario: Live market
- **WHEN** a session under a profile with `crashReveal: live` starts the horse game
- **THEN** the client shows Beat the Gate

### Requirement: Live odds are exact and never overstated
While the horse is out, the client SHALL show the current multiplier, the return if the gate is open, and the chance the gate is open. The chance SHALL equal the configuration's RTP divided by the displayed multiplier, rounded down to one decimal place, and shown as "<0.1%" below that. The multiplier and the money SHALL remain the two most prominent values.

#### Scenario: Odds at x3.20
- **WHEN** a ₦500.00 round on a 97% configuration shows x3.20
- **THEN** the screen shows ₦1,600.00 if the gate is open and a chance of 30.3%

#### Scenario: Odds match the engine
- **WHEN** the displayed chance is compared with the engine's probability that a round reaches that multiplier, over a committed simulation
- **THEN** the displayed chance never exceeds the simulated probability by more than its statistical tolerance

### Requirement: Heading home reveals nothing
Pressing IN! SHALL lock the displayed value immediately, send exactly one cash-out, and show a heading-home state that is the same for every outcome: the same copy, animation and duration, with no sound or motion that differs by result. The result SHALL be shown only after the settlement arrives.

#### Scenario: Identical before the result
- **WHEN** two rounds are pressed at the same value, one settling won and one lost, with the settlement delayed
- **THEN** every frame and sound before the settlement arrives is identical in both

### Requirement: The reveal is not a near miss
A won reveal SHALL show the gate open and celebrate only when the return is strictly greater than the stake. A lost reveal SHALL show the gate shut with the horse stopped out in the field, facing away and not moving towards the gate, and SHALL state the stake lost. No state, copy, history row or recall screen SHALL show the hidden crash value or describe how close the round came.

#### Scenario: Shut gate
- **WHEN** a round reveals as lost at x5.00
- **THEN** the screen shows "GATE SHUT" with the stake lost, and no multiplier other than x5.00 appears

#### Scenario: History row
- **WHEN** the player opens history after that round
- **THEN** the row shows SHUT at x5.00 with stake, return and net, and no crash value

### Requirement: Odds table before any bet
The rules SHALL be reachable before any bet and SHALL explain:
- that the chance the gate is open is RTP divided by the value, with a table of values from x1.01 to x100 showing chance and return on the current stake;
- that the result of each round is fixed when it starts;
- that the horse, field and crowd are decoration;
- the max win, max duration, auto IN! and latency policy.

When the profile enables the withholding notice, the rules SHALL show it.

#### Scenario: Rules before betting
- **WHEN** a player opens the rules with no round running under `ng-draft`
- **THEN** the odds table, the fixed-result statement, the decoration statement and the withholding notice are shown, and no bet is placed
