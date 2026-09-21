## Why

A jurisdiction profile decides whether a market's games play setbacks, and it decides it for **every game on that profile at once**. `effectiveConfig` reads `profile.setbacksMode` directly (`packages/core/src/profiles.ts:256`), so two games sharing a market share a modifier choice that is not a market question.

That collides as soon as a market carries two games with different needs:

```
  ng-draft  (one profile, one market)
     |
     +--> Gate Rush   needs crashReveal:'onCollect'  -> requires setbacksMode:'off'
     |
     +--> a setbacks game                            -> requires setbacksMode:'halve'
```

`validateProfile` makes it explicit, refusing the combination outright (`profiles.ts:316`) with the reason: *"onCollect needs setbacks and boosts off, or the odds shown would not be exact"*. That reason is sound — a deferred-reveal game shows `RTP ÷ value` as the live chance, and the formula is exact only with no modifiers. But it is enforced in the wrong place. **The constraint belongs to a game's resolved config, and `effectiveReveal` already enforces it there** (`profiles.ts:268`), falling back to `'live'` whenever the config is not exact. The profile-level check duplicates a correct check one layer down, and the duplicate is the one that is too strict: it applies a single game's requirement to a market-wide flag.

`reveal` already has the right shape and `setbacks` never got it:

|                | reveal            | setbacks (today)  |
|----------------|-------------------|-------------------|
| game declares  | `registerGame`    | — nothing —       |
| market permits | `crashReveal`     | `setbacksMode`    |
| resolved by    | `effectiveReveal` | — profile wins —  |

The second half of the same gap is presentational. `CrashScreen.setback()` is a stub that assigns the multiplier text and drops the payout the controller passes it (`packages/crash-client/src/game/screen.ts:752` against `controller.ts:612`). Gate Rush never needed it, because deferred reveal forbids setbacks; Whack Crash has a real one, locked inside its own view, which does not extend `CrashScreen`. **No game on the shared screen can currently show a setback at all.** Any game that turns them on would inherit a silent value change with no moment, no previous value and no marker.

**Now is the only free moment.** `light` is the one active profile and it is unregulated; `ng-draft` and `gh-draft` are both `status: 'draft'`, which the host refuses. Nothing ships in a regulated market today, so no live behaviour changes. The window closes when the first regulated profile goes active.

## What Changes

- **A game declares the modifiers it uses**, at registration, alongside the reveal modes it already declares. **BREAKING** for `registerGame` callers that rely on a profile's setbacks reaching their game.
  ```ts
  registerGame('whack-crash',   'whack-crash', { modifiers: ['setbacks'] });
  registerGame('beat-the-gate', 'whack-crash', { reveal: ['onCollect'] });
  ```
- **`setbacksMode` and `boostsMode` become market permissions, not market choices.** `'off'` keeps meaning "forbidden in this market"; anything else means "permitted here". A game that declares no modifiers gets none, whatever the market allows — opt-in, mirroring `reveal`'s live-only default.
- **`effectiveSetbacks(game, profile)` resolves the two**, and `effectiveConfig` uses it in place of the raw profile flag. `effectiveConfig` already takes the game as its first argument; it simply does not use it for this yet.
- **The profile-level reveal/modifier check is removed** (`profiles.ts:316`). The exactness requirement it protected is enforced per game by `effectiveReveal`, which is where it belongs and where it already works.
- **`CrashScreen` gains a real setback presentation**: the previous value struck through, the new value, the factor as a marker, and the live return updated from the payout the controller already passes. A game may add its own scene reaction on top; it does not have to, and gets the screen-level moment by construction.
- **Out of scope, deliberately:** no change to the maths, crash sampling, setback derivation, RNG, settlement or any config id; no new report; no recertification. Registered games resolve exactly the config ids they resolve today once their declarations are added.

## Capabilities

### New Capabilities
<!-- none: this change moves an existing decision to the right layer and fills a presentation gap -->

### Modified Capabilities
- `round-engine`: the modifiers a round plays are resolved from the game and the market together, rather than from the market alone; a market flag states what is permitted, not what is played.
- `whack-game-client`: Whack Crash declares the setbacks it has always used, so its behaviour is unchanged by the new default.

## Impact

- **Packages:** `core` (`registerGame`, `modifiersOf`, `effectiveSetbacks`, `effectiveConfig`, `validateProfile`), `crash-client` (`CrashScreen.setback`, and `boost` alongside it).
- **Apps:** `apps/api` and `apps/gate` add a declaration where they register a game; `apps/whack` declares `setbacks`.
- **Profiles:** no template changes required by this change. A market that wants to permit setbacks flips its own flag afterwards, which is then a market decision with its own evidence.
- **RTP and certification:** none. No config id changes for any game once declarations are added, so every committed report still applies.
- **Sequencing:** `shared-game-shell` moves Whack Crash onto `CrashScreen` and relocates its scene choreography into a `WhackStage`. The two changes meet at the setback seam — this change owns the **screen-level** moment (struck-through value, marker, return), `shared-game-shell` owns the **scene-level** reaction. Landing this first gives that migration something to migrate onto; landing it second means Whack briefly has no setback presentation on the shared screen.
- **What this unblocks:** a second game in a market that already carries a deferred-reveal game, without a per-game profile fork — which compliance rule 8 exists to prevent.
