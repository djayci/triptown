// Builds Flock's audio: composes every cue with scripts/synth.mjs, encodes WebM/Opus and MP3 with ffmpeg,
// and writes public/assets/audio/audio.json (the manifest @triptown/engine's AudioManager reads).
// Usage: node scripts/build-audio.mjs   (needs ffmpeg with libopus and libmp3lame on PATH)
//
// Rules (flock-mvp spec "Flock has its own audio"):
// - written for Flock alone: nothing here is copied or derived from another game's audio;
// - within the 1.5 MB budget (scripts/check-audio-budget.mjs);
// - nothing depends on anything but the multiplier, elapsed time and what is already on screen. The
//   shared controller picks the cue; `win`/`bigwin` play only on a result the base celebrates.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import {
  ROUND_BARS,
  ROUND_TIERS,
  ROUND_TIER_PACE,
  betSting,
  bigWinSting,
  crashSting,
  renderLobby,
  renderRound,
  returnSting,
  winSting,
} from './music.mjs';
import {
  RATE,
  buffer,
  declick,
  handDrum,
  hoof,
  mix,
  mixWrap,
  mtof,
  noise,
  normalize,
  pluck,
  random,
  reverb,
  setSeed,
  biquad,
  osc,
  secs,
} from './synth.mjs';

const OUT = 'public/assets/audio';
const MUSIC_SEED = 0xf10c4;
const SFX_SEED = 0xd05c;

// ---- music: see scripts/music.mjs ("Stampede", a hoedown whose band speeds up through the round) ----

// ---- hooves: one ram's gallop, then more and more of the flock's (src/audio/hooves.ts) -------------

/** The cadence the hoof loops are rendered at, strides per second; the player re-rates them to the legs. */
const HOOF_CADENCE = 2.2;
/** Six of the hero's strides: every ram's stride divides it, so each loop is seamless. */
const HOOF_LOOP = 6 / HOOF_CADENCE;
const HOOF_SEED = 0x400f;

const rmsOf = (b) => Math.sqrt(b.reduce((s, v) => s + v * v, 0) / b.length);
const toRms = (b, target) => {
  const k = target / rmsOf(b);
  for (let i = 0; i < b.length; i++) b[i] *= k;
  return b;
};

/** One ram's gallop through the loop: three hooves a stride, ta-ta-tum. `far` dulls it with distance. */
function gallop(b, { strides, phase, weight, pitch, far }) {
  const period = HOOF_LOOP / strides;
  for (let s = 0; s < strides; s++) {
    const t0 = phase + s * period;
    [
      [0, 0.75],
      [0.13, 0.6],
      [0.29, 1],
    ].forEach(([f, w]) => {
      let h = hoof(weight * w * (0.85 + random() * 0.3), pitch * (0.92 + random() * 0.16));
      if (far > 0) h = biquad(h, 'lowpass', 3200 - far * 2200);
      mixWrap(b, h, t0 + f * period * (0.9 + random() * 0.2));
    });
  }
}

/** A flock of `rams` galloping, each at its own stride and step, farther ones duller. */
function herd(rams, { pitch = 82, farFrom = 0.3, farTo = 1 } = {}) {
  const b = buffer(HOOF_LOOP);
  for (let r = 0; r < rams; r++)
    gallop(b, {
      strides: 5 + Math.floor(random() * 3),
      phase: random() * HOOF_LOOP,
      weight: 0.6 + random() * 0.4,
      pitch,
      far: farFrom + random() * (farTo - farFrom),
    });
  return b;
}

/** The hero alone: close, in step, the run's heartbeat. */
function heroHooves() {
  const b = buffer(HOOF_LOOP);
  gallop(b, { strides: 6, phase: 0, weight: 1, pitch: 72, far: 0 });
  return toRms(b, 0.1);
}

/** A big flock's ground rumble: low earth noise, shaken by the stride. */
function rumble() {
  const b = biquad(biquad(noise(HOOF_LOOP), 'lowpass', 170), 'lowpass', 220);
  for (let i = 0; i < b.length; i++)
    b[i] *= 0.7 + 0.3 * Math.sin((2 * Math.PI * HOOF_CADENCE * 6 * i) / RATE / 6);
  return b;
}

/** The flock's layers, quietest first: they add up, so more rams on screen is more hooves heard. */
function hoofLayers() {
  const few = toRms(herd(5, { farFrom: 0.1, farTo: 0.4 }), 0.075);
  const band = toRms(herd(26, { farFrom: 0.3, farTo: 0.8 }), 0.08);
  const big = herd(110, { farFrom: 0.5, farTo: 1 });
  mix(big, toRms(rumble(), rmsOf(big) * 0.6));
  return {
    hero: { pcm: heroHooves(), from: -1, full: 0 },
    few: { pcm: few, from: 0, full: 6 },
    band: { pcm: band, from: 6, full: 45 },
    herd: { pcm: toRms(big, 0.095), from: 45, full: 170 },
  };
}

// ---- effects --------------------------------------------------------------------------------------

/** A dry wooden click for the countdown. */
function tick() {
  const b = biquad(noise(0.05), 'bandpass', 2300, 6);
  for (let i = 0; i < b.length; i++) b[i] *= Math.exp(-i / (0.006 * RATE));
  mix(b, osc(0.05, 1600), 0, 0.15);
  return normalize(declick(b), 0.5);
}

const bet = betSting;

/** CASH OUT: a gate latch dropping into its keeper — a bright click, a wooden knock, a short rattle. */
function collect() {
  const b = buffer(0.6);
  const click = biquad(noise(0.03), 'bandpass', 3600, 8);
  for (let i = 0; i < click.length; i++) click[i] *= Math.exp(-i / (0.004 * RATE));
  mix(b, click, 0, 1.2);
  mix(b, handDrum(180, { len: 0.25, body: 0.05, slap: 0.6 }), 0.035, 0.8);
  for (let k = 0; k < 3; k++) {
    const r = biquad(noise(0.02), 'bandpass', 2800 - k * 300, 6);
    for (let i = 0; i < r.length; i++) r[i] *= Math.exp(-i / (0.003 * RATE));
    mix(b, r, 0.09 + k * 0.035, 0.5 / (k + 1));
  }
  return normalize(reverb(b, { mixAmt: 0.15, tail: 0.4 }), 0.8);
}

/** A ram falls in beside him: three soft hooves, close together. Quiet, so a fast climb is a patter. */
function join() {
  const b = buffer(0.35);
  for (const [t, w] of [
    [0, 0.5],
    [0.06, 0.4],
    [0.13, 0.6],
  ])
    mix(b, hoof(w), t);
  return normalize(b, 0.5);
}

/** A split: hooves breaking away and fading, and a falling two-note figure. No harm in it. */
function setback() {
  const b = buffer(1.2);
  for (let k = 0; k < 7; k++) mix(b, hoof(1 - k * 0.12), k * 0.08 + random() * 0.02, 0.8 - k * 0.1);
  mix(b, pluck(mtof(57), { len: 0.6, bright: 0.4 }), 0.02, 0.5);
  mix(b, pluck(mtof(52), { len: 0.8, bright: 0.3 }), 0.22, 0.5);
  return normalize(reverb(b, { mixAmt: 0.2, tail: 0.5 }), 0.8);
}

/**
 * The wolf appears (scripts/music.mjs `crashSting`: the band stops on one hit, a howl far off), and the
 * flock scatters: a burst of hooves breaking up and running off in every direction, fading and dulling
 * as they go, under a rush of dust. Nothing is caught or hurt: they only run.
 */
function crash() {
  const b = crashSting();
  const scatter = buffer(1.6);
  for (let k = 0; k < 34; k++) {
    const t = 0.06 + Math.pow(random(), 1.4) * 1.1;
    const away = Math.min(1, t / 1.1);
    let h = hoof(0.9 - away * 0.4 + random() * 0.2, 70 + random() * 25);
    h = biquad(h, 'lowpass', 3600 - away * 2600);
    mix(scatter, h, t, (0.55 - away * 0.4) * (0.7 + random() * 0.3));
  }
  const dust = biquad(biquad(noise(1.4), 'lowpass', 1400), 'highpass', 150);
  for (let i = 0; i < dust.length; i++) {
    const t = i / RATE;
    dust[i] *= Math.min(1, t / 0.12) * Math.exp(-t / 0.45) * 0.18;
  }
  mix(scatter, dust, 0.05);
  mix(b, reverb(scatter, { mixAmt: 0.25, room: 0.8, tail: 0.6 }), 0, 0.9);
  return normalize(b, 0.9);
}

const win = winSting;

const bigwin = bigWinSting;

const returned = returnSting;

// ---- encode ---------------------------------------------------------------------------------------

/** 16-bit PCM WAV, mono (a Float32Array) or stereo ({ L, R }). */
function wav(samples) {
  const chans = samples instanceof Float32Array ? [samples] : [samples.L, samples.R];
  const n = Math.min(...chans.map((c) => c.length));
  const data = Buffer.alloc(n * 2 * chans.length);
  for (let i = 0; i < n; i++)
    chans.forEach((c, k) =>
      data.writeInt16LE(
        Math.round(Math.max(-1, Math.min(1, c[i])) * 32767),
        (i * chans.length + k) * 2,
      ),
    );
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(chans.length, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2 * chans.length, 28);
  h.writeUInt16LE(2 * chans.length, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const tmp = mkdtempSync(pathJoin(tmpdir(), 'flock-audio-'));
/** Encodes WebM/Opus at `kbps` and an MP3 fallback at `mp3kbps`, keeping the source's channel count. */
function encode(name, samples, kbps, mp3kbps = kbps + 16, { mp3Mono = false } = {}) {
  const src = pathJoin(tmp, `${name}.wav`);
  writeFileSync(src, wav(samples));
  const q = ['-hide_banner', '-loglevel', 'error', '-y', '-i', src];
  execFileSync('ffmpeg', [
    ...q,
    '-c:a',
    'libopus',
    '-b:a',
    `${kbps}k`,
    // Constrained VBR keeps busy music near its target bitrate, so the budget holds.
    '-vbr',
    'constrained',
    pathJoin(OUT, `${name}.webm`),
  ]);
  execFileSync('ffmpeg', [
    ...q,
    ...(mp3Mono ? ['-ac', '1'] : []),
    '-c:a',
    'libmp3lame',
    '-b:a',
    `${mp3kbps}k`,
    pathJoin(OUT, `${name}.mp3`),
  ]);
  return [`audio/${name}.webm`, `audio/${name}.mp3`];
}
const ms = (s) => Math.round(s * 1000);

mkdirSync(OUT, { recursive: true });

// Music first, on its own pinned seed, so re-voicing an effect can never change it.
setSeed(MUSIC_SEED);
const tiers = ROUND_TIERS.map((t) => ({ ...t, pcm: renderRound(t.bpm, t.layer) }));
const lobbyBed = renderLobby();

setSeed(SFX_SEED);
const effects = {
  tick: tick(),
  bet: bet(),
  collect: collect(),
  join: join(),
  setback: setback(),
  crash: crash(),
  win: win(),
  bigwin: bigwin(),
  return: returned(),
};
setSeed(HOOF_SEED);
const hoofs = hoofLayers();

// The engine plays `boost` on a boost (+5%, only under the unregulated `light` profile's v4 config): on
// screen that is a few more rams falling in, so it sounds like one.
effects.boost = effects.join;

const GAP = 0.25;
let total = 0;
for (const b of Object.values(effects)) total += secs(b) + GAP;
const sheet = buffer(total);
const sprite = {};
let at = 0;
for (const [name, b] of Object.entries(effects)) {
  mix(sheet, b, at);
  sprite[name] = [ms(at), ms(secs(b))];
  at += secs(b) + GAP;
}

// The shared player's stems are a second of silence: Flock's round music is the tiered score, played by
// src/audio/ranch-music.ts on the same audio context, under the same mute and music volume.
const silence = buffer(1);
const quiet = encode('stem-silent', silence, 16);
const manifest = {
  sfx: { src: encode('sfx', sheet, 48), sprite },
  stems: Object.fromEntries(
    ['base', 'drums', 'lead'].map((k) => [k, { src: quiet, loop: [0, 1000] }]),
  ),
  lobby: {
    src: encode('lobby', lobbyBed, 56, 32, { mp3Mono: true }),
    loop: [0, ms(lobbyBed.L.length / RATE)],
  },
  // The shared tone is silence: the hooves below are Flock's own, and follow the flock on screen.
  tone: { src: quiet, loop: [0, 1000] },
  hooves: {
    cadence: HOOF_CADENCE,
    layers: Object.entries(hoofs).map(([name, l]) => ({
      src: encode(`hooves-${name}`, l.pcm, 24, 32, { mp3Mono: true }),
      from: l.from,
      full: l.full,
    })),
  },
  ranch: {
    pace: ROUND_TIER_PACE,
    bars: ROUND_BARS,
    // Stereo Opus for the devices that play it; the MP3 fallback is mono to fit four tiers in the budget.
    tiers: tiers.map((t, i) => ({
      src: encode(`ranch-${i + 1}`, t.pcm, 64, 40, { mp3Mono: true }),
      bpm: t.bpm,
      loopMs: ms(t.pcm.L.length / RATE),
    })),
  },
};
writeFileSync(pathJoin(OUT, 'audio.json'), JSON.stringify(manifest, null, 1));
rmSync(tmp, { recursive: true, force: true });
console.info(
  `audio: ${Object.keys(effects).length} effects, ${tiers.length} round tiers, lobby and hooves written to ${OUT}`,
);
