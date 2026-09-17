## Context

See `proposal.md` — Why. Two facts from the code shape everything below. First, `registerGame(game, engine)` already lets a game play another game's certified configuration (`packages/core/src/profiles.ts`), so a skin needs no maths. Second, the existing client is largely not about moles: `ui/primitives.ts`, `theme.ts` and `game/display.ts` carry no game-specific references, `ui/hud.ts` carries two and `game/controller.ts` seven. The mole-specific code is concentrated in `ui/stage.ts` (47 references in 264 lines) and `game/view.ts` (184 in 1,149).

## Goals / Non-Goals

**Goals**
- A second game that costs art and copy, not maths.
- Extract the neutral client once, so the third game is cheaper than the second.
- An ascent that feels like progress without leaking anything about the outcome.

**Non-Goals**
- No change to growth, hazard, setbacks, boosts, RTP or settlement.
- No new configuration id, and no new RTP report.
- No multi-wager and no step mechanics.
- No new jurisdiction profiles or currency rules — `beat-the-gate-mvp` owns those.

## Decisions

### D1. The Lift is a skin on the Whack Crash engine, not a new game engine
`registerGame('the-lift', 'whack-crash')`.

*Why:* maths, RNG and rules are what a lab certifies, so a game that changes them needs recertification and cannot ship quickly. One that plays an already-certified configuration inherits its committed reports untouched. This is the first real test of that claim.

*Consequence:* The Lift cannot have its own pacing, hazard or cap. If it ever needs them, it stops being a skin and becomes its own change with its own proof.

### D2. Extract the neutral client rather than fork it
The round controller, HUD, theme tokens, Pixi primitives, display helpers and the compliance half of the view move to a shared package. `apps/whack` keeps `ui/stage.ts` and its art.

*Corrected during implementation:* an earlier draft of this change claimed `ui/stage.ts` was game-neutral. It is not — it is `Hole`, `MoleFrame` and the mole stage, 47 game-specific references in 264 lines. The original count simply never covered that file. The Lift needs its own stage, which is expected: a shaft is not a mole field.

*Why:* the alternative is copying ~1,470 lines that are already neutral, after which every compliance fix — the celebration threshold, the cycle gap, the rules panel, the history view — has to be made twice and will eventually be made differently. `compliance-baseline` is fixing exactly those behaviours right now, which is the strongest argument for having one copy.

*Alternative considered:* let `apps/lift` copy what it needs and reconcile later. Rejected — divergence in a compliance-critical client is the failure this studio can least afford.

**Correction from the session that built those behaviours:** the split is not "controller is shared, view is per-game". Four compliance behaviours live inside `view.ts` — the `resultKind` split in `showWin` (RTS 14F), `disarm()`/`isArmed` with its keyup and pointerup listeners (RTS 14G), `setBetCountdown`, and `setPresentation`. Those move to a shared view; only art and scene stay per game. The point of the seam is that a game implementing no compliance logic of its own still passes `presentation-check.mjs` and `timing-check.mjs` — the rules hold by construction rather than by each game remembering them.

*Risk accepted:* this refactors a client another session is actively changing. Sequencing is a task, not an afterthought.

### D3. Intensity is a function of the multiplier, never of the crash time
Ascent speed, streak density, particle rate and glow all key off the current multiplier.

*Why:* the multiplier is already on screen, so an animation driven by it tells the player nothing new. An animation driven by the crash time is an advance warning, and there are no warnings before a crash. This is the line that makes "make it more exciting as it climbs" legal at all. It stays behind the existing `intensityEffects` flag, off by default in regulated profiles, because rising speed and motion are recognised risk factors.

### D4. The shaft has no top
Floors count up without a displayed ceiling, and there is no progress bar toward the maximum win.

*Why:* a visible top floor would let a player infer how much room is left, which is outcome information. It also quietly implies a maximum the game does not have at that moment.

### D5. The floor number is decoration, and the rules say so
The multiplier and the currency return are the two largest values on screen at all times.

*Why:* every market that legislates on this agrees — Brazil requires the rising multiplier shown, Portugal makes its numeric value mandatory, the Netherlands requires the money "sufficiently distinguishable", Ontario forbids displaying amounts that are unachievable. A large themed number competing with the money is the design those rules are aimed at. The rules screen states the floor carries no separate value, so the decoration is disclosed rather than merely subordinate.

### D6. Both skins ship, and the profile picks
`candy` for light profiles, `adult` for regulated ones.

*Why:* the vivid arcade treatment is the house voice and the reason this concept was chosen, and it is also the standing minors-appeal exposure — guidance reaching in-game themes treats resemblance to games popular with under-18s as a strong-appeal risk. Shipping only the vivid skin would make the game unsellable in the markets it was designed for.

### D7. The compliance audit gates implementation, not planning
This change is written from the 16 Sep 2026 Nigeria and Ghana research, but no audit has judged The Lift.

*Why:* writing the plan now is cheap and makes the audit concrete — it has something to audit. Building against an unaudited concept is what produced a dropped game earlier the same day. Task 1.1 runs the audit and its findings feed back before any art is final.

## Risks / Trade-offs

- **The client extraction collides with an active compliance sprint** → the neutral files move before the game work starts, in one commit, with the workspace green; `compliance-baseline`'s in-flight edits land in the shared copy rather than being re-applied twice.
- **A skin is only cheap if it stays a skin** → any request for different pacing, a different cap or a falling value is a new change with its own proof. Recorded here so it is refused deliberately rather than absorbed.
- **Intensity is the easiest rule to break by accident** → it is a spec requirement with a test that two rounds at the same multiplier look identical regardless of when they end, not a code comment.
- **The audit may reshape the theme** → likely cheap (a lift is generic), but a concept was dropped on 16 Sep after its audit, so the possibility is real and the tasks are ordered to find out early.

## Migration Plan

Extract the shared client with `apps/whack` still green, then add `apps/lift` against it. Rollback is a revert; no stored round changes shape, no configuration id moves, and no report is regenerated.

## Found during implementation, not yet resolved

**The extraction stopped at the compliance seam, not the layout seam.** `CrashViewBase` shares
release-and-press, the countdown, the celebration decision and the presentation flags. It does not
share *layout*: header and balance placement, bet controls, stage sizing, the multiplier block and
the result card were written again from scratch in `apps/lift`. There are now two copies, and
`beat-the-gate-mvp` would be the third.

Worse, the DOM panels — rules, history, fairness, overlay — are compliance surfaces and were not
extracted at all. The rules screen is audit fix #3 and is where RTP, max win, caps, minimum cash-out,
rounding and the disconnect policy are disclosed. Three hand-written rules screens is how one of them
ends up publishing a figure the committed reports do not support, which is a defect that actually
occurred in `apps/whack` the day before this was written.

A shared screen with a stage slot, and shared DOM panels, is the right answer. It is a second
package-level extraction and is not in this change's tasks, so it is recorded here rather than
absorbed.

## Open Questions

- **Does anything in the lift theme raise a market issue?** Nobody has audited it. Task 1.1 answers this. *Decides: the audit, then the user.*
- **Does the shared client belong in `packages/` or in an `apps/shared` layer?** Either satisfies the dependency direction. *Decides: implementation, on first contact.*
- **Can The Lift use the existing art pipeline?** `art/art.mjs` is already shapes plus `useSkin(skin)`, with palette and character treatment in `art/skins/*.mjs` and an atlas per skin. A lift shaft is a different scene graph from a mole field, so the seam may or may not stretch that far. Task 4.0 finds out before a second pipeline is built. *Decides: implementation, on first contact.*
- **Which skin do Nigeria and Ghana get?** Depends on the draft profiles `beat-the-gate-mvp` is adding and on counsel. *Decides: the audit and the profile owner.*
