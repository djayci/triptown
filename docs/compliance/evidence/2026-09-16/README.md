# Whack Crash compliance evidence, 2026-09-16

Outputs behind `docs/compliance/whack-crash-2026-09-16.md` section 10. Everything here was produced by
driving the real client in headless Chrome, never by eye — the UKGC criticised stopwatch testing in the
Stakelogic settlement (25 Jun 2026, £122,835).

| File | What it proves | Command |
|---|---|---|
| `workspace.log` | Lint, typecheck, tests and production builds across the monorepo | `pnpm turbo run lint typecheck test build` |
| `presentation-<profile>.json/.log` | A return at or below the stake is never celebrated: no win sound, no confetti, and the round is presented as a loss (UK RTS 14F, AGCO 2.20) | `node packages/crash-client/scripts/presentation-check.mjs --profile <name>` |
| `timing-<market>.json/.log` | Minimum gap between round starts, measured from the client's own start log, plus proof that a held control starts no second round (UK RTS 14G 5 s, Ontario 2.5 s) | `node packages/crash-client/scripts/timing-check.mjs --profile <name> --min-ms <gap>` |

## Results of the 2026-09-16 run

| Check | Result |
|---|---|
| `pnpm turbo run lint typecheck test build` | 31 successful, 31 total |
| Presentation, `light` | 3 pass, 0 fail |
| Presentation, `regulated-uk` | 3 pass, 0 fail |
| Presentation, `regulated-on` | 3 pass, 0 fail |
| Presentation, `regulated-br` | 3 pass, 0 fail |
| Timing, `light` (min 2500 ms) | worst gap 2512 ms, hold-to-repeat started a round: false |
| Timing, `regulated-uk` (min 5000 ms) | worst gap 5192 ms, hold-to-repeat started a round: false |
| Timing, `regulated-on` (min 2500 ms) | worst gap 2655 ms, hold-to-repeat started a round: false |
| Timing, `regulated-br` (min 5000 ms) | worst gap 5170 ms, hold-to-repeat started a round: false |

The worst gap is the *smallest* observed interval between two round starts, so each market's figure sits
above its own minimum. Presentation counts are the three scenarios per profile: a win above the stake, a
return at or below the stake, and a loss.

RTP evidence is not duplicated here: the committed simulation reports are the record, under
`packages/fairness/reports/` (30 reports; 10M rounds per theoretical config id, 4M per rounding band),
with the published band per config id in `reports/bands.json`.

A copy review runs separately with `node packages/crash-client/scripts/copy-check.mjs`: every player-facing string
must come from `src/i18n/en.ts`, and near-miss or skill wording fails the check (Spain RD 176/2023
art. 17.2, AGCO 2.15, GLI-19 §4.6.1(a)).
