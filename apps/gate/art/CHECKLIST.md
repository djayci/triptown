# Beat the Gate art checklist

Checked against the `beat-the-gate-mvp` spec requirement "Adult, harm-free art and non-racing copy" and AGENTS.md compliance rules 6 and 10. The art is vector placeholder work from `art/art.mjs`, packed by `pnpm atlas` into `public/assets/atlas.{png,json}`.

| Check | Status | Where |
|---|---|---|
| Jockey reads as an adult: head about 1/7 of standing height, long limbs, work gear (helmet, silks, breeches, boots) | Pass (placeholder) | `riderCrouched`, `riderUpright` |
| Horse has realistic proportions: long neck and head, deep chest, jointed legs; no big eyes, no smile, no cute styling | Pass (placeholder) | `BODY`, `GALLOP`, `standing` |
| No whip, fall, injury or distressed horse in any frame | Pass | all frames: gallop ×4, standing |
| Crash shows a closed gate on an empty opening; the horse stands unhurt in the field, facing away | Pass | `GateStage.slamGate` |
| Nothing is in or under the gate when it shuts (Portugal Reg. 308/2023 R7(b) by analogy, per The Lift audit) | Pass | `GateStage.slamGate` keeps the horse at `fieldX - 14` or beyond |
| Saddle cloth carries no number, so a mirrored sprite never shows a backwards numeral | Pass | `cloth` |
| No racing furniture: no starting stalls, finish post, numbered field or odds board | Pass | yard gate, barn and floodlights only |
| No durbar or emirate imagery (Sharia-state sensitivity, `night-meet-2026-09-16.md`) | Pass | — |
| Primary values readable on the night stage (contrast ≥ 3:1) | Pass | `useSkin(skin, FLOODLIGHT_GOLD)` in `src/main.ts`, enforced by `crash-client` theme |
| Style risk: thick-outline sticker look shared with the Candy house style | **Open** | For the concept compliance check (task 3.1) to rule on before art is final |
| Final art replaces placeholders | **Open** | Licensed or commissioned art before launch |
