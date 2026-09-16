# Compliance checklist

Mark each item **PASS / GAP / RISK / UNKNOWN / N/A**, with evidence (`file:line` or a command output), the source, and the fix.
Sources were last checked 2026-09-15. See `jurisdictions.md` for scope and dates.

## A. Math and RTP
- **A1 RTP minimum.** Theoretical RTP must be at least the strictest target minimum: GLI 75% (§4.7.1), Portugal 80% (Reg 308 R20), MGA 85% (PPD art. 22), Brazil 85% (1.207 item 28).
- **A2 RTP is proven.** You need a closed-form derivation plus a simulation with confidence intervals, 100M+ rounds for submission. Any rounding, caps, instant busts or modifiers must be included. For games where timing matters, show RTP for each strategy, or prove it doesn't depend on strategy (UK RTS 3C).
- **A3 Top award odds.** The chance of the max award must be better than 1 in 100M (GLI §4.7.3).
- **A4 Max win / max multiplier.** Must be disclosed and configurable. Portugal caps crash games at **100×** (R17). NJ precedent is 2,500×.
- **A5 Multiplier direction.** For crash games the multiplier must only increase from 1.00 in Portugal (R1/R22). Brazil expects a rising multiplier (item 14c). A falling value or a return below stake is high-risk anywhere.
- **A6 Minimum cash-out.** Portugal requires a configurable minimum of 1.01–1.25 (R19). Brazil's rules must state it (item 14b).
- **A7 Round endings.** Only these endings are allowed: manual cash-out, auto cash-out at the target, cap, or crash (Brazil item 14d). Time caps and forced cash-outs need lab sign-off.
- **A8 PAR/math report.** Rules, formulas, volatility, cap probability, RNG streams used. Version the report: any RTP change is a new game (GLI A.6.1; UK Annex A major update).

## B. RNG and outcome integrity
- **B1 CSPRNG.** Use a cryptographically strong generator, with seeds not derived from time (GLI §3.3.2a–b; UK RTS 7A).
- **B2 Seed refresh.** Refresh state or seeds periodically with external entropy, not only when the player asks (GLI §3.3.2c). Auto-rotate every N rounds or T minutes.
- **B3 Unbiased mapping.** No modulo bias. Document every mapping (GLI §3.2.3).
- **B4 Statistical testing.** Output 100M+ mapped values per stream and run test batteries (chi-square, runs, serial correlation; NIST SP 800-22 Rev1a, Dieharder, TestU01) at 99% confidence (GLI §3.2.2).
- **B5 Platform crypto.** Use `node:crypto`/WebCrypto on the server. Hand-written hash code draws extra scrutiny (GLI §3.2.1). Keep custom implementations for client verifiers only.
- **B6 Deterministic arithmetic.** Settlement-critical maths must not depend on engine float behaviour (`Math.exp`/`log` are not guaranteed identical across engines). Use fixed-point or a deterministic library, or prove tolerance.
- **B7 Outcome fixed and independent.** Outcome comes only from approved RNG values. Player actions and the channel cannot change it (GLI §4.5.2; UK RTS 7B). A player-editable client seed as an input needs lab sign-off.
- **B8 Pre-drawn outcomes protected.** Stored seeds and future outcomes are encrypted, access-controlled and access-logged (GLI §4.4.4a by analogy).
- **B9 No compensation.** Results never adjust to past payouts (UK RTS 7B).
- **B10 Provably fair is extra, not a replacement.** The underlying RNG still needs certification (UK RTS 7A, AGCO 4.26–4.27).

## C. Settlement, timing and disconnects
- **C1 Single time authority.** One synchronised clock (e.g. Redis TIME), with drift logged (GLI §2.2).
- **C2 Latency disclosure.** Where speed affects decisions, tell players and document a risk assessment (GLI §4.5.2f; UK RTS 4A/4B). Log client tap time and round-trip time as evidence.
- **C3 Disconnect policy.** Must be fair, published and restore state (GLI §4.16; UK RTS 10A/10C). Portugal settles at the multiplier displayed at disconnection (R41–43). AGCO 4.21: better of win or refund on system failure (M).
- **C4 System failure.** Void and refund rules, logged (GLI A.6.4).
- **C5 Idempotent settlement.** No double credit. Debit before the round starts.
- **C6 One game at a time per player,** not just per session (GLI §4.3.3e; UK RTS 14C). No dual-bet panels.
- **C7 Kill switch.** Disable a game, version or player on demand, and finish rounds already in play (GLI §2.4.1, §4.15.1).

## D. Game design and player protection
- **D1 No celebration at or below stake.** Returns at or below the stake get no win effects, sounds or "+" labels. Show the net result (UK RTS 14F, all casino games; AGCO 2.20; Brazil planned).
- **D2 Minimum game cycle.** Start to next start, enforced by the server, with release-and-press re-arm: UK 5 s (RTS 14G, non-slot casino), Brazil 5 s (planned), Germany 5 s average, Spain 3 s (slots), Ontario 2.5 s (2.18). Verify with automated timing tests.
- **D3 No autoplay.** Each round needs its own action (UK RTS 8; NL Rko 3.7–3.8; Portugal R33, repeat-stake option allowed; Germany). Auto cash-out ends a bet and is OK. Auto-rebet is not.
- **D4 No turbo or slam-stop,** and no skippable result animation (UK RTS 14E; AGCO 2.19). UK crash cash-out is explicitly not turbo.
- **D5 No encouragement to continue.** No "win it back", and exit is as prominent as re-bet (UK RTS 14A; AGCO 2.16).
- **D6 No illusion of skill.** No reflex or skill copy, no interactive decorations that look meaningful, no near-miss or "almost" animations (AGCO 2.15; GLI §4.6.1a; UK RTS 7C; Brazil planned). Don't show "would have reached xN" after a cash-out.
- **D7 Intensity features.** Rising music, shake and speed meters are risk factors. Make them configurable, and off by default in regulated profiles.
- **D8 Net position display** (UK RTS 2E; AGCO 2.21; NL Rko 3.5).
- **D9 Session clock / elapsed time** (UK RTS 13A/13C; AGCO 2.22).
- **D10 Reality check hooks.** Operator-triggered pause between rounds that blocks new bets (UK RTS 13B; MGA PPD 18A; Portugal R38–40 idle prompt and session summary).
- **D11 Operator RG bridge.** Versioned postMessage with a pinned target origin. Inbound: pause, resume, close, limits, message. Outbound: gameReady, roundStarted, roundEnded {bet, payout, net}, balance, error.
- **D12 Stake limits.** Configurable minimum and maximum. Portugal max ≤ 100× min (R15). Germany €1. UK stake limits apply to reel-based slots only (SI 2025/215).
- **D13 Demo mode.** Same rules and maths, or labelled as not representative. Age-gated, since demos are marketing (UK RTS 6A; LCCP 3.2.11 is operator-side).
- **D14 Language.** Rules and UI in the local language (Portugal R35 Portuguese).
- **D15 Game-specific presentation.** Portugal requires a two-axis graph synced to the multiplier (R4) and a view of recent rounds (R37).

## E. Information and transparency
- **E1 Rules/help available without betting.** Complete and not misleading, one click away (GLI §4.4.1a–b; MGA PPD 7; UK RTS 3A; Brazil Art. 11; Kenya Reg 45).
- **E2 Rules content.** Must cover:
  - how the prize changes, including modifiers (GLI §4.4.1g);
  - duration limits and max win (§4.4.1r);
  - RTP and how it was derived (UK RTS 3C; Brazil item 29 in-game);
  - minimum cash-out and auto cash-out (Brazil 14b);
  - disconnect and latency policy;
  - rounding;
  - that the outcome is fixed and tapping or decorations do nothing.
- **E3 Game recall/history.** Date and time, stake, balance before and after, outcome, player choices, marked as a replay. Operator API and CSV export (GLI §4.14, §2.8.1b, §2.8.2–2.8.3). Portugal R37.
- **E4 Version and build ID** visible in the client (GLI §2.6.2).
- **E5 Connection loss.** Block play and show an error. No outcome logic in the client (GLI §2.6.4–2.6.5).
- **E6 Accessibility.** Results must not be conveyed by colour alone (WCAG 1.4.1). Offer a sound-off default option and a reduced-effects toggle.

## F. Art, audio and marketing
- **F1 Appeal to minors.** No cartoon or candy mascots, baby-faced characters or toy motifs. The ban covers the game itself in Portugal (R7c) and Kenya (Reg 95). It covers marketing, lobby tiles and demos under the UK CAP code (16.3.12; ASA Play'n GO ruling, Jul 2025), AGCO 2.03, Brazil 1.231/2024 and Spain RD 958/2020. Offer an adult skin per jurisdiction.
- **F2 Marketing claims.** No skill or "beat the game" claims, no misleading RTP or win claims (CAP; EU Unfair Commercial Practices Directive Art. 6).

## G. Platform, security and operations
- **G1 Software integrity.** SHA-256 (at least 128-bit) hashes of critical components, checked at deploy, at startup, every 24 h and on demand. An independent verification method. Logs kept 90 days, unalterable (GLI §2.3.2–2.3.3, B.2.6).
- **G2 Change control.** Version control, signed tags, approvals, rollback, segregation of duties, production separate from dev/test with no shared data (GLI B.8; AGCO 5.49–5.60; UK Annex A major/minor updates with PML sign-off).
- **G3 Audit logs.** Append-only, tamper-evident: bets, cash-outs, crashes, seed commit/reveal, admin actions (GLI B.6.5, §2.8.8; Kenya Reg 41).
- **G4 Records and metering.** Per-round records (round ID, player, paytable version, state, auto target, crash, cash-out), actual vs theoretical RTP reports (GLI §2.8–2.9). Retention: Brazil 5 years (Art. 10), GLI 1 year of player-visible history.
- **G5 Backup and resilience.** Daily backups, no single point of failure, restore to last known state (GLI B.3).
- **G6 Security certification.** ISO 27001 ISMS audit, cloud provider ISO 27017/27018 (GLI C.2–C.3). The UKGC security audit follows ISO 27001:2022 Annex A.
- **G7 Hosting location.** Malta/EU/EEA (MGA), EEA plus qualified cloud (Italy), Brazil or treaty country with ISO 27001 data centre (Brazil 722/2024), Kenya in-country (GRA Reg 42), NJ in Atlantic City, Spain SCI data in EU. Pin regions per deployment.
- **G8 Regulator integrations.** Real-time monitoring API and self-exclusion register (Kenya Reg 41/44). Annual platform audit (Kenya Reg 47).
- **G9 Data protection.** Lawful basis, retention, processor agreements, international transfers (GDPR; Kenya Data Protection Act registration).

## H. Licensing and certification logistics
- **H1 Supplier licence per market.** UK software licence, plus a game host licence if you run the server (Spribe precedent). MGA B2B Critical Gaming Supply licence. Sweden software permit. Denmark supplier licence. Curaçao foreign supplier registration (by 24 Dec 2026). Ontario registration. US state licences. Kenya GRA. Uganda NLGRB.
- **H2 Lab choice.** Must be recognised in the target markets. Brazil's list includes GLI, eCOGRA, BMM, GA Europe, Quinel and RiskCherry, and excludes iTech. Labs must be ISO 17025 accredited.
- **H3 Submission pack.** Source code, build hashes, PAR report, RNG test data, rules text, UI screenshots per state, a jurisdiction profile per market.
- **H4 Recertification triggers.** Changes to RNG, maths, rules or critical components (UK Annex A; Brazil Art. 5 §4). Brazil's 180-day window when the new design portaria lands.
