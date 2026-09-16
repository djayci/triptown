## 1. Monorepo setup

- [x] 1.1 Initialize git, pnpm workspace and Turborepo with `apps/*` and `packages/*`; verify `pnpm install` and `pnpm turbo run build` succeed on the empty workspace
- [x] 1.2 Add shared TypeScript strict config, ESLint, Prettier and Vitest; verify `pnpm turbo run lint test typecheck` passes with a placeholder test in each package
- [x] 1.3 Scaffold empty packages `fairness`, `core`, `rgs-client`, `engine` and apps `whack`, `sandbox`, `api`; verify each builds and `fairness`/`core` have no DOM or Pixi dependencies (lint rule or dependency check fails if added)

## 2. Fairness and math (packages/fairness)

- [x] 2.1 Implement seed generation, SHA-256 commit and HMAC-SHA256 byte streams (`crash`, `setbacks`) with 52-bit uniform extraction; verify with fixed test vectors
- [x] 2.2 Implement the game config type and validator (RTP, r0, rmax, tRamp, lambda, f, max win, tMax), rejecting configs where the growth rate is below `lambda*(1-f)`; verify unit tests for valid and invalid configs
- [x] 2.3 Implement crash time derivation (instant bust when `U > RTP`, otherwise invert `K(T) - lambda*(1-f)*T = ln(RTP/U)`); verify that the same inputs give the same `T` and that the inversion is accurate to 1 ms
- [x] 2.4 Implement setback schedule derivation (exponential gaps, cut off at `T`); verify determinism tests and that the mean count matches `lambda*T` over 1M samples
- [x] 2.5 Implement the verifier API (seed, clientSeed, nonce, config → crash time, setbacks, commit check); verify a tampered seed reports not verified
- [x] 2.6 Build the Monte Carlo RTP simulator CLI covering fixed targets (1.5, 2, 10, 100), fixed cash-out times, cash-out right after a setback, and never cashing out; verify 10M rounds per strategy give 97% ± 0.1% and instant bust 3% ± 0.05%, and save the report

## 3. Round model (packages/core)

- [x] 3.1 Implement growth `G(t)` and path value `m(t)` from the setbacks, including tie ordering (setback first); verify unit tests for the 4.20 → 2.10 case and the speed cap
- [x] 3.2 Implement the round state machine (created → running → settled won/lost) with cash-out, auto cash-out, max win, max duration and duplicate cash-out handling; verify unit tests for every round-engine scenario
- [x] 3.3 Implement payout rounding down to the currency minor unit; verify the 4.2037 × 10.00 = 42.03 test
- [x] 3.4 Define the shared event types (START, BAD_MOLE, CASHED_OUT, CRASH) and the round snapshot type; verify that types compile in `rgs-client` and `api`

## 4. Round service client (packages/rgs-client)

- [x] 4.1 Define the `RoundService` interface (start → event stream, cashout, getRound, session/seed ops); verify that type-level tests compile
- [x] 4.2 Implement `MockRoundService` using `fairness` + `core` with real-time event timing and a fake balance; verify an integration test plays won, lost, setback and instant-bust rounds with the correct balances
- [x] 4.3 Add a build flag that excludes the mock from production bundles; verify the production bundle has no mock code (grep the build output)

## 5. Engine (packages/engine)

- [x] 5.1 Implement Pixi v8 app bootstrap with resize handling, DPR capped at 2, and a pause-when-hidden ticker; verify a demo scene renders at 390×844 and 1440×900 without blurring
- [x] 5.2 Add the asset loader with a texture atlas pipeline, GSAP tween helpers, particle emitter wrapper and Howler audio wrapper that respects mute; verify a demo scene plays a tween, confetti burst and sound
- [x] 5.3 Add the reduced-motion flag (reads `prefers-reduced-motion`) that fx helpers respect; verify shake and confetti are skipped when it's emulated in devtools

## 6. Whack Crash client (apps/whack)

- [x] 6.1 Build placeholder vector art (golden, bad, decoy moles; hole; buttons; chips) matching `design/whack-crash` Candy Arcade Pop, and pack it into an atlas; verify a visual side-by-side with the mockups
- [x] 6.2 Implement the betting scene and HUD (balance, bet −/+, chips, auto cash-out, BET button, limits and insufficient-balance states); verify it against the whack-game-client betting scenarios using the mock service
- [x] 6.3 Implement the running scene (rising golden mole, multiplier, cash-out value, intensity meter, decoy moles, WHACK button and mole tap, Space key, single cash-out request); verify multiplier updates each frame and repeated taps send one request
- [x] 6.4 Implement the setback moment (crossed-out old value, halved value, −50% marker, bad mole coin snatch, tilt/shake); verify with a forced setback in the mock
- [x] 6.5 Implement the cashed-out, crashed and instant-bust result states with optimistic-then-settled payout reconciliation; verify each state with mock rounds forced to win, lose and bust at 1.00
- [x] 6.6 Implement the history strip and fairness panel (commit, client seed edit, nonce, verify settled round); verify that a settled round verifies in the panel
- [x] 6.7 Implement stream reconnect and round fetch recovery; verify that dropping the connection mid-round in devtools then restoring it shows the correct final state
- [x] 6.8 Add the DEMO label when the mock is in use; verify it's visible in every state on the demo build and absent in production
- [x] 6.9 Generate placeholder audio (effects sprite: bet, whack, setback sting, win, big win, crash, UI ticks; 3 synced music stems; rising tone loop), export WebM/Opus + MP3 and record sources and licences in `apps/whack/assets/audio/SOURCES.md`; verify that total audio is 1.5 MB or less and that a CI size check fails above the budget
- [x] 6.10 Wire sounds to game events: whack plays on tap, setback sting + music cut, win/big-win at x10, crash stops music; music stems layered by intensity; rising tone pitch = `clamp(1 + 0.25*log2(m), 1, 2)`; verify each "Sound for every game moment" scenario with mock rounds
- [x] 6.11 Add audio controls (mute, music volume, effects volume) saved to storage with safe fallback, unlock on first gesture, pause/resume on visibility change; verify each "Audio controls and browser behaviour" scenario, including storage blocked in a sandboxed iframe

## 7. Round API (apps/api)

- [ ] 7.1 Provision Upstash Redis and environment variables; verify a health endpoint reads and writes a key in preview
- [x] 7.2 Implement sessions: fake balance, server seed + commit, client seed update, seed rotation with reveal; verify API tests for the provably-fair seed scenarios
- [x] 7.3 Implement `POST /rounds`: validate bet and limits, one active round per session, debit, persist the round, stream START/BAD_MOLE/CASHED_OUT/CRASH over SSE until settled or `tMax`; verify API tests for start, insufficient funds and round in progress
- [x] 7.4 Implement `POST /rounds/:id/cashout` using server receive time with no grace, idempotent settlement and credit; verify API tests for before crash, after crash, setback tie and duplicate cash-out
- [x] 7.5 Implement server-side auto cash-out, max win and max duration settlement that runs whether or not the stream is connected; verify tests where the client disconnects and the round settles correctly
- [x] 7.6 Implement `GET /rounds/:id` returning the snapshot, or the settled result with reveal data where allowed; verify it never includes crash time or future setbacks while the round runs
- [x] 7.7 Implement `RemoteRoundService` in `rgs-client` against the API; verify the same integration suite from 4.2 passes against a local API

## 8. Sandbox and deploy

- [x] 8.1 Build the sandbox operator page embedding the game in a cross-origin iframe, with balance display and the fairness verifier; verify a full round completes inside the iframe with no console errors
- [ ] 8.2 Deploy api, whack and sandbox as Vercel preview projects; confirm the plan's function max duration is at least `tMax` + buffer, and verify an SSE round of 60 s completes on preview
- [ ] 8.3 End-to-end check on a real phone (iOS Safari and Android Chrome) through the sandbox: bet, setback, whack win, crash loss, reconnect; verify all pass and measure p95 cash-out latency
