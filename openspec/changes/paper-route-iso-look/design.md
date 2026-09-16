## Context

See `proposal.md` — Why. The client already exists and works: `apps/paper-route` runs a three.js scene (`src/scene/world.ts`, `street.ts`, `courier.ts`, `fx.ts`, `quality.ts`), a DOM HUD (`src/hud/hud.ts`), and a controller that owns round state and talks to the round service. Only the look is wrong, so this change stays inside the scene, the HUD styling and the handful of display helpers tied to the old camera.

Constraints that shape the design:

- Mid-range phones. The current build holds 22–50 draw calls per frame with quality tiers stepping down on slow frames; the new view sees more of the street at once, so it has more to draw.
- The initial-download budget is 1.5 MB and the audio budget 1.5 MB, both enforced at build time (the build reports 0.85 MB and 146 KB today).
- The scene may never reveal the round's outcome, never imply skill, and never celebrate below the stake. Those rules live in `paper-route-client` and hold unchanged.
- The reference is the canvas page "Dawn Diorama" (F1–F4) and the prototype renderer `design/paper-route/prototype/render-iso.html`, which is the source of the camera angle, the palette and the scene inventory.

## Goals / Non-Goals

**Goals**

- One fixed orthographic camera, with the street rebuilt around it.
- The same streaming-chunk approach, so memory stays flat over a long session.
- A light HUD system with money set in a monospaced face.
- A depth treatment that is the first thing dropped when the device is slow.

**Non-Goals**

- No change to round flow, throws, settlement, events, the operator bridge, audio behaviour, rules or history content.
- No new art pipeline: the scene stays procedural geometry with vertex colours, as today. No textures, no imported models.
- No pixel-art filter. The two pixel directions were considered and rejected.
- No camera control for the player, and no cinematic camera moves.

## Decisions

### D1. Orthographic camera, fixed offset, street along one axis

The camera uses `THREE.OrthographicCamera` with a fixed offset from its aim point: (−15, 38, 34) world units, frustum width 13 m, near and far wide enough to hold the whole street slab. The route keeps its existing axis, running toward −Z; houses move to the +X side and the near pavement and parked cars to −X. That puts the street on a diagonal climbing to the upper left with the houses across it to the upper right, and the courier riding into the frame rather than away from it. The aim point slides along the route with the frame's aspect so the courier sits at the same height on every screen shape, which is what keeps them clear of the HUD panel.

*Why:* an orthographic camera is what makes the view read as a miniature rather than a runner, it keeps house sizes constant so chunk recycling is invisible, and it makes shadow-map and culling extents trivial to size.

*Alternative:* a perspective camera with a long lens. Rejected: it reintroduces convergence at the far end of the street, which is exactly the corridor look being replaced.

### D2. Rebuild the street as chunks laid out across the full view

Chunks keep their current role — built once, merged per chunk, recycled by distance — but each chunk now covers the whole cross-section: far gardens and houses, far pavement and kerb, road with centre line, near kerb and pavement, near gardens and planting. Chunk length and the number of live chunks are re-derived from the orthographic frustum, which sees a longer run of street than the chase camera did.

Object placement per chunk is seeded from the chunk index so the street is stable when a chunk is rebuilt, with varied house spacing. Nothing is placed in the courier's travel lane.

*Why:* the merge-per-chunk approach is what keeps the draw calls low, and it already exists.

*Alternative:* instanced meshes per object type across the whole street. Rejected for now: it complicates the vertex-colour palette work for a gain we do not need if the chunk budget holds. If the measured draw calls miss the budget, this is the first thing to try.

### D3. Courier: adult rider on a utility delivery bicycle

The rider is rebuilt at the proportions of the prototype: adult build, helmet, high-visibility vest with a reflective band, upright posture, rear cargo crate holding one roll per unthrown paper, plus a hip bag. The vehicle changes from a moped to a bicycle because the arcade paper round is a bicycle round, and the adult read moves entirely onto build, clothing and the utility bike.

*Why:* it is the one element that carries the genre reference, and it is the difference between "a courier on a round" and "a generic delivery scene".

*Risk:* the audit's adult-read requirement previously leaned on the motor vehicle. See Risks.

### D4. Light HUD system

Panels are near-white translucent (about 90% opacity) with a soft shadow and 16–22 px radii; text is near-black ink; one warm accent (sunrise orange) is used for the primary action and for win copy only. Chivo carries labels and headings, Chivo Mono carries money, multipliers and clock values, both self-hosted through `@fontsource` so the build stays offline and inside the bundle budget.

The HUD keeps its current structure, intents and the in-place DOM patching that makes taps reliable; only tokens, type and spacing change. Contrast is checked over both the brightest and the darkest parts of the scene, and a scrim behind the panels is added if it fails.

*Why:* a light HUD is what separates this from the dark crash-game norm, and monospaced money stops digits jumping while a value counts.

*Alternative:* keeping the dark glass HUD over the light scene. Rejected: it fights the miniature look and reads as a different product bolted on.

### D5. Depth treatment as a masked blur pass, first to be dropped

Depth of field is approximated in screen space: the scene renders to a target, a half-resolution separable blur is taken from it, and the blurred copy is composited back through a vertical mask that is opaque at the top and bottom bands and transparent through the courier band. Haze is a warm gradient over the upper part of the frame.

It is skipped entirely when reduced motion or reduced effects is on, and is the first effect the quality governor drops when frame time slips, before draw distance and before shadow resolution.

*Why:* a true depth-of-field pass is not worth its cost on a mid-range phone, and the band treatment is what the reference frames actually show.

*Alternative:* tilt-shift via a physically-based bokeh pass. Rejected on cost.

### D6. Throws and setbacks in the new projection

The throw arc runs from the crate to the porch of the house alongside, which now lies up and to the right in screen space; the arc, its duration and its landing behaviour are identical whatever the timing, as already required. The setback splash stays a puddle at the courier's wheels with a short wobble, and appears only when the profile allows setbacks.

### D7. Fixed morning light

The sun's angle and colour are constants for the whole round. The helper that raised the sun with the multiplier is removed, because lighting that tracks the multiplier reads as progress and as a tell. Riding speed keeps its existing behaviour: it varies with growth only when the profile enables intensity effects, and is constant otherwise.

### D8. Performance budget re-measured, tiers kept

The quality tiers (high, medium, low) and the frame-time governor stay as they are. The draw-call and frame-time budgets are re-measured for the new view, and the tier ladder is retuned against them: the depth pass goes first (D5), then draw distance and chunk count, then shadow map size, and at the lowest tier the near-side gardens and parked cars.

## Risks / Trade-offs

- **The bicycle weakens the adult cue that the audit relied on.** → Adult build, helmet, high-visibility clothing, upright utility bike with a cargo crate, and no stunt styling are all made normative in the spec. The art checklist runs against the new scene and the lobby tile, and the `game-compliance-audit` re-run (`paper-route-mvp` task 10.6) must clear it before release. If the audit or counsel rejects a bicycle, the fallback is the same rider on a delivery moped, which changes the courier model only.
- **More of the street is visible at once, so draw calls and shadow costs rise.** → Measure before tuning; chunk count and draw distance are the first levers, instancing is the fallback (D2).
- **Long shadows from a low sun need a wide shadow camera, which costs resolution.** → Fit the shadow camera to the visible frustum rather than the whole street, and drop small-object shadow casting on lower tiers.
- **Light HUD over a bright morning scene can fail contrast.** → Check contrast at both extremes; add a subtle scrim behind panels if needed. Ship only if the accessibility floor passes.
- **Two new font families could push the bundle past budget.** → Subset to Latin and the weights actually used; the budget check fails the build if it does not fit.
- **The rebuild touches every scene test.** → Keep the behavioural tests as the contract and rewrite only the scene-shape assertions; no behavioural test may be weakened to make the new scene pass.

## Migration Plan

1. Build the new scene and HUD in place on a branch. There is no live deployment yet, so no runtime flag and no data migration are needed.
2. Keep the prototype renderer as the visual reference, and compare each rebuilt element against the F1–F4 frames.
3. Re-run the existing verification set: unit and controller tests, the timing check, the presentation check for every profile, and the production build with its no-mock, bundle and audio checks.
4. Re-run the art checklist and the compliance audit before any preview deploy.
5. Rollback is a revert of the branch; the previous chase-camera client stays in history.

## Open Questions

- ~~Whether the far-side pavement and gardens are worth their draw cost at the low tier.~~ **Resolved by the 6.1 measurements:** the whole street costs 24 draw calls at the high tier and 14 at the low, so the far side (which carries the houses and porches the game is about) stays at every tier. The low tier drops the near-side gardens and parked cars instead.
