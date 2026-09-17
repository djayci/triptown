# Gate Rush: built-game check, 17 Sep 2026

**Status:** research findings, not legal advice. Follows the concept-stage addendum `gate-rush-2026-09-17.md` and marks each of its findings against the built game (task `gate-odds-mvp` 8.2). Lagos's designated test lab and the Ghana Gaming Commission must still answer the written question (task 2.1) before submission.

**Scope:** `apps/gate` under `ng-draft` and `gh-draft`, where this game's rounds reveal at collect, with the shared packages it runs on. No new web research: the jurisdiction texts are those cited in the addendum.

**Evidence is the code and the automated checks, not screenshots alone.** File references are to the working tree on 17 Sep 2026.

---

## 1. Verdict

The built game does what the concept promised on every finding a build can answer:
- payouts equal the live round's;
- nothing observable changes at the hidden crash;
- the chance is on screen for the whole ride and in the rules before any bet;
- the reveal is not a near miss;
- recall never shows the hidden crash.

What remains is procedural (the lab and GCG question, software certification) or a decision for Triptown: the Candy Paddock look under the Nigeria and Ghana markets, and the withholding notice wording.

## 2. Findings from the addendum, re-marked

| # | Finding | Concept status | Built status | Evidence |
|---|---|---|---|---|
| 1 | Maths unchanged; P(reach m) = RTP ÷ m; deferred pays what live pays | PASS (design) | **PASS** for payout equivalence; odds exactness test still open | `packages/core/src/deferred-reveal.test.ts:103` compares 300 seeded rounds × 5 cash-out times, live vs deferred: identical status and credit. Task 5.1 (simulated P(reach m) against RTP ÷ m on the resolved config) waits on the v3/v4 pace change |
| 2 | Software approval and certification (Lagos s.59, s.71(2); GCG certificate) | RISK | **RISK, unchanged** | Procedural. The question to the lab and GCG is drafted, not sent (`gate-rush-lab-question-2026-09-17.md`) |
| 3 | Classification: single horse, no race | PASS | **PASS** | `apps/gate/copy-banned.json` bans race, racing, odds, starting gate, finish line, bet slip, whip. `check:copy` passes, and a probe with "So close! You just missed it." fails it. "Odds" was removed from the rules too: every key and label says "chance" |
| 4 | Rules and anticipated pay-outs available | PASS (design) | **PASS** | `packages/crash-client/src/dom/rules-panel.ts:112` (`showsChances`) and `chanceSection`. The table runs x1.01 to x100, capped at max win, with chance and return at the selected stake, before any bet. It is shown only when `effectiveReveal` says this game reveals at collect. Tested in `rules-panel.test.ts`, and rendered in the ng-draft demo |
| 5 | Not misleading: a value shown after the round is already decided | RISK → mitigated | **PASS (mitigated)** | Live line "GATE OPEN IF YOU GO IN NOW · x%" (RTP ÷ value, rounded down, `formatRevealChance`). After IN! it is restated, not hidden: "OPEN ON x% OF RIDES IN AT xN" (`screen.ts` `showHeadingHome`). The amount is labelled "IF THE GATE IS OPEN" (`en.ts:42`). Heading home says "The result was fixed when the round started" (`en.ts:47`). The rules explain the value keeps rising after a round is decided and why the chance stays on screen (AGCO 2.15 reasoning, though Ontario itself stays off) |
| 6 | Gamble-feature rules | N/A | **N/A** | One reveal per round, and no double-or-nothing |
| 7 | Near miss and recall | PASS (design) | **PASS** | The shut reveal shows the horse stopped out in the field, facing away (`stage.ts` `revealShut`). The gate slides in with the same motion for both outcomes. History shows "Lost at x5.00", never the crash value (`history-panel.ts:42`, tested in `history-panel.test.ts`). The crash time stays in the record for verification |
| 8 | Nothing leaks early | PASS (design) | **PASS** | `deferred-reveal.test.ts:185`: stream, state, settlement, balance and history are identical 50 ms before and 100 ms after the hidden crash. `heading-home.test.ts`: the same view calls for a win and a loss until max(press + 1,200 ms, settlement), with balance and net held. presentation-check "deferred heading home" PASS under ng-draft |
| 9 | Markets where deferred reveal must stay off | GAP outside Africa | **PASS (contained)** | `ng-draft` and `gh-draft` only (`profiles.ts:228`, `:252`). `market-flags.test.ts` asserts no other template enables it. Validation rejects it with setbacks or boosts on |
| 10 | Horse welfare and minors appeal | OPEN | **OPEN, now sharper** | Welfare: no fall, whip or injury; the shut gate never closes on the horse. Minors appeal: on 17 Sep 2026 the user chose the Candy Paddock look (yellow sunburst, pink gate, Lilita One). The draft profiles still select `skin: 'adult'`, so a regulated build loads Adult Sticker; only the demo shows candy (`apps/gate/src/services.ts:30`). Shipping candy to Nigeria or Ghana, or using it in ads (the GCG bans cartoon characters in adverts), needs a decision and counsel's view |
| 11 | Withholding tax notice | OPEN (counsel) | **OPEN (counsel)** | Shown on a celebrated result and in the rules under ng-draft. It states no rate and says the game deducts nothing |

## 3. New since the concept

| Item | Status | Note |
|---|---|---|
| No auto IN! in Gate Rush | PASS | `GateView.hasAutoCashout()` returns false: the controller never sends a target and the rules omit auto IN!. This removes the question of what an auto target means under a deferred reveal for this game |
| Minimum gap between rounds (5 s) | PASS on the gap; the check currently reports FAIL for an unrelated reason | Worst gap 5,140 ms against a 5,000 ms minimum under ng-draft, and hold-to-repeat started no round. `timing-check.mjs` then fails its practice-pacing step, because the fix gating that step on `profile.practiceRounds` was reverted (bfadc03). Practice rounds are off in ng-draft, so the step should report unreachable |
| Presentation (no win cues at or below stake) | PASS | presentation-check PASS under ng-draft (candy) and gh-draft (adult). Below-stake, even and practice cases are correctly unreachable there |
| Demo currency | Note | The demo prices in USD at the user's request, so the published RTP band shown is the 0.20 stake band. A Nigeria or Ghana build must use NGN or GHS and publish the band at that market's minimum (AGENTS compliance rule 10) |
| Legibility on the yellow stage | PASS | `useSkin` contrast floor of 3:1 checked for the multiplier (purple) and the money (deep pink). Unstroked stage captions pick ink or cream from the declared ground (`theme.ts` `onStage`) |

## 4. Still open

- Send the lab and GCG question, and record the reply (task 2.1).
- Odds exactness test on the resolved rising config (task 5.1).
- Decide the look for Nigeria and Ghana builds and marketing (finding 10).
- Re-apply or replace the timing-check practice gating, so the check reports practice as unreachable where the market forbids it.
- Trademark clearance for "Gate Rush".
