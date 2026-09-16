# Paper Route art checklist — Dawn Diorama look

Run: 2026-09-16, against the built client at 390×844 (`?profile=regulated-uk` and `?profile=light`) and the scene preview. Screenshots in this folder: `paper-route-riding-uk.png`, `paper-route-win-uk.png`, `paper-route-wipeout-light.png`.

Checked against `docs/compliance/paper-route-2026-09-15.md` items F1 (minors appeal), D1 (setting) and D6 (illusion of skill), and the `paper-route-look` spec.

| # | Item | Result | Evidence |
|---|---|---|---|
| F1.1 | Courier reads as an adult: adult proportions and build, no child proportions | PASS | Rider is ~1.8 m against a 3.4–5.8 m house storey and a 4.2 m car; long limbs, seated upright on a full-size frame |
| F1.2 | Work clothing: helmet and high-visibility vest with reflective band | PASS | Helmet, hi-vis vest and two reflective bands on the rider |
| F1.3 | Vehicle is a utility delivery bicycle, not a child's or stunt bike | PASS | Double-diamond frame, upright bars, rear rack and cargo crate; **changed from the moped** — see note below |
| F1.4 | No stunts, tricks or slapstick | PASS | Ride, wobble and fallen poses only; the fallen pose is the rider sitting beside the bike |
| F1.5 | No children or characters who seem under 25 | PASS | One character in the scene |
| F1.6 | No animals, mascots or toy-like props | PASS | Scene inventory is houses, porches, paths, driveways, fences, hedges, trees, lamps, parked cars |
| F1.7 | No candy colours; muted, life-like palette | PASS | Muted greens, warm greys and brick tones (`scene/palette.ts`) |
| D1.1 | First light: low sun, long shadows, warm key with cooler shade | PASS | Fixed sun in `scene/world.ts`; shadows run across the road in every frame |
| D1.2 | Light never signals progress or what is coming | PASS | The multiplier-driven sun helper was removed; `world.test.ts` covers the fixed rig |
| D6.1 | No letterboxes, bins, hoops, markers or anything to aim at | PASS | `street.test.ts` asserts the scene inventory contains no such object |
| D6.2 | Nothing in the courier's travel lane that looks dodgeable | PASS | `street.test.ts` asserts every placement clears the lane |
| D6.3 | House spacing irregular, so no rhythm invites timing a throw | PASS | `street.test.ts` spacing test; measured gaps 9.4–27.6 m |
| D6.4 | Throws look identical whatever the moment | PASS | `fx.test.ts`: same duration, and apex depends on the throw's length only |
| D6.5 | Setback shown only on the event, and only where the profile allows | PASS | Splash and wobble fire on `BAD_MOLE` only; presentation check shows no splash under rising-only profiles |
| P1 | Result screens show returned and net only, no crash point | PASS | `paper-route-wipeout-light.png`: "Returned 1.15 · Net −3.85 · 1 paper delivered · 4 lost at wipeout" |
| P2 | Win copy and the accent only above stake | PASS | Presentation check, all five profiles |

## Note for the audit and for counsel

The courier's vehicle changed from a delivery moped to a utility delivery bicycle (`paper-route-iso-look` design D3). The earlier audit leaned partly on the moped being a licensed motor vehicle as an adult cue. The adult read now rests on build and proportions, helmet and high-visibility clothing, the upright utility bicycle with a cargo crate, and the absence of any stunt styling.

**This needs confirming in the `game-compliance-audit` re-run** (`paper-route-mvp` task 10.6) against CAP 16.3.12/16.3.14, Portugal R7c and AGCO 2.03. If a bicycle is not accepted, the fallback is the same rider on a delivery moped, which changes the courier model only.
