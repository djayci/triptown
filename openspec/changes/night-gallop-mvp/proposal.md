## Why

Licensed operators in Nigeria and Ghana already offer instant games, and step games (push one step further, or cash out) are among the most played there. **Night Gallop: Fence Run** (working title) puts that loop into a floodlit steeplechase told like a TV broadcast. The player presses JUMP to take the next fence or COLLECT to bank the value; a refusal ends the round and the finish line is the top prize.

Earlier drafts of this change were a crash game. The user rejected that version as not real or engaging enough, and chose the step mechanic and the "Prime Time Chase" look (canvas https://claude.ai/artifact/Txzxqhhh49B2yC9JvbLbAa, page "Fence Run · 5 options", design 1). The theme and market audit (`docs/compliance/night-meet-2026-09-16.md`) still applies. The step mechanic has its own addendum (`docs/compliance/night-gallop-steps-2026-09-16.md`).

## What Changes

- **A second round engine, for step games** (**new certification**). It lives in a new pure package `packages/steps`:
  - paytables per difficulty, built so every stopping point returns exactly 97%;
  - fence results derived from the round's HMAC seeds on a `fences` stream;
  - a public verifier;
  - a pure round model: start, jump, collect, finish, abandonment;
  - a step host over the existing session and balance store;
  - an RTP simulator with a committed report.

  It does not change the crash engine.
- **Step round service in `rgs-client`:** a `StepRoundService` interface, an in-browser demo mock and a remote client, plus a shared test suite both run.
- **Step API module in `apps/api`:** session reuse, `POST /v1/steps/rounds`, `POST /v1/steps/rounds/:id/jump`, `POST /v1/steps/rounds/:id/collect`, round fetch and history, an atomic Redis record per action, and abandonment settlement on the server.
- **Game client `apps/gallop`:** a Pixi Prime Time Chase steeplechase.
  - Broadcast chyron, fence values above each fence, a ladder strip of the next values, JUMP and COLLECT.
  - The jump animation is identical every time; a refusal stops the horse at the fence (no fall, no whip).
  - The finish line auto-collects the top prize, and win effects play only when the return beats the stake.
  - It replaces the crash prototype built earlier in this change.
- **Profile flags and draft Nigeria/Ghana profiles** as in the earlier draft (`blockedRegions`, `hostingRegions`, `dataTransferBasis`, `withholdingNotice`, `liveBetsFeed`, `ng-draft`, `gh-draft`, NGN/GHS). These touch `core` and wait for agreement with the shared-package owners.
- **Compliance addendum and evidence** for the step mechanic: rules, choice disclosure, abandonment, cycle gap, no auto-jump.

## Capabilities

### New Capabilities
- `step-engine`: how a step round runs on the server. It covers difficulty paytables, the start and debit, jump and collect judged at the server, the finish, abandonment, idempotency, results and recall, and what the client may learn.
- `step-fairness`: fence outcomes from HMAC seeds, verification, and RTP that is the same for every stopping strategy.
- `gallop-game-client`: the Fence Run client. Broadcast scene, jump and refusal presentation, ladder and buttons, win presentation, rules, vocabulary and art rules, device budgets.
- `market-profile-flags`: the general profile flags, draft Nigeria and Ghana profiles, and NGN/GHS currency rules.

### Modified Capabilities
None. The crash round engine and its fairness requirements are unchanged.

## Impact

- **New code:**
  - `packages/steps` (pure; added to the purity lint rule);
  - step files in `packages/rgs-client`;
  - `apps/api/src/steps/`;
  - `apps/gallop`.
- **Small shared edits:**
  - `eslint.config.js` purity list;
  - `rgs-client/package.json` exports;
  - one mount line in `apps/api/src/app.ts`;
  - `core/profiles.ts`, `core/money.ts` and `core/rules.ts` for flags, currencies and rules, after agreement.
- **Certification:** a new engine means new config ids, a committed RTP report at 97% ± 0.1% for every strategy, and its own lab certification (AGENTS hard rule 2). Lagos certification through the LSLGA-accredited lab applies as before.
- **Superseded:** the crash-specific plan in this change's earlier drafts, and the crash prototype in `apps/gallop`.
- **Business items (open, not code):**
  - Lagos certification;
  - the LSLGA B2B licence;
  - NDPA data-transfer basis;
  - ARCON and GCG ad pre-approval;
  - written licence-category confirmation;
  - a trademark check.
