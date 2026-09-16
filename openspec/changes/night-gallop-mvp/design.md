## Context

See `proposal.md` for why. The shared platform runs Whack Crash:
- `packages/fairness`: HMAC seeds, the crash model and the simulator;
- `packages/core`: the crash round model, `RoundHost`, `RoundStore` with sessions, balances, pacing and audit, money and profiles;
- `packages/rgs-client`: `RoundService`, its mock and remote client, and the shared suite;
- `apps/api`: Hono on Vercel, Upstash Redis, HTTP + SSE.

`game-neutral-core` has just removed game nouns from those packages. It kept "one round model per engine" and a `registerGame(id, engine)` that maps games to crash config families. Three sessions have uncommitted work in the tree.

Night Gallop is now a step game, so it needs a second engine. Its crash-era prototype in `apps/gallop` (scene, horse placeholder, broadcast styling, vocabulary check) is reused where it fits.

## Goals / Non-Goals

**Goals:**
- A step engine that is pure, provably fair, strategy-independent and server-authoritative, reusable by later step games.
- No change to the crash engine's behaviour, events or files beyond small, agreed registration points.
- A Prime Time Chase client with no early tell on jumps and no autoplay.

**Non-Goals:**
- Multiple bets per round, auto-jump, auto-collect targets or turbo.
- SSE for steps: a step round is request/response. The client sends a JUMP and waits for the result, so no stream is needed.
- Changing crash profiles, rules or maths.

## Decisions

### D1. New pure package `packages/steps`
Step maths, derivation, verification, the round model, the step host and the simulator live in `@triptown/steps`. It is added to `PURE_PACKAGES` in `eslint.config.js`: no DOM, Pixi or `node:*`.

It depends on `@triptown/fairness` (the `hmacSha256`, `fromHex`, `utf8` and `bytesToUnit` byte helpers, and `commitServerSeed`, `generateServerSeed`, `CryptoProvider`, `pureCrypto`) and `@triptown/core` (money helpers `payoutMinor`, `resultKind`, `validateBet`, `DEFAULT_CURRENCY`; `RoundStore` for sessions, balance, pacing and credit; `SessionRecord`; `JurisdictionProfile`; `profileFromTemplate`).

*Why:* the engine must run identically in the browser mock, the API and the verifier (hard rules 1 and 6). A separate package keeps the crash engine untouched and avoids colliding with in-flight work in `core`.

*Alternatives:*
- Put steps into `core`. Rejected for now: it conflicts with active edits, and `registerGame`/`effectiveConfig` are shaped for crash config families.
- Extend `fairness` `StreamName`. Rejected: the step package builds its own `fences` stream message with the same format and byte helpers, and changes no shared union.

### D2. Paytables fix the multipliers; clear chances follow from them
A configuration lists the paytable `m_1 < … < m_10` rounded to 2 decimals. The chance of clearing fence k is `m_{k-1} / m_k`, with `m_0 = RTP`. The chance of reaching fence k is then `RTP / m_k`, so stopping after any fence returns exactly RTP.

Starting from a nominal clear chance p, `m_k = round2(RTP / p^k)`:

| difficulty | nominal p | paytable | P(finish) |
|---|---|---|---|
| Easy | 0.90 | 1.08 1.20 1.33 1.48 1.64 1.83 2.03 2.25 2.50 2.78 | 34.9% |
| Medium | 0.80 | 1.21 1.52 1.89 2.37 2.96 3.70 4.63 5.78 7.23 9.03 | 10.7% |
| Hard | 0.65 | 1.49 2.30 3.53 5.43 8.36 12.86 19.79 30.44 46.83 72.05 | 1.3% |

Config ids are `fence-run/v1-easy`, `fence-run/v1-medium` and `fence-run/v1-hard`. Validation rejects any paytable that isn't strictly increasing or implies a clear chance ≥ 1.

*Why:* the displayed value is exactly what pays, and every strategy is exactly fair. That makes the lab report simpler than with irrational multipliers.

*Alternative:* a constant clear chance with exact multipliers `RTP/p^k`. Rejected: 2-decimal displays would not match payouts, or rounding would push individual stops outside 97% ± 0.1% (x1.21 at p = 0.8 pays 96.8%).

### D3. Fence derivation and verification
For fence k: `u_k = bytesToUnit(HMAC_SHA256(serverSeed, "clientSeed:nonce:fences:k"))`, and the fence is cleared when `u_k < clearChance_k`. The first fence not cleared is `refusedAt`, or null.

The host derives all fences at start and stores `refusedAt` inside the round record's secret outcome, kept server-side only. `verifyStepRound({ serverSeed, clientSeed, nonce, configId })` recomputes the outcome and returns each fence's result for display. The 52-bit comparison bias is below 2^-52 and is documented in the report.

### D4. Pure round model and step host
`StepRoundRecord` holds:
- id, session, player, stake, currency, config id, seeds (server seed stored encrypted like crash), commit, nonce;
- `outcome: { refusedAt }` (secret);
- `status: running | collected | finished | lost | void`;
- `cleared`, actions `[{ type: 'jump' | 'collect', key, at, fence, result }]`, `settlement`, `lastActionAt`, `abandonAfterMs`.

Pure functions:
- `createStepRound`;
- `judgeJump(round, now, key)`: cleared, refused, finished, duplicate or not running;
- `judgeCollect(round, now, key)`: collected, nothing to collect, duplicate or already settled;
- `settleIfAbandoned(round, now)`;
- `snapshotOf(round)`: a public view without outcome or seed.

`StepHost` mirrors `RoundHost` for session and balance concerns over the existing `RoundStore`: create session and session info, bet validation, kill switches `game:night-gallop` and `config:<id>`, `claimRoundStart` for one active round and the minimum gap, one debit, `takeNonce`, `creditOnce`, `addSessionTotals`, `releaseActiveRound`, `indexPlayerRound`. It adds a `StepRoundStore` for step records:
- `putStepRound`;
- `getStepRound`;
- `applyStepAction(id, expectedVersion, next)`, a compare-and-set.

The memory implementation lives in `packages/steps`; the Redis implementation (Lua CAS) lives in `apps/api/src/steps/`.

*Why:* this reuses the certified session, wallet and pacing primitives instead of duplicating wallet logic. The CAS makes concurrent JUMP and COLLECT safe (hard rule 4).

### D5. Abandonment
A profile value `stepAbandonAfterMs` defaults to 24 h (1 minute in demo). A running round with no action for that long settles:
- collected at the current value (reason `abandoned`) if at least one fence is cleared;
- otherwise void, with the stake refunded.

Every host call touching the player settles an abandoned round first, and `sweepAbandoned(limit)` runs from the API's existing reconcile cron. Until `core` profiles gain the field (task 5.x), the step host takes it as an option with that default.

*Why:* GLI-19 incomplete-game handling. The player never loses a banked value to a timeout, and nothing is forfeited without a decision.

### D6. Transport
HTTP only, under `/v1/steps`:

| method and path | purpose |
|---|---|
| `POST /v1/steps/rounds` | body `{ stakeMinor, difficulty }` |
| `POST /v1/steps/rounds/:id/jump` | body `{ key }` |
| `POST /v1/steps/rounds/:id/collect` | body `{ key }` |
| `GET /v1/steps/rounds/:id` | round snapshot |
| `GET /v1/steps/rounds` | player history |
| `GET /v1/steps/active` | the player's running round, if any |

Sessions come from the existing `/v1/sessions` token flow, so the balance is shared with the operator session. Errors reuse `HostError` codes plus `nothing_to_collect` and `round_not_running`.

### D7. RoundService for steps
`rgs-client/src/steps.ts` defines `StepRoundService`:
- `getSession`, `startStepRound`, `jump`, `collect`, `getStepRound`, `activeStepRound`, `stepHistory`;
- plus the shared seed operations.

`rgs-client/src/steps-mock.ts` holds `MockStepRoundService`: a `StepHost` over memory stores, carrying the mock build marker, with `forceNext({ refuseAt })` for demos and checks. `rgs-client/src/steps-remote.ts` is the HTTP client. `rgs-client/testing/step-service-suite.ts` runs against both.

### D8. Client (`apps/gallop`, Prime Time Chase)
Pixi scene from `design/night-gallop/fence-run/src/fr-primetime.js`:
- night stadium bokeh, blurred crowd, a turf track;
- brush fences with values above, a finish post, rail posts whipping past;
- a zoom punch and turf burst on landing.

A `JumpSequence` plays the approach and take-off identically for every jump, then waits for the server result before choosing the landing or refusal branch. This makes "no early tell" testable by comparing frames. The HUD is drawn in Pixi with a DOM accessibility mirror:
- LIVE chyron, big italic multiplier;
- ladder strip;
- COLLECT and JUMP buttons, difficulty and stake before the round.

Fonts (Barlow Condensed and Barlow) are bundled via `@fontsource` so text renders crisp and never falls back to Courier. Whack's `services.ts` pattern selects the mock under `VITE_DEMO`. The crash controller and HUD in the app are replaced.

### D9. Profile flags, currencies and rules
Unchanged from the earlier draft:
- flags: `blockedRegions`, `hostingRegions`, `dataTransferBasis`, `withholdingNotice`, `liveBetsFeed`;
- draft profiles: `ng-draft`, `gh-draft`;
- NGN and GHS currencies;
- new `stepAbandonAfterMs`.

These edit `core` and wait for agreement with its owner (task 5.1). Until then the demo uses `regulated-uk` (5 s gap) and USD.

## Risks / Trade-offs

- **[Second engine means a second certification]** → Accepted by the user. Keep the engine generic (fences are just steps) so later step games reuse the same certificate family.
- **[Mixed uncommitted tree across sessions]** → Only new files, plus three small shared edits. Report what was touched so the user can commit in a coherent order.
- **[CAS contention on rapid presses]** → The client sends one request per press; the store retries a lost race once, then returns the stored result.
- **[Lab reading of "player choice" as skill]** → Rules state that every strategy returns 97% and that timing changes nothing. The jump animation has no tell, and there's no time pressure.
- **[Abandonment default of 24 h may not suit a market]** → A profile value, with counsel to confirm.
- **[Placeholder horse]** → Licensed sprite sheets are a later task; the placeholder is marked in `design/`.

## Migration Plan

1. `packages/steps` with tests and the simulator report.
2. rgs-client step service, mock and suite.
3. API step module, Redis store and tests.
4. `apps/gallop` Fence Run client and checks.
5. `core` flags, profiles, currencies and rules, after agreement.

**Rollback:** remove the step module mount and the new packages; nothing existing depends on them.

## Open Questions

- **Final game name and trademark.** *Owner: user.*
- **Minimum and maximum stake in NGN and GHS**, and whether Hard (top x72.05) needs a max-win cap per profile. *Owner: user with operators.*
- **Abandonment time per market** (default 24 h). *Owner: counsel.*
- **Whether Nigeria and Ghana need a minimum gap between round starts** for step games (demo uses 5 s). *Owner: counsel.*
- **Lab acceptance of the paytable-derived clear chances** and of `fence-run/*` as a new certified game family. *Owner: user with the lab.*
- **Licensed horse and jockey model.** *Owner: user.*
