# Paper Route audio sources

All placeholder audio is **generated procedurally** by `scripts/synth.mjs` (pure JavaScript synthesis at 48 kHz mono) and encoded by `scripts/build-audio.mjs` (MP3 via `@breezystack/lamejs`, WebM/Opus via Chrome WebCodecs). No samples, recordings or third-party sound libraries are used, so there are **no third-party licences**. Everything is © Triptych Studio.

| Cue | Function | Notes |
|---|---|---|
| tick | `sfxTick` | UI tick |
| bet | `sfxBet` | two-note pluck |
| throw | `sfxThrow` | neutral airy whoosh, identical for every throw (audit D6) |
| land | `sfxLand` | soft porch thump |
| return | `sfxReturn` | neutral tone for rounds ending at or below stake (RTS 14F) |
| win | `sfxWin` | short, restrained chime for rounds ending above stake only |
| wipeout | `sfxWipeout` | tyre skid and thud, no comedy effects |
| splash | `sfxSplash` | setback splash, light profiles only |
| engine | `engineLoop` | seamless 2 s moped loop; pitch follows speed only with intensity effects on |

Regenerate with `pnpm --filter @triptown/paper-route audio`. Replace with final assets before commercial launch, and update this file with their sources and licences.
