# Whack Crash compliance audit, 15 Sep 2026

**Status:** research findings, not legal advice. Have a gaming lawyer and your chosen test lab confirm everything before you submit.
**Scope:** build `whack-crash-mvp` (37/40 tasks) against lab standards (GLI-19 v3.0), the UK, the EU and offshore licensing hubs, the Americas, and Africa.
**Method:** five research tracks read primary texts where they could: GLI-19 v3.0, the UKGC RTS, AGCO Registrar's Standards, Brazil Portaria 1.207/2024 Annex I, Portugal Reg. 308/2023, the MGA Directives, the Italian ADM technical rules, the Danish Gaming Act, the Dutch Rko, and the Kenyan GRA Regulations 2026. Each claim has a confidence level: **H** = primary text read, **M** = regulator page or several reliable secondary sources, **L** = thin sources.

---

## 1. Verdict

**The game cannot be certified in its current form in any regulated market.** The core idea (a crash game you cash out by whacking) is allowed in most regulated markets. What fails are the product details. The fixes come in three kinds:

1. **Changes needed in every market:** no win effects on losses, a rules screen, a minimum time between rounds, a less child-like look, round history, and player-protection hooks.
2. **One change to the maths:** a falling multiplier (the x0.5 bad mole that can drop below x1.00) is illegal in Portugal. It conflicts with Brazil's crash rules, and elsewhere it risks being ruled "misleading" or a loss disguised as a win.
3. **Platform and operations work for certification:** RNG certification, self-checks on software integrity, audit logs, change control, hosting in the right region, and licences.

## 2. Critical fixes, ranked

| # | Fix | Why (sources) | Applies to |
|---|---|---|---|
| 1 | **No celebration when the return is at or below the stake.** No confetti, "BONK!" or win sound, and no "+payout" label. Show "Returned X · Net −Y" | UKGC RTS 14F (all casino games since 17 Jan 2025) **H**; AGCO 2.20 **H**; Brazil planned portaria **M**; Dixon et al. 2010 LDW research | Everywhere |
| 2 | **Minimum time between round starts, enforced by the server** (5 s UK/DE/BR planned, 2.5 s ON, 3 s ES). The player must release and press again. Replace one-tap "BET AGAIN" with a deliberate BET press. Time it with automated tests | RTS 14G **H**; AGCO 2.18 **H**; Brazil planned 5 s **M**; GlüStV §22a **H**. Stakelogic fined £122,835 (Jun 2026) after testing speed with a stopwatch | Everywhere (configurable) |
| 3 | **Rules/help screen available before betting.** It must cover the growth rate, setbacks, sub-x1.00 returns, 3% instant bust, RTP 97% for any strategy, max win, the 60 s cap, auto cash-out, rounding down, server-time/latency policy, disconnect policy, provably-fair steps, and a line saying the outcome is fixed and tapping does nothing | GLI-19 §4.4.1(a,b,g,r), §4.5.2(f), §4.6.1(a) **H**; RTS 3, 4 **H**; MGA PPD art. 7 **H**; Brazil Art. 11, item 14(b) **H**; Kenya Reg 45 **H** | Everywhere |
| 4 | **Remove the falling multiplier (sub-x1.00 halving).** Make growth only go up, or keep setbacks with a floor, then rerun the RTP proof | Portugal Reg. 308/2023 R1/R22 **H**; Brazil Annex I item 14 **H**; misleading-design rules (AGCO 2.15, RTS 7C, NL Rko 3.4) | PT, BR; risk everywhere |
| 5 | **Less child-like art.** Adult proportions, a less candy-like palette, no mascot or storybook cues. Keep an alternative "adult" art set, and treat lobby tiles and demos as advertising | Portugal R7c (in-game ban) **H**; CAP 16.3.12 and the Play'n GO ASA ruling (Jul 2025) **H**; AGCO 2.03 **H/M**; Brazil 1.231/2024 **M**; Kenya Reg 95 **H**; Spain RD 958/2020 **M** | Everywhere (marketing), PT (game itself) |
| 6 | **Session clock, net position and reality-check pause** (between rounds only), plus an operator responsible-gambling bridge with a pinned origin | RTS 2E, 13A–C **H**; AGCO 2.21–2.22 **H**; MGA PPD 18A **H**; Portugal R38–40 **H** | UK, ON, MT, PT (build once) |
| 7 | **Per-round history/replay:** date and time, stake, balance before and after, outcome, player choices, crash point, setbacks. Plus an operator API and a CSV export | GLI-19 §4.14, §2.8 **H**; Portugal R37 **H**; Brazil items 54–55 **H** | Everywhere |
| 8 | **Latency and disconnect policy:** disclose it, record client tap timestamps and round-trip time as evidence, and define a refund/void rule for system failures. Portugal settles at the multiplier on screen when the connection dropped | GLI-19 §4.5.2(f), §4.16, A.6.4 **H**; RTS 4, 10 **H**; AGCO 4.21 **M**; Portugal R41–43 **H** | Everywhere; PT differs |
| 9 | **Remove skill framing.** Decoy moles do nothing when tapped, rename FRENZY, no "whack before it dives" copy, no skill claims in marketing | AGCO 2.15 **H**; GLI-19 §4.6.1(a) **H**; RTS 7C **H**; Brazil planned portaria **M** | Everywhere |
| 10 | **RNG and platform hardening:** use platform crypto on the server, rotate seeds automatically, encrypt stored seeds, use deterministic maths for settlement, a single time source, append-only audit logs, 24-hour software hash self-checks, separate preview and production, and change control | GLI-19 §2.2, §2.3.2–2.3.3, §3.3.2(c), B.2.6, B.6, B.8, C.2–C.3 **H**; AGCO 5.49–5.60 **H** | Certification anywhere |

## 3. What already passes

- **RNG design:** CSPRNG seeding, HMAC-SHA256, a 52-bit mapping with no modulo bias, and outcomes fixed before the round (GLI-19 §3.2.3, §3.3.2(a,b), §4.5.2) **H**.
- **RTP 97% for every strategy** is above every minimum found: GLI 75%, MGA 85%, Brazil 85%, Portugal 80%. The strategy-independent proof settles the UK RTS 3C question about skill-affected RTP **H**.
- **Top award odds:** hitting the 10,000× cap is at most about 9.7e-5 per round, well inside GLI §4.7.3 **H**.
- **Crash cash-out is not "turbo" in the UK.** The Commission said so explicitly: RTS 14E "does not capture crash games" **H**.
- **Auto cash-out is not autoplay,** because it ends a bet and never places one (RTS 8, GLI §4.9.2) **H/M**. Never add auto-rebet.
- **One game at a time** (RTS 14C). Lock it per player, not per session.
- **Not a skill game in law:** under UK Gambling Act s6(2) it is a game of chance and a casino game **H**. The risk is marketing it as skill, not its legal classification.
- **Server-authoritative, no-grace cash-out** is defensible, but it must be disclosed (see fix #8).

## 4. Licensing: what the studio itself needs

| Market | Supplier licence | Crash games | Key design limits | Hosting | Conf. |
|---|---|---|---|---|---|
| **UK** | Remote gambling **software** licence (s41) **plus** remote casino **game host** licence if you run the game server. Spribe was suspended (Oct 2025 to Mar 2026) for hosting without one | Allowed | RTS 14F/14G (5 s), 2E, 13C, 3, 4, 8, 10; CAP 16.3.12 | Test house report uploaded before release; annual audit | H |
| **Malta (MGA)** | B2B Critical Gaming Supply licence: €5k to apply, about €25–35k/yr, 4–6 months | Allowed (Type 1) | RTP ≥85%, rules one click away, balance display and reality check (PPD 18A) | Malta/EU/EEA (others case by case) plus live mirror | H |
| **Curaçao (CGA)** | Foreign suppliers **register** (deadline 24 Dec 2026); local B2B licence €24.5k/yr | Allowed | Lab RNG certificate expected | None found | M |
| **Isle of Man / Gibraltar** | IoM optional (£35k/yr); Gibraltar tiered, content approval needed | Allowed | Accredited testing | – | M/L |
| **Portugal (SRIJ)** | None; certified through the operator | **Restricted** (Reg. 308/2023) | Multiplier only goes up from 1.00, **max 100×**, **two-axis graph**, min cash-out 1.01–1.25, max bet ≤100× min bet, no child-appeal imagery, no autoplay (repeat-stake allowed), Portuguese language, prompt after 3 min idle, session summary, settle at the multiplier shown on disconnect | Not verified | H |
| **Spain (DGOJ)** | None; approved inside operator homologation | Allowed in practice; category unclear | RD 958/2020 minors rules (advertising), 3 s slot rule may be applied | Internal control system (SCI) data in EU | M |
| **Germany (GGL)** | Per-game approval | **Not licensable** in crash form | 5 s average, €1 stake (€3/5 pilot), no autoplay | – | M |
| **Netherlands (KSA)** | None; system certification | Allowed | Rko 3.4 not misleading, 3.5 amounts in €, 3.7–3.8 one action per round | – | M/H |
| **Sweden** | **Gaming software permit** (mandatory, including when supplying through a third party) | Allowed | – | – | M |
| **Denmark** | **Supplier licence** (DKK 67.6k to apply, 45.1k/yr) | **Unclear** (bill L 127 pending) | Per-game approval proposed | – | M |
| **Italy (ADM)** | None; ADM certificate per game | Allowed; under scrutiny | RNG separate from game, source code review | **EEA plus AGID/ACN-qualified cloud** (Vercel unlikely to qualify) | H |
| **Brazil (SPA/MF)** | None for studios; each game certified by an SPA-recognised lab (GLI, eCOGRA, BMM, GA Europe, Quinel, RiskCherry; **iTech not listed**) | Allowed; **5 s rule pending** | Annex I item 14: multiplier shown rising, listed round endings only (the 60 s forced cash-out isn't one), RTP ≥85% shown in-game; planned ban on turbo, autoplay, loss celebrations and skill suggestions; 180-day recertification | Brazil or legal-cooperation-treaty country, ISO 27001 data centre; data kept 5 yrs | H/M |
| **Ontario (AGCO)** | Gaming-related supplier registration: C$3k (Other) to C$15k (Manufacturer) a year | Allowed (Aviator, GLI certificate) | 2.15 not misleading/no skill perception, 2.18 2.5 s, 2.19, 2.20, 2.21 net position, 2.22 time, 2.03 no cartoon marketing | – | H |
| **US (NJ/PA/MI)** | State supplier licences with long investigations | NJ allowed (IGT Take-Off!, capped 2,500×); PA/MI unclear | GLI-19 | **Equipment in-state (NJ: Atlantic City)** | H/M |
| **Colombia** | Through Coljuegos concession holders | **Allowed** (Acuerdo 01/2026 explicitly covers crash games) | Lab certificate | – | M |
| **Peru** | Automatic provider registration; per-game homologation (9 labs) | Likely allowed | – | – | M |
| **Kenya (GRA)** | GRA software/supplier licence (fee not verified) | **Restricted:** 2025 crash-game audit, no standalone apps | Rules shown before betting, RTP/RNG certified, real-time GRA API, self-exclusion register, no cartoons (Reg 95) | **Player data in Kenya** (Reg 42) | H/M |
| **Nigeria (Lagos)** | State licence | Allowed in practice | GLI-33 reported | – | M/L |
| **Uganda** | NLGRB software licence | Allowed | Software certification, clearances for owners and directors | – | M |
| **South Africa** | – | **Online casino prohibited** | – | – | M/H |
| **Australia** | – | **Online casino prohibited** (IGA) | – | – | H |

## 5. Recommended path

1. **Build a "regulated core" version first.** Implement fixes #1–#10, and make these configurable per market in a jurisdiction profile:
   - `minCycleMs`, `quickReplay`
   - `maxMultiplier`, `minCashout`, `setbacksMode`
   - `showSessionClock`, `showNetPosition`, `showRtpInGame`
   - `skin`, `soundDefault`, `intensityEffects`
   - `disconnectPolicy`, `graphAxes`, `language`, `idlePromptMs`, `hostingRegion`
2. **Certify once with a lab recognised in the most markets.** GLI or BMM are accepted by Brazil, Ontario, the MGA, Italy's ADM and US states. Use GLI-19 as the base, with the math/PAR report (100M+ rounds plus a closed-form proof), RNG stream test output, and source code review.
3. **Go to market through an aggregator or licensed RGS host** to reach MGA and Curaçao operators quickly. It carries the platform audit and hosting. This does **not** replace the supplier permits Sweden and Denmark require, or the UK host licence if you run the game server yourself.
4. **First markets:** Colombia and Peru (light entry), then Brazil (biggest crash market; wait for the design portaria so you certify once), Ontario (same certificate, clear rules), and Portugal (a separate variant: only-increasing multiplier, 100× cap, axis graph).
5. **Later:** MGA licence once revenue covers about €30k/yr, UK (software plus host licences), Kenya (in-country hosting, GRA API), US (state-by-state, in-state servers). **Skip:** Germany, South Africa, Australia. **Hold:** Denmark.

## 6. Code evidence (as of this audit)

- A below-stake cash-out is celebrated: `packages/core/src/round.ts` (no floor on manual cash-out) → `apps/whack/src/game/view.ts` `showWin` (confetti, BONK, `+payout`) → `controller.ts` `resolve` plays `win`.
- No cycle-time setting: `packages/fairness/src/config.ts` has no `minCycleMs`. Replay guard is 700 ms: `controller.ts` `RESULT_INPUT_GUARD_MS`.
- Decoys are interactive and speed up: `view.ts` (decoy `pointertap`, `update()` decoy timer).
- No rules/help, clock or net position: `apps/whack/src/dom/` contains only `fairness-panel.ts` and `sound-panel.ts`.
- The operator bridge posts balance to `'*'`: `controller.ts` `renderBalance`.
- The server seed rotates only when the player asks: `packages/core/src/host.ts` `rotateSeed`.
- Hand-written SHA/HMAC: `packages/fairness/src/sha256.ts`. Float maths in settlement: `packages/fairness/src/model.ts` (`Math.exp`/`Math.log`).
- One active-round lock per session: `RoundStore.claimActiveRound`.
- Hosting is Vercel plus Upstash with no region pinned (`apps/api/scripts/build.mjs`).

## 7. Not verified. Confirm with counsel or the lab

- Whether UK RTS 14G (5 s) applies to crash games. The research reads it as applying; confirm with the Commission or the lab.
- Whether Brazil's design portaria (5 s, no turbo or autoplay) has been published, and its final wording.
- Portugal's server-location rules. The MGA's exact company-establishment requirement. Curaçao's technical standard.
- Fees for Kenyan software suppliers and Pennsylvania suppliers. Tanzania's supplier category. Ghana's supplier regime.
- AGCO 2.03, 4.06 and 4.21, which were checked against extracts rather than the verbatim text.
- Whether a player-editable client seed as an outcome input is acceptable under GLI-19 §4.5.2 (ask the lab early).
- Whether a GLI-19 v4 is coming (v3.0 is dated July 2020).

## 8. Key sources

- GLI-19 v3.0: https://gaminglabs.com/wp-content/uploads/2024/06/GLI-19-Interactive-Gaming-Systems-v3.0.pdf
- UKGC RTS 14: https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-14-responsible-product-design
- UKGC crash-game carve-out: https://www.gamblingcommission.gov.uk/consultation-response/summer-2023-consultation-proposed-changes-to-lccp-and-rts-consultation/proposal-1-player-led-spin-stop-features
- UKGC game host licence: https://www.gamblingcommission.gov.uk/licensees-and-businesses/licences-and-fees/remote-casino-game-host-operating-licence
- Spribe suspension: https://igamingbusiness.com/legal-compliance/gambling-commission-suspends-spribe-licence/
- ASA gambling appeal to children: https://www.asa.org.uk/advice-online/betting-and-gaming-appeal-to-children.html
- AGCO Registrar's Standards: https://www.agco.ca/en/book/export/html/245361
- Portugal Reg. 308/2023: https://www.srij.turismodeportugal.pt/sites/default/files/2023-03/Regulamento_n_308_2023_Saque_ou_Crash.pdf
- MGA Directive 3/2018: https://www.mga.org.mt/app/uploads/Directive-3-of-2018-Gaming-Authorisations-and-Compliance-Directive.pdf
- MGA Player Protection Directive: https://www.mga.org.mt/app/uploads/Directive-2-of-2018-Player-Protection-Directive.pdf
- Italy ADM Regole Tecniche: https://www.adm.gov.it/portale/documents/20182/206822607/3.+Regole+Tecniche.pdf/b5e33b6b-ee92-b4dc-b9fa-0cfc53ac5f26?t=1734525043377
- Brazil Portaria 1.207/2024: https://www.legisweb.com.br/legislacao/?id=462643
- Brazil recognised labs: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/autorizacao-para-apostas-de-quota-fixa/entidades-certificadoras
- Kenya GRA Regulations 2026: https://gra.go.ke/wp-content/uploads/2026/03/18.03.26-GRA-THE-GAMBLING-CONTROL-CONDUCT-OF-GAMBLING-OPERATIONS-REGULATIONS-2026.pdf
- Colombia Acuerdo 01/2026: https://www.soloazar.com/es/categoria/legislacion/coljuegos-actualiza-la-regulacion-de-juegos-instantaneos-y-habilita-nuevas-mecanicas-online
- Sweden software permit: https://www.spelinspektionen.se/licens-o-tillstand/sok-licens/tillstand-for-spelprogramvara/vagledning-tillstand-for-spelprogramvara/
- Germany GlüStV §22a: https://lxgesetze.de/gl%C3%BCstv-2021/22a
