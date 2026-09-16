# Audio sources

All files in this folder are **placeholders** generated from code in this repository:

| File | Made by | Licence |
|---|---|---|
| `sfx.webm`, `sfx.mp3` (bet, jump, land, refuse, collect, win, finish) | `apps/gallop/scripts/synth.mjs` | Original work of Triptych Studio, no third-party material |
| `lobby` (crowd and floodlight hum between rounds) | `apps/gallop/scripts/synth.mjs` | Same as above |
| `stem-base` (crowd), `stem-drums` (gallop hoofbeats), `stem-lead` (broadcast pulse) (`.webm`, `.mp3`) | `apps/gallop/scripts/synth.mjs` | Same as above |
| `tone.webm`, `tone.mp3` (required by the manifest, unused) | `apps/gallop/scripts/synth.mjs` | Same as above |

Rebuild with `pnpm --filter @triptown/gallop audio`. Encoders: MP3 via `@breezystack/lamejs` (LGPL, build-time only), WebM/Opus via Chrome WebCodecs + `webm-muxer` (MIT, build-time only). No encoder code ships to players.

The jump sound is the same for every jump; the landing or refusal sound plays only after the server's result. Music intensity follows the number of fences cleared. Replace all files with the final sound designer mix before commercial launch.
