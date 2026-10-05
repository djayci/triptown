# Flock audio sources

Every sound here was synthesized for Flock by `scripts/build-audio.mjs`. The music and its stings (bet, win, big win, return) are in `scripts/music.mjs`; the other effects are in `scripts/synth.mjs`. Nothing is recorded, sampled or licensed, and nothing is copied or derived from another game's audio. Rebuild with `pnpm --filter @triptown/flock audio`, which needs ffmpeg with libopus and libmp3lame.

## Round music: "Stampede", a hoedown whose band speeds up

The user's briefs (4–5 Oct 2026): country and ranch, uplifting, upbeat, exciting, melodic, "like Cotton Eye Joe", speeding up through the round with the pitch fixed. Written from scratch in `scripts/music.mjs` after every earlier score was rejected and deleted.

A hoedown on a dance floor in D major. The hook is eight bars over D–G–D–A–D–G–A–D: a two-bar call up to the high D, an answer that runs up to the A and lands on the A chord, the call again climbing to the B, and home. A fiddle section plays it: three bowed voices a few cents and milliseconds apart, each played as one continuous bow (a scoop into accented notes, the bow easing between notes, vibrato growing on long ones, bow noise on each start) through a fiddle-body filter. Under it, a four-on-the-floor kick, claps with a stomp on 2 and 4, off-beat open hats, an off-beat saw-and-sine bass and a banjo forward roll (a tuned Karplus-Strong string). Every oscillator is band-limited. One reverb and one echo send, kick-ducked bass and chords, a bus compressor and a look-ahead limiter, and no saturation.

| File | Tempo | What it adds | Starts at pace |
|---|---|---|---|
| `ranch-1.{webm,mp3}` | 138 BPM | The groove (kick, claps, hats, off-beat bass), the banjo rolling eighths, a soft pad, the fiddles on the hook | 0 |
| `ranch-2.{webm,mp3}` | 144 BPM | + shaker sixteenths, the bass's octave pop, off-beat chord stabs, the banjo in sixteenths | 0.15 |
| `ranch-3.{webm,mp3}` | 150 BPM | + the hook an octave up, a crash on the one and a snare build into it | 0.35 |
| `ranch-4.{webm,mp3}` | 156 BPM | + a harmony fiddle a third below, the bass pumping sixteenths | 0.60 |

`src/audio/ranch-music.ts` steps up one tier on the next bar line as the round's elapsed time (the shared `pace`) passes each threshold, carrying on from the same bar of the tune. Each tier is rendered at its own speed, so the band gets faster while the pitch stays fixed. The tiers are 8-bar loops in stereo Opus at 64 kbps (constrained VBR), with a mono 40 kbps MP3 fallback.

The shared player's three stems are one second of silence (`stem-silent.{webm,mp3}`), because Flock's tiered score replaces them. The tier player uses the same audio context and master gain, so mute, music volume and the page-hidden suspend all apply to it.

## Hooves: one ram to a herd

The user's idea (5 Oct 2026): a steps sound that builds up as the sheep join. `src/audio/hooves.ts` plays four seamless 2.7 s loops together, in step. The layers add up, so the sound grows from one ram trotting to a herd's rumble. Each layer comes in with the number of rams the stage has on screen, which comes from the multiplier. All the layers play at one rate set by the legs on screen (`strideCadence`, from the run speed, which comes from elapsed time). They fade out as the run pulls up after CASH OUT, and stop under the wolf cue at a crash. They never know the crash time. Mono, 24 kbps Opus and 32 kbps MP3. The shared tone is silence (`stem-silent`), so the hero is never heard twice.

## The rest

| File | What it is |
|---|---|
| `lobby.{webm,mp3}` | Between rounds: "Stampede" at 126 BPM, 16 bars. The banjo plays the hook while the fiddles hold the chords, then the fiddles take it with the banjo rolling under them, over a lighter groove. Stereo Opus at 56 kbps, mono 32 kbps MP3 |
| `hooves-hero.{webm,mp3}` | The hero's own gallop, three hooves a stride ("ta-ta-tum"), close. Always on while he runs |
| `hooves-few.{webm,mp3}` | 5 rams, each on its own stride and step. In from the first ram on screen, full at 6 |
| `hooves-band.{webm,mp3}` | 26 rams, farther and duller. In from 6 rams, full at 45 |
| `hooves-herd.{webm,mp3}` | 110 rams and the ground's rumble. In from 45 rams, full at 170 |
| `sfx.{webm,mp3}` | Effects sprite, with offsets in `audio.json`. See the list below |

The cues in `sfx`:
- `tick`;
- `bet`: 0.75 s, a quick banjo pickup up the D chord and a rush of air into one tight band hit (kick, clap, a bright D stab), in the round music's key and over before the hook takes off;
- `collect`: the gate latch, for CASH OUT;
- `join`: a ram falls in, at each milestone. It is also played for `boost`, which only the unregulated `light` profile's v4 config produces;
- `setback`: the flock splits;
- `crash`: only on the crash, when the wolf appears. The band stops dead on one hard hit (kick, low boom, a heavy B-flat chord: the run's D major cut off by its flat sixth), a wolf howls far off (an almost pure voice sliding up, holding, falling away, mostly room), and the flock scatters: a burst of hooves running off and fading, under a rush of dust. No snarl, no attack, nothing hurt;
- `win`: a banjo roll up D major, a band hit and crash, the fiddles running up to the top D and holding it, on celebrated results only;
- `bigwin`: a snare build, two band hits, and the fiddles' call up a tone in E over the banjo;
- `return`: one soft, muted banjo note, never a win sound.

No bleat anywhere: it is the most child-appealing sound a sheep makes (flock-mvp D7). The music stays in the game; Kenya's Advertising Regulations 2026 reg 9(j) bans jingles and hooks in adverts, so no Flock trailer for Kenya reuses it.
