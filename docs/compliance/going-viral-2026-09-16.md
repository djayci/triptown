# Going Viral compliance audit, 16 Sep 2026

> **The game was dropped on 16 Sep 2026, the day this was written.** The report is kept because almost
> none of its value was about the game: the Nigeria and Ghana licensing, advertising and certification
> findings, the multiplier-display rules across seven markets, and the minors-appeal analysis all apply
> to anything this studio ships. Read sections 2, 3, 4, 7 and 8 as market knowledge. Sections 1, 5 and 6
> judge a concept that no longer exists. The durable rules are also in `AGENTS.md` (Compliance) and in
> `references/jurisdictions.md`, which is where to look first.

**Status:** research findings, not legal advice. A Nigerian and a Ghanaian gaming lawyer, plus your chosen test lab, must confirm everything before you submit or spend.

**Scope:** concept-stage audit of a proposed crash game for **Nigeria and Ghana**. There is no app, no OpenSpec change and no config for Going Viral. What exists is the concept (below), a single line in a test fixture, and the engine it would run on. Every fact about the game is **design intent, not verified behaviour**. Facts about the engine, the profiles and the platform come from code and are cited.

**The concept.** A crash game whose rising number is presented as a **view counter** on a clip that is "going viral"; the crash is "the feed moves on". One bet per round. Intended to ship as a skin on the certified Whack Crash engine — `registerGame('going-viral', 'whack-crash')` — with a **topical skin channel** reskinning the same certified game around current events.

**Method:** three parallel research tracks, primary texts read in full where obtainable:
1. Nigeria — LSLGA Law No. 7 of 2021 and its schedules, ARCON Act 2022, ARCON Vetting Guidelines.
2. Ghana — Gaming Act 2006 (Act 721), GCG Advertising Guidelines, GCG licence requirements and 2025 fee regulations, GCG 2025 Annual Report.
3. Cross-cutting display rules — GLI-19 v3.0, Brazil Portaria 1.207/2024 Annex I, Portugal Reg. 308/2023, UKGC RTS, AGCO Registrar's Standards.

Platform and shared-engine facts inherit from `whack-crash-2026-09-15.md` and are not re-derived.

**Confidence:** **H** primary text read, **M** regulator page or several reliable secondary sources, **L** thin sources.

---

## 1. Verdict

**The mechanic is fine. The framing is not, and the business model is the real casualty.**

Neither Nigeria nor Ghana has any rule about game themes — both were checked against full primary texts. But "Going Viral" makes fame and social validation the metaphor for winning, and that lands on Lagos **Responsible Gaming Regulations 2021 reg.7(1)(k) and (p)** (gaming implying social acceptance or personal success, or enhancing personal qualities) and Ghana's **General Guideline (x)** (gaming implied to be required for personal success). Those are concept-level objections. No art direction answers them.

Separately, **the view counter cannot be the hero number** in any market with a crash rulebook. Brazil requires the multiplier value displayed **and** an always-visible counter in Reais — the concept fails there twice. Portugal makes the multiplier a mandatory element with a two-axis graph. Italy very likely treats a rising non-money number as *crediti di gioco*, which triggers a mandatory conversion-value display. The Netherlands and Spain stop short of blocking but constrain the layout directly. Seven markets were checked and every one that says anything at all points the same way: **the multiplier and the money stay primary, the counter is decoration.**

And the **topical skin channel — the reason this concept was chosen — does not work in Nigeria at the intended cadence.** ARCON pre-vetting is a monthly panel with a ₦2,000,000 foreign-production surcharge per campaign, and the studio is a named offender, not just the operator.

**And the theme is a UK problem that fixing the display does not solve.** CAP/BCAP guidance of Oct 2025 §14 reaches *in-game* themes, not just ad creative: an online gambling game is likely to be of inherent "strong" appeal to under-18s if it shares "significant similarities, in terms of form and gameplay, with video games, online games, **or social games** popular with under-18s; or **in-game themes and content** are likely to be considered of 'strong' appeal". A social-feed crash game invites exactly that comparison. The UK is not a launch market here, but this is the rule that would block the concept when you expand.

The game can be certified. The pitch cannot be delivered as conceived.

## 2. Critical fixes, ranked

| # | Fix | Why (sources, confidence) | Applies to |
|---|---|---|---|
| 1 | **Reprice or drop the topical-skin channel for Nigeria.** Every skin's tile and trailer is a fresh advertisement needing pre-exposure ARCON approval. Default is the **monthly** Standards Panel; accelerated is 8 or 16 working hours at ₦100k–₦280k on top of the vetting fee. Creative produced outside Nigeria attracts **₦2,000,000 per foreign production**, plus **₦2,000,000** again for non-Nigerian on-screen talent or VO. Exposing before the certificate is **₦500,000 minimum, charged separately against the media house, the agency and the advertiser**. Produce Nigerian creative in Nigeria with Nigerian talent and the whole package drops to ₦7,500–₦107,500 per concept | ARCON Act 2022 s.54: any person "including sponsor or beneficiary… **which creates or places**" an advert targeting Nigeria without prior Standards Panel approval commits an offence — the studio is caught directly, the operator's approval does not cover it (**H**). s.63 defines "advertisement" to include a "display" or "logo" that showcases a product "irrespective of media, medium or platform" — a lobby tile is caught (**H**). Vetting Guidelines Headings 11, 17, 29, 33 (**H**) | NG |
| 2 | **Get LSLGA/Global Lab to confirm in writing whether an art-only reskin triggers fresh homologation.** From Jul 2026 Lagos requires source code, RNG and platform submission through Global Lab for a Certificate of Homologation, with revocation for uncertified systems. Whether a cosmetic reskin over certified maths is a new submission is **unpublished and unresolved**. If it is, the channel's unit economics collapse in Nigeria regardless of the ARCON position | LSLGA homologation roadmap Jul 2026 (**M**); no source either way on reskins (**not verified**). Single highest-value unknown in this report | NG |
| 3 | **Drop the virality framing from the concept, not just the art.** "Going Viral", "blow up", "everyone's watching you", follower or subscriber counts, any creator-gets-famous narrative. Rename the game for both markets | Lagos RG Regs 2021 **reg.7(1)(k)** prohibits implying gaming "promotes or is required for **social acceptance**, personal or **financial success**"; **7(1)(p)** prohibits suggesting gaming "can enhance personal qualities" (**H**, gazette text read). Escalating penalty reg.8: ₦1m → ₦5m + suspension → ₦10m + revocation (**H**). Ghana General Guideline **(x)**: ads "shall not imply that gaming is required for personal success, professional achievement or wealth creation"; **(xi)** no endorsement suggesting gambling funded someone's success; **(ix)** no wealthy character (**H**, full guidelines read) | NG, GH |
| 3b | **Expect the theme itself to fail UK under-18 review, whatever the display does.** If the UK is ever a target, the social-feed concept needs replacing, not adjusting | CAP/BCAP "Gambling and lotteries advertising: protecting under-18s", Oct 2025, **§14** — reaches in-game themes and gameplay similarity to "social games popular with under-18s" (**H**). §13: the ASA considers "themes, characters and styles used" of the product itself. §25 and *Videoslots Ltd t/a Mr Vegas* A26-1328653 (1 Jul 2026, upheld): enforcement lands on the **game tile**. Counterweight: *Dribble Media t/a Midnite* A26-1324908 (10 Jun 2026, not upheld) — a TikTok-native "pov:" influencer post passed on audience data, so execution decides it (**H**) | UK (future) |
| 4 | **The multiplier stays the hero number.** A persistent, prominent `x2.41` for the whole round, plus the live payout in local currency, with the view counter visually subordinate — different typeface, weight and colour, never in the payout's position, never given win-celebration treatment | Brazil Portaria 1.207/2024 Annex I **item 14(c)**: "o jogo de colisão deve exibir claramente ao apostador **o valor do multiplicador em aumento** durante o jogo" (**H**). Portugal Reg. 308/2023 **regra 4**: "O jogo tem como **elemento obrigatório o valor numérico do multiplicador**", over a two-axis graph with a synchronised line; **regra 6** permits themed representations only as additions to the mandatory elements (**H**). AGCO **2.15**: "Games shall not display amounts or symbols that are **unachievable**" — the sharpest line against a large arbitrary "views" number (**H**). Netherlands **Rko art. 3.5(1)**: stakes, winnings and losses must appear as amounts in euros "op duidelijke, begrijpelijke en **voldoende onderscheidende** wijze" — which forbids a layout where a large non-currency number dominates (**H**). GLI-19 **§4.4.1(e)** permits a non-currency unit only if the artwork "clearly indicate[s]" the unit awards are designated in (**H**). UK **RTS 7E**: artwork must let the player determine "the value of any winnings" (**H**) | All; blockers in BR and PT |
| 4b | **Police the crash copy for near-miss framing.** "The feed moves on" is fine; "you almost went viral", "so close" is not | Spain **RD 176/2023 art. 17.2**: "Queda prohibido que los resultados en una partida… aun constituyendo pérdidas para el jugador, vengan acompañados de mensajes del tipo «Casi acertaste», «Estuviste cerca», o similar" — near-miss messaging on a losing result is prohibited outright (**H**). art. 17.1 requires results presented "de un modo claro y veraz". The Spanish analogue of the repo's no-near-miss rule | ES; good practice everywhere |
| 5 | **Never let the counter fall.** Going Viral must run a rising-only config (`setbacksMode: 'off'`). A view count that decreases has no real-world referent, and "the feed moves on" does not zero your views | GLI-19 **§4.6.2**: a simulated object's behaviour "shall be consistent with the real-world object, unless otherwise denoted by the game artwork" (**H**). UK RTS 7C misleading design (**H**). A coherence objection a lab reviewer raises whether or not a clause is cited | All |
| 6 | **Build a Nigeria and a Ghana jurisdiction profile.** Neither exists. The only profile Going Viral could bind to today is `light` — candy skin, falling multiplier, 2.5 s cycle, no session clock, no net position, no minimum cash-out | `packages/core/src/profiles.ts:109-167` — shipped profiles are `light`, `regulated-uk`, `regulated-on`, `regulated-br`, `pt-draft` (**H**, code). `light` would fail Ghana's cartoon ban on art alone, and its falling multiplier is fix 4 of the Whack Crash audit | NG, GH |
| 7 | **Strip every cartoon, emoji, avatar and reaction sticker, and do not reproduce a real platform's UI.** Adults with clear age cues, abstract UI geometry | Ghana Underage **(ii)**: "Children's songs, **cartoon characters etc., or the imitation thereof** shall not be used"; **(i)**: no advertising that appeals "either **directly or indirectly**" to under-18s — an open-ended test, run by a regulator with an active anti-child-gaming programme (**H**). Lagos **reg.7(1)(d)**: "likely to appeal to underage or vulnerable persons, **especially by reflecting or being associated with youth culture**" — a "likely to appeal" test with no intent requirement (**H**). Reproducing TikTok/Reels chrome is also an IP problem, separately | NG, GH |
| 8 | **Resolve Ghana's biometric directive before costing a launch.** Operators reportedly must verify via the National Identification Authority — Ghana Card, fingerprint or facial — **before a bet is placed and before any payout**. Taken literally that is incompatible with a ~3 s rebet loop | Reported 4 Aug 2025; directive text **not found on the GCG site**, trade press only (**M**). Get an operator's written implementation. The minimum-cycle-gap rule already forces an interstitial shape, which helps | GH |
| 9 | **Obtain the Nigerian Code of Advertising Practice.** ARCON Act s.54 sets the penalty for unvetted exposure by reference to it, and any gambling-specific content rules likely live there. ARCON's own page carries no download and probed URLs 404 | **Not verified** — the fine that actually applies is in a document nobody has read (**H** that it is unread) | NG |
| 10 | **Use Lagos RG Regs reg.7(2) to ask LSLGA about the theme in writing**, through the operator-licensee. "A licensee may consult the Authority for any advice or consent before it puts out any advertisement or promotions." There is **no LSLGA guidance interpreting "youth culture"** — you cannot design to a standard nobody has stated | reg.7(2) (**H**). Converts the largest UNKNOWN into a documented position you can show a lab and an operator. Costs nothing | NG |
| 11 | **Add `rulesPreApproval` to the Nigeria profile.** Round rules, RTP and how it is derived, max win, the 60 s cap, minimum cash-out and rounding must be available pre-bet **and pre-approved by the Authority**; any later rules change needs prior approval | LSLGA Law **s.81(f)(ii)** (rules and "anticipated pay-outs"); Online and Retail Gaming Regs 2021 **reg.6** (**H**). The rules screen from `compliance-baseline` satisfies the content; the pre-approval step is new and Nigeria-specific | NG |
| 12 | **Never make a player action feed the counter.** No "tap to post", "share to boost", or anything that presents an input as growing the number | Netherlands **Bko art. 4.2(4)**: "De vergunninghouder organiseert geen kansspelen waarin de speler handelingen moet verrichten die **niet van invloed zijn op de uitkomst** van het kansspel" — a statutory ban on required player actions that do not influence the outcome (**H**). Cash-out is safe because it ends the bet and so does influence the outcome. UK CAP guidance §24 agrees that simple cash-out interactions are fine. This is a cleaner citation than the one `AGENTS.md` currently carries for the no-illusion-of-skill rule | All; NL statutory |
| 13 | **Naira payout at equal-or-greater prominence than the counter**, continuously, with the rules stating plainly that the view counter *is* the multiplier | LSLGA Law **s.62(1)(b)**: winnings "shall not be worded in such a manner as to mislead or deceive the public"; RG Regs **reg.7(1)(f)**: nothing untruthful "about the chances of winning or the expected return to a player" (**H**) | NG |

## 3. What already passes

- **Ghana needs no supplier licence.** Act 721 s.13 binds whoever **operates** a game of chance; the 40+ line 2025 fee schedule has no supplier, B2B, platform, aggregator or software-provider category (**H**, full text read). Certification is filed by the operator annually. Commercial sites advertising a Ghanaian "B2B licence" have no statutory basis (**L**, treat as marketing copy).
- **No theme rule exists in either country.** Nigeria: no rule, guideline or statement prohibiting gambling themes based on social media, virality, fame or internet culture (**UNKNOWN**, reported as absence). Ghana: Act 721 contains no theme restrictions of any kind, and the GCG publications page carries no game-content or technical standard (**H**, inventoried).
- **The engine is certified maths Going Viral inherits free.** RTP 97% strategy-independent with committed reports at 10M rounds; `registerGame('going-viral', 'whack-crash')` binds the game to Whack Crash's config ids and their reports, so an art-only skin needs no new proof and no recertification (`packages/core/src/profiles.ts`, `packages/fairness/reports/`). This is the one part of the pitch that survives intact.
- **Money handling is already right.** Exact accrual, rounded half-up once per round (`packages/core/src/money.ts:21`); `resultKind` encodes "only a return **above** the stake is a win" (`money.ts:60`), which is RTS 14F and AGCO 2.20.
- **No Nigerian or Ghanaian display rule for the multiplier.** Nothing to breach (**H**). Ghana's only display provision, Act 721 s.60, is drafted for physical casino premises; a read-across to online is **not verified**.
- **Crash games are offered by licensees in both markets** with no regulator statement against them (**L/M**).
- **One bet per round** avoids the GLI-19 §4.4.2 multi-wager display requirements entirely.
- **No regulator anywhere names social media as a prohibited game theme.** Confirmed across the UK, Ontario, the Netherlands, Spain, Italy, Brazil, Nigeria and Ghana (**H** across four independent passes). Only Portugal (regra 7(c)), Kenya (Reg 95) and the UK (CAP 16.3.12 + Oct 2025 guidance §14) reach game *theme* at all; everywhere else the theme risk arrives through marketing assets. Ontario **2.03** names "social media influencers" but is an advertising casting rule; the game-content standards carry no theme restriction. The Dutch influencer ban (Regeling art. 4(2)–(3)) reaches advertising only. The exposure everywhere is **minors appeal**, not the subject matter.
- **The cash-out interaction itself is safe.** UK CAP guidance **§24**: "Short sequences of simple product functions like selecting a game or a feature of an app like 'cash-out' function are unlikely to breach the 'strong' appeal rules" (**H**).

## 4. Licensing and markets

| Market | Supplier licence | Game type status | Key design limits | Hosting | Conf. |
|---|---|---|---|---|---|
| **Nigeria (Lagos)** | **Yes** — LSLGA B2B licence; courts apply LSLGA to remote suppliers | Offered under Online Casino; no crash statement | Ad content rules reg.7(1) reach marketing, not in-game art; rules pre-approval reg.6; homologation via Global Lab from Jul 2026 | NDPA transfer basis needed; US hosting unresolved | H/M |
| **Ghana** | **No** | Offered by licensees; Act 721 has **no online provisions at all** — fee categories only | No autoplay, speed, RTP or cycle rule found; ad guidelines reach marketing | Act 843 registration; draft DP Bill localisation | H/M |
| Brazil | Per-game lab cert | Allowed, with a crash rulebook | **Item 14(c) blocker** for a counter-only design; counter in Reais | BR or treaty country | H |
| Portugal | None (operator system) | Allowed, restricted | **Regra 4 blocker**; two-axis graph mandatory; regra 7(c) nothing designed for children | Not verified | H |
| Ontario | Registration | Allowed | **2.15 "unachievable amounts"** is the sharpest challenge to a big views number; **2.03** names social-media influencers but is an advertising rule, and the game-content standards carry no theme restriction | — | H |
| Italy | ADM per-game cert | Allowed | **Likely blocker** — a rising non-money counter probably reads as *crediti di gioco*, requiring the conversion value on screen (**M**, section number **not verified**). D.L. 87/2018 art. 9 bans "qualsiasi forma di pubblicità, anche indiretta", which makes a virality-premised game commercially awkward | EEA, qualified cloud | M |
| Netherlands | System cert | Allowed | **Bko 4.2(4)** statutory ban on player actions that do not influence the outcome; **Rko 3.5(1)** euro amounts "sufficiently distinguishable" | — | H |
| Spain | None (operator) | Allowed in practice | **RD 176/2023 art. 17.2** no near-miss messaging on losses; euro amounts (Orden HAP/1370/2014 art. 12.1). RD 958/2020 art. 3.g excludes the operator's own site, so game art and title sit outside it | EU | H |

## 5. Recommended path

1. **Decide whether the topical channel is the product.** If it is, Nigeria is the wrong first market — fixes 1 and 2 are structural, not fixable by design. If Nigeria is the first market, ship a stable skin and drop the topicality claim there.
2. **Rename the game and strip the fame framing** before any art is made. This is fix 3 and it is cheapest now.
3. **Redesign the counter as a subordinate layer** over a persistent multiplier and a live currency payout, on a rising-only config. That design is shippable everywhere checked.
4. **Ask LSLGA in writing** under reg.7(2), through an operator-licensee, and ask the GCG whether a lobby tile is an "advertisement". Both are free and both convert UNKNOWNs into documented positions.
5. **Finish `compliance-baseline` first.** 19 open tasks, every one player-facing — celebration at or below stake, cycle timing, rules screen, history, session clock, net position, operator bridge, adult skin. Going Viral inherits all of them unbuilt. No new game is sellable before they land.
6. Then build the Nigeria and Ghana profiles, and only then draw the canvas.

## 6. Checklist results (concept-stage; A, D, E, F, H only)

| ID | Item | Status | Evidence | Fix |
|---|---|---|---|---|
| A1 | RTP strategy-independent 97% | **PASS** | committed 10M reports, inherited | — |
| A2 | Multiplier can fall | **RISK** | `light` profile `setbacksMode: 'halve'` | Fix 5: rising-only |
| A3 | Return at or below stake possible | **PASS (disclosable)** | `light` minCashout 0 | State in rules |
| A4 | Rounding | **PASS** | `money.ts:21` half-up once | — |
| D1 | No celebration at or below stake | **GAP** | `compliance-baseline` 5.1 open | Inherited blocker |
| D2 | Minimum cycle | **GAP** | 5.2 open; no NG/GH rule found | Inherited; profile needed |
| D3 | No autoplay | **PASS** | engine has none | — |
| D6 | No illusion of skill | **PASS (concept)** | no reflex framing; hard-cut crash | Keep collect verb neutral |
| D8/D9 | Net position, session clock | **GAP** | 8.1 open | Inherited blocker |
| D11 | Operator RG bridge, pinned origin | **GAP** | 8.2 open | Inherited blocker |
| D15 | Two-axis graph synced to multiplier | **GAP** | not designed | Fix 4 (PT) |
| E1/E2 | Rules before betting, full content | **GAP** | 6.3 open | Inherited + NG pre-approval (fix 11) |
| E3 | Round history and recall | **GAP** | 7.1 open | Inherited blocker |
| F1 | Appeal to minors | **RISK** | theme is youth-coded; `light` skin is candy | Fixes 6, 7 |
| F2 | Marketing claims | **RISK** | "Going Viral" is a success claim | Fix 3 |
| H | Licensing logistics | **GAP (NG)** / **PASS (GH)** | ARCON pathway absent; no GH supplier licence | Fixes 1, 2, 9 |

## 7. Not verified. Confirm with counsel or the lab

- **Whether an art-only reskin triggers fresh Lagos homologation.** No source either way. Highest-value unknown here.
- **The Nigerian Code of Advertising Practice** — holds the ARCON s.54 fine and any gambling content rules. Not obtainable from ARCON's site.
- **Any LSLGA interpretation of "youth culture"** in reg.7(1)(d). None exists. The reading in fix 7 is analysis, not authority.
- **The ARCON–FSGRN harmonised gaming advertising code**, effective 1 Apr 2026, 25 states. MoU reported, no text published. Most likely instrument to carry a youth-appeal rule reaching game art rather than only ads.
- **Ghana's 4 Aug 2025 biometric directive** — text not on the GCG site; the "before every bet and payout" wording is trade press.
- **Ghana's draft Legislative Instrument** — completed and submitted, contents unpublished (**H** on status, **not verified** on content).
- **Whether a lobby tile or in-product demo is an "advertisement"** in either country. No authority found either way.
- **LSLGA "technical standards"** under Casino and Gaming Regs reg.18(3) — referenced, unpublished, and an undefined power to refuse a game.
- **Italian ADM Regole Tecniche section numbers** — ADM's PDFs are not text-extractable, so the *crediti di gioco* clause was confirmed via a search index, not read in place. **Do not cite a section number.** Verify before any filing or before treating Italy as a blocker.
- **Brazilian Portarias 1.207 and 1.231** were read via a third-party rendering because the official DOU site refused connections — **re-check Anexo item numbering against the DOU** before any filing.
- **AGCOM delibera 132/19/CONS** section numbers; **no DGOJ sanction on game themes located** (none found, not none exists).
- **Precedent: no certified crash game found whose primary rising indicator is anything but a multiplier** — now **H** on studio and operator primary pages, not trade press: Hard Rock Bet's own NJ help page ("The multiplier starts at 1.00x and begins climbing"), SmartSoft's JetX page (writes the quantity as "Multiplier (height)" — one quantity, not two readouts), BGaming Space XY, Pragmatic Spaceman. **No social-media-themed crash game found in any regulated market**, independently confirmed twice. One open check worth 20 minutes if you want to push this design: whether Evolution's *Cash or Crash* renders its 20 ladder steps as **currency** rather than "x" in a UK/Ontario/NJ build — if so it is the only genuine precedent for a non-multiplier primary indicator in a certified product.
- **2021 Commission Notice C/2021/526 section number** — EUR-Lex unreachable; do not cite a section. The CPC Network "Key principles on in-game virtual currencies" (21 Mar 2025) is a better-anchored but non-binding substitute, and concerns currency used to *buy*, not winnings (**M**).
- **Whether AGCO treats a lobby game tile as "advertising, marketing materials and communications."** The UK answers this explicitly (CAP §25); Ontario does not.
- **Advertising-side rules for Spain (RD 958/2020), Italy (D.L. 87/2018 art. 9) and Brazil (Portaria 1.231/2024)** — dispatched but never returned. Not covered by this audit.
- The Lagos gazette was read from a law-firm-hosted PDF, not a `.gov.ng` domain. Obtain a certified copy for any filing.

## 8. Key sources

- Lagos State Lotteries and Gaming Authority Law No. 7 of 2021 and schedules — **Responsible Gaming Regulations 2021 reg.7(1)**, Online and Retail Gaming Regs reg.6, Casino and Gaming Regs reg.18, ss. 54, 62, 81, 94 (**H**)
- ARCON Act No. 23 of 2022 ss. 54, 63; ARCON Advertising Standards Panel Vetting Guidelines, eff. 1 Jan 2023, Headings 7, 10, 11, 13, 17, 19, 23, 29, 33 (**H**)
- Gaming Act 2006 (Act 721) ss. 3, 13, 14, 16, 60, 62, 72; GCG Guidelines on Advertisement; GCG Requirements for a Gaming Licence; Fees and Charges (Miscellaneous Provisions) Regulations 2025; GCG Annual Report 2025 (**H**)
- GLI-19 v3.0 §§4.3.4, 4.3.5, 4.4.1, 4.6.1, 4.6.2 (**H**) — contains **no** occurrence of "crash" or "collision"
- Brazil Portaria SPA/MF 1.207/2024 Annex I items 10, 11, 14 (**H**)
- Portugal Regulamento 308/2023 regras 3, 4, 6, 7(c), 26, 42 (**H**)
- UKGC RTS 3A/3B/3D, 7C, 7E, 14F (**H**); AGCO Registrar's Standards 2.03, 2.15, 4.05–4.07, 4.15 (**H**)
- CAP/BCAP Advertising Guidance, "Gambling and lotteries advertising: protecting under-18s", Oct 2025, §§13, 14, 22, 24, 25; CAP Code Ed.12 rule 16.3.12; ASA rulings *Videoslots* A26-1328653 (upheld) and *Dribble Media t/a Midnite* A26-1324908 (not upheld) (**H**)
- Netherlands: Besluit kansspelen op afstand **art. 4.2(4)**; Regeling kansspelen op afstand **art. 3.4, 3.5**; Regeling werving, reclame en verslavingspreventie **art. 4(2)–(3)** (**H**)
- EU UCPD 2005/29/EC **art. 6(1)(b),(d)** and **art. 7(2)** (**H** wording; re-check Annex I against EUR-Lex for the 2019/2161 amendments before relying on it)

## 9. Changes since the last audit

First audit for this game. Two corrections to earlier work:

- **Citation fix.** There is no "Responsible Gambling Regulations". The instrument is the **Responsible Gaming Regulations 2021**, a schedule to LSLGA Law No. 7 of 2021, and its reg.7 is headed "Advertising Regulations" with subsections numbered **7(1)(a)–(t)**. `night-meet-2026-09-16.md` fix 6 cites "Lagos RG Regs 2021 reg.7(d)" — right regulations, wrong subsection numbering. Corrected there today. Cite by wording where the letter is load-bearing; the gazette's own layout doubles a letter.
- **Ghana's 30% warning rule is narrower than recorded.** It applies to **billboards and flyers only**; TV and social media use full-duration crawls instead (GCG Specific Guidelines (i)–(iii), **H**). `references/jurisdictions.md` has been corrected.
