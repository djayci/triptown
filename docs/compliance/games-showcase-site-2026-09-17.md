# Triptown site: marketing-stage compliance note

**Date:** 17 September 2026
**Subject:** `apps/site`, the Triptown studio site (OpenSpec `games-showcase-site`). It is a public page listing the games and opening their play-money demos behind an 18+ self-declaration.
**Stage:** marketing and concept. This note is not a game audit: the games' own certification findings stay in their reports.
**Sources:** `.claude/skills/game-compliance-audit/references/jurisdictions.md` (entries verified 15–16 Sep 2026, all within 90 days) and `AGENTS.md` rules 6, 9 and 12.
**Status:** research, not legal advice.

## 1. What the site is, in regulatory terms

A public, studio-run page that shows game names, one-line descriptions, a logo tile per game and links to free-to-play demos **is an advertisement** in every market considered:

- **UK.** The CAP under-18 guidance (Oct 2025) treats game tiles as ads, and its §25 enforcement lands on the tile.
- **Nigeria.** ARCON Act 2022 s.63 defines an advert to include a "display" or "logo" that showcases a product, "irrespective of media, medium or platform". A lobby tile is caught, and a playable demo is arguably caught too (not verified).
- **Free play.** `AGENTS.md` rule 9 treats free play as advertising, not just gameplay.
- **Brazil.** 1.231/2024 art. 12 reaches the demos and tiles.
- **Ontario.** AGCO 2.03 covers marketing.

The studio, not only an operator, carries this liability. ARCON s.54 names "any person including sponsor or beneficiary… which creates or places" an advert targeting Nigeria, and the site is created and placed by Triptown.

## 2. Findings

| # | Finding | Rating | Where it lands |
|---|---|---|---|
| F1 | **18+ before any game or demo.** Lagos RG Regs reg.3 (18+), Ghana Act 721 s.72 (under 18 is a child), CAP 16.3.12. The spec requires a server-enforced gate on every file under `/play/`, with a session-only confirmation. It is a self-declaration, not verification. That is proportionate for a B2B page with play money, no account and no wallet, and nothing in the sources requires more for a studio showcase. A forged cookie is an accepted residual risk. Since 17 Sep 2026 (user request) the game names, pitches and logo tiles are visible, greyed out, before the answer; only play is withheld. The tiles are therefore shown to a visitor who has not declared their age, which F5 weighs. | PASS (by design) | spec "No play without the 18+ confirmation"; tasks 3.1–3.4, 6.1, 6.2 |
| F2 | **Nigeria: ARCON pre-approval.** Any advert "targeting Nigeria" needs Standards Panel approval before exposure. Form 001 must be signed by an ARCON-registered practitioner, and the minimum penalty is ₦500,000 each against advertiser, agency and media. The site shows Gate Rush, whose demo runs the `ng-draft` profile, so a Nigerian audience is plausible. **Fix:** the site must not be placed or promoted to a Nigerian audience until an ARCON vetting route is chosen. Until then it stays unindexed and shared by direct link to operators and partners only. | GAP → fixed in build | task 5.1: `X-Robots-Tag: noindex, nofollow` on **every** route for now, not only `/play/` |
| F3 | **Lagos advertising content (RG Regs reg.7(1)).** No untruthful statement about "the chances of winning or the expected return" (f), no skill suggestion (i), no implied personal or financial success (k), no "enhance personal qualities" (p), and an 18+ warning (reg.7(3)). The Gate Rush pitch mentions "the live chance", which is truthful: it is the engine's exact RTP ÷ value. The copy check must also ban success and wealth language. | GAP → fixed in build | task 5.2: banned-wording categories gain success/wealth terms ("rich", "fortune", "life-changing", "success"); the footer carries "18+" |
| F4 | **No RTP, max-win or multiplier claims on the site.** A flat "97%" would misstate the band a market sells (AGENTS rule 10), and "up to xN" is a win promise. The rules screen inside each game carries the measured figures. | PASS (by design) | spec "No promotional gambling claims"; task 5.2 |
| F5 | **Minors appeal of the games shown.** On 17 Sep 2026 the user decided the site shows each game as built, not on its adult skin: "I don't want the adult skin or even regulated UK in here, I want the game as I have it." The Play links therefore open the Candy looks: Whack Crash has brightly coloured moles with blush, buck teeth and a crown on a yellow sunburst; Gate Rush has a bright green paddock with a pink gate. The same day the tiles changed from screenshots to logo stickers in each game's candy style (bubbly lettering, pink sticker, sunburst). They show no characters, which lowers the tile's exposure, but the arcade styling remains a CAP "animated style" factor. The CAP under-18 guidance (Oct 2025) lists cute animals, animated styles and video-game looks as high-risk and treats tiles as ads. The ASA Videoslots ruling (1 Jul 2026) upheld complaints over cartoon animals. Kenya reg.95(1)(d) and Ghana's cartoon ban point the same way. Lagos RG reg.7(1)(d) catches ads "likely to appeal to underage persons". `AGENTS.md` rules 6 and 12 bar this in marketing. The site's own design (Black Glass) is adult; the risk is in the game art it displays. Even the earlier adult skin still showed cute moles. **This is the site's highest risk.** | RISK (accepted by the user for B2B sharing; blocker for public placement) | see §3 |
| F6 | **Whack Crash: skill-coded intro copy.** The demo's idle screen reads "Whack the golden mole before it dives." That is a timing and reflex framing (AGCO 2.15, RTS 7C, Lagos reg.7(1)(i), AGENTS rule 5), and a site linking to it repeats the exposure. The site's own pitch ("the dive comes without warning") is fine. | GAP (in the game) | Whack change, out of scope here |
| F7 | **Gate Rush jockey.** The rider reads as an adult in work gear, and the horse is drawn with realistic proportions. The minors-appeal exposure is the palette and outline style (F5), not the characters. | PASS for characters; palette under F5 | task 5.3 preview |
| F8 | **Brand and attribution.** "Proudly powered by Triptych" names the parent. It is not an endorsement and implies no success or wealth (reg.7(1)(k)/(l)). | PASS | spec "Triptych attribution" |
| F9 | **Ghana.** The GCG advertising guidelines bind operators, not suppliers, and whether a tile counts as an advert is not verified. The pending Advertising Council Bill could reach a studio directly (watch list). Nothing on the site conflicts with the guidelines' content rules (no cartoons, subject to F5; no assured wins; no wealthy characters). | WATCH | re-check before any Ghana-facing promotion |
| F10 | **Demo builds carry the mock service.** That is correct: the site serves `dist-demo`, the production bundles are untouched, and `check-no-mock.mjs` still guards them (AGENTS rule 7). | PASS | tasks 5.1, 6.4 |

## 3. Decision on the games' look (updated 17 Sep 2026)

The first version put every game on its adult skin, and a build check enforced it. The user reversed that: the site shows the games as built, in their Candy looks. It is the user's product decision, and it is recorded here with its consequence:

- **While the site is unindexed and shared by direct link with operators and partners behind the 18+ gate (F1, F2)**, the exposure is a B2B audience of adults. The residual risk is that a regulator treats the site as an advert regardless.
- **Before any public placement, promotion, ARCON submission, or removing noindex**, F5 must be resolved: either the site shows each game's adult presentation, or the games' own art is changed. Until then, those steps would place Candy art in front of the public in an advert, which rules 6 and 12 bar.

## 4. Fixes folded into the change

- **F2:** noindex on all routes until an ARCON route is chosen (task 5.1).
- **F3:** success and wealth terms added to the banned wording; "18+" shown in the footer (tasks 4.3, 5.2).
- **F5:** user decision recorded (§3); the site stays unindexed and B2B, and `AGENTS.md` states that public placement is blocked until F5 is resolved.
- **F6:** a Whack Crash copy issue, raised against the game, not the site.
