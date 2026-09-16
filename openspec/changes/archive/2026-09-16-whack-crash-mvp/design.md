## Context

The repo is empty apart from OpenSpec and the design mockups in `design/whack-crash/` (Candy Arcade Pop, hosted at https://claude.ai/artifact/8E361sJfp7xQUYQA7owF6T). See proposal.md for motivation. Constraints:

- Real-money readiness: the payout must never depend on reaction speed or skill, and the browser must never know the round outcome while the round is running.
- Hosting starts on Vercel only, with serverless functions and no long-lived WebSocket servers.
- The game runs inside operator iframes and native webviews on mid-range phones over mobile data.
- Many more games will follow, so shared parts must not depend on any one game.

## Goals / Non-Goals

**Goals:**
- A playable Whack Crash round, end to end, against a real server.
- A math model that is verifiable, with RTP proven by simulation before any UI polish.
- A package split that lets game #2 reuse engine, fairness, round and client plumbing unchanged.

**Non-Goals:**
- Shared multiplayer rounds, live bet feeds, chat.
- Operator wallet integration. The API keeps a fake balance per session.
- Certification-grade RNG audits. The design stays compatible with them, but no audit is done here.
- Final art and final sound mix. Placeholder vector art matching the mockups and generated placeholder sounds are enough.

## Decisions

### D1. Monorepo layout (pnpm + Turborepo)

```
apps/
  whack/        Vite + PixiJS game client (static build)
  sandbox/      fake operator page embedding the game in an iframe
  api/          Vercel functions: round start (SSE), cashout, status
packages/
  fairness/     seeds -> crash time + setback schedule, verifier, RTP simulator
  core/         pure TS round model: path value at time t, settlement, state machine
  rgs-client/   RoundService interface + MockRoundService + RemoteRoundService
  engine/       PixiJS helpers: app bootstrap, resize/DPR, loader, tweens, fx, audio
```

The rule: `fairness` and `core` have zero runtime dependencies on DOM or Pixi, so the same code runs in the browser mock, the API and the verifier.
*Alternative:* one app per game with copy-pasted logic. Rejected because it doesn't scale to many games.

### D2. PixiJS v8 over Phaser

These games need rendering, tweens and particles, not physics, tilemaps or a scene system. Pixi is smaller, which matters for iframe load on mobile data, and it's the common choice in iGaming studios. GSAP handles tweens and Howler handles audio.
*Alternative:* Phaser 3. It's heavier and its scene model duplicates our own state machine.

### D3. Solo rounds, HTTP + SSE (no WebSockets)

```
client                              api (Vercel fn)                 Redis
  | POST /rounds {bet, clientSeed} -->| debit, derive round,          |
  |                                   | store {T, setbacks, t0} ----->|
  |<== SSE: START{roundId, commit, t0}|                               |
  |<== SSE: BAD_MOLE{t, factor}       | (emitted at server time)      |
  |-- POST /rounds/:id/cashout ------>| tc = server receive time      |
  |                                   | tc < T ? credit m(tc) : lost -|
  |<== SSE: CRASH{T}                  | close stream (seed revealed   |
  |                                   | only on rotation, see D5)     |
```

- The stream is held open until the crash, the auto cash-out or the caps end the round, so it must fit inside the Vercel function duration limit. D6's max duration guarantees that.
- `GET /rounds/:id` returns settled results, and lets the client recover the state after it reconnects.
*Alternatives:* polling (chatty and laggy), WebSockets (need a separate service), auto cash-out only (loses the whack moment).

### D4. Math model: the payout is a martingale

Definitions, with all times in seconds from `t0`:

- **Growth:** `G(t) = exp(K(t))`, where the log-growth rate is `K'(t) = r0 + (rmax - r0) * min(1, t / tRamp)`. The rate ramps up, then holds at its cap.
- **Setbacks:** a Poisson process with rate `lambda`. Each hit multiplies the value by `f = 0.5`.
- **Path value:** `m(t) = G(t) * f^N(t)`, where `N(t)` = setbacks so far.
- **Expected value:** `E[m(t)] = exp(K(t) - lambda*(1-f)*t)`.
- **Survival:** `S(t) = P(T > t) = RTP / E[m(t)]` for `t > 0`, with `P(T = 0) = 1 - RTP` (instant bust).

With these definitions, `m(t) * 1{T > t}` has constant expectation `RTP` at every `t`. Setbacks are independent of the crash time, so every stopping strategy (manual whack, auto cash-out target, cash out right after a setback) returns RTP on average.

**Constraint:** `S` must not increase over time, so `K'(t) >= lambda*(1-f)` everywhere. Config validation enforces this.

**Sampling the crash time:** take `U` in (0,1]. If `U > RTP`, then `T = 0`. Otherwise solve `K(T) - lambda*(1-f)*T = ln(RTP / U)`. The left side is monotonic, so a closed form per ramp segment or a bisection works.

**Starting parameters (tunable, validated by simulation):** `RTP = 0.97`, `r0 = 0.12/s`, `rmax = 0.95/s` (about +10% per 100 ms), `tRamp = 12 s`, `lambda = 0.12/s`, `f = 0.5`.

*Alternative:* a crash point based on the multiplier (`crash = RTP/U`), as in classic crash games. Rejected: once setbacks exist the path isn't monotonic, and multiplier-based busting would make RTP depend on strategy.

### D5. Provably fair derivation

- Each session has a `serverSeed` (32 random bytes), a `clientSeed` (chosen by the player, with a default) and an incrementing `nonce`. The API publishes `commit = SHA256(serverSeed)` before the first round that uses it.
- For each round, bytes come from `HMAC_SHA256(serverSeed, clientSeed:nonce:stream:i)`, with separate streams for `crash` and `setbacks`.
- `U` = the first 52 bits divided by 2^52, mapped to (0,1].
- Setback times are exponential gaps with `-ln(U_i)/lambda`, cut off at `T`.
- Settled rounds show their crash time and setbacks right away. The server seed is revealed only when the player rotates it, because later rounds in the session use the same seed. After rotation, the player can recompute `T` and every setback using `packages/fairness` in the sandbox verifier.
*Alternative:* a fresh server seed per round. That's simpler, but it means extra commit round-trips. We keep the session-plus-nonce model, which is the industry norm.

### D6. Settlement, caps and timing rules

- **Debit** happens at round start. If the debit fails, the round does not start.
- **Cash-out** time `tc` is the server receive time minus `t0`. There is **no retroactive latency grace**: a grace window would let a client that has already seen `CRASH` cash out after the fact. Payout = `bet * m(tc)`, rounded down to the currency's minor unit.
- A setback and a cash-out at the same server time are ordered by timestamp. Ties resolve setback first.
- **Auto cash-out:** the player sets a target before the round, and the server settles at the first `t` where `m(t) >= target`. The client plays the whack animation for it.
- **Max win:** payout is capped (configurable, default 10,000x or a fixed amount), and the server auto cashes out when `m(t)` reaches the cap.
- **Max duration:** the server forces a cash-out at `tMax` (default 60 s) so the stream fits the function limit. Forced cash-outs are stopping times, so RTP is unchanged.
- **Disconnect:** the round continues on the server. Auto cash-out applies if set, otherwise the round ends at crash as a loss. Reconnecting shows the result.

### D7. Client display vs server truth

The client animates `G(t)` locally from `t0` and applies setbacks when their SSE events arrive. When the player whacks, it shows the expected payout immediately, then reconciles with the server's settled `m(tc)`, which may be slightly higher because of network delay. The client never gets `T` until `CRASH`.

### D8. Round service abstraction

`RoundService` has `start(bet, opts) -> event stream`, `cashout(roundId)` and `getRound(roundId)`. `MockRoundService` runs `fairness` + `core` in the browser with the same timing rules. It exists for development and demos only, is visibly labelled "DEMO", and is excluded from production builds by config.

### D9. Rendering structure

- One Pixi `Application` per game. Scenes follow round states (Betting, Running, Setback overlay, CashedOut, Crashed).
- The HUD (bet panel, history, balance) is drawn in Pixi so the whole game is one canvas for webview embeds. Accessibility labels are mirrored in a DOM layer on top.
- Resolution is capped at DPR 2. A reduced-motion setting turns off screen shake and confetti.
- Art is vector placeholders built from the mockup shapes, packed into one texture atlas at build time.

### D10. Audio

- **One effects sprite + separate music stems.** All one-shot effects (bet, whack, setback sting, win, big win, crash, UI ticks) go in one audio sprite, so a single download and a single decode cover them. Music is 3 looping stems of the same length and tempo: base, drums, lead.
- **Music that builds with intensity.** All 3 stems start in sync when a round starts. Drums fade in at the Fast level and lead at FRENZY, driven by the same intensity value as the meter. Fading stems in keeps them on the beat, which switching tracks wouldn't.
- **Rising tone follows the multiplier.** A short looping tone plays while the mole is up. Its playback rate is `clamp(1 + 0.25*log2(m), 1, 2)`, so the pitch climbs with the multiplier and drops audibly on a setback.
- **Audio follows game events.** The client plays sounds when round events arrive (START, BAD_MOLE, CASHED_OUT, CRASH) and on local input (whack tap). The whack sound plays on tap without waiting for the server, so the hit feels instant.
- **Formats and budget.** WebM/Opus first with an MP3 fallback, and a total audio download of 1.5 MB or less. Music stems load after the first frame so audio never delays startup.
- **Browser rules.** Audio unlocks on the first user gesture, which is always the BET tap, and the game shows a mute icon until then. Audio pauses when `visibilitychange` reports the page hidden, which covers webviews sent to the background.
- **Controls.** Mute, music volume and effects volume are saved per device in `localStorage`, wrapped in try/catch (some iframes block storage) with defaults of sound on, music 60%, effects 90%.
- **Placeholder source.** Sounds are generated with an AI audio tool and trimmed to the budget. Their licence terms are recorded in `apps/whack/assets/audio/SOURCES.md` so they can be replaced before a commercial launch.
*Alternative:* one pre-mixed music track per intensity level. Rejected because switching tracks sounds jarring and costs 3 times the download.

## Risks / Trade-offs

- **Vercel function duration limits cut long rounds** → `tMax` 60 s cap and forced cash-out. Check the plan's limit before deploying.
- **Players on high latency lose value between tap and server receipt** → show "cashing out..." instantly and document that settlement uses server time. Measure p95 latency in the sandbox.
- **The mock service leaks outcomes** → demo only, labelled, excluded from production by config.
- **Players find setbacks unfair** → the provably fair verifier shows setback times, and the mechanics are explained in a help panel.
- **Math mistakes** → a Monte Carlo simulator (10M+ rounds per strategy) must show RTP within ±0.1% for fixed targets, timed cash-outs and after-setback strategies before the client is built.
- **Audio adds load time in iframes on slow connections** → 1.5 MB budget, music loads after first frame, and a CI check fails the build if audio assets grow past the budget.
- **iOS webviews keep audio locked, or cut it when the phone is switched to silent** → the game stays fully playable without sound. Test on a real iPhone in task 8.3.
- **Redis round state is lost mid-round** → settle from the stored `{seeds, nonce, t0}` because the round is deterministic. Write the debit before the stream starts.

## Migration Plan

This is a new project, so there's nothing to migrate. Deploy order: API with Redis, then the game, then the sandbox, all as preview environments first. Rollback means redeploying the previous Vercel deployment.

## Open Questions

- Max win default: a multiplier cap or a fixed currency amount per operator? This is a config value and doesn't change the specs.
- Where session seeds live long-term once real operators exist (Redis vs a database). It doesn't affect this MVP.
