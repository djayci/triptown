## Why

The Paper Route client shipped with a chase camera behind the courier down a sunrise street. Played end to end, it does not hold up: the view is flat, the street reads as a corridor, and the game looks like every other crash game with a runner behind it. The owner rejected it.

The agreed replacement is the arcade paper-round view of the 1985 genre original, as the "Dawn Diorama" direction picked from three options: an angled overhead camera on a street that climbs the screen diagonally, a miniature town at first light, and a light, editorial HUD. It gives the game an identity (a street you work along, houses either side, a courier doing a round) without any of the original's IP, and it removes the runner-game look the audit flagged.

Nothing about the money, the maths, the server or the compliance behaviour changes.

## What Changes

- Replace the chase camera with an orthographic camera at a fixed angle looking down on the street, with the courier riding up-screen along a diagonal. The scene scrolls along one axis, as before.
- Rebuild the street for that view: road with centre line, kerbs, both pavements, front gardens, picket fences, driveways, porches, hedges, trees, parked cars, and irregular house spacing on the far side.
- **BREAKING for the art contract:** the courier rides a delivery bicycle with a rear crate instead of a moped. The adult read now comes from build and proportions, work clothing, helmet, high-visibility vest and the cargo bike itself. This touches an audit-driven requirement, so it needs a fresh art-checklist pass and a re-audit before release.
- Replace the dark glass HUD with the light frosted HUD: Chivo and Chivo Mono, near-white panels, ink text, sunrise-orange THROW, rounded panels, the same controls and the same information in the same places.
- Add the depth-of-field and haze treatment (soft blur at the top and bottom of the frame, warm haze toward the far end of the street) and the low morning sun with long shadows.
- Keep every behavioural rule already specified: RETURN NOW vs WIN NOW, neutral results with no crash point, identical throws whatever the timing, no hazard hints, setbacks only where the profile allows, intensity following the profile, quality tiers, and the embed layout.
- Re-measure and re-tune the performance budget for the new scene, since the visible area and object count change.

## Capabilities

### New Capabilities

- `paper-route-look`: how the Paper Route scene is framed and drawn — camera projection and angle, street layout for that view, courier vehicle and adult read, the light HUD's visual system, and depth and light treatment. Behavioural requirements stay in `paper-route-client`.

### Modified Capabilities

<!-- None. `paper-route-client` keeps its behavioural requirements; the two requirements that described the chase camera and the moped are superseded by `paper-route-look` and will be reconciled when `paper-route-mvp` is archived. -->

## Impact

- `apps/paper-route/src/scene/`: `world.ts` (camera, lights, post-processing), `street.ts` (chunk layout), `courier.ts` (bicycle and rider), `fx.ts` (throw arc and splash in the new projection), `palette.ts`, `quality.ts`.
- `apps/paper-route/src/hud/hud.ts` and the panel styling in `src/dom/`: the light visual system, plus the fonts in `package.json`.
- `apps/paper-route/src/game/display.ts`: speed and sun-elevation helpers tied to the old camera.
- Tests in `apps/paper-route/src/*.test.ts` that assert scene and street behaviour.
- `design/paper-route/` (canvas page "Dawn Diorama", renderer `prototype/render-iso.html`) is the reference.
- `docs/compliance/paper-route-2026-09-15.md` and the `game-compliance-audit` re-run in `paper-route-mvp` task 10.6: the vehicle change and the new art must be checked against audit items F1, D1 and D6.
- No change to `packages/*`, the API, the round maths or the operator bridge.
