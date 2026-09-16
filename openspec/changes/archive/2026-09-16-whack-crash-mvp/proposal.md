## Why

Triptych Studio is opening **triptown-games**, a vertical that builds crash-style instant games for gambling operators. We need a first game that proves the mechanics, the math and a reusable engine at the same time. "Whack Crash" is that first game: a crash game where you cash out by whacking a golden mole, with a bright candy-arcade look so it stands out from the dark Aviator-style games.

## What Changes

- New pnpm + Turborepo monorepo in `triptown-games/`, organized so every later game reuses the same engine, fairness and round packages.
- New **solo round engine**: each player gets their own round, generated server-side. The multiplier grows over time with a speed ramp, random **bad mole setbacks** (x0.5) happen during the round, and a secret crash time ends it.
- New **provably fair** layer: the server commits to a seed hash before the round and reveals the seed after it. Players can verify the crash time and setbacks. The target is a 97% RTP for every cash-out strategy.
- New **Whack Crash web client** (HTML5/WebGL, mobile-first, runs inside operator iframes and native webviews). It covers five states: betting, running, setback, cashed out and crashed. Visuals follow the Candy Arcade Pop mockups.
- New **sound layer**: event sounds for every game moment, a music loop that builds with round intensity, a rising tone whose pitch follows the multiplier, and mute and volume controls. Sounds are placeholders for now, and the final mix comes later.
- New **round API on Vercel**: start a round and stream its events over SSE, cash out, and read round status. Round state is stored in Redis.
- New **in-browser mock round service**, so the game is playable before the server exists. Demos only: it exposes the secret round data to the browser.
- New **sandbox page** that simulates an operator site (iframe embed, balance, currency).

## Capabilities

### New Capabilities
- `round-engine`: round lifecycle, bet debit and win credit, how the multiplier path is built (growth, speed ramp, setbacks), cash-out rules, crash, auto cash-out, max win and max duration caps, and disconnect handling.
- `provably-fair`: seed commit and reveal, deterministic derivation of crash time and setback schedule, player verification, and the guarantee that RTP doesn't depend on strategy.
- `whack-game-client`: the player-facing game: bet controls, the WHACK cash-out action, what each round state shows, round history, sound and audio controls, responsive layout, and running inside an embed.

### Modified Capabilities
None. This is a new project with no existing specs.

## Impact

- **New code:** `apps/whack`, `apps/sandbox`, `apps/api`, `packages/core`, `packages/fairness`, `packages/rgs-client`, `packages/engine`.
- **New dependencies:** PixiJS v8, GSAP, a particle emitter, Howler, Vite, Vitest, Upstash Redis.
- **Infrastructure:** Vercel projects for the game, the sandbox and the API; an Upstash Redis instance.
- **Out of scope:** shared multiplayer rounds, real operator wallet integration, an operator API or aggregator adapters, a backoffice, final character art, the final sound mix, and licensing or certification work.
