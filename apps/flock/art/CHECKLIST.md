# Flock art checklist

The rules are set by the flock-mvp spec ("Adult art and plain copy") and the concept audit `docs/compliance/flock-2026-10-04.md`. Check this list against `public/assets/atlas-dusk.png` after every `pnpm atlas`.

The art is placeholder vector art, ported from the approved canvas (`design/flock/`).

## Grown animals, not cartoons (GH Underage ii, KE LN 112 reg 92(1)(d))

- [x] Every ram has a full curl of horn: the clearest adult cue.
- [x] Every ram has a long Roman-nosed head, carried forward.
- [x] The fleece is matted and uneven, with crimp strokes and a ragged belly fringe. It is not a round, soft-toy cloud.
- [x] No eyes, no face, no mouth, no expression, on any ram or on the wolf.
- [x] No lambs or juveniles; every ram is drawn at the same adult proportions.
- [x] The proportions are life-like: body, legs and head in roughly real ratios, with nothing enlarged.
- [x] The palette is muted dusk: browns and dusk blues, with rim light from a low sun. It has no saturated candy colours.
- [x] The wolf is a lean adult silhouette with a cold rim light. Its ears, hackles and tail are drawn as silhouette only.

## No harm and no near miss (spec "Pen and wolf never read as a near miss or as harm")

- [x] No frame shows a bite, blood, a fall or an animal lying down.
- [x] The wolf has two kinds of frame, standing and entry stride. None of them is a lunge, pounce or open jaw.
- [x] The stage stops the wolf `WOLF_GAP` (55 px) clear of the hero's nose (`src/game/stage.ts`).

## Cultural rule (Lagos Responsible Gaming Regs reg 7(1)(t) and (q))

- [x] No frame shows rams butting, clashing or facing each other. Every ram faces its direction of travel.
- [x] No sacrifice, slaughter or festival cue: no knife, rope, tether, decoration or Sallah/Eid motif.
- [x] The hero never faces the wolf down. He has a braced pull-up frame (`hero-brake`) and no confrontation pose.

## Frames in the atlas (41)

- `hero-stand`, `hero-brake`, `hero-trot-0..7`, `hero-gallop-0..7`.
- `flock-stand`, `flock-brake`, `flock-trot-0..7`, `flock-gallop-0..7`. The stage tints far rams toward dusk blue.
- `wolf-stand`, `wolf-stride-0..3`.
