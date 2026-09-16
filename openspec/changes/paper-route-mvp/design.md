## Context

See proposal.md for motivation, and `docs/compliance/paper-route-2026-09-15.md` for the audit that shaped these decisions. This change builds on two others.

**`whack-crash-mvp` (nearly done):**
- `packages/fairness` derives the crash time and setbacks from the seeds. It has a validated `GameConfig` (now with `papers`), strategies including `paperStops`, and the Monte Carlo simulator.
- `packages/core`:
  - `RoundRecord` holds one `settlement`.
  - `cashout()` judges a single manual cash-out.
  - `scheduledSettlement()` picks the earliest of auto, max win, max duration and crash.
  - `RoundHost` runs the rules on a `RoundStore`, and `settleOnce()` makes settlement idempotent.
  - Events are `START`, `BAD_MOLE`, `CASHED_OUT` and `CRASH`.
- `packages/rgs-client`: `RoundService`, `MockRoundService`, and the shared suite.
- `apps/api`: Hono with SSE and a Redis store.
- `packages/engine`: Pixi-based, with audio helpers in the same index.

**`compliance-baseline` (being implemented in parallel by another session):**
- server-authoritative jurisdiction profiles (`setbacksMode`, `maxMultiplier`, `minCashout`, `minCycleMs`, `intensityEffects`, `disconnectPolicy`, `skin`, …), plus a `partialCashout: off | papers` flag agreed for Paper Route;
- `effectiveConfig(game, profile)`, with registered `paper-route/v1` and `paper-route/v1-rising`, and `+capN` ids;
- round-level `resultKind(stake, return)`, a cycle gate, fresh-press input, `describeRules`, recall records holding a list of cash-outs, the operator bridge, a time source, tap-time/RTT evidence, void/refund, and the report index.

**Constraints:**
- The AGENTS.md rules still hold, including Compliance rules 9–11 added by the Paper Route audit.
- While the other session holds `packages/core`, `packages/fairness`, `packages/rgs-client` and `apps/api`, Paper Route edits to those files wait for its go-ahead (tasks are ordered accordingly).

## Goals / Non-Goals

**Goals:**
- One round model in which Whack Crash is the N = 1 case of the paper model. No second, forked round engine.
- A Paper Route client that feels like 3D, holds 30+ fps on mid-range phones, and passes the audit's presentation rules in every profile.
- A published RTP that is true at every allowed bet, not only in theory.

**Non-Goals:**
- Renaming `BAD_MOLE` or changing Whack Crash's wire format.
- The Portugal two-independent-bets variant. Portugal runs with partial cash-out off.
- Loaded 3D assets (glTF characters or textures). Everything is procedural geometry in this change.
- A shared 3D engine package.
- Shared player-protection UI beyond what `compliance-baseline` provides. Paper Route reuses its logic and ports its DOM panels.

## Decisions

### D1. Papers belong to the config; availability belongs to the profile

- `GameConfig.papers` (done) sets N. The profile's `partialCashout` decides whether a session uses it. With `off`, the host starts rounds with `papers = 1` and the effective config id gets no `papers` suffix. A single-paper round is exactly a Whack-style single cash-out.
- The paper value is `betMinor / papers`. Validation requires `betMinor % papers === 0` and a paper value ≥ `minPaperMinor`. The currency default is 20 minor units (0.20), chosen from the rounding analysis in D3.
- `RoundRecord` gains `papers`, `throws: ThrowRecord[]` and `creditedMinor`. A `ThrowRecord` is `{ throwId, count, time, multiplier, exactMicro, reason, clientTapAt?, rttMs? }`. `settlement` stays the terminal record, with totals: `payoutMinor` (the rounded round total), `papersThrown`, `papersLost` and `roundingAdjustMinor`.
- `throwPapers(round, nowMs, { throwId, count: 1 | 'all' })` returns `thrown`, `cashed_out`, `crashed`, `below_min_cashout`, `duplicate` or `no_papers`. The profile's `minCashout` applies to every throw.
- `scheduledSettlement()` stays deterministic. Auto cash-out, the effective cap, max duration and the disconnect policy all settle *every remaining* paper.

*Alternative:* one sub-round per paper. Rejected: it multiplies records and streams, hides that all papers share one path, and invites a "simultaneous games" reading under RTS 14C.

### D2. Whack Crash is `papers: 1` with an unchanged wire format

- With `papers === 1`, the host never emits `THROWN`.
- `RoundService.cashout(roundId)` becomes a thin wrapper around a throw-all.
- `CASHED_OUT` and `CRASH` gain optional totals, which Whack Crash ignores.
- The existing shared round-service suite must pass unchanged.

### D3. Exact accrual, one half-up rounding per round

**Measured problem:** flooring each cash-out to the cent pulls RTP well below 97% for timed strategies at small stakes. Expected RTP per crash window, 400k paths:

| Paper value | Strategy | Floor per paper | Accrual + one half-up rounding |
|---|---|---|---|
| 0.10 | 1 per second | 93.9% | 97.08% |
| 0.20 | 1 per 0.7 s | 95.3% | 97.03% |
| 0.50 | 1 per 0.7 s | 96.3% | 97.08% |

Target cash-outs (x2, x5) are unaffected either way. GLI-19 §4.7.1(a) requires the minimum RTP at any bet level, and one-way rounding makes "97% for any strategy" untrue.

**Decision:**
- Each throw stores `exactMicro = floor(paperMinor × count × multiplier × 10⁴)`. This is integer micro-minor units, so the maths stays in integers after the one multiplier evaluation.
- After each throw, credit `floor(Σ exactMicro / 10⁴) − creditedMinor`.
- At settlement, `payoutMinor = floor((Σ exactMicro + 5000) / 10⁴)`, which is half-up once, and credit the remaining 0 or 1 minor unit as `roundingAdjustMinor`.

With a 0.20 minimum paper, the strategies tested here average close to 97%. But no deterministic cent rounding keeps every individual cash-out within ±0.1%: at a 0.20 paper, x1.02 pays 0.20 (95.1%) and x1.025 pays 0.21 (99.4%). The band is about ±0.5% at 1.00 and ±0.05% at 10.00, and fixed early-time strategies measure about −0.18% at 0.20. The user chose "half-up + disclose band": theoretical (unrounded) reports keep the ±0.1% gate, rounded reports publish the worst-case band per stake, certification gates on the jurisdiction minimum RTP (85%) at every stake, and the rules disclose the rounding effect. The user adopted this settlement for every game in `compliance-baseline` (task 3.8, design D23): one shared `core` function for N = 1 and N = 5, with a 0.20 minimum stake for Whack Crash and a 0.20 minimum paper value for Paper Route. Paper Route uses that function rather than its own.

*Alternatives:*
- **Minimum paper value only, keep flooring.** Rejected: it needs about 10.00 per paper to stay close to 97%, and it is still one-way.
- **Half-up per paper.** Rejected: players can pick throw moments that round up.
- **Sub-cent wallet balances.** Rejected: operator wallets and NL Rko 3.5 expect whole currency units.

### D4. Atomic, idempotent throws in the store

`RoundStore.recordThrow(roundId, throw, papers)` appends the throw only if:
- the round is unsettled,
- the throwId is new, and
- the papers already thrown plus `count` stay within `papers`.

It also returns the new `creditedMinor` delta. In memory this is a synchronous check. In Redis it is a Lua script over the round hash, sharing the per-player lock and the audit sink from `compliance-baseline`.

The host judges `nowMs` from the shared time source against `settlementDue()` before recording, with ties resolving setback first. A throw that races the lazy crash settlement loses: `settleOnce` wins first, and `recordThrow` then sees a settled round and returns `crashed`. Each successful throw writes an audit entry that includes the evidence fields.

### D5. API

- `POST /v1/rounds/:id/throws` takes `{ throwId, count: 1 | 'all', clientTapAt?, rttMs? }` and returns the throw result. `POST /v1/rounds/:id/cashout` maps to `count: 'all'`.
- The SSE stream adds `THROWN { roundId, throwId, count, time, multiplier, returnMinor, creditedMinor, remaining, balanceMinor }`. It has no crash time.
- Snapshots, `GET /v1/rounds` summaries and operator recall records include the throws array. Running rounds never include crash data.
- The game and profile come from the session, per `compliance-baseline`.

### D6. RTP simulation with several stops and rounding

- Strategies are lists of `(papers, stop rule)` pairs (done in 1.2).
- The simulator's theoretical estimate uses the existing conditional estimator.
- A second, exact estimator evaluates rounding. It sorts each path's stops by time, weights each crash window by `S(t_k) − S(t_{k+1})`, and applies the settlement function from D3 to the accrued total. That gives an exact expectation per path, free of crash-time noise.
- Reports for `paper-route/v1` and `paper-route/v1-rising` list theoretical RTP and RTP at the minimum paper value (and at 1.00) for every strategy, and are registered in the `compliance-baseline` report index.

Strategies:
- all at x2
- 1 at x1.5 and the rest at x5
- 1 per second
- 1 per 0.7 s
- all at 1.3 s
- 1 right after each setback (setback config only)
- 1 at x3 and the rest never
- all at x10
- never

### D7. Client architecture: three.js scene + DOM HUD

```
apps/paper-route/src/
  main.ts            boot: WebGL check, session + profile, quality tier, services, controller
  services.ts        demo/live switch (mock only behind VITE_DEMO)
  game/controller.ts round state machine, throw queue, cycle countdown, reconnect, bridge events
  game/display.ts    pure: multiplier, riding/banked/total return, RETURN NOW vs WIN NOW, result kind, speed and sun (profile-aware)
  scene/world.ts     renderer, camera rig, sunrise sky, fog, lights, quality tiers
  scene/street.ts    procedural chunks with irregular house spacing, no mailboxes or targets
  scene/courier.ts   adult courier on a delivery moped (procedural low-poly, realistic proportions), idle ride, wobble, fall
  scene/fx.ts        uniform porch throw, splash (setbacks on only), wipeout, streaks (reduced-motion aware)
  hud/               bet panel, multiplier, bag with per-paper stake/return, THROW/ALL, result, rules, history, clock/net, countdown
  audio.ts           manifest + wiring via @triptown/engine/audio
```

- **Presentation rules live in `display.ts` and have unit tests.**
  - `liveLabel(stake, banked, riding)` gives RETURN NOW or WIN NOW.
  - `resultKind` comes from core.
  - The throw effect has one variant.
  - Win presentation fires only on a terminal event whose round total exceeds the stake.
- **The courier is an adult on a delivery moped.** Proportions are about 7.5 heads, with hi-vis, a helmet, a courier bag and a licensed scooter. The palette is muted and life-like, taking the D1 sunrise lighting but not the toy saturation. There are no animals anywhere. The concept art in `design/paper-route/` is redone before the scene is built, and reviewed against audit items F1/D6.
- **Hazards are spawned by events, never scheduled.** The splash exists only when `setbacksMode` is on and a `BAD_MOLE` event arrives. The wipeout starts only on `CRASH`. Street props use cosmetic randomness with no link to the round.
- **Throws are uniform.** A throw always lands at the porch alongside the courier. House spacing is randomized, so there is no rhythm to time throws against.
- **Motion comes from the round clock and the profile.** With `intensityEffects` on, speed and loop pitch follow the growth rate. With it off, both stay constant. The sun rises with `ln(m)` but never reaches a "full day" state that would read as a goal.
- **Shared compliance UI.** Rules come from `describeRules` plus the Paper Route items in the client spec, and history, clock/net, countdown and the idle prompt use the `compliance-baseline` logic. Its DOM panels in `apps/whack` are ported, and moved into a shared package later if a third game needs them. The operator bridge comes from `packages/engine/src/bridge.ts`.

*Alternative:* pre-rendered sprites in Pixi. Rejected in exploration because it loses the real 3D camera motion.

### D8. Performance tiers

| Tier | Pixel ratio | Shadows | Draw distance | Bloom |
|---|---|---|---|---|
| high | min(DPR, 2) | 2048 map | 260 m | on |
| medium | min(DPR, 1.5) | 1024 map | 180 m | off |
| low | 1 | off (blob shadow) | 120 m | off |

- The game starts at medium on touch devices and steps down after 2 s above 33 ms per frame.
- Geometry is merged per street chunk, keeping draw calls under 150.
- CI enforces a budget of 1.5 MB before the first playable frame, excluding audio.

### D9. Engine audio without Pixi

`packages/engine` adds subpath exports (`/audio`, `/audio-settings`, `/motion`, `/bridge`) for modules that don't import Pixi. A build check confirms Pixi is absent from the Paper Route bundle.

## Risks / Trade-offs

- **Working in `core`/`fairness` at the same time as `compliance-baseline`** → Paper Route waits for the other session's go-ahead on shared files. Its tasks start with client, art, engine subpaths and simulator reports that don't collide.
- **Operator wallets may reject a final +0.01 rounding credit after the last throw** → The adjustment is sent with the terminal settlement as a normal credit. Ask operators during integration, and fall back to crediting the rounded total only at settlement (no mid-round credits) per operator flag.
- **Brazil's lab may not read a throw as an allowed ending** under Portaria 1.207 item 14 d) → Present each paper as an independent bet (item 12), get the reading in writing before submission, and turn partial cash-out off for Brazil if it is refused.
- **An adult courier and a muted palette are less "fun"** → That is the regulatory price. The light-profile skin can be brighter, but it still has no children, animals or toy looks.
- **Concurrent throws near the crash** → Atomic store (D4); the client reverts unconfirmed papers.
- **WebGL cost on low-end phones** → Quality tiers and a not-supported message.
- **The Vercel stream limit** → Unchanged: `tMax` bounds the round.

## Migration Plan

1. Revised concept art and client foundation (no shared-code collision).
2. After the go-ahead from `compliance-baseline`, the core/store/API generalization with `papers: 1` defaults. Whack tests stay green.
3. Paper Route simulation reports registered in the report index.
4. `apps/paper-route` gameplay on the mock, then live API; its own Vercel project; sandbox picker.

Rollback: Paper Route is a separate app and config. The core generalization is backward compatible for `papers: 1`.

## Open Questions

- Default paper count (5) versus operator-configurable 3–10. The config already allows it.
