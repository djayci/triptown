# Audio sources

All files in this folder are **placeholders** generated from code in this repository:

| File | Made by | Licence |
|---|---|---|
| `sfx.webm`, `sfx.mp3` (tick, bet, whack, setback, boost, win, bigwin, crash) | `apps/whack/scripts/synth.mjs` | Original work of Triptych Studio, no third-party material |
| `lobby` (arcade loop for the betting screen) | `apps/whack/scripts/synth.mjs` | Same as above |
| `stem-base`, `stem-drums`, `stem-lead` (`.webm`, `.mp3`) | `apps/whack/scripts/synth.mjs` | Same as above |
| `tone.webm`, `tone.mp3` | `apps/whack/scripts/synth.mjs` | Same as above |

Rebuild with `pnpm --filter @triptown/whack audio`. Encoders: MP3 via `@breezystack/lamejs` (LGPL, build-time only), WebM/Opus via Chrome WebCodecs + `webm-muxer` (MIT, build-time only). No encoder code ships to players.

Note: the design called for AI-generated placeholders. Procedural synthesis was used instead so there are no licence terms or account costs to track. Replace all files with the final sound designer mix before commercial launch.
