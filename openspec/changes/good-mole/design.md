## Context

The round maths lives in `packages/fairness`: `logGrowth` gives `K(t)`, `logExpectedMultiplier` gives `H(t) = K(t) − λ(1−f)·t`, and `crashTimeFromUniform` inverts `H` in closed form (quadratic on the ramp, linear after it). `deriveRound` draws the crash time from the `crash` stream and setback times from the `setbacks` stream. `core` replays those times to value a round, and the client animates the same maths locally between events.

Two constraints shape everything below: the payout must stay a martingale whatever the player does (AGENTS.md hard rule 2), and a running round must never leak future events (hard rule 3). Config ids are the unit of certification, so any maths change means a new id with its own committed report, and profiles may only reference ids that have one.

## Goals / Non-Goals

**Goals:**
- Add an upward modifier that is provably free: same 97% RTP for every strategy, verified by simulation before code ships.
- Keep one closed-form crash-time inversion — no numeric root finding on the hot path.
- Let a market run boosts, setbacks, both or neither, chosen by profile flags rather than forks.
- Keep the existing `v1` ids and their reports untouched, so nothing already certified changes under an operator's feet.

**Non-Goals:**
- Tuning the bad mole. Its rate and factor stay as they are.
- Any interaction: the good mole is decoration, like every other mole.
- Progressive or streak-based boosts (a boost that depends on history would break the martingale and invite skill framing).
- Paper Route's partial cash-out interaction. That game is gone; the shared `papers` plumbing stays untouched.

## Decisions

### D1. Boosts are a second Poisson modifier with its own stream
`RoundOutcome` gains `boosts: number[]`, drawn from a new `boosts` stream with `streamUniform(seeds, 'boosts', i)`, using the same exponential-gap generator as setbacks and the same horizon `min(crashTime, tMax)`. A separate stream keeps the three dimensions independent: changing boost settings cannot move an existing crash time for the same seeds, which keeps old rounds verifiable against their recorded config id.

*Alternative:* reuse the setback stream with a sign bit. Rejected because it couples the two rates and changes every historical setback time.

### D2. Defaults: `boostFactor` 1.05, `boostRate` 0.4/s
One boost roughly every 2.5 s, worth +5%, so a typical 3.7 s round sees one or two. Expected lift is `λ_g(g−1) = 0.02` per second against the bad mole's drag of `λ_b(1−f) = 0.06`.

Small and frequent rather than large and rare, because of D12: a boost that jumps over the max-win cap loses the excess, and that loss grows with the factor (measured ≈ 0.98 pp of RTP per unit of `g−1`). At ×1.05 the loss is 0.05 pp, so every strategy stays inside the 97% ± 0.1% gate; ×1.25 would have cost 0.23 pp and failed it.

### D3. The crash hazard absorbs the lift
`H(t) = K(t) − drift·t` where `drift = λ_b(1−f) − λ_g(g−1)`. Everything downstream — `survival`, `crashTimeFromUniform`, the ramp/linear split — already works in terms of one drift constant, so the change is to `setbackDrag` becoming `modifierDrift` and the config validation that guards it. Inversion stays closed form.

With the defaults: drift falls from 0.06 to 0.04, so `H` grows 0.02/s faster and survival past 10 s drops by about 18% (`e^−0.2`). Rounds are shorter; return is unchanged.

### D4. Validity constraints
`assertValidConfig` additionally requires `boostRate >= 0`, `boostFactor > 1` when `boostRate > 0`, and `r0 > drift` (already required, now against the net drift). A negative drift is legal — that is simply a boost-heavy config whose expected value climbs faster than growth alone.

### D5. Ordering at equal times
Setbacks are applied before boosts when two modifiers share a timestamp, matching the existing "ties resolve setback first" rule for crashes. Probability zero in practice, but the verifier, the server and the client must agree.

### D6. Config ids: `v2` for boosted variants
`whack-crash/v2` is setbacks + boosts; `whack-crash/v2-rising` is boosts only. `v1` and `v1-rising` keep their current maths and reports and are what `boostsMode: 'off'` resolves to. `+capN` derivation and the report index gate work unchanged. Effective config selection becomes a two-axis lookup:

| setbacksMode \ boostsMode | `off` | `boost` |
|---|---|---|
| `halve` | `whack-crash/v1` | `whack-crash/v2` |
| `off` | `whack-crash/v1-rising` | `whack-crash/v2-rising` |

### D7. Profile flag and defaults
`JurisdictionProfile` gains `boostsMode: 'off' | 'boost'`. Templates ship with `boost` for `light` and `off` for every regulated template, so nothing regulated changes behaviour on this change alone; an operator opts in once the new id has a lab-accepted report. A boost never takes value away, so no jurisdiction rule known from the audit blocks it — the gate is certification, not legality.

### D8. Events and records
A `GoodMoleEvent` (`type: 'GOOD_MOLE'`, `time`, `factor`, `multiplier`) mirrors `BadMoleEvent` and joins the `RoundEvent` union — an exhaustive-switch change every consumer must handle. `RoundSnapshot`/`RoundSummary` gain `boosts: number[]`, alongside the existing `setbacks`, and the operator CSV gains a `boosts` column. Boosts are filtered by the same visibility rule as setbacks: only those at or before the visible time.

### D9. Client presentation, deliberately quieter
Green burst with a `+5%` badge on the good mole, a short rising blip (one new sfx in the sprite), and a small hop of the gold mole. No screen shake, no stage tilt, no hazard flash, no confetti — those stay reserved for the crash and the win, so a boost never reads as a win (RTS 14F applies to the round total, not to a modifier). The good mole uses the existing decoy hole slots and the opposite side from the last bad mole where possible, so the two are easy to tell apart at a glance.

### D10. Rules text
`describeRules` gains `boosts { ratePerSecond, factor, warning: false }` right after the `setbacks` item, and the existing `outcomeFixed` item is enough to cover "tapping the mole does nothing". The item only appears when the effective config has `boostRate > 0`, so the rules screen always matches the config in play.

### D11. Proving it before shipping
`simulate-rtp.ts` gains boost-aware strategies (`cashOutAfterBoost`, plus the existing set) and reports mean round length. Required before any profile may use the new ids: 10M rounds per strategy for `whack-crash/v2` and `whack-crash/v2-rising`, each within 97% ± 0.1%, instant-bust share 3% ± 0.05%, and the half-up rounding band at stakes 0.20/0.50/1.00 as in `compliance-baseline` D23. Reports land in `packages/fairness/reports/` and the report index.

### D12. The max-win cap truncates an overshooting boost
A setback never crosses the cap upward, so `v1` measures exactly 97.000% even for strategies that ride to the max win. A boost can cross it: the round settles at `maxWinMultiplier` and the excess above the cap is not paid, which costs RTP for cap-reaching strategies only ("never cash out", and "cash out after a setback" on rounds that have no setback).

Measured truncation at 10M rounds, same total lift each time: ×1.25 → 0.232 pp, ×1.12 → 0.117 pp, ×1.10 → 0.098 pp, ×1.05 → 0.049 pp. The loss is essentially linear in `g−1` and independent of the cap level, because those strategies always end at the cap.

Rejected alternatives: paying the overshoot (breaks the published max win); skipping a boost that would cross (moves the same error elsewhere); scaling the config's RTP (lifts every strategy equally, so the spread between cap riders and everyone else survives); a continuous growth-rate boost (exact at any strength, but `H(t)` stops being invertible in closed form and the verifier would need numeric root finding).

## Risks / Trade-offs

- **[Cap truncation]** D12: 0.05 pp of RTP is lost to boosts crossing the max win. It is inside the gate but it is a real, permanent cost that grows if the boost factor is ever raised.
- **[Shorter rounds]** The lift is paid for in round length: with the defaults, ~18% fewer rounds reach 10 s. Mitigation: the simulation reports mean and median round length for the old and new ids side by side, so the trade is a decision with numbers on it, not a surprise.
- **[Two modifiers are harder to read]** A value that can jump both ways is more confusing at a glance. Mitigation: D9's asymmetric presentation, and the rules item that states both factors.
- **[Recertification cost]** New ids mean a new lab submission before regulated use. Mitigation: `v1` ids stay valid and remain the default for regulated templates, so this can ship to light markets first.
- **[Boost near the max win cap]** A boost can cross `maxWinMultiplier` mid-round; settlement already caps at the max win, and the round ends there.
- **[Event-union churn]** Adding `GOOD_MOLE` touches every consumer's exhaustive switch (core, rgs-client, api, whack). Mitigation: the compiler finds them; the shared round-service suite covers the event end to end.
