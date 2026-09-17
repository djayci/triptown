## Context

See `proposal.md` — Why. Three facts shape the approach:
1. `registerGame(game, engine)` in `packages/core/src/profiles.ts` binds a game to another game's certified configuration ids.
2. `the-lift-mvp` is moving Whack Crash's game-neutral client into `@triptown/crash-client`:
   - theme, primitives, HUD and display are already moved;
   - the controller (with the player-protection state machine) and the compliance half of the view are next.
3. The Nigeria and Ghana market flags are already implemented in `core`, and several games will consume them.

## Goals / Non-Goals

**Goals**
- A horse game that plays like Whack Crash and costs art and copy, not maths.
- A gate fiction where staying out longer is obviously riskier, with nothing on screen that predicts the crash.
- The Floodlight Gold look, rendered well on low-end Android.

**Non-Goals**
- No new configuration id, RTP report, modifier or pacing.
- No reimplementation of shared compliance behaviour inside `apps/gate`.
- No racing: one horse, no field of runners, no finish, no odds.

## Decisions

### D1. A skin on the Whack Crash engine
`registerGame('beat-the-gate', 'whack-crash')`, playing the `-rising` configuration under every profile the game ships with.

*Why:* the maths, RNG and rules are what a lab certifies. Fence Run added a new engine and therefore a new certification family, which is the cost this studio decided to stop paying for new themes (AGENTS.md, "new games are presentation, not new maths").

*Consequence:* the game cannot have its own hazard, cap or modifiers. Asking for one makes it a new change with its own proof.

### D2. Build on `@triptown/crash-client`, never on a copy of Whack
`apps/gate` supplies only its stage, art, catalogue and audio. The controller, HUD, rules, history, operator bridge, cycle gap, celebration threshold and release-and-press guard come from the shared package.

*Why:* copying Whack's controller would duplicate the player-protection logic that `compliance-baseline` just finished, and the copies would drift. The shared seam is designed so that a game with no compliance code still passes `presentation-check` and `timing-check`.

*Sequencing:* scene and art work starts now. Round wiring waits for `the-lift-mvp` 2.3/2.4. If the seam doesn't fit the gate, that gets raised with the extraction owner, not worked around.

*Alternative considered:* ship a copied client now and converge later. Rejected: divergence in compliance-critical code is the failure this studio can least afford.

### D3. The gate is home, and it never moves
The yard gate sits fixed at the left of the stage. The horse laps the field on a loop with a fixed period, so its distance to the gate follows the loop, never the time left. Lap speed, crowd flashes and the meter follow the multiplier only, behind the profile's `intensityEffects` flag.

*Why:* a gate the horse charges at (the first mockup) must never get closer, or the distance becomes a countdown; that makes the fiction incoherent. Framing the gate as home makes "stay out for more, get back before it shuts" self-explanatory while the gate stays still. This follows AGENTS.md compliance rule 5 and hard rule 3.

### D4. Cash-out locks on tap and the ride home waits for the server
IN! locks the displayed value at once, like Whack's snap. The ride through the gate plays only after the settlement confirms it. On a crash, the gate slams while the horse is shown well out in the field, never at the gate.

*Why:* the server decides a tie by receive time. If the ride home started on tap and the server then reported a crash, the gate would shut in the horse's face, which is a near-miss animation. The ban on near misses (AGENTS.md compliance rule 5; AGCO 2.15; RTS 7C) rules that out by construction.

### D5. Floodlight Gold is the adult skin, and the audit judges it
The look uses:
- a night track, floodlights and gold accents;
- Bungee for display type and Bricolage Grotesque for body type;
- Whack's thick ink outlines;
- an adult jockey with adult proportions and a realistic, non-cute horse.

It ships as the `adult` skin. There is no candy skin.

*Why:* `ng-draft` and `gh-draft` select `adult`. The chunky outline style is shared with the Candy house style, which is a minors-appeal risk (AGENTS.md compliance rules 6 and 10, CAP 16.3.14). So the concept check in task 3.1 must rule on it before art is final.

### D6. Harm-free horse and non-racing vocabulary
- No whip, no fall, no injury and no distressed horse.
- The crash is a shut gate, and the horse stops unhurt.
- Copy avoids "race", "odds", "starting gate", "finish" and "bet slip". The gate is a yard gate.

*Why:* `night-meet-2026-09-16.md` flagged virtual-racing classification risk (GLI-33 §4.5) and animal-welfare optics. A single horse going home is not a race.

### D7. Shelve Fence Run; keep the market flags
Fence Run's engine, client, API routes and compliance addendum move to branch `shelf/fence-run`. They are also in commit `10f3fa7`. The market flags stay in `core` because every West Africa game needs them. Only the step-only `stepAbandonAfterMs` flag goes.

*Why:* dead code in `packages/` invites reuse of a rejected engine. The flags, though, are game-neutral and already tested.

## Risks / Trade-offs

- **The shared controller and view aren't ready** → scene and art proceed first. Round wiring is a dependency, not a workaround.
- **The chunky style reads as child-appealing** → task 3.1 rules on it before art is final. The fallback is a flatter, more realistic horse drawn with the same scene structure.
- **A lap loop is easy to accidentally tie to time** → a spec requirement plus a test that two rounds at the same multiplier render the same scene regardless of their crash time.
- **Removing the step routes touches `apps/api/src/app.ts`, which another session also changed** (`/v1/ping`) → only the step-specific lines are removed, and the API test suite runs before the removal is called done.

## Migration Plan

1. Commit the shelf branch from a separate worktree, so the shared working tree never switches branch.
2. Remove Fence Run from the working tree with the workspace gate green.
3. Build `apps/gate` against the shared client.

Rollback: check out `shelf/fence-run`. No stored round format, config id or report changes.

## Open Questions

- **Is the Floodlight Gold outline style acceptable for regulated Nigeria and Ghana builds?** *Decides:* task 3.1, then the user.
- **Should the button say IN! or HOME!?** Either satisfies the spec. *Decides:* the user, during art review.
