# Jurisdiction notes

Snapshot from the Whack Crash audit (`docs/compliance/whack-crash-2026-09-15.md`). Each entry has a `verified` date and confidence: **H** primary text, **M** regulator page or several reliable secondary sources, **L** thin sources.
Re-verify an entry before relying on it if it is **older than 90 days**, or if it is on the watch list.

## Watch list (re-check on every audit)
- **Brazil:** interministerial design portaria (5 s per bet; no autoplay, turbo or loss celebrations; no skill suggestions; 180-day recertification). Announced 5 Aug 2026; **still not in the DOU as of 16 Sep 2026** (SPA act index ends 13 Jul 2026).
- **Denmark:** whether bill **L 127** (Spilpakke 1, tabled 25 Feb 2026) passed - Folketinget's "as adopted" text was unreachable on 2026-09-16. Provisions dated 1 Jul 2026 and 1 Jan 2027.
- **Curacao:** registration portal for foreign suppliers opens ~Oct 2026 (LOK transition ends 24 Dec 2026); dossier requirements unpublished.
- **Gibraltar:** the fee-tier Legal Notice (reported LN.2026/065) and the tier a game supplier falls into; Schedule 8 transitional cover lapses ~1 Oct 2026.
- **Colombia:** obtain a readable copy of Coljuegos **Acuerdo 01 of 7 May 2026** (official PDF is an image scan).
- **Kenya:** whether the GRA grants written exemptions from reg 42(2) data localisation, and any crash-specific follow-up rules.
- **Brazil item 14 lab reading:** no published GLI or accredited-lab interpretation of items 12/14 was found on 2026-09-16; the primary text is our only source. Re-check before a Brazil submission.
- **Nigeria:** LSLGA homologation (6-month window from Jul 2026; Global Lab exclusivity and GLI acceptance unconfirmed); FSGRN reciprocity for B2B; Central Gaming Bill after the Dec 2025 assent refusal. Added 2026-09-16.
- **Ghana:** GCG Legislative Instrument (completed and submitted for approval, contents unpublished) and Act 721 amendments (initiated, not passed); Data Protection Bill 2025 (localisation effort, transfer approval); GRA gaming monitoring system. Added 2026-09-16.
- **Ghana biometric directive (4 Aug 2025):** operators reportedly must verify via the National Identification Authority (Ghana Card, fingerprint or facial) **before a bet is placed and before any payout**. Directive text not found on the GCG site; trade press only (M). If literal, a per-bet check is incompatible with a fast crash rebet loop — get an operator's written implementation before costing a Ghana launch. Added 2026-09-16.
- **Ghana Advertising Council Bill:** pending before Parliament; unlike the GCG guidelines it could reach a B2B studio's own marketing directly (M). Added 2026-09-16.
- **Rounding:** lab practice for payout rounding in PAR sheets and certified RTP; operator wallet support for round-level carry settlement. Added 2026-09-15.

## Test-lab baseline
- **GLI-19 v3.0 (Jul 2020) is still current; no v4 exists.** re-verified 2026-09-16 against the GLI standards index, **H**.
- **GLI-19 v3.0** is the base standard for online game servers and RNGs. verified 2026-09-15, **H**. https://gaminglabs.com/wp-content/uploads/2024/06/GLI-19-Interactive-Gaming-Systems-v3.0.pdf
- **No GLI crash-specific standard exists.** The only crash-specific rulebooks found are Brazil Annex I item 14 and Portugal Reg. 308/2023. **H**
- **Precedents.** Aviator: GLI Ontario certificate (M). Blitzcrown: GLI-19 plus Brazil (M). IGT Take-Off!: NJ (M). Spaceman (Pragmatic Play) "Cashout 50%" partial cash-out marketed at UKGC and SPA-licensed brands (M/L). verified 2026-09-15.
- **RTP at every bet level.** GLI-19 §4.7.1(a): the minimum RTP "shall be met… at any single bet level"; §4.7.2(a) displayed RTP must explain how it was determined. No standard found on payout rounding outside jackpots (§4.13.6(b); Brazil 1.207 item 49(b)). verified 2026-09-15, **H**.
- **Rounding.** GLI-19 has **no payout-rounding-direction rule**: only 4.13.6(b) (jackpots not rounded down or truncated) and 4.3.5(c) (credit-meter truncation must still return the fraction). Half-up is neither mandated nor barred; the live obligations are **disclosure**, 4.7.1(a) minimum RTP at any single bet level, and 4.7.2(a) explaining how a displayed RTP was derived. No MGA or UKGC rounding guidance found. verified 2026-09-16, **H**.
- **Rounding precedent.** Nevada GCB Notice 2026-14 (23 Mar 2026): cash payouts may not "only round down"; policy must be disclosed. verified 2026-09-15, **H**.

## United Kingdom (Gambling Commission). verified 2026-09-15, H
- **Licences.** Remote gambling software licence (Gambling Act 2005 s41). Remote casino game host licence if you host (Spribe suspended Oct 2025 to Mar 2026; s117 warning Jun 2026). Personal management licences (LCCP 1.2.1). LCCP 2.3.1 technical standards. LCCP 5.1.6 CAP code.
- **Crash games allowed.** RTS 14E turbo ban "does not capture crash games".
- **Rules that apply to casino games (since 17 Jan 2025):**
  - RTS 14F: no celebration when return is at or below stake.
  - RTS 14G: 5 s start-to-next-start for non-slot casino games.
  - RTS 14C: no simultaneous games (wording updated 12 Jan 2026 to cover all games, not just slots; a split stake within one game is not a second game, M).
  - RTS 14A: don't encourage continued play.
  - RTS 8: no autoplay.
  - RTS 2E: net position.
  - RTS 13A–C: time display and reality checks.
  - RTS 3: rules and RTP.
  - RTS 4: latency risk.
  - RTS 6A: free play.
  - RTS 7: RNG and no misleading design.
  - RTS 10: interruptions.
- **Slots only, not crash:** RTS 14D (2.5 s spins) and the 2025 stake limits (SI 2025/215, reel-based games).
- **Testing.** Approved test house report uploaded to the games register before release. Annual audit. Major vs minor updates (Annex A).
- **Enforcement.** Stakelogic fined £122,835 (Jun 2026) for 14D speed breaches after stopwatch testing.
- **Minors.** CAP 16.3.12 and 16.3.14 (no one who seems under 25). ASA upheld complaints over cartoon slot imagery. Play'n GO ruling 16 Jul 2025. CAP under-18 guidance (Oct 2025) lists cute animals, animated styles and looks similar to popular video games as high-risk and treats game tiles as ads. **§14 reaches IN-GAME themes, not just ad creative:** a game is likely to be of inherent "strong" appeal to under-18s if it shares "significant similarities, in terms of form and gameplay, with video games, online games, **or social games** popular with under-18s; or **in-game themes and content**" are of strong appeal (verified 2026-09-16, H). §13 weighs "themes, characters and styles used" of the product itself; §22 "language used commonly in youth-oriented social media should be avoided"; §24 simple cash-out interactions are unlikely to breach; §25 enforcement lands on the game tile. LCCP SR 3.2.1's youth-culture rule is **non-remote only** — for a remote game the constraint arrives via the ad rules (LCCP 5.1.7). ASA Videoslots/Mr Vegas ruling 1 Jul 2026: cartoon elephant and shark upheld; life-like, muted Big Bass fisherman not upheld. verified 2026-09-15, H.

## Malta (MGA). verified 2026-09-15, H
- **Licence.** B2B Critical Gaming Supply: €5k to apply, about €25–35k/yr (M), 4–6 months (L).
- **Crash games allowed** (Type 1). New RNG or game engine needs prior approval (Dir. 3/2018 arts. 21, 23).
- **Design rules.** RTP ≥85% (PPD 22). Rules one click away (PPD 7). Real-time balance display and reality check (PPD 18A).
- **Hosting.** Malta/EU/EEA, or equivalent safeguards case by case, plus live mirror (arts. 15, 17).

## Curaçao (CGA, LOK). verified 2026-09-15, M
- **Local suppliers** need a licence (€4,592 to apply, €24,490/yr). **Foreign suppliers** must register by 24 Dec 2026. Lab certificate expected (L).
- Crash games allowed in practice.

## Isle of Man / Gibraltar. verified 2026-09-16, H/L
- **Gibraltar Gambling Act 2025 is in force**: Act 2026-04, assent 23 Mar 2026, commenced **1 Apr 2026** by LN.2026/064 (all provisions except ss 55-77). A crash supplier needs a **B2B Gambling Operator's licence** (s 17(1)(b); s 19(2)(b) server-based content software and (h) other gaming software) and must provide the service "in or from Gibraltar" (s 19(1)(e)), i.e. local substance. Schedule 8 gives six months' transitional cover from commencement, lapsing ~1 Oct 2026. Fee tiers sit in a separate Legal Notice, not retrieved (L). verified 2026-09-16, H.
- **Isle of Man.** Optional software supplier licence (£35k/yr plus £5k). Accredited testing.
- **Gibraltar.** Gambling Act 2025 tiered B2B regime with content approval. Start date uncertain.

## Portugal (SRIJ). verified 2026-09-15, H
- **Licence.** No supplier licence; approval goes through the operator's technical system.
- **Crash games restricted:** "Saque ou Crash", Reg. 308/2023.
- **Game rules:**
  - Multiplier only increases from 1.00 (R1/R22).
  - Two-axis graph synced to the multiplier (R4).
  - No imagery, sound or language designed for children (R7c).
  - Max bet ≤ 100× min bet (R15).
  - Max multiplier 100 (R17).
  - Minimum cash-out 1.01–1.25 (R19).
  - RTP ≥80% (R20).
  - Auto cash-out allowed (R24).
  - Saque = withdrawing *the* bet (art. 2 h); payout = stake × multiplier at saque (R26); one or two independent bets per play (R12–13). No partial cash-out provided for. verified 2026-09-15, H.
  - No side bets (R29).
  - No autoplay; repeat-stake allowed (R33).
  - Portuguese language (R35).
  - Recent rounds view (R37).
  - Prompt after 3 min idle and session summary (R38–40).
  - Disconnect settles at the multiplier displayed (R41–43).
- **Server location:** not verified.

## Spain (DGOJ). verified 2026-09-15, M
- **Licence.** No supplier licence; homologation inside the operator's system.
- **Crash games allowed in practice** (Aviatrix approved Jan 2025); legal category unclear.
- **Minors.** RD 958/2020 art. 11.2: (b) design apt to attract minors including mascots, (d) people made to look like minors, (e) gambling as a sign of maturity. Art. 11 survived the Supreme Court judgment of 2 Apr 2024. verified 2026-09-15, H/M.
- **Hosting.** Internal control system (SCI) data stored in the EU.

## Germany (GGL). verified 2026-09-16, H/M
- **Effectively closed to crash.** The GGL's permitted set defines virtuelle Automatenspiele as replicas of terrestrial slot machines; crash is not mentioned anywhere on the GGL site. The EUR 3 / EUR 5 stake pilot (Entscheidungsrichtlinie under s 22a(7) GlueStV 2021, in force 1 Jul 2026 to 31 Dec 2027; EUR 3 needs 21+, EUR 5 adds a 90-day clean-play condition and behavioural monitoring) is slot-specific and gives crash no headroom. verified 2026-09-16, H.
- **Crash games not licensable.** Only virtual slots and poker can be licensed nationally.
- **Virtual slot rules (§22a):** 5 s average game, €1 stake (pilot €3/€5 for 21+), no autoplay or jackpots.

## Netherlands (KSA). verified 2026-09-16, H
- **Bko art. 4.2(4):** "De vergunninghouder organiseert geen kansspelen waarin de speler handelingen moet verrichten die **niet van invloed zijn op de uitkomst** van het kansspel" — a **statutory ban on required player actions that do not influence the outcome**. Kills any tap-to-boost or decorative-input mechanic; a cash-out is fine because it ends the bet. Cleaner citation than the general no-illusion-of-skill rules.
- **Rko art. 3.5(1):** stakes, winnings and losses shown as euro amounts "op duidelijke, begrijpelijke en **voldoende onderscheidende** wijze" — forbids a layout where a large non-currency number dominates the money.
- **Rko art. 3.4:** no presenting a game "onder een naam" that misleads about its nature — literally a naming rule; extending it to theming is an argument.
- **Influencer/role-model ban** sits in the Regeling werving, reclame en verslavingspreventie art. 4(2)–(3) (enumerates "influencer, vlogger, blogger") — **advertising only; it does not reach a game's theme**.

## Netherlands, earlier notes. verified 2026-09-15, M/H
- **Licence.** No B2B licence; system certification (scheme 2.1).
- **Crash games allowed.**
- **Rko rules:** 3.4 not misleading, 3.5 amounts in €, 3.7–3.8 action per round, 3.29 ISO 17025/17065 labs.

## Sweden (Spelinspektionen). verified 2026-09-15, M
- **Licence.** Mandatory gaming software permit, including when supplying through a third party. Suppliers get fined for serving unlicensed operators (Spribe).
- **Crash games allowed.**

## Denmark (Spillemyndigheden). verified 2026-09-16, H/M
- **Supplier licence already mandatory** (since 1 Jan 2025): covers betting, online casino and combination games, up to 5 years, accredited certification before grant; 2026 fees DKK 67,600 application and DKK 45,100 a year. H.
- **Bill L 127** (Spilpakke 1, tabled 25 Feb 2026) amends s 18(5) so combination games need an **individual pre-launch approval per game**. Crash is not among the named game types (roulette, baccarat, punto banco, blackjack, poker, slots, plus proposed dice and wheel of fortune), so Whack Crash would need an individual authorisation as a "variation" (M). Passage unconfirmed. verified 2026-09-16.
- **Licence.** Supplier licence since 1 Jan 2025 (§24a): DKK 67,600 to apply, DKK 45,100/yr. Company must be EU/EEA-based or appoint a representative (§32a).
- **Crash game status unclear** (§18 game types; bill L 127).

## Italy (ADM). verified 2026-09-15, H
- **Licence.** No B2B licence; ADM certificate per game (source code, RNG, maths). RNG must sit outside the game application.
- **Hosting.** All infrastructure in the EEA, on an AGID/ACN-qualified cloud.
- **Crash games allowed** (Aviator certified); under political scrutiny (M/L).

## Brazil (SPA/MF). verified 2026-09-16, H/M
- **Item 14(d) is an exhaustive list of round endings** (manual redemption above the minimum, auto-redemption at the player's target, auto-redemption at the game maximum, or the multiplier ceasing to increase), on a multiplier that "aumenta gradualmente". **A falling multiplier fits none of them**, so an x0.5 setback is a certification blocker in Brazil on primary text, not only by analogy with Portugal. An upward x1.05 boost is an increase and is not caught (M). Item 14(b) also requires pre-round disclosure of increase frequency, maximum multiplier, **minimum redemption multiplier** and the auto-cashout feature. verified 2026-09-16, H.
- **Licence.** No studio licence; per-game certification by recognised labs. GLI, eCOGRA, BMM Spain, BMM NA, GA Europe, Quinel and RiskCherry are recognised; iTech is not; Trisigma reportedly revoked. Operators can reuse the developer's certificates (1.207 Art. 7).
- **Crash games allowed.** Annex I item 14:
  - random, not skill;
  - rules must give growth speed, max multiplier, minimum cash-out and auto cash-out;
  - rising multiplier shown;
  - only listed round endings (14 d); multiple independent bets need per-bet stake and prize display plus the total (item 12, H, verified 2026-09-15);
  - taps register accurately.
- **Other Portaria 1.207 rules.** RTP ≥85% shown in-game (items 28–29). Rules shown before betting (Art. 11). Autoplay limits (Art. 40). Data kept 5 years (Art. 10).
- **Hosting.** Brazil or a legal-cooperation-treaty country, ISO 27001 data centre (722/2024).
- **Advertising.** 1.231/2024 art. 12: XV no one who appears under 18, XVIII no elements particularly appealing to minors, XIV(e) no suggestion of skill. Amended by Portaria 1.964/2026 (warnings, M). verified 2026-09-15, H.
- **Planned design portaria:** see watch list.

## Ontario (AGCO / iGO). verified 2026-09-15, H
- **Licence.** Gaming-related supplier registration: C$15k/yr (Manufacturer) or C$3k/yr (Other). Lab certification or Registrar approval (4.08).
- **Crash games allowed** (Aviator).
- **Registrar's Standards:**
  - 2.15 not misleading / no perception of skill or speed;
  - 2.16 no autoplay (slots), prevent impulsive play;
  - 2.18 2.5 s cycle;
  - 2.19 no turbo;
  - 2.20 no win effects at or below stake;
  - 2.21 net position;
  - 2.22 time;
  - 2.03 no cartoon marketing appealing to minors;
  - 4.05/4.06 rules and house edge;
  - 4.21 interruptions (M);
  - 5.49–5.60 change management.

## United States. verified 2026-09-15, H/M
- **Licensing** is state by state. **NJ:** casino service industry enterprise licence; primary gaming equipment in Atlantic City (13:69O-1.2); IGT Take-Off! crash approved (2,500× cap). **MI:** supplier licence ($2.5k to apply), GLI-19 v3.0. **PA:** supplier licence.
- **Crash status:** unclear in PA and MI.

## Latin America. verified 2026-09-15, M/L
- **Colombia:** crash games allowed (Coljuegos Acuerdo 01, 7 May 2026); lab certificate.
- **Peru:** automatic provider registration; per-game homologation (9 labs); crash games likely allowed.
- **Mexico:** through permit holders; IEPS tax 50% from 2026; supplier regime unclear.
- **Argentina:** by province (LOTBA, IPLyC).

## Kenya (GRA, Gambling Control Act 2025). verified 2026-09-16, H
- **Data localisation (hard blocker for our hosting).** Conduct of Gambling Operations Regulations 2026 reg 42(2): player data must be stored and processed on servers **located in Kenya** unless the Authority grants written exemption. reg 41(d) real-time monitoring API; reg 44 central monitoring system and national self-exclusion register. verified 2026-09-16, H.
- **Supplier licence.** Licensing Regulations 2026 reg 15 (Form 12), Second Schedule: KES 50,000 application, KES 500,000 annual, KES 5,000 per additional game; 1-year term. reg 45: RNG certified by the Authority or its agent, game rules certified annually, RTP publicly disclosed. verified 2026-09-16, H.
- **Reg 95(1)(d)** bars "cartoons, toys, child-oriented images, or language likely to attract minors" - the Candy skin and mole character are directly exposed. verified 2026-09-16, H.
- **Licence.** Supplier/software licence required (fee not verified).
- **Crash games restricted:** BCLB audit directive (Mar 2025); no standalone crash apps.
- **Regulations 2026:**
  - Reg 41: real-time API and audit logs.
  - Reg 42: player data on Kenyan servers.
  - Reg 44: central monitoring and self-exclusion register.
  - Reg 45: rules before betting; RTP/RNG certified.
  - Reg 47: annual audit.
  - Reg 95: no cartoons or child imagery.
- **Tax.** 5% excise on deposits, 5% withholding on withdrawals, 15% GGR.

## Other Africa. verified 2026-09-15, M/L
- **Nigeria, Ghana:** see their own sections below (verified 2026-09-16).
- **Uganda:** NLGRB gambling software licence.
- **Tanzania:** unclear.
- **South Africa:** online casino prohibited.

## Nigeria (state-regulated). verified 2026-09-16, H/M
- **Structure.** Supreme Court *AG Lagos v AG Federation* (22 Nov 2024): the National Lottery Act applies only in the FCT; states regulate elsewhere (M). FCT Lottery Regulatory Office since May 2025 (M). The Central Gaming Bill was passed by the National Assembly but assent refused, Dec 2025 (M). FSGRN (state regulators' forum): 11% GGR contribution, reciprocity certificate from 1 Jan 2026 (L/M, no primary text).
- **Lagos law.** Lagos State Lotteries and Gaming Authority Law No. 7 of 2021 (Gazette Extraordinary No. 14 Vol. 54):
  - s.1 "horse racing" excludes virtual horse racing;
  - s.33 licence categories (incl. remote gaming);
  - s.59 only software approved and registered by the Authority or a certified institution (5 years);
  - s.81(f) player tools, rules, history, "anticipated pay-outs";
  - s.85 unlicensed activity.
  - Casino & Gaming Regs reg.18: testing by the designated lab at the applicant's cost.
  - **Responsible Gaming Regulations 2021** (a schedule; reg.7 is headed "Advertising Regulations", items run **7(1)(a)–(u)** with one letter doubled in the gazette's own layout — cite by wording where the letter is load-bearing). reg.3 is 18+. reg.7(1) binds "any advertisement or promotional materials… to the public", **not in-game art**: (d) "likely to appeal to underage or vulnerable persons, **especially by reflecting or being associated with youth culture**" — a "likely to appeal" test with no intent requirement; (f) nothing untruthful about "the chances of winning or the expected return"; (i) no suggestion skill influences a game of chance; **(k) must not imply gaming "promotes or is required for social acceptance, personal or financial success"**; (l) no celebrity endorsement suggesting gaming contributed to their success; **(p) must not suggest gaming "can enhance personal qualities"**; (r) toughness/recklessness; (u) cultural beliefs about luck. reg.7(3) 18+ warning; reg.7(4) RG symbol ≥10% of TV advert duration. **reg.7(2) lets a licensee ask the Authority for advice or consent before publishing** — the cheap route to a documented position on a contested theme. "Vulnerable person" includes "a person easily physically or emotionally influenced", not age-bounded. Penalty reg.8: ₦1m → ₦5m + suspension → ₦10m + revocation. **No LSLGA guidance interpreting "youth culture" exists** (verified 2026-09-16, H text / no interpretation found).
- **Suppliers.** A B2B "software/gaming service provider" licence is needed (L/M). Lagos High Court 2026 rulings apply LSLGA to remote operators taking Lagos wagers (H, LSLGA notice 25 Jul 2026).
- **Certification.** LSLGA mandatory homologation from 20 Jul 2026 (6 months): census, source code and RNG submission, Certificate of Homologation; uncertified systems disconnected (H). Global Lab reported as the accredited lab (L/M).
- **Crash games.** Not named in Lagos law; offered under Online Casino by licensees; no regulator statement found (L).
- **Ads (ARCON).** ARCON Act 2022 **s.54** catches "any person **including sponsor or beneficiary**… **which creates or places**" an advert targeting Nigeria without prior Standards Panel approval — **a B2B studio is a named offender, not just the operator** (H). **s.63** defines "advertisement" to include a "display" or "logo" that showcases a product "irrespective of media, medium or platform", so a **lobby tile is caught**; a playable demo is arguable and **not verified**. Vetting Guidelines (eff. 1 Jan 2023): pre-approval before exposure for all categories bar five narrow exclusions; the **Standards Panel meets monthly**; accelerated vetting at 16 h or 8 h for extra fees; Form 001 must be signed by an **ARCON-registered practitioner (ARPA+)** — a foreign studio cannot self-file; approval codes must appear on all materials; models and VO **shall be Nigerian** unless a variation is bought. Fees: online vetting ₦7,500, regular ₦25,000; accelerated +₦70k/₦150k (16 h) or +₦100k/₦280k (8 h); **foreign production +₦2,000,000**; **foreign model variation +₦2,000,000**. Exposure without a certificate: **₦500,000 minimum each against media house, agency and advertiser**. New-media approvals reportedly lapse in ~3 months (M). The **Nigerian Code of Advertising Practice**, which holds the s.54 fine, is **not obtainable from ARCON's site — not verified** (verified 2026-09-16, H unless noted).
- **Game content (NG).** Casino and Gaming Regs 2021 reg.18(3): only games meeting "**technical standards as determined by the Authority**" are approved — those standards are **unpublished**, an undefined power to refuse a game. Online and Retail Gaming Regs 2021 **reg.6**: no licence or renewal without **Authority-approved rules**, and any rule change needs prior approval — a maths or rules change is a regulatory event in Lagos, not just a lab event. LSLGA Law s.62(1)(b): winnings "shall not be worded in such a manner as to mislead"; s.81(f)(ii) rules and "anticipated pay-outs"; s.81(f)(ix) live balance during play; **s.54 "obnoxious advertising"** catch-all, ₦500k **per day** after notice (verified 2026-09-16, H).
- **Data.** NDPA 2023 s.41 cross-border transfer bases (recorded), s.44 registration for major importance (H). GAID 2025 in force 19 Sep 2025 (M). No gaming localisation rule found (M).
- **Tax.** Nigeria Tax Act 2025: stakes VAT-exempt (M); 5% withholding on winnings reported (L/M).
- **North.** 12 Sharia states ban gambling for Muslims; Kano Hisbah raids resumed Nov 2024 (M). Operators must geo-block.

## Ghana (Gaming Commission). verified 2026-09-16, H/M
- **Law.** Gaming Act 2006 (Act 721): s.13 licenses only those who **operate** games of chance; no supplier licence category, and none in the 40+ line 2025 fee schedule (H). **Act 721 contains no online, remote or interactive gaming provisions at all** — "Online Casino" and "Remote Interactive Games" exist only as fee categories in the Fees and Charges (Miscellaneous Provisions) Regs 2025 (H, full text read 2026-09-16). That is the core legal-basis fragility in Ghana. The draft L.I. was completed and submitted for approval and Act amendments were initiated; neither passed as of 2026-09-16 (H, GCG Annual Report 2025 published Jul 2026). Its contents are unpublished (not verified); stated scope is licensing, compliance and responsible gaming.
- **Licensees must be partly or wholly Ghanaian owned** (s.14(1)(g)) — a further reason a foreign studio should not seek its own licence (H).
- **Operators.** Licence and renewal filings need "details of game software system/information on software providers… Certification of software", renewed annually (H, GCG Requirements for Licence 2025). No named lab or technical standard (H/M). Online Casino US$50k licence, $25k renewal, $50k annual fee (H, Fees and Charges Regs 2025).
- **Crash games.** Aviator widely offered by licensees; no GCG statement or action found (L/M).
- **Design.** Under 18 is a child (s.72) (H); GCG self-exclusion scheme (H). No autoplay, speed, RTP or cycle-time rule found (H absence).
- **Ads.** GCG Guidelines on Advertisement (full text read 2026-09-16, H). Guidelines under s.3(2)(g), not an L.I., so the levers are licence renewal and a **US$5,000 "Breach of Guidelines" administrative penalty** (H, 2025 fee regs), not a statutory offence. Two-stage pre-approval (script/sketch, then the finished recording), **no stated decision deadline**, approval lasts the licence year, and revocation if an approved ad is changed without notifying the Commission. The duty sits on the **operator**, not the supplier. No celebrities; no impression of assured wins; no wealthy character (ix); no implication that gaming is required for personal success (x); no endorsement suggesting gambling funded someone's success (xi); no "cartoon characters etc., or the imitation thereof" (Underage ii); **no advertising that appeals "either directly or indirectly" to under-18s (Underage i)** — an open-ended test, and the sharpest risk for any youth-coded theme. Warnings **≥30% of the largest font on billboards and flyers only**; TV and social media use full-duration crawls instead. No prime-time broadcast. No static outdoor ads within 200 m of schools or playgrounds. Whether a lobby tile or in-product demo counts as an "advertisement" is **not verified**.
- **Data.** Act 843 registration with the Data Protection Commission (M). Draft DP Bill 2025: "reasonable efforts to localise", written consent and Authority approval for large transfers (H draft, status L).
- **Tax.** 10% withholding on winnings repealed from 2 Apr 2025 (Act 1129) (M); 20% GGR tax (M).

## Australia. verified 2026-09-15, H
- Online casino games are prohibited under the Interactive Gambling Act. Not a market.
