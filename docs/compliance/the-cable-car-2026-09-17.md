# The Cable Car compliance audit, 17 Sep 2026

Concept stage. Nigeria and Ghana in depth. Research support, not legal advice; every item marked
for counsel or the lab is named in section 6.

**What this audit is and is not.** The Cable Car is a skin on the certified Whack Crash engine with
one genuinely new thing: the outcome is revealed on the player's collect rather than as it happens.
Sections B (RNG), C (settlement) and G (platform) inherit unchanged from
`whack-crash-2026-09-15.md` and are not re-examined here. The markets are the same two as The Lift
and the jurisdiction notes are carried over from `the-lift-2026-09-17.md` at their recorded dates —
**no market was re-researched for this audit**, which is a limitation, not a clean bill.

Facts about this game are design intent. It does not exist yet.

## 1. Verdict

The theme is a clear improvement on its predecessor and removes rather than mitigates the risks that
shaped it. Nothing is harmed, nothing falls, so the dignity and violence provisions that forced The
Lift's empty car no longer reach this game at all.

The deferred reveal is the whole of the new exposure, and it concentrates in one place: **for as
long as a round runs, the screen shows a value and an amount that may already be unwinnable.** That
is not a defect of the implementation — it is what the mechanic is — and it is legal only because
the live win chance is on screen beside it. Treat that line as part of the mechanic, not as
decoration that can be dropped for space.

## 2. Critical fixes, ranked

| # | Fix | Why (sources, confidence) | Applies to |
|---|---|---|---|
| 1 | **The live win chance is mandatory while a deferred round runs.** RTP ÷ value, floored at 0.1%, never absent | The multiplier keeps climbing past a crash the player cannot see, so the payout shown is an amount that may no longer be obtainable. **AGCO 4.15** requires the value of winnings to be determinable and Ontario forbids displaying amounts that are unachievable (**H**). BR Annex I item 14(c) and PT regra 4 require the value shown to be the real one (**H**) | All, and non-negotiable |
| 2 | **The wait must never be tied to the scenery.** Fixed length from the press; not the arrival at a drawn station, not the distance to one | If the wait ended on arrival, pressing just before a station would be safer than just after for the same payout. RTP would differ by how the player plays — a strategy edge, which breaks the martingale (AGENTS hard rule 2) and is an illusion of skill (**AGCO 2.15**, **GLI-19 §4.6.1(a)**, **RTS 7C**) (**H**). The theme makes the illegal version feel natural, which is what makes this the highest-risk item after the chance line | All |
| 3 | **The wait must be identical for a win and a loss** in length, animation, sound, text and the value shown | A wait that differed by outcome would leak the outcome before it is shown — an advance warning by another name (AGENTS hard rule 3, **RTS 7C**) (**H**) | All |
| 4 | **A locked value is not a win until revealed.** Unsettled styling, a caption saying the amount is conditional, and no balance, net-position or history movement during the wait | A settled-looking amount that is then taken away is a misleading presentation risk, and the Netherlands and Spain require the money to be "sufficiently distinguishable" in what it claims (**M**). The balance moving early would also reveal the result (**H**) | All |
| 5 | **Auto cash-out must state what it does not guarantee.** A target that fires enters the same wait and can still lose | Auto cash-out is permitted because it only ends the current bet (AGENTS compliance rule 4). Under a deferred reveal it does not end the uncertainty, and a player may reasonably assume a target secures a return. **GLI-19 §4.4.1** requires the rules to cover modifiers and how the game actually behaves (**H**) | All |
| 6 | **Carried forward, unchanged: marketing copy must not frame the game as nerve or daring** | CAP **16.3.9** / BCAP 17.3.8 and Lagos reg. **7(1)(q)** (**H**). The deferred reveal makes this harder, not easier: "hold your nerve to the next stop" is precisely the framing that is barred | UK, NG |
| 7 | **Carried forward and still unread: Nigerian Code of Advertising 2023 Art. 54, "Gambling Activity."** ARCON's posted PDF is cover and contents only | The likeliest home for a bespoke Nigerian content rule. **Unknown, not a known risk** (**H** that it is unread) | NG |
| 8 | **Carried forward: the tile and the trailer are advertising even though the game is not.** ARCON pre-exposure approval, GCG pre-approval | ASA remit extends to a marketer's own non-paid space (**M**); the Fuero Games ruling was against an advert made of game footage (**H**) | UK, NG, GH |
| 9 | **Carried forward: minors appeal remains the standing exposure.** The vivid arcade treatment is the risk; the regulated skin is the answer | PT 7(c), Ghana Underage (i)/(ii), Lagos reg. 7(1)(d), CAP 16.3.12 and the Oct 2025 guidance §14 reaching in-game themes (**H**) | All |

## 3. What the theme fixes outright

These were live findings against The Lift and do not reach this game, rather than being mitigated
in it.

- **Nothing is harmed.** The ride ends by arriving. Portugal Reg. 308/2023 Rule 7(b) (dignity and
  integrity of persons) and Ghana AAG Art. 15 (violence against people) both require something bad
  to happen to someone. Nothing does.
- **People may therefore be in the car**, which is what The Lift's snapped cable had cost it. They
  must still read as adults (fix 9).
- **No impact and no falling point of view** — there is nothing to fall, so no state can exist.
- **No dread build-up** survives as a requirement, but its basis changes: it is no longer about
  fear, it is the no-advance-warning rule (fix 3). A cable car that slowed as it neared a station
  would be announcing the end of the round.

## 4. What is inherited and not re-examined

RNG and seeding, settlement and idempotency, the operator bridge, hosting, and the platform
integrity controls: see `whack-crash-2026-09-15.md` and `whack-crash-2026-09-16.md` §10. The
round maths is the engine's, unchanged, on the same configuration ids and the same committed
reports — a skin that needed its own maths would need its own lab acceptance.

The deferred reveal itself was proved payout-equivalent to a live round over 1,500 paired cash-outs
in `gate-odds-mvp`'s core tests. This audit relies on that rather than repeating it.

## 5. Recommended path

Build the chance line and the fixed wait first, before any art is final: they are the two things
that decide whether the mechanic is lawful, and both are cheap to get right and expensive to
retrofit. Run the presentation and timing checks on every profile, and **look at a still of every
state** — the two most serious findings against The Lift, a control no round could reach and a
multiplier at 1.42:1, were invisible to every automated check and obvious in a screenshot.

## 6. Not verified. Confirm with counsel or the lab

- **Whether a deferred reveal is a "crash game" for Brazil Annex I item 14(d)**, which lists the
  permitted round endings and assumes the player sees the value it ends at. The ending here is the
  same; only the moment it is disclosed differs. **Unknown** — this is the single question most
  worth putting to the lab before a Brazilian submission, and it applies equally to Gate Rush.
- **Whether the live chance satisfies Italy's conversion-value expectation** for anything that reads
  as game credits. Not researched.
- Nigerian Code of Advertising 2023 Art. 54 (fix 7).
- Whether Ghana's GCG treats a probability displayed in-game as an advertising claim requiring
  pre-approval. **Unknown.**

## 7. Key sources

Carried from `the-lift-2026-09-17.md` and `whack-crash-2026-09-16.md` at their recorded dates:
UKGC RTS 7C/7E/14F/14G, AGCO 2.15/2.20/4.15, GLI-19 §4.4.1/§4.6.1(a)/§4.7.1(a), Brazil Portaria
1.207/2024 Annex I items 14(c)/(d), Portugal Reg. 308/2023 Rules 4/7(b)/7(c)/22, Ghana AAG Code
Arts. 7/15, Nigeria Code Arts. 7/15/18, Lagos Responsible Gaming Regs 2021 reg. 7(1), ARCON Act 2022
ss. 54/63, CAP under-18 guidance (Oct 2025) §14 and CAP 16.3.9/16.3.12/16.3.14.

**No source in this list was re-verified for this audit.** Anything older than 90 days should be
refreshed before a submission.
