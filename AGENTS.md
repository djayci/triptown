# AGENTS.md

Triptown Games builds HTML5 crash-style games for real-money gambling operators. The games run inside operator iframes and native webviews on mid-range phones, and everything is hosted on Vercel. The first game is **Whack Crash**: a golden mole rises with a multiplier, WHACK cashes out, the mole diving is a crash, a bad mole knocks the value down by x0.5 and a good mole lifts it by x1.05.

Many more games will follow. Shared packages must never depend on one particular game.

## Source of truth

- **Spec:** `openspec/changes/whack-crash-mvp/`. Read `design.md` (decisions D1–D10) before changing math, fairness, settlement, transport or rendering structure. `tasks.md` shows what is done and what comes next. Requirements are in `specs/*/spec.md`.
- **Workflow:** changes go through OpenSpec (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`). When implementing a task, tick it in `tasks.md` only after its stated "verify" step passes.
- **New games:** run the **`new-game-concept`** skill (`.claude/skills/new-game-concept/`). It takes an idea through mechanics brainstorming, `opsx:explore`, a concept-stage compliance audit, a design canvas and an OpenSpec proposal, in that order.
- **Art direction:** Candy Arcade Pop. The mockups are in `design/whack-crash/*.dc.html` (bright yellow, thick ink outlines, Lilita One for display text, Bricolage Grotesque for UI text). The Neon files there are the rejected alternative. Don't use them as reference.

Settled decisions are not up for debate while you implement. If code and spec disagree, raise it; don't quietly diverge. Known open questions: the max win default (multiplier or fixed amount), the operator wallet API, and long-term seed storage.

## Layout

```
apps/
  whack/        Vite + PixiJS v8 game client (static build)       @triptown/whack
  lift/         The Lift: a skin on the Whack Crash engine         @triptown/lift
  gate/         Beat the Gate: a skin on the Whack Crash engine    @triptown/gate
  sandbox/      fake operator page: iframe embed + verifier       @triptown/sandbox
  api/          Hono on Vercel functions: rounds, SSE, cashout    @triptown/api
packages/
  fairness/     seeds, HMAC streams, crash time, setbacks and boosts, verifier, RTP simulator
  core/         pure round model: path value, state machine, money, RoundHost, RoundStore, game registry
  rgs-client/   RoundService interface, MockRoundService (./mock), shared test suite (./testing)
  crash-client/ the game-neutral crash client: round controller, CrashScreen layout, HUD, theme,
                DOM compliance panels (rules, history, fairness, overlay) and the shared checks
  engine/       Pixi helpers: app bootstrap/DPR, assets, tweens, particles, audio, reduced motion
```

Dependency direction: `fairness` ← `core` ← `rgs-client` / `api` ← `whack`. `engine` knows nothing about rounds.

Packages export TypeScript source directly (`"exports": "./src/index.ts"`). They have no build step, and apps bundle them.

**A new game is a skin, not a product.** It extends `CrashScreen` from `@triptown/crash-client`,
supplies a `GameStage` and its words, and implements no layout and no compliance logic — those live
in `CrashViewBase` and hold by construction. `apps/lift` is the worked example: 34 lines of view.
A stage receives the multiplier and nothing else, never the crash time, which is what keeps the
no-advance-warning rule true rather than merely intended.

**Shared packages name the model, never a game.** Events are `SETBACK` / `BOOST` / `PART_SETTLED`; a split stake has `stakeParts` and settles into `parts`. A game is registered at runtime, not listed in a type:

```ts
registerGame('skin-game', 'whack-crash');   // a skin on a certified engine
registerGame('some-game'); // brings its own maths, needs its own report
```

The second argument is the engine whose config ids the game plays, so a skin reuses the certified ids and their committed RTP reports and needs no recertification. That is the point: new games are presentation, not new maths. Adding a game must never mean editing a type in `core` or `fairness`.

## Commands

Use Node 22 (`.nvmrc`) and pnpm 10. Run commands from the repo root:

```sh
pnpm install
pnpm dev                     # all apps (whack :5173, sandbox :5174, api via tsx watch)
pnpm build | lint | test | typecheck
pnpm format                  # prettier
pnpm --filter @triptown/whack dev
pnpm --filter @triptown/whack build:demo      # demo build with the mock service (dist-demo/)
pnpm --filter @triptown/whack atlas           # rebuild public/assets/atlas-{candy,adult}.{png,json} (add a skin name to build one)
pnpm --filter @triptown/fairness simulate     # Monte Carlo RTP report -> packages/fairness/reports/
pnpm --filter @triptown/core exec vitest run src/round.test.ts   # single test file
```

Client compliance behaviour is verified by driving the real client, never by eye: `node packages/crash-client/scripts/presentation-check.mjs` (no win cues at or below the stake) and `node packages/crash-client/scripts/timing-check.mjs --profile <name> --min-ms <gap>` (minimum gap between rounds, and no hold-to-repeat). Both must pass for every active profile before a release.

Before calling work done, run `pnpm lint typecheck test` for the packages you touched (for example `pnpm turbo run lint typecheck test --filter=@triptown/core...`).

## Hard rules

These protect real money and certification. Breaking one is a bug, even when the tests pass.

1. **`fairness` and `core` stay pure.** No Pixi, GSAP, Howler, DOM globals or `node:*` imports. They must run unchanged in the browser mock, the API and the verifier. ESLint enforces this (`eslint.config.js`). Never weaken that rule to make an import work. Test files and `scripts/` are exempt.
2. **Payout never depends on skill or strategy.** The payout is a martingale (D4). Crash hazard depends only on elapsed time. Setbacks and boosts are independent of the crash time and of each other. There are no warnings before a crash. Any change to growth, setbacks, boosts, config limits or crash sampling needs a fresh `simulate` run showing RTP at 97% ± 0.1% for every strategy, with the updated report committed. Each modifier combination *and each pace* is its own config id: `v1`/`v2` are the fast family (median round 3.4 s), `v3`/`v4` the slow one (8.4 s), odd numbers unboosted and even boosted, `-rising` meaning no setbacks. A profile may only use an id with a committed passing report of at least `MIN_REPORT_ROUNDS`; boosted ids need their own lab acceptance before any regulated market uses them. Retiring a pace does not delete its ids — a settled round must still verify.
3. **The client never learns the outcome early.** A running round must not expose crash time `T` or future setbacks or boosts in any response, event or snapshot. `T` arrives only with `CRASH`. The server seed is revealed only on rotation.
4. **Server time is the truth.** Cash-out time is server receive time minus `t0`. There is no latency grace. Ties resolve setback first. Settlement is idempotent. Debit happens before the round starts. Auto cash-out, max win and `tMax` (60 s) settle on the server whether or not a client is connected.
5. **Money is integer minor units.** Use `payoutMinor` / `accrueCashout` + `settleAccrual` and `formatMinor` from `core`: exact accrual, rounded half-up once per round (compliance-baseline D23). Minimum stake is 0.20. Never keep balances or payouts as float currency.
6. **Determinism.** Randomness in a round comes only from `HMAC_SHA256(serverSeed, clientSeed:nonce:stream:i)`. `Math.random()` is fine for cosmetic effects in the client, and never allowed in `fairness`/`core` round derivation.
7. **The mock never ships.** `MockRoundService` is only reachable behind `import.meta.env.VITE_DEMO === 'true'` through a dynamic import (`apps/whack/src/services.ts`). The production build runs `scripts/check-no-mock.mjs` and fails if mock markers leak into the bundle. Demo builds must show a visible DEMO label.
8. **A stake-free round still consumes its nonce and is still recorded.** A practice round skips exactly one step of `startRound` — the debit — and shares the rest. If it skipped the nonce, the next staked round would use the nonce the player had just watched play out: not an information leak but a solved game, and indistinguishable from an honest build until someone exploited it. Assert the nonce advances directly; a passing round proves nothing about it. `validateBet` must keep rejecting a zero stake, so the practice path bypasses it rather than loosening it.
9. **Transport is HTTP + SSE only.** No WebSockets, because everything has to fit inside Vercel serverless functions.

## Compliance (certification and licensing)

These games are built to be certified by accredited test labs and licensed to regulated operators. The current Whack Crash audit is **`docs/compliance/whack-crash-2026-09-16.md`**; its section 10 records the fixes verified the same day (result presentation, rules screen, operator bridge, non-interactive decoys, clock and net position, history view, RTP band, adult skin). What remains there is Kenya hosting and the licensing questions for counsel. **`docs/compliance/whack-crash-2026-09-15.md`** is the platform baseline; `night-meet-2026-09-16.md` and `going-viral-2026-09-16.md` are concept-stage audits. Shared fixes land through the `compliance-baseline` OpenSpec change. To audit any game, run the **`game-compliance-audit`** skill (`.claude/skills/game-compliance-audit/`). Its `references/jurisdictions.md` holds the dated rules and the watch list. Everything here is research, not legal advice.

**Rules for every game (from the audits; each is a certification blocker):**

0. **A modifier may never take the multiplier down in Brazil or Portugal.** Brazil 1.207 Annex I item 14(d) lists the only permitted round endings and assumes a multiplier that only increases, so a falling value fits none of them (primary text, verified 2026-09-16). Keep `setbacksMode: 'off'` for those markets. Upward modifiers are fine.

1. **Never celebrate a return that is at or below the stake.** No confetti, win sound or "+payout" on those rounds; show the net result instead. Emphasis is not only sound and confetti: screen shake, a burst, a hit landing on the character all read as celebration too, and a shake on a losing round was shipping until `presentation-check` learned to count it. **Every win effect must route through the single celebrate decision** (`resultPresentation` / `resultKind`) and register on a flag or counter the check can read — `confetti` and `shakes` today. The check reads decisions, not pixels, so an effect fired straight from the scene is invisible to it whatever its z-order, and an effect that plays under a result panel is invisible to the player while still counting against you. Source: UKGC RTS 14F (applies to all casino games since Jan 2025), AGCO 2.20.
2. **Enforce a minimum gap between round starts on the server.** It must be configurable per market: UK 5 s, Brazil 5 s (planned), Ontario 2.5 s. The player must release and press again to start the next round. Verify timing with automated tests, not a stopwatch (Stakelogic was fined for that).
3. **Make rules and help available before any bet.** Cover modifiers, RTP and how it is derived, max win and caps, minimum cash-out, disconnect and latency policy, and rounding. State that the outcome is fixed and that tapping or decorations do nothing. Source: GLI-19 §4.4.1, UK RTS 3/4.
4. **No autoplay and no auto-rebet.** Auto cash-out is allowed because it only ends the current bet. One game at a time per player.
5. **No illusion of skill.** No reflex or skill copy, no decorations that look interactive, no near-miss animations, no "would have reached xN". Source: AGCO 2.15, GLI §4.6.1(a), RTS 7C.
6. **No child-appealing art in regulated builds or marketing.** Portugal R7c and Kenya Reg 95 apply to the game itself. UK CAP 16.3.12, AGCO 2.03 and Brazil 1.231 cover tiles, demos and ads. Keep an adult skin available.
7. **Support player-protection hooks:** session clock, net position, and an operator reality-check pause that only takes effect between rounds. Keep per-round history with an operator API, and use a pinned postMessage origin, never `'*'`.
8. **Record per-market differences as jurisdiction profile flags, not forks.** Examples: `minCycleMs`, `maxMultiplier`, `minCashout`, `setbacksMode`, `skin`, `showNetPosition`, `hostingRegion`.
9. **Free play is advertising, not just gameplay.** `practiceRounds` defaults off and is absent from every template. Enabling it for a market is a legal decision — UK CAP and Brazil 1.231 bring age-gating and content rules a gameplay flag cannot answer — not a config change. The server refuses a practice round the profile forbids whatever the client offered: "the button was hidden in that build" is not a defence. A practice round never shows money and never states what a stake would have returned (AGCO 2.15, UK RTS 7C near-miss).
10. **Publish the RTP band measured at the stake the market actually sells.** Half-up rounding costs most at the smallest stake and almost nothing above it: `whack-crash/v3-rising` measures 96.35%-97.18% at a 0.20 stake but 97.00%-97.01% at 1.00. A band measured at 0.20 is therefore both wrong and pessimistic for Nigeria, whose minimum is 100.00 (500x larger), while a flat 97% would breach GLI-19 4.7.1(a) in any market that does allow 0.20. `reports/bands.json` holds one band per config id *per stake level* and `bandForStake()` picks the largest measurement at or below the market's `minBetMinor` — never above it, which would understate the spread. A config with no measured band must fail the build (`scripts/check-bands.mjs`), never fall back to the headline figure: the rules screen drops the band silently when one is missing.
11. **Rounding must not be one-way or break the published RTP.** GLI-19 §4.7.1(a) requires the minimum RTP at any single bet level. A game with several credits per round accrues exact values and rounds once per round, sets a minimum value per credit, and publishes RTP at the minimum bet. Nevada Notice 2026-14 bans "only round down" (by analogy).
12. **No children, cute animals or runner-game looks, in the game or its tiles.** Characters must read as adults (realistic proportions, age cues, work gear). No "cuddly" animals, even as hazards. Source: CAP under-18 guidance (Oct 2025), CAP 16.3.14 ("seems to be under 25"), ASA Videoslots ruling (Jul 2026).
13. **A split stake stays one game.** One debit, one round id, one cycle record. Celebrate only when the round's total return exceeds the stake, never per partial cash-out. Record every partial cash-out in recall. Portugal allows no partial cash-out (Reg. 308 art. 2 h, R12, R26, R29). Source: RTS 14C/14F, GLI-19 §4.14.2(i)(j).
14. **Platform for certification:** server-side crypto via `node:crypto`, automatic seed rotation, encrypted seed storage, deterministic settlement maths, a single time authority, append-only audit logs, 24 h software hash self-checks, separate preview and production, and recorded change control. Any change to RNG, maths or rules means recertification.

**Themed-presentation rules (from the 16 Sep 2026 concept audit; the game it audited was dropped, these outlived it):**

- **A themed number never replaces the multiplier.** Brazil Annex I item 14(c) and Portugal regra 4 require the multiplier value on screen; Italy likely requires a conversion value for anything that reads as game credits; the Netherlands and Spain require the money "sufficiently distinguishable". A theme is a layer over the multiplier and the local-currency payout, never a substitute.
- **No player action may be presented as feeding the outcome.** Netherlands Bko art. 4.2(4) is a statutory ban on required player actions that do not influence the result. Cash-out is fine — it ends the bet.
- **A game's theme is a minors-appeal question, not just its art.** UK CAP guidance (Oct 2025) §14 reaches in-game themes and gameplay resembling "social games popular with under-18s". Check the concept, not only the skin.
- **A studio is directly liable for its own marketing in Nigeria.** ARCON Act s.54 names whoever "creates or places" an advert, and s.63 covers a lobby tile. The operator's approval does not cover the studio.

**Open decisions this raises:**

- **The falling multiplier.** Setbacks can take the value below x1.00. That is illegal in Portugal (R1/R22), conflicts with Brazil's crash rules (item 14), and is a misleading-design risk elsewhere. Hard rule 2 above keeps the maths as specced until this is decided through OpenSpec (`compliance-baseline` proposes `setbacksMode: off` for regulated profiles).
- **The Candy art direction** is a minors-appeal risk in regulated markets. Keep an adult skin available for regulated builds and marketing.
- **Licensing.** The UK needs a software licence plus a game-host licence if Triptown runs the servers (see the Spribe suspension). Sweden and Denmark need supplier permits even when supplying through an aggregator.
- **Hosting.** Vercel/Upstash hosted in the US does not meet the MGA (EU/EEA), Italy (qualified cloud), Brazil, Kenya or New Jersey hosting rules. Kenya is now confirmed hard: Conduct of Gambling Operations Regs 2026 reg 42(2) requires player data on servers in Kenya absent a written exemption, plus a real-time monitoring API (reg 41(d)) and central-system integration (reg 44).

## Client conventions (apps/whack, packages/engine)

- One Pixi `Application` per game. Scenes follow round states (Betting, Running, Setback, CashedOut, Crashed). The HUD is drawn in Pixi so the game is a single canvas, with accessibility labels mirrored in a DOM layer.
- DPR is capped at 2. The ticker pauses when the page is hidden. Check layouts at 390×844 and 1440×900.
- Respect `prefers-reduced-motion`: no screen shake and no confetti.
- The client animates `G(t)` locally, applies setbacks as `BAD_MOLE` events arrive, shows the expected payout as soon as the player whacks, then reconciles with the server's settlement. Repeated taps send exactly one cash-out request.
- Art is vector placeholders: shapes in `apps/whack/art/art.mjs`, palette and character treatment per skin in `art/skins/{candy,adult}.mjs`. One atlas per skin is committed, and a session loads only its profile's skin. After editing the art, run `atlas` and commit all four output files. The adult skin exists to answer the minors-appeal rules (CAP under-18 guidance §14, Kenya reg 95(1)(d), PT R7c, BR 1.231 art. 12 XVIII); its header lists what it is answering, so read that before changing it.
- Audio budget is 1.5 MB total (WebM/Opus plus MP3 fallback). Music loads after the first frame. Audio unlocks on the first gesture. Wrap every `localStorage` access in try/catch because sandboxed iframes may block it. Record every audio source and its licence in `apps/whack/assets/audio/SOURCES.md`.
- Mock rounds can be forced with `?force=` in demo builds (see `MockRoundService.forceNext`).

## Code style

- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Use `import type` for type-only imports.
- Prettier: single quotes, semicolons, trailing commas, 100-char lines. ESM everywhere.
- Prefix intentionally unused variables and arguments with `_`.
- Tests are Vitest, colocated as `*.test.ts`. Math and fairness code gets fixed test vectors and statistical checks. Round-service behaviour goes in `rgs-client/testing/round-service-suite.ts` so the mock and the future `RemoteRoundService` run the same suite.
- Comments explain _why_ (a rule, an invariant, a float guard) rather than restate the code.
- Don't hand-edit generated output: `dist/`, `dist-demo/`, `.vercel/output/`, `atlas.*` or `reports/*`. Regenerate them instead.
- `openspec/` and `design/` are skipped by lint and formatting. Edit them deliberately.
