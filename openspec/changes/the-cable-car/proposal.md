## Why

The Lift was built, audited and shipped green, and the user rejected it twice: "I'm truly not liking what we have here." Two things were wrong and neither was fixable by polish.

A lift in a shaft can only ever show a box in a tube. The camera is inside the machine, so there is no vehicle to look at, no landscape, and — because the original ending was a snapped cable — nobody could be in the car. That constraint was downstream of the fall, not a rule of its own, and it cost the game the one thing worth caring about.

The second, deeper problem: **nothing happened during a round.** On the regulated profiles setbacks are off, so between start and crash there was literally no event — a number rising past identical floors. The zones added in `e193f4a` helped, and were not enough.

Seen from the side, a cable car gives back everything the shaft took: the vehicle, the rope, the drop, the people riding, and stations passing. And the collect gains a reason to be dramatic — you ask for the next stop, and you do not yet know whether you will reach it.

## What Changes

- **New app `apps/cable-car`** (`@triptown/cable-car`): a sideways cable-car skin on the certified Whack Crash engine. New scene, words and art direction; no layout and no compliance logic of its own, per the `CrashScreen` seam.
- **Deferred reveal becomes this game's collect.** `registerGame('cable-car', 'whack-crash', { reveal: ['onCollect'] })` and `crashReveal: 'onCollect'` on the Nigeria and Ghana profiles. The value locks on the press, the car keeps moving, and the result arrives at the stop. The maths is unchanged: same engine, same config ids, same committed reports.
- **The live win chance is mandatory in this game, not optional.** On a deferred reveal the multiplier keeps climbing past a crash that already happened, so the screen can display money that is no longer winnable. AGCO forbids displaying unachievable amounts, so the chance line (`RTP ÷ value`) is what makes the screen honest.
- **Stations are scenery, never cash-out points.** VALLEY, PINE HALT, MIDWAY, CLOUD DECK, EAGLE POINT, OPEN SKY, each entered at a multiplier. Collecting stays available at every instant.
- **The line has no visible end.** The rope climbs into cloud; no summit or terminus is ever drawn.
- **BREAKING: `apps/lift` is removed** and `the-lift-mvp` is archived. Its shared work — the `CrashScreen` seam, the compliance checks, the audit and everything learned from it — stays and is what makes this change small.
- A concept-stage compliance audit for the new game, and its own message catalogue.

## Capabilities

### New Capabilities

- `cable-car-client`: the cable-car game client — what it draws, what it must never draw, how the deferred collect is presented, and the information it owes the player before and during a bet.

### Modified Capabilities

None. `round-engine` already carries deferred reveal (`crashReveal`, `effectiveReveal`, `registerGame` reveal modes) from `gate-odds-mvp`; this change consumes it rather than altering it. `provably-fair` and `whack-game-client` are untouched.

## Impact

- **New:** `apps/cable-car/**`, `docs/compliance/the-cable-car-<date>.md`, `design/cable-car/*.dc.html` (already drafted and approved).
- **Removed:** `apps/lift/**`; `the-lift-mvp` archived.
- **Touched, minimally:** `packages/core` profile templates (`ng-draft`, `gh-draft` gain nothing new — they already carry `crashReveal: 'onCollect'`), the API host map (register the new game id), `AGENTS.md` layout.
- **Depends on `gate-odds-mvp`'s client work**, which is uncommitted in another session at the time of writing: `showHeadingHome`, `setRevealOdds`, `formatRevealChance`, `HEADING_HOME_MS`. This change must not edit those files; it consumes them once landed.
- **Unchanged and deliberately so:** `packages/fairness` — no new configuration id, no new report, no `simulate` run. A skin that needed either would not be a skin.
