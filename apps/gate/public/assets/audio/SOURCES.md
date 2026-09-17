# Audio sources

All files in this folder are **placeholders** generated from code in this repository. None of it is shared with Whack Crash: the horse game has its own highlife soundtrack (rewritten 17 Sep 2026).

| File | Made by | Licence |
|---|---|---|
| `sfx.webm`, `sfx.mp3` (tick, bet, collect, setback, boost, return, win, bigwin, crash) | `apps/gate/scripts/synth.mjs`. Bet: latch, hoof stamps, whoosh. Tick: rush of air and a bell tap. Collect: hoofbeats and latch. Return: one muted guitar note. Win: guitar strum, the lead climbing to a held high D over horns and a pad, fading over about 2 s. Big win: the tune's opening line, a talking-drum fill and a longer resolve. Crash (gate shut): the gate slam, then a calm falling guitar phrase onto a soft B minor chord. Setback and boost are not played on this game's rising configurations. | Original work of Triptych Studio, no third-party material |
| `lobby` (loop for the betting screen) | `apps/gate/scripts/synth.mjs`: relaxed highlife in D major at 120 BPM, guitar, bell and shaker, no horns or kick | Same as above |
| `stem-base`, `stem-drums`, `stem-lead` (`.webm`, `.mp3`) | `apps/gate/scripts/synth.mjs`, the round music: fast highlife-style groove in B minor at 150 BPM. Base (always on): kick, claps, octave bass pitched for small speakers, guitar, shaker, and the four-bar melody on a trumpet-like lead. Drums (join at medium speed): congas, bell timeline, talking-drum runs. Lead (joins at high speed): horn stabs and the melody doubled an octave up | Same as above |
| `tone.webm`, `tone.mp3` | `apps/gate/scripts/synth.mjs`: gallop loop over wind; its rate rises with the multiplier | Same as above |

Rebuild with `pnpm --filter @triptown/gate audio`. Encoders: MP3 via `@breezystack/lamejs` (LGPL, build-time only), WebM/Opus via Chrome WebCodecs + `webm-muxer` (MIT, build-time only). No encoder code ships to players.

Music layers and the gallop rate follow the displayed multiplier only (shared controller), never time left or the crash, and they stop changing once IN! is pressed, so riding home sounds the same for every result. The gate slam plays only on the CRASH event, with no creak or wind-up before it. Replace all files with the final sound designer mix before commercial launch.
