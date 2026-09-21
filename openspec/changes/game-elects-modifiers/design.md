## Context

See `proposal.md` — Why. The state of the code this design works against:

- `effectiveConfig(game, profile)` (`packages/core/src/profiles.ts:254`) takes the game as its first argument and uses it only to resolve the engine. The modifier decision comes straight from `profile.setbacksMode` / `profile.boostsMode` via `baseConfigId`.
- `effectiveReveal(game, profile, config)` (`profiles.ts:266`) is the pattern this change copies: the game declares (`revealModesOf`), the market permits (`profile.crashReveal`), and the resolved config confirms (`lambda === 0 && boostRate === 0 && stakeParts === 1`). Anything short of all three yields `'live'`.
- `registerGame(game, engine, { reveal })` (`profiles.ts:33`) is already the runtime registry AGENTS.md requires: adding a game edits no type in `core` or `fairness`.
- `CrashScreen.setback(_from, to)` (`packages/crash-client/src/game/screen.ts:752`) assigns `this.mult.text` and nothing else. The controller calls it with three arguments including the recomputed payout (`controller.ts:612`); the third is dropped.
- Only `light` is an active profile, and it is unregulated. `ng-draft` and `gh-draft` are drafts, which `RoundHost` refuses without the dev override.

## Goals / Non-Goals

**Goals:**

- Put the modifier decision where the reveal decision already is, so the two resolve the same way and a reader learns one pattern rather than two.
- Make a market flag mean a market fact. `setbacksMode: 'off'` should read as "Brazil forbids a falling multiplier", not "the games here happen not to use one".
- Give every `CrashScreen` game a setback moment by construction, the way it already gets the celebration rule by construction.
- Change no game's resolved config id, so no committed report is invalidated.

**Non-Goals:**

- Flipping any market to permit setbacks. That is a market decision with its own evidence, made after this lands.
- The scene-level setback reaction. A game's own choreography stays the game's (see D5).
- Boost parity beyond what falls out for free. Boosts get the same resolution because they share the mechanism, but boosted config ids still need lab acceptance before a regulated market uses one (AGENTS.md hard rule 2), which this change does not touch.
- Per-game profile overrides of anything else. This is one seam, not a general override system.

## Decisions

### D1. The game declares modifiers at registration, mirroring `reveal`

`registerGame` gains `modifiers?: readonly ModifierKind[]` where `ModifierKind = 'setbacks' | 'boosts'`, stored in a registry beside `GAME_REVEALS`, read by `modifiersOf(game)`.

*Why registration rather than a config field or a game-class property:* it is the one place a game already tells `core` about itself, and it is runtime, so adding a game still edits no type. A `GameConfig` field would be wrong — the config is the engine's and is shared by every skin on it, while the modifier appetite is the skin's.

*Alternative considered:* infer it from the game's registered config ids. Rejected — a skin resolves the engine's ids, so every skin on `whack-crash` would infer identically and the distinction we need would not exist.

### D2. The default is no modifiers, and Whack Crash declares

`modifiersOf` returns `[]` for a game that declared nothing, exactly as `revealModesOf` returns `['live']`.

*Why opt-in:* a new game should not silently acquire a falling multiplier because of the market it launched in. The failure mode of opt-in is visible (a game that forgot its declaration plays rising, and someone notices); the failure mode of opt-out is invisible (a game acquires a mechanic nobody designed for it).

*Consequence:* `apps/whack` must declare `modifiers: ['setbacks']` or Whack Crash loses its bad moles on the `light` profile. That is a one-line migration and it is more honest than inheriting them by accident — Whack Crash has always been a setbacks game and nothing said so in code.

### D3. `effectiveSetbacks` resolves game against market; `effectiveConfig` uses it

```
effectiveSetbacks(game, profile)
  = profile permits && game declares  ->  profile.setbacksMode
  = otherwise                         ->  'off'
```

`effectiveConfig` calls it in place of reading `profile.setbacksMode`, and the same for boosts. The resolution is a narrowing intersection in both directions: a market that forbids setbacks overrides a game that wants them, and a game that does not use them ignores a market that allows them.

*Why a named function rather than inlining it in `effectiveConfig`:* the rules screen, the recall record and any audit need to state which modifiers a round actually played, and they should ask the same question the config resolution asked rather than re-deriving it.

### D4. The profile-level check is removed, not relaxed

`validateProfile`'s rejection of `crashReveal: 'onCollect'` alongside modifiers (`profiles.ts:316`) is deleted.

*Why deleting is safe:* the requirement it protects — that `RTP ÷ value` is an exact chance — is a property of a **resolved config**, and `effectiveReveal` already tests exactly that property on exactly that object, falling back to `'live'` when it does not hold. After D3, a deferred game on a setbacks-permitting market resolves a rising config (it declared no modifiers), so `effectiveReveal` returns `'onCollect'` and the displayed chance is exact. A game that declared both `reveal: ['onCollect']` and `modifiers: ['setbacks']` resolves a setbacks config, and `effectiveReveal` returns `'live'` — the reveal yields, which is the correct precedence, because a wrong number on screen is worse than a missing feature.

*Why not keep it as a warning:* a check that cannot fail for any reachable configuration is noise, and a check that can fail only by being wrong is a trap.

*Risk accepted:* the deleted check was the only thing asserting the relationship at the profile layer. A test replaces it, asserting the end-to-end property instead — that no resolved combination ever yields `'onCollect'` on a config with modifiers.

### D5. The screen owns the setback moment; the scene owns its reaction

`CrashScreen.setback(from, to, payout)` becomes a real implementation: the previous value struck through, the new value in its place, the factor shown as a marker, and the live return updated from the payout argument the controller already passes. `boost` gets the same treatment in the same pass, since it is the same seam and currently the same stub.

The game's scene is told a setback happened and may react — Whack's mole snatching coins, a Breach layer falling back — through the existing `GameStage` surface. It is never required to, and a game that does nothing still shows the player what changed.

*Why split it there:* the multiplier, the return and the marker are the shared screen's elements; the screen already owns them everywhere else and a game cannot reach them without the layout duplication `shared-game-shell` exists to remove. The scene is the game's and always was.

*Why the payout argument matters:* the frame loop would refresh the return within a frame anyway, but a setback is the one moment where the value moves discontinuously, and taking the controller's recomputed figure makes the displayed money correct at the instant of the change rather than one tick later.

### D6. Sequencing against `shared-game-shell`

Land this change **first**. `shared-game-shell` migrates Whack Crash onto `CrashScreen` and moves its scene choreography into a `WhackStage`; at that moment the screen-level setback moment has to already exist, or the migration either drops Whack's setback presentation or rebuilds it inside the game — which is the duplication that change is removing.

*If it lands second instead:* Whack's migration must carry a temporary screen-level setback of its own, and this change then deletes it. Workable, wasteful, and it puts a known-incomplete presentation in front of the pixel-identity check that `shared-game-shell` depends on.

## Risks / Trade-offs

- **A game forgets its declaration and silently loses a mechanic** → the failure is visible in play and in the rules screen (the setback items disappear from `describeRules`), and a test asserts every registered game's resolved config matches what its declaration implies.
- **`setbacksMode` changes meaning without changing its name** → every profile keeps its current value and every game keeps its current resolved config, so nothing moves on the day. The risk is a reader carrying the old meaning forward; the field's doc comment states the new one, and the name stays because renaming a profile field touches stored operator configuration for no behavioural gain.
- **Deleting a validation rule reads as loosening compliance** → it is a relocation, not a removal: the same property is asserted end-to-end instead of at one layer, and the replacement test is stricter, because it covers combinations the profile check could not see (a game declaring both).
- **Boosts come along for free and boosted ids are not lab-accepted** → resolution changes, permission does not. No profile enables boosts, and the hard rule requiring lab acceptance before a regulated market uses a boosted id is untouched and still binding.
- **The setback presentation is the first thing built against a stub nobody has used** → it is verified by `presentation-check` against a profile with setbacks permitted, asserting that a setback fires no win cue, no confetti and no shake, since a setback moment on a round that ends at or below the stake is exactly the emphasis trap compliance rule 1 describes.

## Migration Plan

1. `modifiers` on `registerGame` plus `modifiersOf`, defaulting to `[]`. No caller changes yet; nothing resolves differently because nothing reads it.
2. Declarations added: `whack-crash` gets `modifiers: ['setbacks']` wherever it is registered (`apps/whack`, `apps/api`, tests). Still inert.
3. `effectiveSetbacks` added and `effectiveConfig` switched to it. This is the step where resolution changes; with step 2 done, every game resolves the config id it resolved before, which the test suite asserts directly.
4. `profiles.ts:316` removed, replaced by the end-to-end test in D4.
5. `CrashScreen.setback` and `boost` implemented; `presentation-check` run against a setbacks-permitting profile.

**Rollback:** steps 1–2 are additive and inert. Step 3 is the only behavioural commit and reverts cleanly, since it restores a direct read of the profile flag. Step 5 is independent of 1–4 and revertible on its own.

## Open Questions

- Whether `light` should keep permitting boosts once permission and use are separate. It is the only profile that enables them, no game declares them, and after this change that means the flag has no effect anywhere — worth deciding whether it stays as a statement of intent or goes.
- Whether the recall record should state the modifiers a round actually played, now that it is a resolved value rather than readable straight off the profile. It is derivable from the config id today; naming it explicitly would be clearer for an auditor and is not needed for this change to land.
