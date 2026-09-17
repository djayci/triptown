# Night Meet compliance audit, 16 Sep 2026

**Status:** research findings, not legal advice. A Nigerian and a Ghanaian gaming lawyer, plus your chosen test lab, must confirm everything before you submit.

**Scope:** this is a concept-stage audit of game #3, a horse-racing crash game for **Nigeria and Ghana**. It covers:
- the explored mechanics: two slips per race, one debit, a power-cut crash;
- the design canvas at https://claude.ai/artifact/Txzxqhhh49B2yC9JvbLbAa (8 Night Meet state artboards);
- the shared packages it would reuse (`core`, `fairness`, `api`), which have no commits yet.

There is no OpenSpec change, client or game config for Night Meet yet. Global lab rules (GLI-19 v3.0) were checked for the two-slip model and for the risk of the game being classed as virtual racing. The UK, Ontario and Portugal are covered only where they affect those two questions.

**Method:** three parallel research tracks read primary texts where they could get them:
1. Nigeria: Lagos Law No. 7 of 2021 and its regulations, LSLGA notices, ARCON vetting guidelines, NDPA 2023.
2. Ghana: Gaming Act 2006 (Act 721), GCG advertising guidelines, GCG licence requirements 2025, GCG Annual Report 2025, draft Data Protection Bill 2025.
3. Cross-cutting: GLI-19 v3.0, GLI-33 v1.1, UKGC RTS 14 and consultation responses, Gambling Act 2005 ss.6/9/353, AGCO Registrar's Standards, CAP under-18 guidance (Oct 2025).

I spot-checked the key quotes against the saved texts: GLI-19 §4.4.2, Lagos Law s.1 "virtual horse racing", the LSLGA homologation notice, and GCG "cartoon characters" and "certification of software". The primary texts are saved in the session scratchpad (`audit-sources/`) and have not been copied to `docs/compliance/sources/`. Shared-platform facts come from `whack-crash-2026-09-15.md` and `paper-route-2026-09-15.md` and are not repeated here.

**Confidence:** **H** primary text read, **M** regulator page or several reliable secondary sources, **L** thin sources.

---

## 1. Verdict

The mechanics can be certified in both markets. The two-slip model is supported by GLI-19, and neither country has game-design rules stricter than our global defaults. **The blockers are not in game design:**
- **Lagos certification (time-critical).** Lagos began a mandatory 6-month re-certification in July 2026. It runs through its own accredited lab (Global Lab, reportedly exclusive), so a GLI certificate alone may not be accepted there.
- **A B2B licence in Lagos.** Lagos courts hold that it reaches remote suppliers.
- **Legal paperwork for data transfers** under Nigeria's data protection law (NDPA).
- **Classification framing.** The game must never read as horse-race or virtual-sports betting, so the name and copy need changes ("Night Meet", "race", "slip" are racing and sportsbook words).

Ghana is easier. It has no supplier licence; the operator's filing needs a software certificate. Its advertising rules, however, are strict, and every ad needs GCG approval before it runs.

## 2. Critical fixes, ranked

| # | Fix | Why (sources, confidence) | Applies to |
|---|---|---|---|
| 1 | **Plan certification for Lagos, not just GLI-19.** Contact LSLGA's technical desk and Global Lab now; budget both a Lagos certificate and GLI-19 (Ghana, other markets). The Lagos certificate is due by about Jan 2027. Get certificates per game version | LSLGA notice 20/25 Jul 2026: census, then submission of source code and RNG, then a Certificate of Homologation. Uncertified systems are "disconnected immediately upon expiration" and certificates from "non-authorized entities" are flagged (**H**). Global Lab exclusivity (**L/M**). Lagos Law 2021 s.59: only software "approved and registered by the Authority or a certified institution"; approval lasts 5 years (**H**). Casino & Gaming Regs 2021 reg.18: testing at the designated lab's cost (**H**) | NG (Lagos) |
| 2 | **Get an LSLGA B2B licence** ("software/gaming service provider"), then extend to other states through FSGRN reciprocity or per state | Lagos Law 2021 ss.33(3), 85 ban unlicensed activity (**H**). 2026 Lagos High Court rulings (Zegaming, Africa Betting, Mozzartbet) apply LSLGA to remote firms taking Lagos wagers (**H**, LSLGA notice 25 Jul 2026). B2B category and fee (**L/M**, Mondaq 5 Jun 2026). Supreme Court 22 Nov 2024 moved regulation to states (**M**). The Central Gaming Bill was not signed (**M**). FSGRN reciprocity and levies (**L/M**) | NG |
| 3 | **Make it read as a casino crash game, not race betting.** Rename the game (drop "Meet"). Replace "race" with "run" and "slip" (sportsbook "bet slip") with "Bet A / Bet B". Keep one horse, no field, no odds, no finish line and no placings. The rules must say it is an RNG casino game with no race result. Get written category confirmation from LSLGA (Online Casino) and GCG (Online Casino / Remote Interactive Games). Get a lab or counsel opinion before any UK or Portugal filing | GLI-33 v1.1 §4.5 covers virtual events: "simulations of sporting events, contests, and races whose results are based solely on" an RNG (**H**). UK Gambling Act 2005: s.6(2)(b) says a game of chance "does not include a sport", s.9 covers betting on "the outcome of a race", s.353 covers "virtual" races (**H**). Lagos Law s.1 defines horse racing "other than virtual horse racing" (**H**). Act 721 s.72 defines "horse race" as a gazetted track race (**H**). Portugal lists "apostas hípicas" separately (**M**) | All; opinion needed for UK/PT |
| 4 | **Build the two slips to GLI-19's multi-wager rule.** Show each slip's stake, each slip's return and the round total, and tie each award to its slip. Keep one debit, one round id and one cycle. Record every slip's collect in recall. Add a `maxSlips` (1–2) profile flag | GLI-19 §4.4.2 "Multi-Wager Games" allows "multiple, independent wagers… simultaneously"; (a) each wager clearly shown with its stake, (b) the win per wager and the total win, (c) each award tied to its wager (**H**). §4.3.3(e) forbids starting a new game before the current cycle ends; two slips are one cycle (**H**). UKGC RTS 14C bans multiple games at once and keeps "more than one set of reels within the individual game" "under review" (**H** text, **M** application) | All |
| 5 | **Set up a lawful data-transfer basis before any Nigerian player's data reaches US hosting.** Keep personal data out of the game server (operator player tokens only, no biometrics). Sign processor agreements with operators, using standard contract clauses where needed. Assess NDPC registration and Ghana DPC registration. Add `hostingRegion` and `dataTransferBasis` flags | NDPA 2023 s.41 (transfer bases, basis recorded) and s.44 (registration for major importance) (**H**). GAID 2025 requires NDPC approval of transfer clauses (**M**). NDPC gaming investigations, Aug 2025 (**M**). Ghana Act 843 registration every 2 years (**M**). The draft Ghana DP Bill 2025 asks for "reasonable efforts to localise" and approval for large transfers (**H** draft, status **L**) | NG, GH |
| 6 | **Marketing assets built for both regulators.** Nigeria: ARCON pre-vetting of every tile, demo and video Triptown supplies, plus 18+ warnings. Ghana: GCG pre-approval, warnings at 30% of the largest font or as a crawl. Neither: celebrities, "assured win" or wealth imagery, cartoons, youth culture, reckless or heroic framing, luck or cultural-belief motifs, falls, whips | ARCON Vetting Guidelines, pre-approval of all ads incl. social, minimum penalty ₦500k (**H**). Lagos **Responsible Gaming Regulations 2021 reg.7(1)** — (d) youth culture, (i) skill, (l) celebrities, (r) "toughness… recklessness", (u) "cultural beliefs or traditions about… luck", 7(3) 18+ (**H**; subsection numbering corrected 2026-09-16 from the gazette text — reg.7 is headed "Advertising Regulations" and its items run 7(1)(a)–(u), with one letter doubled in the gazette's own layout, so cite by wording where the letter is load-bearing). GCG Guidelines on Advertisement: no celebrities, no impression of "assured wins", no "cartoon characters etc., or the imitation thereof", 30% warnings, pre-approval, no prime-time broadcast (**H**). ~~ASA Coral 2020: a falling-jockey video was irresponsible~~ — **withdrawn 2026-09-17**. A20-1059159 was read in full: it is about free-bet mechanics and repeat play (CAP 16.3.1), and says nothing about the fall. Not authority on accident imagery. See `the-lift-2026-09-17.md` §3 | NG, GH (ads, tiles, demos) |
| 7 | **Realistic adult art, locally sensitive.** A realistic thoroughbred and an adult jockey with clear age cues, muted palette, no mascot face. No durbar, emirate or festival horse imagery. The crash is a stadium floodlight failure, never a horse fall or injury | CAP under-18 guidance Oct 2025 §20: "'cuddly' or 'cute' animals… exaggerated features" high risk; §14 "life-like and/or adult" more acceptable (**H**). GCG cartoon ban (**H**). Lagos RG reg.7(t) cultural beliefs (**H**). Sharia-state gambling bans and Kano Hisbah raids (**M**) | All |
| 8 | **Keep the power cut about the stadium, not the country.** Copy and marketing say "floodlights"; no national grid, utility names, NEPA or *dumsor* references, no political jokes | GCG can revoke approval for ads affecting "public interest and sensibilities" or "offensive to public policy" (**H**). Nigerian Code of Advertising Practice Art. 127 on national institutions (**L**, not verified). *Dumsor* is politically charged in Ghana (background knowledge, not researched) | NG, GH |
| 9 | **Per-state blocking hook.** A `blockedRegions` config the operator bridge honours; operators geo-block the 12 Sharia states | 12 northern states under Sharia criminal law ban gambling for Muslims; Hisbah enforcement resumed after Nov 2024 (**M**) | NG |
| 10 | **Fix the rules copy drafted on the canvas.** State what happens to open slips at the 60 s cap: they settle as `maxDuration` cash-outs, see `packages/core/src/events.ts:1`. Show RTP at the minimum NGN stake, add "not a race result", per-slip and total returns, and the naira rounding unit. Add a `winningsWHT` display flag in case Nigeria's reported 5% withholding on winnings needs a net line | GLI-19 §4.4.1 rules content (from the Whack audit, **H**). Lagos Law s.81(f): rules and "anticipated pay-outs" available to players (**H**). Nigeria Tax Act 2025 withholding on winnings (**L/M**). Ghana withholding repealed by Act 1129 from 2 Apr 2025 (**M**) | All; WHT NG only |
| 11 | **No live-bets feed in v1** (flag, default off). If ever added: real, delayed, anonymised data that never spotlights big wins | No rule found. AGCO 2.16 (no chasing or raising stakes) and 2.04 (not misleading) are adjacent (**H** text, **L** application) | All |

## 3. What already passes (concept and shared platform)

- **Two slips as one game cycle.** GLI-19 §4.3.3(e) and §4.4.2 support it (**H**). Portugal R12 allows up to two bets. AGCO 2.17 applies to slots only (**H**). The canvas already uses one debit and one round id (`nm-engine.js` `totals()` and the run-start debit).
- **Win effects only when the race total beats the total stake, never on a single slip's collect.** The canvas holds effects until settlement (`nm-engine.js`, the `after.open === 0` branch). The Returned and In Profit artboards show the neutral states. This matches AGENTS rule 11 and RTS 14F (**H**).
- **Rising-only multiplier, no setbacks, sudden crash with no warning cue.** The flicker starts only after the crash (`nm-scene.js` `lightsLevel`).
- **Strategy-independent RTP of 97%** holds for any split of a stake. The Paper Route rising config passes 8 strategies over 4M rounds (`packages/fairness/reports/rtp-paper-route-v1-rising-halfup-20-jitter50.md`). The instant-bust share is 2.995% against a 3.000% target. Two unequal slips are the same martingale; a dedicated run is still needed (checklist A2).
- **No autoplay or auto-rebet. Auto collect per slip only. 5 s gap between races. Rules before any bet. Session clock and net position always visible.** All are on the canvas; server enforcement comes from `compliance-baseline`.
- **Ghana needs no supplier licence** (Act 721 s.13; GCG register) (**H**). Ghana's winnings withholding is repealed (**M**), so no tax line is needed there.
- **Age 18+, self-exclusion (Nigeria SAFEPLAY, the GCG scheme) and KYC** are operator-side (Lagos RG Regs reg.3, Act 721 s.72) (**H**).
- **No game-design rule found in either country stricter than the global defaults.** None covers autoplay, speed, minimum RTP or cycle time, or bets per round (**H** absence in the texts read, **M** overall).

## 4. Licensing and markets

| Market | Supplier licence | Game type status | Key design and marketing limits | Hosting / data | Conf. |
|---|---|---|---|---|---|
| **Lagos (NG)** | LSLGA B2B licence (fee not published); s.35 capital and local content may apply | Crash is not named; sits under Online Casino held by the operator. Get written confirmation | Lagos certification via Global Lab by about Jan 2027; RG reg.7 ads; ARCON pre-vetting; 18+ | NDPA s.41 transfer basis; no gaming localisation rule found; CBN localisation (Jan 2027) covers payment firms, not games | H/M |
| **Other NG states** | Per state, or FSGRN reciprocity (whether B2B is covered is not verified) | As Lagos, where the state regulates | FSGRN 11% GGR contribution, ₦100m per category (operators) | As Lagos | L/M |
| **FCT (Abuja)** | FCT Lottery Regulatory Office (since May 2025) | Not researched in depth | – | As Lagos | M |
| **12 Sharia states** | – | Gambling banned for Muslims; Hisbah raids | Geo-block through the operator | – | M |
| **Ghana** | None; certificate supplied inside the operator's GCG filing, renewed yearly | Aviator widely offered by licensees; no GCG statement found | GCG ad pre-approval, 30% warnings, no celebrities, cartoons or wealth imagery; 20% GGR tax | Act 843 DPC registration; draft DP Bill 2025 localisation effort | H/M (crash status L/M) |
| UK / Portugal (reference) | See the Whack audit | Classification risk as virtual race betting | – | – | H/M |

## 5. Recommended path

1. **Now:** write to LSLGA and Global Lab to ask about the certification scope, B2B licence steps and whether GLI certificates are accepted. Ask two launch operators, one in Lagos and one in Ghana, to confirm the licence category for crash games in writing.
2. **In the OpenSpec change** (`night-meet-mvp` or the new name):
   - naming and copy that avoid racing and sportsbook terms;
   - GLI §4.4.2 displays;
   - generalising papers into slips in `core`, coordinated with the shared-package owners;
   - profile flags `maxSlips`, `blockedRegions`, `hostingRegion`, `dataTransferBasis`, `winningsWHT`, `liveBetsFeed:false`;
   - NGN currency rules (minor unit, minimum stake per slip, rounding band at that stake).
3. **Before building art:** a checklist for realistic, adult, non-affluent art, reviewed against CAP §20, GCG and Lagos reg.7.
4. **Before the first operator:** NDPA processor and transfer agreements, the DPC/NDPC registration assessment, the RTP simulation for two slips at the minimum NGN stake, and a certification pack for both GLI-19 and the Lagos certificate.
5. **Marketing:** ARCON vetting and GCG pre-approval for every tile, demo and video Triptown supplies.

## 6. Checklist results (concept stage)

| ID | Item | Status | Evidence | Fix |
|---|---|---|---|---|
| A1 | RTP minimum | PASS (planned) | 97% config default `packages/fairness/src/config.ts:26` | – |
| A2 | RTP proven | GAP | No two-slip config or report; paper route rising passes (report above) | Simulate 2 unequal slips, independent auto targets, at the minimum NGN stake |
| A4 | Max win disclosed | UNKNOWN | `[MAX WIN]` placeholder on the Rules artboard | Set it per profile |
| A5 | Rising only | PASS (design) | Canvas: no setbacks | Profile `setbacksMode: off` |
| A7 | Round endings | RISK | The 60 s cap is not described in the canvas rules; `maxDuration` reason `packages/core/src/events.ts:1` | Rules copy (fix 10) |
| B1–B10 | RNG | Inherited | Shared `fairness`/`api`; `node:crypto` in `apps/api/src/integrity.ts:1`, `seed-cipher.ts:2` | Per the Whack audit and baseline |
| C6 | One game at a time | PASS with conditions | GLI-19 §4.3.3(e), §4.4.2 (**H**) | Replace the checklist's "no dual-bet panels" with the multi-wager conditions (fix 4) |
| D1 | No celebration at or below stake | PASS (design) | Canvas Returned / In Profit artboards | Automated presentation check once built |
| D2 | Minimum game cycle | PASS (design) | 5 s gap on the canvas; server gate in `compliance-baseline` task 5.2 (open) | – |
| D3 | No autoplay | PASS (design) | Per-slip auto collect only | – |
| D6 | No illusion of skill | RISK | Racing framing ("race", "meet"); no skill cues on the canvas | Fix 3 copy |
| D7 | Intensity features | RISK | Shake, crowd lights, speed tied to the multiplier (`nm-scene.js`) | `intensityEffects` flag; reduced-motion switch already on the canvas |
| D8/D9 | Net position, clock | PASS (design) | HUD strip on every artboard | Baseline task 8.1 |
| E1/E2 | Rules | GAP | Rules artboard draft with placeholders | Fix 10 |
| E3 | Recall | GAP | Not built for slips | Record per slip (GLI §4.4.2c, §4.14) |
| F1 | Appeal to minors | RISK | Placeholder silhouette only | Fix 7 |
| F2 | Marketing | GAP | None produced | Fix 6 |
| G7 | Hosting location | RISK | US Vercel/Upstash | Fix 5 |
| G8 | Regulator integrations | UNKNOWN | Lagos certification may add a monitoring hookup; a GRA monitoring system is planned in Ghana (**M**) | Exportable round/audit feed hook |
| H1 | Supplier licence | GAP (NG) / N/A (GH) | – | Fix 2 |
| H2 | Lab choice | RISK | Global Lab for Lagos vs GLI | Fix 1 |

## 7. Not verified. Confirm with counsel or the lab

**Nigeria**
- Whether Global Lab is exclusive, whether GLI/BMM certificates are still accepted, the "GLA standard" contents, and the announcement date (sources give June and September 2026).
- The LSLGA B2B fee, and whether the s.35 capital and local-shareholding rules apply to B2B suppliers.
- FSGRN primary texts (11% GGR, reciprocity) and whether reciprocity covers B2B.
- The section number of Nigeria's 5% withholding on winnings, and who must display it.
- The Betway v ARCON suit number and date; the gambling chapter of the Nigerian Code of Advertising Practice; Art. 127 wording.
- GAID article numbers and thresholds for major-importance registration.
- FCT Lottery Regulatory Office technical rules for online games.

**Ghana**
- Whether the GCG Legislative Instrument has been laid or passed, and its contents (supplier, RNG or RTP rules).
- GCG lab preferences; the scope and data feed of the GRA monitoring system.
- Act 843 section numbers (the scanned PDF has no text layer).
- Ghana DP Bill 2025 status.

**Both, and cross-cutting**
- How LSLGA and GCG classify virtual games versus casino, in writing.
- Whether Aviator or Spaceman dual bets are live or disabled in UK, Ontario, MGA or Brazil builds; any lab statement on dual bets.
- The UKGC 2008 betting-versus-gaming advice note (primary text not found).
- Portugal SRIJ treatment of RNG horse visuals.
- The ASA Coral 2020 ruling page.
- Any ruling on whips or falls in gambling content.

## 8. Key sources

**Nigeria**
- Lagos State Lotteries and Gaming Authority Law No. 7 of 2021 and its schedules (RG, Casino & Gaming, Online & Retail, Remote Gaming Regs 2021), Gazette Extraordinary No. 14 Vol. 54 (27 Apr 2021), copy via srjlegal.com, ss.1, 33, 59, 81, 82, 85; RG reg.3, reg.7 (**H**).
- LSLGA public notices: certification 20/25 Jul 2026, High Court judgments 25 Jul 2026, https://lslga.org (**H**). Licence categories https://lslga.org/licensing-categories-and-compliance/ (**M**).
- ARCON Vetting Guidelines, https://advertcouncil.gov.ng/documents/Vetting%20Guidelines.pdf (**H**).
- Nigeria Data Protection Act 2023, ss.41, 43, 44 (**H**). GAID 2025 summary, DLA Piper (**M**).
- Aluko & Oyebode, FCT regulation 2025; Mondaq Nigeria gaming guides (27 May, 5 Jun, 25 Aug 2026) (**M**, **L/M**); Stake.com action, igamingafrika 10 Sep 2026 (**M**); Tinubu assent refusal, allAfrica 22 Dec 2025 (**M**); Hisbah raids, Sahara Reporters 23 Nov 2024 (**M**); HRW 2004 Sharia states (**M**).

**Ghana**
- Gaming Act 2006 (Act 721), ss.3, 13, 14, 16, 26, 41–48, 71, 72, https://gamingcommission.gov.gh/wp-content/uploads/2025/01/Gaming-Act-2006.pdf (**H**).
- GCG Guidelines on Advertisement, https://www.gamingcommission.gov.gh/wp-content/uploads/2025/01/ADVERTISING-GUIDELINES-OF-THE-GAMING-COMMISSION.pdf (**H**).
- GCG Requirements for Licence 2025 and the fee regulations (**H**); GCG Annual Report 2025 (**H**); operator register (**H**).
- Draft Data Protection Bill 2025, cl.96–97 (**H** draft); Chambers Gaming Law 2025 Ghana (**M**); GNA on the winnings tax repeal, Mar 2025 (**M**).

**Standards and reference markets**
- GLI-19 v3.0 §§4.3.1, 4.3.3, 4.4.2, 4.17, https://gaminglabs.com/wp-content/uploads/2020/07/GLI-19-Interactive-Gaming-Systems-v3.0.pdf (**H**).
- GLI-33 v1.1 §4.5, https://gaminglabs.com/wp-content/uploads/2019/05/GLI-33-Event-Wagering-Systems-v1.1.pdf (**H**).
- UKGC RTS 14 (updated 12 Jan 2026); the 2023 Proposal 5 response; the 2024 multiple-slots response (**H**).
- Gambling Act 2005 ss.6, 9, 353 (**H**).
- AGCO Registrar's Standards 2.03, 2.04, 2.16–2.18 (updated 14 May 2026) (**H**).
- CAP "Gambling and lotteries advertising: protecting under-18s" (Oct 2025) §§14, 20 (**H**).

## 9. Changes since the last audit

This is the first audit of this game. Compared with `whack-crash-2026-09-15.md` and `paper-route-2026-09-15.md`, it adds:
- **Nigeria is now state-regulated in detail:** Lagos certification through Global Lab (Jul 2026), B2B licensing, court rulings reaching remote suppliers, FSGRN, ARCON pre-vetting, Lagos RG reg.7, NDPA s.41.
- **Ghana:** no supplier licence, the operator's software-certificate requirement, strict GCG ad guidelines, the winnings withholding repeal, the draft DP Bill 2025.
- **GLI-19 §4.4.2 (multi-wager games)** contradicts the checklist line C6 "no dual-bet panels". The line should be corrected (see fix 4).
- **Classification as virtual racing** under GLI-33 §4.5 and Gambling Act 2005 ss.6/9/353 is a new risk category for any sport-themed game.
