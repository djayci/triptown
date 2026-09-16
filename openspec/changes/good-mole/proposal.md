## Why

Whack Crash's only in-round modifier takes value away: the bad mole halves the multiplier. Rounds therefore read as "wait, then lose something", with no upswing to react to. A good mole that multiplies the value up by a small factor adds positive variance and a second reason to watch the round, without touching the strategy-independent 97% RTP: the crash hazard absorbs the extra expected value exactly as it already absorbs the setback drag.

## What Changes

- Add a **good mole** modifier: at Poisson rate `boostRate` (default 0.4/s) the multiplier is multiplied by `boostFactor` (default 1.05). Boosts come from their own outcome stream, are independent of the crash time and of setbacks, and are never announced in advance.
- Recalibrate the crash hazard so the payout stays a martingale: the expected-multiplier exponent becomes `H(t) = K(t) − λ_b(1−f)·t + λ_g(g−1)·t`. Rounds get shorter on average; RTP stays 97% for every strategy.
- Add a per-market `boostsMode: 'off' | 'boost'` profile flag, with **BREAKING** new effective config ids for boosted play (`whack-crash/v2`, `whack-crash/v2-rising`). Existing `v1` ids keep their current maths and reports, so certified profiles are unaffected until an operator opts in.
- Stream a `GOOD_MOLE` event at each boost time, record boost times in the round record and recall exports, and show them in history and verification.
- Add rules items for the good mole (factor, rate, "no warning", "decorations do nothing") so the rules screen still matches the maths of the config actually in play.
- Client presentation: green burst with a `+5%` badge, a short rising blip, a small upward hop of the gold mole. Deliberately quieter than the setback — no screen shake, no tilt, no hazard flash — and no interactive affordance.
- Prove every new config id with committed 10M-round simulation reports (all strategies, plus the rounding band at the minimum stake) before any profile may use it.

## Capabilities

### New Capabilities

- None. The good mole extends the existing round maths, fairness guarantees, profiles and client behaviour.

### Modified Capabilities

- `round-engine`: the multiplier path includes upward boosts; boost events are streamed without warning, like setbacks.
- `provably-fair`: boosts come from a dedicated derived stream and are part of the strategy-independent RTP guarantee and its validity constraints.
- `whack-game-client`: the good mole gets its own feedback, quieter than the bad mole, and stays non-interactive.
- `jurisdiction-profiles`: `boostsMode` joins `setbacksMode` in choosing the effective config id, with the same report gating. (Delta lands on the `compliance-baseline` capability once that change is archived; until then it is written against the same capability path.)

## Impact

- `packages/fairness`: `GameConfig` gains `boostRate` and `boostFactor`; `model.ts` gains the net drift used by `logExpectedMultiplier` and `crashTimeFromUniform`; `round.ts` derives a `boosts` stream; new config entries and ids; validation rules; new simulation reports and report index entries.
- `packages/core`: `multiplierAt` and the snapshot/settlement path account for boosts; `GOOD_MOLE` event; `RoundRecord`/`RoundSummary` carry boost times; `describeRules` gains the good-mole items; profiles gain `boostsMode`.
- `apps/api`: boosts stream over SSE, appear in recall JSON and CSV, and in the operator export columns.
- `packages/rgs-client`: event type, mock scenario (`boost`), shared suite coverage.
- `apps/whack`: display maths, boost feedback, sound (one new sfx in the sprite), history and verification panels.
- `docs/compliance`: rules text and the audit fact sheet mention the new modifier; new config ids need lab recertification before a regulated launch.
