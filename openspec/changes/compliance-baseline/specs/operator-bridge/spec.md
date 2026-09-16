## Purpose

Defines how a Triptown game running inside an operator's page or webview exchanges messages with that operator. Operators use it to run player-protection tools (reality checks, limits, closing the game) and to receive round and balance events, without exposing data to other origins.

## ADDED Requirements

### Requirement: Versioned protocol with pinned origin
The game SHALL exchange `postMessage` messages with its embedding page using a versioned envelope `{ protocol: 'triptown', version, type, payload }`. It SHALL send messages only to origins listed in the profile's `operatorOrigins`, and SHALL ignore messages from any other origin. The game MUST NOT post messages to `'*'`.

#### Scenario: Message from unknown origin
- **WHEN** a page on an origin not in `operatorOrigins` sends a `pause` message
- **THEN** the game ignores it

#### Scenario: Outbound target
- **WHEN** the game sends a balance update inside an operator page whose origin is listed
- **THEN** the message is posted with that exact origin as the target, never `'*'`

### Requirement: Outbound events
The game SHALL send:
- `gameReady` with version, config id and profile;
- `balance` whenever the balance changes;
- `roundStarted` with round id and stake;
- `roundEnded` with round id, stake, return and net;
- `error` with a code (for example `bet_limit`, `insufficient_funds`, `cycle_too_soon`, `game_disabled`).

#### Scenario: Round lifecycle
- **WHEN** a player bets 10.00 and cashes out for 24.00
- **THEN** the operator page receives `roundStarted` with stake 10.00, then `roundEnded` with return 24.00 and net +14.00, then `balance`

### Requirement: Inbound commands
The game SHALL accept:
- `pause` with an optional message, which applies the reality-check pause rules;
- `resume`;
- `closeGame`, which blocks betting, lets a running round settle, then shows a closed state;
- `setLimits`, which sets a session stake limit and a session loss limit the game enforces before accepting a bet;
- `showMessage`, which displays operator text between rounds.

#### Scenario: Close game during a round
- **WHEN** the operator sends `closeGame` while a round is running
- **THEN** the round settles normally, `roundEnded` is sent, and the game shows a closed state with betting disabled

#### Scenario: Loss limit reached
- **WHEN** the operator has set a session loss limit of 50.00 and the player's session net is −48.00
- **THEN** a bet of 10.00 is blocked in the game with a limit message, and an `error` event with code `loss_limit` is sent

### Requirement: Standalone behaviour
When the game is not embedded, or no listed operator origin is present, it SHALL work normally. It SHALL still apply all profile-driven protections, and SHALL send no bridge messages.

#### Scenario: Opened directly
- **WHEN** the game URL is opened in a top-level tab
- **THEN** the game plays normally and posts no messages
