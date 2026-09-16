## Context

This change turns the findings in `docs/compliance/whack-crash-2026-09-15.md` into shared behaviour; see `proposal.md` for why. What exists today:

- **`packages/fairness`** derives outcomes with a hand-written SHA-256/HMAC (`sha256.ts`). `GameConfig` now carries `papers`, added by the in-flight `paper-route-mvp` change, and there is a `GAME_CONFIGS` registry.
- **`packages/core`**
  - `RoundHost` locks one active round per *session*.
  - `rotateSeed` only runs when the player asks.
  - Sessions and rounds store the server seed in plain text.
  - The clock is whatever `Date.now()` the instance has.
- **`apps/api`** is Hono on Vercel functions with Upstash Redis, and has no operator auth.
- **`apps/whack`**
  - The result screen celebrates any `won` settlement.
  - Replay is one tap after a 700 ms guard.
  - Decoys are tappable and speed up with intensity.
  - There is no rules, history, clock or net display.
  - The balance is broadcast to `'*'`.

Constraints:

- `fairness` and `core` must stay pure: no DOM, `node:*` or renderer imports.
- Payouts must stay strategy-independent (a martingale), verified by simulation.
- Everything must still run on Vercel serverless with HTTP + SSE.
- The work lands in parallel with `paper-route-mvp`, which generalises settlement to N cash-outs.

## Goals / Non-Goals

**Goals:**
- One build serves light and regulated markets through profiles. No per-market forks.
- Every blocker in the audit's "change for every market" list is fixed for all games through shared code.
- Evidence a lab can check: RTP report per config id, audit chain, integrity manifest, automated timing test.

**Non-Goals:**
- Legal sign-off on profile values. The values below are defaults taken from the research and need counsel review before submission.
- Moving hosting regions or ISO 27001 work.
- A real operator wallet.
- A complete Portugal profile: the two-axis graph, Portuguese copy and the exact disconnect semantics are a follow-up. Only a `draft` profile ships.
- Final adult art from an illustrator.

## Decisions

### D1. Profiles live in `core` and are resolved by the server
`packages/core/src/profiles.ts` defines a `JurisdictionProfile` type, `validateProfile` and a `PROFILES` registry. Initial values, all pending legal review:

| profile | minCycleMs | quickReplay | setbacks | maxMult | minCashout | skin | clock/net | sound | intensity | idle | disconnect | status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `light` | 2500 | true | halve | 10000 | 1.01 | candy | off/off | on | on | – | lose | active |
| `regulated-uk` | 5000 | false | off | 10000 | 1.01 | adult | on/on | muted | off | – | lose | active |
| `regulated-on` | 2500 | false | off | 10000 | 1.01 | adult | on/on | muted | off | – | lose | active |
| `regulated-br` | 5000 | false | off | 10000 | 1.01 | adult | off/on | muted | off | – | lose | active (showRtpInGame) |
| `pt-draft` | 5000 | false | off | 100 | 1.01 | adult | on/on | muted | off | 180000 | cashout-at-disconnect | draft |

Sessions bind a profile when they are created:
- Production takes it from operator config (`OPERATORS` env JSON: operator id → profile, origins, API key hash), falling back to `DEFAULT_PROFILE`.
- A `profile` request parameter is honoured only when `ALLOW_PROFILE_OVERRIDE=true`, which is set for dev and preview deployments only. That is how the sandbox picker works.

`draft` profiles are refused unless the override flag is on.

*Alternative:* profiles as separate deployments. Rejected because it multiplies infra and lets builds drift apart.

### D2. Math variants are separate config ids; caps derive their own id
- `setbacksMode: off` maps to a registered config with `lambda: 0`: `whack-crash/v1-rising`, and `paper-route/v1-rising` once that change lands. `halve` keeps the existing ids.
- A profile `maxMultiplier` below the config's `maxWinMultiplier` produces an *effective* config `…+cap100`.
- The simulator gains `--config <id>` and writes `reports/rtp-<id>.md/json`.
- A generated `packages/fairness/reports/index.json` (id → pass, rounds, date) is imported at build. `validateProfile` fails if any effective config id it needs is missing or not passing.

A rising-only crash with `lambda: 0` is the classic `RTP/U` crash, and the existing validation (growth rate > drag = 0) already accepts it.

*Alternative:* flooring setbacks at x1.00. Rejected by the user and in the audit: Portugal still fails, and strategy independence breaks.

### D3. Minimum cash-out is part of cash-out judging
`judgeCashout` returns a new `below_min_cashout` kind when `m(t) < minCashout`, and the round continues. It stays a stopping time, so RTP is unchanged. Auto targets below the minimum are rejected at start.

This is compatible with Paper Route: the check applies to each throw.

### D4. Player identity, per-player lock and the cycle gate
- `SessionRecord` gains `playerId`: the operator's player id, or the session id for the fake wallet.
- `claimActiveRound` and `releaseActiveRound` are keyed by player.
- The store keeps `lastStartAt` per player.
- `startRound` rejects with `cycle_too_soon { retryAfterMs }` when `now − lastStartAt < profile.minCycleMs`. The comparison uses the time authority (D11), and the timestamp is written together with the active-round claim (one Lua script in Redis).
- Adds error codes to `HostErrorCode`: `cycle_too_soon`, `below_min_cashout`, `game_disabled`, `integrity_blocked`, `loss_limit`.

### D5. Result kinds decided in one place
`core` exports `resultKind(stakeMinor, returnMinor)`, which returns `'win' | 'even' | 'loss'`. Everything that presents a result uses it: the client, the history view and bridge events. For `even` and `loss` the view shows a neutral result ("RETURNED x · NET −y" or "CRASHED"), plays a neutral `return` or `crash` sound with no win sound, and runs no confetti or BONK. For `win` it shows the win screen with **net** gain.

The live label switches between "RETURN NOW" and "WIN NOW" based on whether the optimistic payout is greater than the stake.

### D6. Pacing and input in the client
- The controller tracks `canBetAt` from the server's `cycle_too_soon` response and from the local `roundStartedAt + minCycleMs`, then shows a countdown on the BET button.
- An `InputArm` helper requires `pointerup`/`keyup` before the next start can be accepted. It ignores key auto-repeat and holding.
- When `quickReplay: false`, the result screen shows only **Continue**, which returns to betting. Change bet and exit stay visible.
- The 700 ms guard remains for the `quickReplay: true` profile.

### D7. No illusion of skill
- Decoys get `eventMode = 'none'` and pop at a fixed slow rate that does not depend on intensity or round data.
- The meter label becomes `SPEED` with neutral colours.
- Copy moves to the message catalogue (D9). "Whack the golden mole before it dives" is replaced with neutral text, e.g. "Cash out any time before the mole dives. The result is set before the round starts."
- The result screen never shows the crash point. It stays in history and the fairness panel.

### D8. Intensity and sound defaults
- `intensityEffects: false` disables shake, tilt, stem layering (music stays on the base layer or off) and the rising pitch tone.
- `soundDefault` seeds `AudioManager` when the player has no saved setting.
- A new "Reduce effects" toggle in the sound/settings panel sets an engine override alongside `prefers-reduced-motion`.

### D9. Rules generated from config + profile; message catalogue
- `core` exports `describeRules(config, profile, currency)`. It returns structured items `{ key, params }`: growth, setbacks (only when on), instant bust (1 − RTP), RTP, max multiplier, `tMax`, minimum cash-out, auto cash-out, rounding, below-stake returns (only when setbacks are on), minimum cycle, latency, disconnect policy, void/refund, provably fair, outcome fixed.
- The client renders these with a catalogue at `apps/whack/src/i18n/{en}.ts`, falling back to English. Missing keys warn in dev.
- The rules panel is a DOM dialog, like the fairness panel, reachable from a new "?" stage button in every state. It shows the version, build hash (Vite `define` from `GIT_SHA` or the manifest hash), config id and profile.

*Alternative:* hand-written rules copy per game. Rejected because the numbers would drift from the config.

### D10. Recall: records, totals, operator API
- `RoundRecord` adds `playerId`, `profile`, `configId` (already present), `clientVersion`, `balanceBeforeMinor`, `balanceAfterMinor`, `evidence { clientTapAt, rttMs }`, and `void { reason, at } | null`.
- The session keeps `startedAt`, `stakedMinor` and `returnedMinor` counters (INCRBY), so the net position survives reloads.
- **Redis:** a per-player sorted set `wc:p:{player}:rounds` scored by start time. Records have TTL `ROUND_RETENTION_DAYS` (default 1825).
- **Player API:** `GET /v1/rounds` (existing) returns a public `RoundSummary` with settled fields only.
- **Operator API:** `GET /v1/operator/rounds?player=&from=&to=&cursor=&format=json|csv`, authenticated by the operator API key (hashed in `OPERATORS`).
- **Player binding:** `POST /v1/sessions` accepts `player` only with `X-Operator-Key` for that operator (401 otherwise); ids are stored as `{operator}:{player}` so operators never share a lock, pacing clock or history. Without a player the session id is the player.
- **Operator paging:** `cursor` is `{toMs}:{offset}`, pinning the window so rounds started later don't shift pages; page size ≤ 500; running rounds are left out. CSV cells that start with `= + - @` are prefixed with `'`.
- **Summary shape:** `RoundSummary` adds `sessionId`, `playerId`, `gameId`, `settledAt`, `profile`, `clientVersion`, `balanceBeforeMinor/AfterMinor`, `returnMinor`, `netMinor`, `resultKind`, `crashMultiplier`, and `cashouts[]` (`{reason, time, multiplier, share, exactMinor, creditedMinor, clientTapAt, rttMs}`; a single cash-out round derives one entry from its settlement, partial cash-out games write `Settlement.cashouts`).
- **In-game history:** a DOM dialog listing up to 50 rounds; detail rows are labelled "Past round". History strip chips add a text or icon marker (✓ cashed out, ✕ crashed, void) next to the multiplier.

Upstash cost goes up (about 3 more commands per round). This is acceptable at MVP volume and noted in the risks.

### D11. Time authority without a network call per request
- A `TimeSource` in the API syncs against Redis `TIME` at cold start and then every 10 s.
- `clock.now()` = `Date.now() + offset`.
- Offset changes over 100 ms are logged and written to the audit log.
- The memory store uses offset 0.
- `RoundHost` keeps its synchronous `Clock` interface, so no changes spread through `core`.

*Alternative:* `TIME` on every request. Rejected because it adds a round-trip to every cash-out.

### D12. Server crypto behind an injected HMAC
- `fairness` gains `type HmacSha256 = (key: Uint8Array, msg: Uint8Array) => Uint8Array`. `deriveRound`, `streamBytes` and `commitServerSeed` take an optional implementation, defaulting to the pure one.
- The API passes a `node:crypto` implementation (`createHmac`/`createHash`), so `fairness` stays free of `node:*`.
- A test in `apps/api` derives 100k random rounds with both implementations and asserts bit equality.

### D13. Seed lifecycle: automatic rotation and encryption at rest
- The session stores `seedRounds` and `seedCreatedAt`.
- Before `startRound`, if the seed has run 1,000 rounds or is 24 h old (both configurable), the host rotates, keeps the revealed seed in `session.revealedSeeds` (last 20), and publishes the new commit. The first round on the new seed is nonce 0.
- `GET /v1/session/seeds` returns revealed seeds for verification.
- `core` defines `SeedCipher { encrypt(seed): Promise<string>; decrypt(ct): Promise<string> }`. The API implements AES-256-GCM with WebCrypto, key `SEED_ENCRYPTION_KEY` (32 bytes, base64); startup fails without it when deployed. Tests and dev use a pass-through cipher.
- Round records store only the seed *ciphertext* plus commit. Seeds are never logged; a redaction helper covers error paths.

### D14. Append-only hash-chained audit log
- `core` defines `AuditSink.append(type, data)`. The API implements it like this:
  - Read `wc:audit:last` (`seq`, `hash`).
  - Compute `hash = sha256(prevHash | seq+1 | at | type | json)` in the app. Redis Lua has no SHA-256.
  - Commit with a Lua compare-and-set that writes `wc:audit:{seq+1}` and updates `wc:audit:last` only if `last` is unchanged.
  - On conflict, re-read and retry.
- Entries keep the retention TTL.
- `pnpm --filter @triptown/api audit:verify` walks the chain.
- Events: session created, seed commit/reveal, round start (debit), cash-out received (evidence), settle (credit), void/refund, profile/kill-switch change, integrity result, time drift.

*Alternative:* a Redis Stream. It works with Upstash, but compare-and-set chaining is simpler to verify offline.

### D15. Integrity manifest, endpoint and daily check
- The release build (`scripts/release-manifest.mjs`) hashes every file in `apps/api/.vercel/output/functions/api.func` and `apps/whack/dist`. It writes `manifest.json` (version, git sha, file → sha256) and signs it with Ed25519 (`RELEASE_SIGNING_KEY` in CI; the public key is committed).
- The server bundle includes the manifest.
- `GET /v1/admin/integrity` (operator/admin key) recomputes hashes of the function's own files, verifies the signature and compares.
- It runs at cold start (async, non-blocking) and daily via a Build Output API `crons` entry.
- A failure sets `wc:integrity:blocked`. `startRound` then rejects with `integrity_blocked` until an admin clears it through `POST /v1/admin/integrity/clear`. Results go to the audit log.

### D16. Disconnect policies
- `lose`: current behaviour.
- `cashout-at-disconnect`:
  - The SSE handler's `onAbort` calls `host.cashout(..., { reason: 'disconnect' })`, judged at detection time.
  - As a backstop for rounds whose stream never connected, the client sends `POST /v1/rounds/:id/heartbeat` every 2 s. A check on the next touch (or the stream poll) settles at the last heartbeat + 3 s if that was before the crash.
  - The new settlement reason `disconnect` is added to `CashoutReason`.
- Portugal's "multiplier shown at disconnect" is approximated by the detection time. The exact semantics are a PT follow-up question.

### D17. Void and refund
- `startRound` writes the round with `debited: true` inside a try/catch. If `putRound` or history fails after the debit, it credits the stake back, writes `void` with a reason and audits it.
- Settlement writes the settlement, then credits, then sets `credited: true`.
- A reconciliation step (run by the daily cron and on session touch) finds records that are settled but not credited older than 60 s and credits them. Rounds with no settlement past `tMax + 120 s` and no derivable outcome (for example a decrypt failure) are voided and refunded.
- Void events stream as a new terminal event `VOID { reason, refundMinor, balanceMinor }`.

### D18. Operator bridge in `engine`
- `packages/engine/src/bridge.ts` implements the protocol envelope `{ protocol: 'triptown', version: 1, type, payload }`. It checks the origin against the profile's `operatorOrigins` using `document.referrer` / `location.ancestorOrigins` to find the parent, and always posts with an explicit `targetOrigin`.
- **Inbound** messages map to controller commands:
  - `pause`/`resume`: a reality-check overlay that blocks BET after the current round.
  - `closeGame`.
  - `setLimits`: stake and loss limits enforced before `bet()`, emitting `error: loss_limit`.
  - `showMessage`.
- **Outbound:** `gameReady`, `balance`, `roundStarted`, `roundEnded { stake, return, net, kind }`, `error`.
- The sandbox implements the operator side with buttons for pause, close, limits and message, plus a profile picker that sends the dev override.

### D19. Session clock, net position and idle prompt in the HUD
- The HUD adds a compact strip under the header, `⏱ 12:04 · NET +4.00`. It shows when the profile enables it.
- Values come from the session counters (D10), updated on every settlement.
- The idle prompt is a DOM dialog triggered by a client timer since the last bet (`idlePromptMs`). It blocks BET until the player chooses Continue or Exit; Exit sends `closeGame` on the bridge.

### D20. Latency measurement and evidence
- The client measures RTT with `GET /v1/ping`, which never touches Redis, every 10 s while the game is visible, and from cash-out timings.
- A slow-connection notice shows when the EWMA RTT is above 300 ms.
- Cash-out requests send `{ clientTapAt: serverEstimateMs, rttMs }`, where `serverEstimateMs` is the tap `performance` time converted with the SSE clock offset. They are logged only (D10, D14).

### D21. Adult skin as a second art set and theme
- Art moves to `apps/whack/art/skins/candy.mjs` and `skins/adult.mjs`, built into `public/assets/atlas-candy.*` and `atlas-adult.*`.
- `theme.ts` becomes `skins/{candy,adult}.ts`, exporting colours, fonts and effect intensity.
- Adult direction:
  - palette of charcoal, deep teal and brass;
  - Bricolage Grotesque only, with no bubbly display face;
  - moles with smaller eyes, natural proportions, no crown (brass sheen on the target mole instead), no blush or buck teeth;
  - no confetti or BONK burst: a restrained ring pulse only on `win`;
  - no sunburst rays: a subtle radial gradient.
- The loader fetches only the active skin's atlas.
- An art checklist (no mascot features, no candy motifs, no child-like palette) is added to the art source header and checked in review against the audit's F1.

### D22. Mock parity and verification
- `MockRoundService` accepts a profile and implements every new rule through `RoundHost`, since it shares core. The shared `round-service-suite` gains:
  - cycle gate;
  - minimum cash-out;
  - rising-mode no-setback checks;
  - void event handling;
  - history fields.
- New end-to-end scripts:
  - `scripts/timing-check.mjs` plays 50 fastest-possible rounds per profile in headless Chrome and asserts round-start intervals are ≥ `minCycleMs`.
  - `scripts/presentation-check.mjs` forces below-stake, even and win results and asserts no confetti or win sound on the first two, using the `AudioManager` log and view state.

### D23. Settlement rounding: exact accrual, one half-up rounding, 0.20 minimum
- Measured RTP with per-cash-out round-down fell well below 97% at small stakes: about 92.9% for Whack at 0.10 with a 2 s cash-out, and about 93.9% for Paper Route at 0.10 per paper. GLI-19 §4.7.1(a) requires the minimum RTP at every bet level, and Nevada Notice 2026-14 bans round-down-only payouts.
- **Decision (user, 2026-09-15):** settlement accrues exact values per cash-out, credits the round total rounded half-up once, and raises the minimum stake or paper value to 0.20. With one cash-out this reduces to "round half-up once", so both games use the same function.
- The simulator gains a settlement-rounding mode at given stakes. The shared suite's payout assertions change from floor to half-up.
- **Band, not ±0.1% (user decision, 2026-09-15):** no deterministic cent rounding can keep every cash-out value within ±0.1% at small stakes. At 0.20, x1.02 pays 0.20 (95.1%) and x1.025 pays 0.21 (99.4%). At 1.00 the band is about ±0.5%, and at 10.00 about ±0.05%. Reports publish the worst-case band per stake. Certification gates on the jurisdiction minimum RTP at every stake (GLI-19 §4.7.1a), and the rules disclose the rounding effect. Theoretical (unrounded) reports keep the ±0.1% gate for profile validation.
- The light profile keeps `minCashout` x1.01 (user decision). Halving rounds can't cash out below x1.01; RTP was verified unchanged at 97.0%.

## Risks / Trade-offs

- **[Profile values are unverified legal defaults]** → Each profile carries a `sources` note and `reviewed: false`. The `game-compliance-audit` skill lists them for counsel sign-off before production use.
- **[Merge conflicts with `paper-route-mvp` in `core`/`fairness`]** → Land `core` changes as small commits: profiles, identity/lock, cycle gate, crypto provider. Keep new code in new modules (`profiles.ts`, `rules.ts`, `audit.ts`, `seed-cipher.ts`). Coordinate through `tasks.md` ordering. Make no assumption that one round has one cash-out.
- **[Upstash command volume and cost increases]** (history index, counters, audit entries, lastStartAt) → Pipeline commands per request, measure commands per round in the preview test, set retention per deployment.
- **[SSE abort detection in serverless may miss some disconnects]** → The heartbeat backstop (D16). Only `pt-draft` uses `cashout-at-disconnect` for now.
- **[Integrity self-hashing inside a function bundle]** can be fooled by an attacker who controls the runtime → This is a lab expectation, not a security guarantee. It is paired with signed manifests, Vercel immutable deployments and the external verification endpoint.
- **[Audit log chaining under concurrency]** → Compare-and-set with retry. Chain order may differ from wall-clock order, which is acceptable because each entry records its own timestamp.
- **[Adult skin placeholder quality]** → Ship the placeholder for certification screenshots, then brief an illustrator. Candy remains available for light profiles.
- **[Slower pacing reduces revenue per session in regulated markets]** → Confined to regulated profiles. Light profiles keep 2.5 s and quick replay.

## Migration Plan

There is no production data yet. Preview Redis databases are flushed when this change deploys, because the session and round shapes change (encrypted seeds, player id, counters).

The API rejects sessions created before the change (401 → client recreates). Roll back by redeploying the previous build and flushing preview Redis again.

## Open Questions

- Operator authentication model for production (per-operator API keys vs signed launch tokens). The `OPERATORS` env var is enough for sandbox and preview.
- Exact Portugal disconnect semantics ("multiplier displayed at disconnection") and whether detection-time settlement is accepted. This is resolved in the PT follow-up, not here.
- Whether `light` should also default to muted sound. Product call; it doesn't change the specs.
