# Paper Route compliance audit, 15 Sep 2026

**Status:** research findings, not legal advice. A gaming lawyer and your chosen test lab must confirm everything before you submit.
**Scope:** concept and plan stage. This covers the OpenSpec change `paper-route-mvp` (proposal, specs, design), the concept art in `design/paper-route/`, and the fairness code added so far (tasks 1.1–1.2). There is no client, API or core code for this game yet. It is checked against GLI-19 v3.0, UKGC RTS, Portugal Reg. 308/2023, Brazil Portaria 1.207/2024 and 1.231/2024, AGCO, MGA, NL Rko, ADM, CAP/ASA and Spain RD 958/2020. There is no git commit yet.
**Method:** there were two research tracks:
- partial cash-out and multi-bet rules;
- rounding, illusion of skill and appeal to minors.

Both read primary texts (local copies in `docs/compliance/sources/`). The RTP simulator was run locally, including a rounding sweep, and the round-duration distribution was computed. This builds on `whack-crash-2026-09-15.md` for everything the two games share (RNG, platform, licensing, hosting), which is not repeated here. The jurisdiction notes were verified today, so they were not re-researched.
**Confidence:** **H** primary text read, **M** regulator page or several reliable secondary sources, **L** thin sources.

---

## 1. Verdict

**The partial cash-out mechanic can be certified in principle, but the concept as drawn cannot.** Pragmatic Play's Spaceman already ships a 50% cash-out in UK and Brazilian markets (M/L), and no standard read bans splitting a stake. What fails is everything around the mechanic:
- **the theme:** a paperboy, a cartoon dog, a toy-like runner look;
- **one-way rounding** that makes "97% for any strategy" untrue at small bets;
- **the x0.5 setbacks** (banned in Portugal, conflicting in Brazil);
- **per-throw presentation** that would celebrate returns below the stake or hint at aiming.

Portugal needs a variant without partial cash-out. Every fix below is a design or config change, and none needs a new math model. The shared blockers from the Whack Crash audit (rules screen, cycle time, history, player protection, platform integrity) are being fixed in the `compliance-baseline` change, and Paper Route must build on it.

## 2. Critical fixes, ranked

| # | Fix | Why (sources, confidence) | Applies to |
|---|---|---|---|
| 1 | **Replace the paperboy with an adult courier on a moped or delivery scooter.** Realistic proportions, visible adult age cues, hi-vis and helmet, muted life-like palette, no toy look. Treat lobby tiles and demos as ads | CAP 16.3.12, 16.3.14 ("seems to be under 25") and CAP under-18 guidance Oct 2025: "cute animals", "animated styles", looks "similar to video games popular with under-18s" (H); ASA Videoslots ruling 1 Jul 2026, where a life-like, muted character was not upheld (H); Portugal R7c in-game (H); Brazil 1.231 art. 12 XV/XVIII (H); Spain RD 958/2020 art. 11.2(b)(d)(e) (H); AGCO 2.03 (H) | Everywhere (ads), PT/KE in-game |
| 2 | **No animal setback.** Remove the dog. When setbacks are on, use an event with no animal and nothing avoidable (a splash or a wobble, shown only when the event arrives). Regulated profiles have no setbacks at all | Cute animals listed high-risk (CAP guidance, elephant/shark ruling) (H). A hazard that looks avoidable risks AGCO 2.15, GLI §4.6.1(a), RTS 7C (H). Portugal R1/R22 multiplier only rises (H) | Everywhere |
| 3 | **Settle each round exactly and round the total once.** Accrue each throw in sub-cent units, credit only whole cents as they are earned, and round the final remainder half-up at settlement. Set a minimum paper value, and publish the RTP at the minimum bet as well as the theoretical RTP | GLI-19 §4.7.1(a): minimum RTP "at any single bet level" (H). §4.7.2(a) and Brazil item 29(a): explain how RTP is determined (H). RTS 3A/3D accurate (H). Nevada Notice 2026-14: "not permitted to only round down" (H, cash, by analogy). Simulated per-paper flooring: **93.9%** at a 0.10 paper, 96.6% at 1.00, 97.0% at 10.00 (1 per second; 2M rounds) | Everywhere |
| 4 | **Per-throw presentation is neutral until the round's total return exceeds the stake.** No win sound, confetti or "+" amount for a throw while the running total is at or below the stake. Show each paper's return and the round total | RTS 14F compares with the total stake (H); AGCO 2.20 (H). About 26% of rounds dip below x1.00 when setbacks are on (local calc) | Everywhere |
| 5 | **Portugal: partial cash-out off.** One cash-out per bet. The one-or-two independent stakes model (Aviator-style) is a later variant | Reg. 308 art. 2 h) saque = withdraw *the* bet; R12 one or two bets per play; R26 payout = stake × multiplier; R29 no side bets (H) | PT |
| 6 | **Brazil: present each paper as an independent bet** with its own stake, prize and the round total. Get the lab to agree in writing that throws are cash-outs of independent bets under item 14 d) | Item 12 multiple independent bets (H); item 14 d) lists the ways a round may end (H) | BR |
| 7 | **Throws look the same whenever you throw.** No mailboxes, targets or hit/miss or "perfect" variants. The paper lands at the porch alongside, with irregular house spacing. There is no steering, swipe or lane input. The rules say where the paper lands is decoration | AGCO 2.15; GLI §4.4.1(a)(l), §4.6.1(a); RTS 7C; NL Rko 3.4(2); Brazil planned design portaria "habilidade" (H/M) | Everywhere |
| 8 | **No "would have" values.** Never show what unthrown papers would have paid. The crash point after a round follows `compliance-baseline` (history and fairness panel, not the result screen) | AGCO 2.15 "amounts… unachievable"; RTS 14A; GLI §4.5.2(c) (H) | Everywhere |
| 9 | **Record every throw in history and recall:** time, multiplier at server receipt, papers, amount, client tap time and round-trip time. Disconnects settle remaining papers by the profile's `disconnectPolicy` | GLI-19 §4.14.2(i)(j), §4.16.2–4.16.3 (H); ADM "suddivisione" and intermediate phases (H); Rko art. 4.4 (H); Portugal R41–43 (H) | Everywhere |
| 10 | **Intensity follows the multiplier only and can be turned off per profile.** No slowing, wobble or music cue that could read as a crash warning. No "end of route" goal | RTS 7C, AGCO 2.15, GLI §4.4.1(f) (H); `intensityEffects` in `compliance-baseline` | Everywhere (configurable) |

## 3. What already passes

- **Theoretical RTP is 97% for every throw strategy.** 10M rounds: all 5 at x2 96.995%, 1 at x1.5 + 4 at x5 97.004%, 1 per second 96.999%, 1 after each setback 97.000%, 1 at x3 + 4 never 97.001%, all at x10 97.004%, never 97.001%. Instant bust is 2.996% (`packages/fairness/reports/rtp-paper-route-v1.md`). Splitting a stake keeps the martingale, so the multi-stop RTP proof holds (UK RTS 3C question settled).
- **Not simultaneous games** if it stays one stake debit, one round id and one game-cycle record. RTS 14C, now worded for all casino games since 12 Jan 2026 (H), bans multi-game functionality. A split stake inside one game is closer to a blackjack split (M).
- **The RTP minimum is met at the smallest planned bet** even with the current flooring (93.9% ≥ GLI 75%, MGA/BR 85%, PT 80%) (H).
- **Partial cash-out precedent:** Spaceman "Cashout 50%" is live at UKGC and SPA-licensed brands (M/L).
- **Showing the real crash point in history** is verification, not a near miss (GLI §4.6.1(c)) (H).
- **Speed and sunrise tied to the multiplier** are low risk if they never cue a crash (H).
- **Auto cash-out settling all remaining papers is not autoplay** (RTS 8, per the Whack Crash audit) (H).

## 4. Licensing and markets

The same as `whack-crash-2026-09-15.md` §4, with these Paper Route differences:

| Market | Partial cash-out | Setbacks | Other Paper Route limits | Conf. |
|---|---|---|---|---|
| UK | Allowed with one stake (14C); celebration based on the round total (14F) | Profile off | CAP: adult courier, no animals, not runner-like in tiles | H/M |
| Portugal | **Off** (Reg. 308 2h, 12, 26, 29) | **Off** (R1/R22) | Max ×100, min cash-out 1.01–1.25, in-game minors ban | H |
| Brazil | Allowed as independent bets (item 12), with lab reading of 14 d) in writing | Off (item 14 rising) | Per-paper stake and prize display; RTP shown in game | H/M |
| Ontario | Allowed; 2.17/2.20/2.21 worded for slots, design to them anyway | Profile | 4.02/4.14 recall of partly settled games | H |
| MGA, NL, IT | Allowed; NL/IT recall of each intermediate phase | Profile | IT: show how the stake was split | H |
| Colombia | Unknown (Acuerdo 01/2026 primary text not read) | Profile | – | L |

## 5. Recommended path

1. **Build on `compliance-baseline`** for profiles, responsible play, rules/help, recall, the operator bridge and platform integrity. Don't duplicate them in the Paper Route change.
2. **Add Paper Route profile flags:** `partialCashout: off | papers` (Portugal off), `minPaperMinor`, a settlement mode for exact accrual with one half-up rounding per round, and a regulated rising-only config (`paper-route-rising/v1`) with its own RTP report.
3. **Redo the concept art** with an adult courier on a moped, no dog, uniform throws, and a muted, more life-like palette, before building the 3D scene.
4. **Get the lab's view early** on the Brazil item 14 d) reading, on rounding in the PAR sheet, and on whether operator wallets accept the whole-cent credits of a carry settlement.

## 6. Checklist results

| ID | Item | Status | Evidence | Fix |
|---|---|---|---|---|
| A1 | RTP minimum | PASS | 93.9% worst case at a 0.10 paper (2M-round sweep); 97.0% theoretical (`reports/rtp-paper-route-v1.md`) | – |
| A2 | RTP proven, including rounding and per strategy | GAP | Theoretical report only; per-paper flooring costs up to 3.1 pts (sweep) | Carry settlement plus report at minimum bet (#3) |
| A3 | Top award odds | PASS | Same path model and cap as Whack (`fairness/src/config.ts:32`) | – |
| A4 | Max win disclosed/configurable | PASS (via baseline) | `maxWinMultiplier` in config; profile `maxMultiplier` in `compliance-baseline` | PT ×100 |
| A5 | Multiplier only rises | GAP | `PAPER_ROUTE_CONFIG` inherits `setbackFactor` 0.5 (`fairness/src/config.ts:38-42`) | Rising-only config for regulated profiles |
| A6 | Minimum cash-out | GAP | No minimum per throw in `specs/partial-cashout/spec.md` | Apply profile `minCashout` to each throw |
| A7 | Allowed round endings | RISK | A throw settles part of the round while it continues (`specs/partial-cashout/spec.md:24-40`) | BR independent-bet framing; PT off |
| A8 | PAR report | GAP | Theoretical report only | Include rounding, min-bet RTP, per-strategy table |
| B1–B10 | RNG and integrity | Shared | See Whack Crash audit; fixed in `compliance-baseline` | – |
| C2 | Latency disclosure | GAP | Spec has no per-throw tap time or RTT logging | #9 |
| C3 | Disconnect policy | GAP | Spec only covers "lose" (`specs/partial-cashout/spec.md:94-99`) | Profile `disconnectPolicy` for remaining papers |
| C5 | Idempotent settlement | PASS (planned) | throwId idempotency (`specs/partial-cashout/spec.md:50-60`) | – |
| C6 | One game at a time | PASS (planned) | One stake, one round (`design.md` D1) | Keep; no second stake |
| D1 | No celebration at or below stake | GAP | Spec plays a throw sound and shows expected payout per throw (`specs/paper-route-client/spec.md:30`) | #4 |
| D2 | Minimum game cycle | Shared | `compliance-baseline` responsible-play | Cycle ends after the last paper settles |
| D3 | No autoplay | PASS | Auto cash-out only (`specs/partial-cashout/spec.md:77-82`) | – |
| D6 | No illusion of skill / near miss | GAP | Throw "towards the nearest house" (`specs/paper-route-client/spec.md:30`); "crash point that would have ended the round" (`spec.md:84`); dog hazard (`spec.md:63`) | #2, #7, #8 |
| D7 | Intensity features | RISK | Speed and sun follow the multiplier (`spec.md:19`) | Profile `intensityEffects` |
| D8–D11 | Net position, clock, reality check, bridge | Shared | `compliance-baseline` | Net position updates on every throw credit |
| E1–E2 | Rules content | GAP | No Paper Route rules content | Add papers, throw rules, rounding and landing-is-decoration text to baseline rules generator |
| E3 | Recall of player choices and intermediate phases | GAP | Throws not in baseline record fields | #9 |
| F1 | Appeal to minors | GAP | Paperboy on a bicycle, cartoon dog, toy-like low-poly street (`design/paper-route/*`, `specs/paper-route-client/spec.md:63`) | #1, #2 |
| F2 | Marketing claims | UNKNOWN | No marketing yet | No skill or "beat the dog" copy |

## 7. Not verified. Confirm with counsel or the lab

- How labs treat payout rounding in PAR sheets and certified RTP. No public statement found (L).
- Whether operator wallets and seamless-wallet APIs accept mid-round whole-cent credits with a final half-up adjustment.
- Whether Brazil's lab reads a partial throw as an allowed ending under item 14 d) when each paper is framed as an independent bet.
- Whether AGCO applies the slot-worded 2.17/2.20/2.21 to crash games.
- Colombia Acuerdo 01/2026 text on partial withdrawals. Where Spaceman's 50% cash-out is live in Ontario, Portugal, Italy and Spain.
- Whether any ruling treats low-poly 3D or childhood-nostalgia themes as appealing to under-18s. None found. The runner-game resemblance is an inference from CAP guidance §14/§24.
- The final wording of Brazil's design portaria (still unpublished at 5 Aug 2026).

## 8. Key sources

- UKGC RTS 14 (14C wording updated 12 Jan 2026): https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-14-responsible-product-design
- UKGC RTS 2: https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-2-displaying-transactions
- CAP guidance, protecting under-18s (Oct 2025): https://www.asa.org.uk/resource/gambling-and-lotteries-advertising-protecting-under-18s.html
- Portugal Reg. 308/2023: https://www.srij.turismodeportugal.pt/sites/default/files/2023-03/Regulamento_n_308_2023_Saque_ou_Crash.pdf
- Brazil Portaria 1.207/2024: https://www.legisweb.com.br/legislacao/?id=462643
- Brazil Portaria 1.231/2024 (advertising): local copy `sources/br_portaria1231.txt`
- Spain RD 958/2020: local copy `sources/es_rd958_2020.txt`
- Nevada GCB Notice 2026-14 (rounding): local copy `sources/nv_ngcb_notice_2026-14_pennies.txt`
- GLI-19 v3.0: https://gaminglabs.com/wp-content/uploads/2024/06/GLI-19-Interactive-Gaming-Systems-v3.0.pdf
- AGCO Registrar's Standards: https://www.agco.ca/en/book/export/html/245361
- Spaceman 50% cash-out: https://www.pragmaticplay.com/en/games/spaceman/
- Brazil design portaria status: igamingbrazil.com (5 Aug 2026)

## 9. Changes since the last audit

This is the first Paper Route audit. Compared with the Whack Crash audit earlier today, it adds new findings on partial cash-out (PT R12/R26/R29, BR item 12), rounding (GLI §4.7.1(a) at any bet level, Nevada precedent), the RTS 14C wording extension (Jan 2026), and the CAP under-18 guidance (Oct 2025) with the ASA Videoslots ruling (Jul 2026).
