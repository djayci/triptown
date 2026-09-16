# Night Gallop: Fence Run step-mechanic addendum, 16 Sep 2026

**Status:** research findings, not legal advice. A Nigerian and a Ghanaian gaming lawyer, plus the chosen test lab, must confirm everything before submission.

**Scope:** this addendum covers the change of Night Gallop from a crash game to a step game ("Fence Run"). It sits on top of `night-meet-2026-09-16.md`, which covers the theme, Nigeria, Ghana, licensing, data and advertising; all of that still applies except its fix 4 (multi-wager displays), which no longer applies because the game has one bet per round.

**What was checked:**
- the implemented engine (`packages/steps`), the step API (`apps/api/src/steps/`) and the client (`apps/gallop`), as of this date (not yet committed to git);
- GLI-19 v3.0, UKGC RTS 3/4/7/8/10/14, AGCO Registrar's Standards, Brazil Portaria SPA/MF 1.207 Annex I;
- Lagos LSLGA Law 2021 and its regulations, Ghana Act 721 and the GCG licence requirements.

**Method:** one research track read primary texts, saved in the session scratchpad (`audit-sources/steps/`), and I checked the design against them. Code evidence comes from tests, the simulation report and two headless browser checks run today.

**Confidence:** **H** primary text read, **M** regulator page or several reliable secondary sources, **L** thin sources.

---

## 1. Verdict

A step game with one bet, one decision per step and every result fixed at the start fits existing lab standards as an ordinary RNG casino game. No standard found has a step-game category, and none bans the format. The design already meets the rules that matter most:
- every stopping strategy returns exactly 97%;
- jumps have no early tell;
- win effects play only above the stake;
- abandoned rounds refund rather than forfeit when no fence was taken;
- there is no autoplay.

**The remaining risks are procedural, not design:**
- Nigeria and Ghana publish no game-type technical standard, so the accepted lab and standard need written confirmation;
- Brazil and GLI rules on showing the top prize on the idle screen;
- a lab review of the paytable-derived clear chances as a new certified game family.

## 2. Findings and fixes, ranked

| # | Finding | Sources (confidence) | Status | Fix / evidence |
|---|---|---|---|---|
| 1 | **No published technical standard in Nigeria or Ghana.** Lagos requires games to meet "technical standards as determined by the Authority" and be tested by its designated lab; Ghana requires a software certificate in the operator's licence file | Lagos Casino & Gaming Regs 2021 reg 18(3)–(4) (**H**); GCG Requirements for Licence 2025 (**H**); Act 721 definition of a game of chance (**H**) | RISK | Certify to GLI-19 with a named lab, and get written LSLGA and GCG confirmation of the accepted lab and standard (overlaps `night-meet` fix 1) |
| 2 | **Player choices form one game cycle; the step is a gamble feature.** GLI-19 §4.3.3(c)(iii) covers games with player choice. §4.8.5 gamble rules ask for (d) a 100% theoretical return for each gamble, (e) the maximum number of gambles, (i) the range of choices and payouts | GLI-19 v3.0 §4.3.3, §4.8.5 (**H**); Brazil item 6(c)(iii), item 37 (**H**) | PASS | From fence 2 onward each JUMP returns exactly 100% (clear chance × next value / current value = 1). The whole 3% edge is on fence 1. The maths report should show this; `packages/steps/src/config.ts` enforces it by construction |
| 3 | **Same RTP for every strategy** | GLI-19 §4.7.1(a) (**H**); UK RTS 3C (**H**) | PASS | `packages/steps/reports/rtp-fence-run-v1.md`: every stop exactly 97.0000% for Easy, Medium and Hard; six strategies within 4 standard errors over 20M rounds per difficulty. Rounding band 97.000% at 100+ minor units, 96.88–97.65% at 20 |
| 4 | **Illusion of skill.** A perceived skill element must be disclosed unless no strategy applies; no design may suggest skill or speed affects the outcome | GLI-19 §4.6.1(a) (**H**); UK RTS 7C (**H**); AGCO 2.15 (**H**); Brazil item 24(a), Art. 3 (skill games excluded) (**H**); Lagos RG Regs 7(1)(i) (**H**) | PASS | Rules state that every fence is fixed at round start, pressing faster, slower or at any moment changes nothing, every way of playing returns 97%, and the scene is decoration, with the clear chance per fence per difficulty. Verified by `apps/gallop/scripts/rules-check.mjs` (evidence `docs/compliance/evidence/2026-09-16/night-gallop-rules-check.json`) |
| 5 | **No tell before the result.** Pre-set layouts must not change during play, and losing outcomes must not be substituted or foreshadowed | GLI-19 §4.5.2(c) (**H**); AGCO 2.15 (**H**); UK RTS 7C (**H**) | PASS | `JumpSequence` is a pure function of time until the server result is applied; unit test `jump-sequence.test.ts`; headless `presentation-check.mjs` with 900 ms latency: 55 and 54 frames before the response, identical for cleared and refused (evidence `night-gallop-presentation-check.json`) |
| 6 | **Incomplete rounds.** The wager is held, the round must be resolved or resumed, the recovery policy disclosed, and on failure the better outcome for the player applies | GLI-19 §4.16.2–4.16.3 (**H**); UK RTS 10A/10C (**H**); AGCO 4.21 (**H**); Brazil items 62–64 (**H**) | PASS (policy needs counsel) | Rounds resume after reload (`activeStepRound`). After the abandonment time the server collects at the current value, or **refunds** if no fence was taken. No new round starts while one is open. Disclosed in rules. Default 24 h; GLI §4.8.2(b) by analogy suggests at least 2 minutes before any automatic resolution. The demo uses 1 minute; production must stay ≥ 2 minutes |
| 7 | **Minimum game cycle.** UK: at least 5 s from one game start to the next, and a fence-1 refusal can end a round in under 5 s | UK RTS 14G (**H**); Brazil planned portaria (**M**) | PASS | Enforced on the server from the bet (`claimRoundStart` with profile `minCycleMs`); tested (`host.test.ts` "enforces one active round and the minimum gap", step service suite "enforces the minimum gap"). The client shows a countdown |
| 8 | **Top prize on the idle screen.** The default screen must not show the highest advertised award | GLI-19 §4.3.2(d) (**H**); Brazil item 5(d) (**H**, broader wording) | PASS (verify on art) | The betting screen shows the first five fence values (x1.21 to x2.96 on Medium), not x9.03. The finish post carries no value. The full paytable is in the rules. Keep it that way in lobby tiles |
| 9 | **No "would have" reveals.** After a refusal or collect, only the fences actually taken are shown | UK RTS 7C, AGCO 2.15 (**H**); house rule | PASS | Snapshots and history carry no outcome (`round.test.ts` "never exposes the outcome or server seed"). The refusal banner shows fence, stake and net only. Later fences are provable only through the seed verifier (`verifyStepRound`) |
| 10 | **Autoplay, auto-jump, turbo, skip.** Each cycle must be committed individually; turbo and skipping animations are banned; nothing may push the player to continue | UK RTS 8A, 14E, 14A (**H**); Brazil item 34 and planned portaria (**M**) | PASS | No auto-jump, auto-collect target, rebet or skip. No confirmation prompt on COLLECT. One request per press (`action-gate.test.ts`) |
| 11 | **Wins at or below stake.** No celebration when the return is at or below the stake | UK RTS 14F (**H**); AGCO 2.20 (**H**) | PASS | Every collect is at least x1.08 (Easy) above the stake. Refusal is neutral. Headless check: win effect only on collect, none on refusal |
| 12 | **Difficulty levels.** Each paytable is its own configuration and must meet the RTP minimum; no rule requires equal RTP, but rules and payouts cannot change mid-game | GLI-19 §4.7.1(a), §2.8.3 (**H**); UK RTS 3C, 7D (**H**); Brazil items 5(a), 28 (**H**) | PASS | Three config ids `fence-run/v1-{easy,medium,hard}`, all 97%, locked at bet time, shown with the paytable and clear chances in the rules |
| 13 | **Regulator actions on instant games.** Kenya's BCLB ordered crash and Aviator games resubmitted in March 2025 (step games not named); India banned all real-money online games in 2025 | igamingafrika (**M**) | WATCH | Kenya and India are not target markets. Add step games to the jurisdiction watch list |
| 14 | **Precedents.** Claims that Chicken Road or Mines are certified or live in UK, Ontario or Brazil come only from affiliate and clone sites, and they conflict | (**L**) | UNKNOWN | Don't cite them to a lab; rely on the GLI-19 reading above |

## 3. What changed since the concept audit (`night-meet-2026-09-16.md`)

- The mechanic is a step game with one bet per round, so fix 4 (two-slip GLI §4.4.2 displays) no longer applies.
- There is a new engine and new certification family (`fence-run/v1-*`), implemented and tested; see the change `night-gallop-mvp`, groups 1–4.
- The crash is replaced by a refusal: the horse stops at the fence, with no fall and no whip. The theme, adult-art, vocabulary, advertising and data findings are unchanged.

## 4. Open, for counsel or the lab

- Written LSLGA and GCG confirmation of the accepted lab and standard for a step game.
- The abandonment time per market, and whether "collect at current value" is acceptable everywhere (AGCO "better outcome" suggests yes).
- Whether Nigeria or Ghana want a minimum gap between round starts (the UK needs 5 s; the demo uses 5 s).
- Lab acceptance of paytable-derived clear chances, and of three difficulty paytables as one game.
- Brazil's pending design portaria (auto-choices, turbo) if Brazil is ever targeted.

## 5. Evidence produced today

- `packages/steps/reports/rtp-fence-run-v1.md` and `.json`: 20M rounds per difficulty, seed 1.
- `docs/compliance/evidence/2026-09-16/night-gallop-presentation-check.json`.
- `docs/compliance/evidence/2026-09-16/night-gallop-rules-check.json`.
- Tests:
  - `packages/steps`: 25 tests (derivation vector cross-checked against Node's HMAC-SHA256);
  - `packages/rgs-client` step suite against the mock;
  - `apps/api` step suite over HTTP against the memory and Redis-mock stores.

## 6. Key sources

- GLI-19 v3.0 §§4.3.2, 4.3.3, 4.5.2, 4.6.1, 4.7.1–4.7.3, 4.8.2, 4.8.5, 4.16: https://gaminglabs.com/wp-content/uploads/2020/07/GLI-19-Interactive-Gaming-Systems-v3.0.pdf (**H**)
- UKGC Remote gambling and software technical standards, RTS 3, 4, 7, 8, 10, 14: https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/ (**H**)
- AGCO Registrar's Standards for Internet Gaming 2.15, 2.16, 2.20, 4.21 (**H**)
- Brazil Portaria SPA/MF 1.207/2024, Annex I, Art. 3, items 5, 6, 14, 24, 28, 34, 37, 62–64 (DOU) (**H**)
- Lagos State Lotteries and Gaming Authority Law 2021 and Regulations (Casino & Gaming reg 18; Responsible Gaming reg 7) (**H**)
- Ghana Gaming Act 2006 (Act 721); GCG Requirements for Licence 2025 (**H**)
- Kenya BCLB crash-game directive, 25 Mar 2025: https://igamingafrika.com/betting-control-and-licensing-board-bclb-issues-mandatory-compliance-requirements-for-aviator-and-crash-games/ (**M**)
