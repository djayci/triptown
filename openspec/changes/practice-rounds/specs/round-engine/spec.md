## MODIFIED Requirements

### Requirement: Round start debits the bet
A round SHALL be either **staked** or a **practice round**, with no third case. A staked round SHALL have its full bet debited from the player's balance before the round starts, and the system MUST NOT start it if the debit fails. A practice round SHALL carry no stake, take no debit and pay nothing, and MUST NOT be startable unless the session's profile permits practice rounds.

In every other respect a practice round SHALL be indistinguishable from a staked one: the same config id, the same seed stream, the same nonce sequence, the same settlement rules and the same persistence. A practice round SHALL consume its nonce exactly as a staked round does.

#### Scenario: Successful start
- **WHEN** a player with balance 100.00 starts a round with bet 10.00
- **THEN** the balance becomes 90.00 and the round stream emits a START event with a round id, the seed commit and the server start time

#### Scenario: Insufficient balance
- **WHEN** a player with balance 5.00 starts a round with bet 10.00
- **THEN** the request is rejected with an insufficient-funds error and no round is created

#### Scenario: Bet outside limits
- **WHEN** a player starts a round with a bet below the minimum or above the maximum configured for their currency
- **THEN** the request is rejected with a bet-limit error and no round is created

#### Scenario: Practice round takes no money
- **WHEN** a player starts a practice round
- **THEN** the balance is unchanged at the start and at settlement, whatever multiplier the round reaches

#### Scenario: A practice round cannot be used to scout the next one
- **WHEN** a player plays a practice round and then starts any further round
- **THEN** the further round is derived from a different nonce, so the practice round's outcome tells the player nothing about it

#### Scenario: Practice refused where the market does not allow it
- **WHEN** a practice round is requested under a profile that does not permit practice rounds
- **THEN** the request is refused, no nonce is consumed and no round record is created
