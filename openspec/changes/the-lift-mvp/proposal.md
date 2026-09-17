## Why

Triptown needs a second crash game that costs a skin, not a product. The engine work to make that possible is done: `game-neutral-core` opened the game registry, so `registerGame('the-lift', 'whack-crash')` binds a new game to Whack Crash's certified config ids and their committed RTP reports. No new maths, no new proof, nothing to recertify.

The Lift is that test. One bet, a lift rising through floors, the cable going as the crash. It was chosen over four alternatives because it is the only one with no near-miss instinct to design around — a shaft has nothing to telegraph — and because a lift is adult and mundane in every market, which matters when arcade nostalgia is already this studio's standing minors-appeal exposure.

The measurement that decides how it is built, counted across `apps/whack/src`: `ui/primitives.ts` (352 lines), `theme.ts` (95) and `game/display.ts` (95) contain **zero** game-specific references; `ui/hud.ts` (238) contains two and `game/controller.ts` (687) contains seven. Against that, `ui/stage.ts` (264) contains **47** and `game/view.ts` (1,149) contains **184**. So roughly 1,470 lines are already neutral or trivially so, and the genuinely mole-specific code is the stage and most of the view. A second game does not need a second client — it needs the neutral part extracted once.

## What Changes

- **A new game registered on the existing engine.** `registerGame('the-lift', 'whack-crash')`. The Lift plays `whack-crash/v1-rising` and its capped variants, so every committed RTP report already covers it.
- **The game-neutral client moves into a shared package.** Round orchestration, HUD, theme tokens, Pixi primitives, the display helpers and the compliance half of the view leave `apps/whack` and become reusable. `apps/whack` keeps its mole stage and art. **BREAKING** for `apps/whack` internals; no change to how Whack Crash plays.
- **`apps/lift`**: a client that supplies lift rendering against the shared crash client, plus its own message catalogue and skins.
- **Presentation.** A five-depth parallax ascent — floor numerals, floor bands with lit windows, speed streaks, dust motes, transom slats — with a dial whose arc fills as the value climbs. Speed and intensity are a function of the multiplier only, never of the crash time, and sit behind the existing `intensityEffects` flag.
- **Two skins**: `candy` for light profiles, `adult` for regulated ones, selected by the profile exactly as Whack Crash does.

Out of scope: any change to growth, hazard, setbacks, boosts, RTP or settlement; multi-wager; the step engine; the Nigeria and Ghana jurisdiction profiles and NGN/GHS currency rules, which `beat-the-gate-mvp` is adding to `core` and this change consumes rather than duplicates.

## Capabilities

### New Capabilities
- `lift-game-client`: how The Lift presents a round — the states and what each shows, the ascent and its intensity rule, the no-advance-warning constraint, skin selection, and the information a player can reach before betting.

### Modified Capabilities
<!-- none: extracting the shared client changes structure, not observable behaviour, and Whack Crash's spec still describes what it does -->

## Impact

- **Packages:** a new shared crash-client package; `engine` and `rgs-client` unchanged; `core` and `fairness` untouched.
- **Apps:** `apps/whack` refactored to consume the shared client; `apps/lift` added.
- **RTP:** none. The Lift plays already-certified config ids; no report changes and none is needed.
- **Blocked on:** the concept-stage compliance audit, which has **not** run. Nigeria and Ghana were researched on 16 Sep 2026 for other concepts and those findings apply, but no audit has judged this one. Tasks below gate implementation on it.
- **Depends on:** `beat-the-gate-mvp` for the `ng-draft`/`gh-draft` profiles and NGN/GHS currency rules.
