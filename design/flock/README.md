# Flock — design sources

The approved design for game #4 is the "Flock — rams join" page of the design canvas, approved by the user on 4 Oct 2026:
https://claude.ai/artifact/YNuJp8cLRw7sAVo89cMtMh

The canvas is the source of truth. The files here are the code it was built from, kept as the art and motion reference for `apps/flock`.
- `world2.js` is the shared dusk scene: the round engine for the boards, the HUD values, the sky, the ground, the hero ram, the wolf and the helpers.
- `flock.js` is the flock layer:
  - the slot table and join order;
  - `flockCount(v) = floor(24 · ln(v)^1.6)`;
  - joining, leaving and fleeing rams;
  - the flock's words.
- `build.mjs` writes the board files into `boards/` and the canvas index. Run `node design/flock/build.mjs design/flock/boards/canvas.json`.
- `boards/` holds the generated `.dc.html` artboards and the canvas index, as published.

These are Canvas 2D sketches, not production code. `apps/flock` ports the drawing to PixiJS atlas frames (see `openspec/changes/flock-mvp/design.md`, D6).

Motion rules from the user's reviews:
- every animal faces the way it moves;
- background animals hold a steady pace while the runner speeds up;
- designs animate.
