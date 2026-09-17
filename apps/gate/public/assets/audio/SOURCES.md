# Audio sources

All files in this folder are **placeholders** generated from code in this repository:

| File | Made by | Licence |
|---|---|---|
| `sfx.webm`, `sfx.mp3` (tick, bet, collect, setback, boost, return, win, bigwin, crash) | `apps/gate/scripts/synth.mjs` (collect: hoofbeats and latch; crash: gate slam) | Original work of Triptych Studio, no third-party material |
| `lobby` (loop for the betting screen) | `apps/gate/scripts/synth.mjs` | Same as above |
| `stem-base`, `stem-drums`, `stem-lead` (`.webm`, `.mp3`) | `apps/gate/scripts/synth.mjs` | Same as above |
| `tone.webm`, `tone.mp3` | `apps/gate/scripts/synth.mjs` | Same as above |

Rebuild with `pnpm --filter @triptown/gate audio`. Encoders: MP3 via `@breezystack/lamejs` (LGPL, build-time only), WebM/Opus via Chrome WebCodecs + `webm-muxer` (MIT, build-time only). No encoder code ships to players.

Music intensity follows the multiplier only (shared controller). The gate slam plays only on the CRASH event, with no creak or wind-up before it. Replace all files with the final sound designer mix before commercial launch.
