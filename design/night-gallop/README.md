# Night Gallop design reference

This folder holds the concept canvas for `openspec/changes/night-gallop-mvp`. The published canvas is https://claude.ai/artifact/Txzxqhhh49B2yC9JvbLbAa. Its pages still use the earlier working title, "Night Meet".

- `canvas.html`: the full canvas as a single file. It opens offline in a browser with view and export.
- `*.dc.html`: the Night Meet state artboards: live loop, betting gap, bet A collected, in profit, win, returned, lights out and rules. Each one animates a canvas scene with a placeholder horse silhouette.
- `directions/`: the five first scene directions. Night Meet (`Floodlight.dc.html`) was the one picked.
- `src/`: the scene and engine sources plus the generators used to build the artboards. `nm-scene.js` is the scene-layer reference for design D8.

These are mockups and not production code. The copy on the artboards comes from before the audit, so it still says "race", "slip" and "Night Meet". The shipped copy follows the vocabulary rules in `specs/gallop-game-client`.
