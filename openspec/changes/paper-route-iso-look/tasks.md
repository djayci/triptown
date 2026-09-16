# Tasks

## 1. Camera and world

- [x] 1.1 Replace the chase rig in `scene/world.ts` with the orthographic camera from design D1 (fixed offset and frustum width, portrait and landscape aspect handling, follow along the travel axis without rotation); verify a unit test that two equal-size objects at the near and far ends of the visible street project to the same screen size, and that the courier's screen position is unchanged between multiplier 1.00 and 20.00
- [x] 1.2 Fit the shadow camera to the visible frustum with the low morning sun of design D7, and remove the multiplier-driven sun helper from `game/display.ts` and its callers; verify unit tests that the sun angle and colour are identical at 1.00 and at the maximum multiplier, and that `ridingSpeed` keeps its current behaviour with intensity on and off
- [x] 1.3 Re-derive chunk length, live chunk count and draw distance for the new frustum; verify a scripted 60 s ride holds constant memory with no visible gap at the far end of the street at any quality tier

## 2. Street

- [x] 2.1 Rebuild `scene/street.ts` chunks to cover the full cross-section (far gardens and houses, far pavement and kerb, road with centre line, near kerb and pavement, near gardens and planting), seeded per chunk index; verify unit tests that every element is present in a built chunk and that a rebuilt chunk is identical to its first build
- [x] 2.2 Place houses at varied spacing with porches, paths, driveways, fences, hedges and trees, plus street furniture and parked cars; verify a unit test over 20 chunks that no fixed house interval repeats and that porch positions are reachable by `porchAlongside`
- [x] 2.3 Enforce the clear travel lane: assert placement rules in code and verify a unit test that no object in any chunk overlaps the courier's lane, and that no target, collectable or scoring marker exists in the scene inventory
- [x] 2.4 Re-tune the vertex-colour palette in `scene/palette.ts` to the Dawn Diorama reference; verify a side-by-side screenshot against the F1 frame at 390×844

## 3. Courier

- [x] 3.1 Rebuild `scene/courier.ts` as an adult rider on a utility delivery bicycle (helmet, high-visibility vest with reflective band, upright posture, rear cargo crate, hip bag), with ride, wobble and fallen poses; verify unit tests for the three poses and a side-by-side screenshot against the F1 and F3 frames
- [x] 3.2 Show one roll in the crate per unthrown paper; verify unit tests for 5, 3 and 0 rolls
- [x] 3.3 Run the release art checklist (audit items F1, D1, D6) against the new scene and the lobby tile; verify every item passes and record the result in `docs/compliance/evidence/<date>/`

## 4. Effects

- [x] 4.1 Rebuild the throw arc and landing in `scene/fx.ts` for the new projection, from the crate to the porch alongside; verify a unit test that throws at different moments produce the same arc duration, shape and sound, and that the paper lands at a porch every time
- [x] 4.2 Rebuild the setback splash and wobble at the courier's wheels; verify unit tests that they play only on a setback event under a setbacks-on profile and never under a rising-only profile
- [x] 4.3 Implement the masked blur and haze pass of design D5 (half-resolution separable blur, vertical mask, warm gradient), off under reduced motion or reduced effects; verify unit tests for the mask bands and a screenshot test that the courier band is sharp while the top and bottom bands are soft

## 5. HUD and panels

- [x] 5.1 Add Chivo and Chivo Mono through `@fontsource` with Latin subsets and only the weights used, and remove the unused Barlow faces; verify `pnpm --filter @triptown/paper-route build` passes the bundle budget check
- [x] 5.2 Restyle `hud/hud.ts` to the light system (near-white panels, ink text, single warm accent on the primary action and win copy only, monospaced money and clock), keeping the current structure, intents and in-place DOM patching; verify the HUD renders every state at 360×640 and 390×844 with all controls at least 44 px tall
- [x] 5.3 Restyle the rules, history, fairness and settings panels to match; verify each opens over the scene and stays readable at 360×640
- [x] 5.4 Check HUD contrast over the brightest and darkest parts of the scene and add a scrim if needed; verify measured contrast meets the project's accessibility floor in both cases
- [x] 5.5 Verify money columns do not jitter: a test that a value counting from 1.00 to 12.00 keeps a fixed digit width and does not move the surrounding layout

## 6. Performance

- [x] 6.1 Measure draw calls, frame time and memory for the new scene at each tier on the throttled headless setup; verify the measurements are recorded and the high tier meets the agreed draw-call budget
- [x] 6.2 Re-tune the quality ladder in `scene/quality.ts` so the depth pass drops first, then draw distance and chunk count, then shadow resolution, then small-object shadow casting; verify with 6× CPU throttling that the tier drops within about 2 seconds and the HUD keeps updating
- [x] 6.3 Resolve the design's open question on far-side detail at the low tier using the 6.1 measurements; verify the chosen setting holds the frame-time target on the throttled run

## 7. Verification

- [x] 7.1 Update the scene and display unit tests to the new shapes without weakening any behavioural assertion; verify `pnpm turbo run lint typecheck test --filter=@triptown/paper-route --force` passes
- [x] 7.2 Re-run `pnpm check:presentation` for light, regulated-uk, regulated-on, regulated-br and pt-draft; verify all pass and save the output under `docs/compliance/evidence/<date>/`
- [x] 7.3 Re-run `pnpm check:timing` for regulated-uk and regulated-on; verify both pass and save the output alongside
- [x] 7.4 Play full rounds in the sandbox iframe under light and regulated-uk, covering a throw, a throw-all, a wipeout with papers banked, a setback under light and a reconnect; verify every round completes with no console errors
- [x] 7.5 Run the production build (`no-mock`, bundle and audio checks) and the full workspace `lint typecheck test --force`; verify all pass
