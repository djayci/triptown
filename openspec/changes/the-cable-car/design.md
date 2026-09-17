## Context

The Lift passed every check and the user rejected it twice. The failure was not defects; it was that a shaft has nothing in it and a round had no events. This change keeps everything the Lift proved — the `CrashScreen` seam, the compliance checks, the audit, the reachability work — and replaces only what the player looks at.

The design canvas is approved: seven artboards at `design/cable-car/*.dc.html`, published for review. Decisions below are numbered like `whack-crash-mvp`'s D1–D10, and every compliance-driven one cites its source.

## Decisions

### D1 — A skin, not a new game engine
The Cable Car registers as `registerGame('cable-car', 'whack-crash', { reveal: ['onCollect'] })`. It plays the engine's certified configuration ids, and therefore its committed RTP reports. No new config id, no `simulate` run, no recertification.

*Why:* AGENTS hard rule 2 and the skin-on-an-engine pattern. A game that needed its own maths would need its own lab acceptance, which is the cost this architecture exists to avoid.

### D2 — The collect is a deferred reveal, and the wait is theatre
Collecting locks the value and enters a waiting state; the result appears at `max(press + HEADING_HOME_MS, settlement received)`. Whether the round was already over was settled before the press. The wait is a fixed length from the press and is byte-identical in every observable way for a win and a loss.

*Why:* this is the whole point of the mechanic, and also its only real hazard. A wait whose duration varied with the outcome would leak the outcome — an advance warning by another name (hard rule 3).

### D3 — The reveal is never tied to the scenery
The wait does not end when the car reaches a drawn station, and does not vary with the distance to one.

*Why:* this is the trap the theme sets. "Get out at the next stop" makes it natural to reveal on arrival — but then pressing just before a station is safer than pressing just after, for the same payout. That is a strategy edge: RTP would differ by how the player plays, which breaks the martingale (hard rule 2) and is an illusion of skill (AGCO 2.15, RTS 7C). Stations stay decoration; the clock is the clock.

### D4 — The live win chance is mandatory, not decoration
`RTP ÷ value`, floored at 0.1%, shown whenever a deferred round runs.

*Why:* on a deferred reveal the multiplier keeps climbing past a crash the player cannot see, so the screen displays money that is no longer winnable. Ontario forbids displaying amounts that are unachievable, and Brazil Annex I item 14(c) and Portugal regra 4 require the value to be readable and true. The chance line is what makes the screen honest rather than merely pretty. It also answers the strategy question on its face: chance × value = RTP at every value, so no stopping point beats another — and the rules say so in those words.

### D5 — The chance is restated, not hidden, during the wait
Once pressed, the line changes from a live chance to the chance that applied at the press, in the past tense, rather than disappearing.

*Why:* hiding it removes the disclosure at the exact moment the player is most invested. Leaving it in the present tense would be false — the player has already gone in. Restating it is the only reading that is both present and true. It is a probability statement about a decision already made, which is not a near-miss (Spain RD 176/2023 art. 17.2 concerns losses dramatised as near-wins; a percentage is neither dramatised nor a claim about this round).

### D6 — Nothing breaks and nobody falls
The ride ends by arriving: the car stops and its doors open. No snapped rope, no drop, no impact, no falling point of view.

*Why:* Portugal Reg. 308/2023 Rule 7(b) protects the dignity and integrity of persons and Ghana AAG Art. 15 bars depicting violence against people. Both need something bad to happen to someone. Arriving harms nobody — and that is what allows riders in the car at all. The Lift's empty cabin was a consequence of its snapped cable, not a rule in its own right, and it cost that game its only character.

### D7 — The stop is abrupt, and that is deliberate
No deceleration, chime, light or animation precedes the end. The doors open *after* the outcome.

*Why:* a cable car that slowed as it neared its station would be telling the player the round was about to end. With D6 removing the fear content, this is no longer about tone — it is the load-bearing no-advance-warning rule (hard rule 3).

### D8 — The line has no visible end
The rope climbs into cloud. No summit, terminus, final station or progress bar toward the maximum win is ever drawn. The top zone is named OPEN SKY, deliberately not a destination.

*Why:* same rule as D7, applied to composition rather than motion. A visible end of the line is a progress bar toward the crash.

### D9 — Stations are a ladder of reachability, keyed to value
VALLEY (x1.00), PINE HALT (x1.50), MIDWAY (x3.00), CLOUD DECK (x6.00), EAGLE POINT (x12.00), OPEN SKY (x25.00). Each is entered at a multiplier, never at a time.

*Why:* two rounds reaching the same value must look identical, or the scenery is telling the player something (hard rule 3). The spacing roughly halves reachability at each step — P(reach m) = RTP ÷ m — so arriving somewhere means something without predicting anything. This also fixes The Lift's floor mapping, which put the Penthouse on floor 110 of a 490-storey building.

### D10 — The readout lives on the vehicle
Altitude is shown on the cabin, not in a HUD chip. The shared themed counter is omitted (`counterFor()` returns null).

*Why:* The Lift's floor counter floated mid-shaft belonging to no part of the picture, and the user named it unprompted. A vehicle carries its own readout. The multiplier remains the value; the altitude is subordinate decoration and never styled as money (BR Annex I 14(c), PT regra 4).

### D11 — Auto cash-out is offered, and its interaction with the reveal is stated
Auto cash-out remains available. On a deferred round it fires the same press at the target value, and the same waiting state follows.

*Why:* auto cash-out is permitted because it only ends the current bet (AGENTS compliance rule 4). Under deferred reveal it does not end the uncertainty either, so the rules must say that explicitly rather than let a player assume a target guarantees a return.

## Risks and open questions

- **This change consumes another session's uncommitted work.** `showHeadingHome`, `setRevealOdds`, `formatRevealChance` and `HEADING_HOME_MS` belong to `gate-odds-mvp` and are not yet committed. Tasks that depend on them are sequenced last and this change must not edit those files. *Owner: `triptown-games-bc` to land; this change to consume.*
- **Two games now share the mechanic.** Beat the Gate / Gate Rush uses deferred reveal too, so the two are siblings — the same twist with different art. That is legitimate and cheap under the skin architecture, but it is a portfolio fact worth stating rather than discovering later. *Decided by the user: both.*
- **A locked value that loses is a harsh read.** The player sees x2.48 and may receive nothing. D4 and D5 are what keep that honest rather than surprising, but it is the thing to watch in the first audit and the first real session.
- **No sound.** The Cable Car ships silent, as The Lift did. Audio needs licensed assets within the 1.5 MB budget and a `SOURCES.md` entry, so it is separate scope. *Owner: the user.*
- **Nigerian Code of Advertising 2023 Art. 54 is still unread**, carried over from the Lift audit. Not a known risk; an unknown one.
