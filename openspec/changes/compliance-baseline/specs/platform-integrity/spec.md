## Purpose

Provides the platform controls accredited test labs verify before certifying a remote game server (GLI-19 §2.2, §2.3, §3.3, §4.16, Appendix B). These cover RNG handling, seed protection, time authority, audit trails, software integrity, concurrency, and fair handling of disconnects and failures.

## ADDED Requirements

### Requirement: Platform cryptography on the server
Outcome derivation on the server SHALL use the platform's cryptographic library (`node:crypto` or WebCrypto) for SHA-256 and HMAC-SHA256. The pure TypeScript implementation MAY remain for client-side verification only. Server and client MUST produce identical outcomes for the same seeds.

#### Scenario: Cross-implementation equality
- **WHEN** 100,000 random seed, client seed and nonce combinations are derived with both the server library and the client verifier
- **THEN** every crash time and setback schedule is bit-for-bit identical

### Requirement: Automatic seed rotation
The system SHALL rotate a session's server seed automatically after a configured number of rounds (default 1,000) or a configured age (default 24 hours), whichever comes first. The first round after the limit starts on the new seed. On rotation, the previous seed SHALL be revealed to the player through the same flow as a manual rotation, and a new commit SHALL be published before the next round.

#### Scenario: Round limit reached
- **WHEN** a session finishes its 1,000th round on one server seed
- **THEN** the next round uses a new server seed whose commit was published first, and the previous seed becomes available for verification

### Requirement: Encrypted seed storage
Server seeds SHALL be encrypted at rest with authenticated encryption (AES-256-GCM) using a key held outside the data store. Unencrypted seeds MUST NOT be written to the store, logs or error reports.

#### Scenario: Store inspection
- **WHEN** the raw contents of the round store are inspected
- **THEN** no unencrypted server seed appears in any key or value

#### Scenario: Missing key
- **WHEN** the API starts without a seed encryption key in a deployed environment
- **THEN** startup fails with a configuration error

### Requirement: Single time authority
All settlement times (round start, cash-out receipt, crash, auto cash-out, minimum cycle checks) SHALL come from one time source shared by every server instance. The system SHALL log instance clock drift against that source when it exceeds 100 ms.

#### Scenario: Two instances
- **WHEN** a round is started on one serverless instance and cashed out on another
- **THEN** both timestamps come from the shared time source and the elapsed time is computed from them

### Requirement: Append-only audit log
The system SHALL write a tamper-evident audit entry for each of: session created, seed committed, seed revealed, round started (with debit), cash-out received (with client tap time and RTT), round settled (with credit), round voided or refunded, profile or kill-switch change, and integrity check result. Each entry SHALL include a hash of the previous entry. A verification command SHALL detect any altered, removed or reordered entry.

#### Scenario: Tampered entry detected
- **WHEN** one stored audit entry is modified
- **THEN** the audit verification command reports the chain as broken at that entry

### Requirement: Software integrity manifest and self-check
Each release SHALL produce a manifest of SHA-256 hashes for every deployed client and server file, signed by the release step. The API SHALL expose an authenticated integrity endpoint that recomputes hashes of the running server bundle and compares them with the manifest. This check SHALL run at cold start, on demand, and at least every 24 hours, and each result SHALL be written to the audit log.

#### Scenario: Daily check passes
- **WHEN** the scheduled integrity check runs against an unmodified deployment
- **THEN** it records a pass with the manifest version and the hashes compared

#### Scenario: Modified file
- **WHEN** a deployed server file differs from the manifest
- **THEN** the integrity check records a failure, and new rounds are blocked until an operator clears it

### Requirement: One active round per player
The system SHALL allow at most one unsettled round per player across all of that player's sessions and devices.

#### Scenario: Second device
- **WHEN** a player with a running round on a phone tries to start a round from a laptop session
- **THEN** the laptop start is rejected with `round_in_progress`

### Requirement: Cash-out evidence
Cash-out requests SHALL be able to include the client's tap timestamp and its most recent measured round-trip time. The server SHALL record both with the cash-out. They MUST NOT affect settlement, which remains based on server receive time.

#### Scenario: Evidence recorded
- **WHEN** a cash-out arrives with a tap timestamp and an RTT of 180 ms
- **THEN** the round record and audit log store both values, and the payout uses the server receive time

### Requirement: Disconnect policies
The system SHALL support these `disconnectPolicy` values:
- `lose`: the round continues on the server; auto cash-out, caps and crash apply; no manual cash-out is assumed.
- `cashout-at-disconnect`: when the server detects that the player's connection is lost, it cashes out at the multiplier at detection time if the round has not crashed.

Connection loss SHALL be detected by the event stream closing or by missed client heartbeats, whichever comes first.

#### Scenario: Cash-out at disconnect
- **WHEN** a player under `cashout-at-disconnect` loses connection at x1.80 and the server detects it at x1.85 before the crash
- **THEN** the round settles as won at x1.85 with reason `disconnect`

#### Scenario: Lose policy
- **WHEN** a player under `lose` disconnects without auto cash-out and the round later crashes
- **THEN** the round settles as lost

### Requirement: System failure void and refund
If a round cannot be settled correctly because of a system fault (for example the store fails after debit, or settlement data is inconsistent), the system SHALL void the round, refund the stake, record the reason in the round record and audit log, and notify the player through the round events.

#### Scenario: Store failure after debit
- **WHEN** the stake has been debited but the round record could not be written
- **THEN** the stake is refunded, the round is marked void with the failure reason, and the player sees a "round voided, stake refunded" message

### Requirement: Settlement rounding preserves RTP at every stake
Settlement SHALL accrue each cash-out's exact value and round the round's total return to the currency minor unit once, half-up, at settlement. It MUST NOT round each cash-out down separately. The minimum stake (or minimum paper value for partial cash-out games) SHALL be 0.20 in the account currency. Because rounding to a whole minor unit shifts the return of an individual cash-out slightly, the system SHALL publish the worst-case RTP band per stake level. Measured RTP at every allowed stake MUST stay within that band and at or above the jurisdiction minimum RTP. The rules SHALL disclose that the theoretical RTP can vary slightly at small stakes because of rounding.

#### Scenario: Rounding once per round
- **WHEN** a round with two cash-outs accrues exact returns of 0.064 and 0.108
- **THEN** the credited total is 0.17, not the sum of the separately rounded-down cash-outs (0.16)

#### Scenario: RTP at minimum stake
- **WHEN** the RTP simulator applies settlement rounding at a 0.20 stake for every strategy and config
- **THEN** every strategy measures within the published worst-case rounding band for 0.20 and at or above 85%

#### Scenario: Band disclosed
- **WHEN** a player opens the rules
- **THEN** they state the theoretical RTP and that returns at small stakes can vary slightly because payouts are rounded to the nearest cent

#### Scenario: Stake below minimum
- **WHEN** a player bets 0.10
- **THEN** the bet is rejected with `bet_limit`
