## Purpose

Makes every step round's fence results provably fixed before the first jump, verifiable by the player after seed reveal, and fair for any stopping strategy.

## ADDED Requirements

### Requirement: Fence results from HMAC seeds
The result of fence k (1-based) in a round SHALL be derived as follows:
- compute HMAC-SHA256 with the server seed as key over the message `clientSeed:nonce:fences:k`;
- take the first 52 bits of the digest as a uniform u in [0, 1);
- the fence is cleared when u is less than that fence's clear chance.

Derivation SHALL use only these values, with no other randomness. The refusing fence is the first fence not cleared, or none.

#### Scenario: Deterministic derivation
- **WHEN** the same server seed, client seed, nonce and configuration are derived twice
- **THEN** both derivations give the same result for every fence

#### Scenario: Fixed test vector
- **WHEN** server seed `000102…1f` (32 bytes), client seed `night-gallop` and nonce 0 are derived on Medium
- **THEN** the result matches the committed test vector in the step fairness tests

### Requirement: Public verification
After a server seed is revealed, a verifier running the same derivation in the browser SHALL reproduce the recorded result of every fence taken in each round played on that seed. It SHALL also confirm that the seed hashes to the commitment shown before those rounds.

#### Scenario: Verify a refused round
- **WHEN** a player verifies a round refused at fence 3 with the revealed seed
- **THEN** the verifier shows fences 1 and 2 cleared, fence 3 refused, and a matching commitment

### Requirement: Same RTP for every stopping strategy
Each published step configuration SHALL return its RTP (97%) whether the player collects after any fixed fence, always runs to the finish, or uses mixed strategies. The configuration SHALL have a committed simulation report showing the theoretical RTP of every stop within 97% ± 0.1%, and every simulated strategy within 4 standard errors of 97%. High-variance strategies such as running to the finish on Hard have a standard error above 0.1% even at tens of millions of rounds, so the exact theoretical value is the tolerance check and the simulation confirms it.

#### Scenario: Simulation report
- **WHEN** at least 10 million rounds are simulated per difficulty for Easy, Medium and Hard, with every strategy evaluated on the same rounds (collect after fence 1, 3, 5 or 9; run to the finish; collect at a random fence each round)
- **THEN** every stop's theoretical RTP is within 97% ± 0.1%, every strategy's measured RTP is within 4 standard errors of 97%, and the report is committed

#### Scenario: Exact expectation
- **WHEN** the expected return of stopping after fence k is computed from the paytable and clear chances
- **THEN** it equals 0.97 for every k within floating-point tolerance
