// Procedural placeholder audio for Gate Rush and Beat the Gate. Pure JS synthesis, 48 kHz mono Float32.
// Every sound here is generated from code in this file, so there are no third-party licences.

export const SR = 48000;
// A gallop is quicker than an arcade beat: 150 BPM, and the tone slot carries a hoofbeat loop.
export const BPM = 150;
export const BEAT = 60 / BPM;
export const LOOP_BEATS = 16;
export const LOOP_SECONDS = LOOP_BEATS * BEAT; // 7.5 s
export const TONE_SECONDS = 1;

const TAU = Math.PI * 2;
let seed = 1234567;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function buffer(seconds) {
  return new Float32Array(Math.round(seconds * SR));
}

/** Adds a voice into `out` starting at `start` seconds. `wrap` writes past the end back to the start (seamless loops). */
function add(out, start, seconds, fn, gain = 1, wrap = false) {
  const s0 = Math.round(start * SR);
  const n = Math.round(seconds * SR);
  for (let i = 0; i < n; i++) {
    let idx = s0 + i;
    if (wrap) idx %= out.length;
    else if (idx >= out.length) break;
    out[idx] += fn(i / SR, seconds) * gain;
  }
}

const env = (t, len, a = 0.004, r = 0.08) => Math.min(1, t / a) * Math.min(1, Math.max(0, (len - t) / r));
const expDecay = (t, k) => Math.exp(-t * k);
const square = (ph) => (ph % 1 < 0.5 ? 1 : -1);
const tri = (ph) => 1 - 4 * Math.abs((ph % 1) - 0.5);
const saw = (ph) => 2 * (ph % 1) - 1;

function lowpass(buf, cutoff) {
  let y = 0;
  const a = 1 - Math.exp((-TAU * cutoff) / SR);
  for (let i = 0; i < buf.length; i++) buf[i] = y += a * (buf[i] - y);
  return buf;
}

function normalize(buf, peak = 0.85) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh((buf[i] / max) * peak * 1.2) / Math.tanh(1.2);
  return buf;
}

// ---------- drums ----------
const kick = (t, len) => Math.sin(TAU * (50 * t + (100 * (1 - Math.exp(-t * 30))) / 30)) * expDecay(t, 14) * env(t, len, 0.001, 0.02);
const snare = (t, len) => (rand() * 0.8 * expDecay(t, 22) + Math.sin(TAU * 185 * t) * 0.5 * expDecay(t, 30)) * env(t, len, 0.001, 0.02);
const hat = (t, len) => {
  const n = rand();
  return (n - (hat.prev = (hat.prev ?? 0) * 0.6 + n * 0.4)) * expDecay(t, 60) * env(t, len, 0.001, 0.01);
};

// ---------- hooves and wind ----------
/** One hoof strike on turf: a low thump with a short dirt click. */
const hoof = (pitch = 1) => (t, len) =>
  (Math.sin(TAU * (95 * pitch) * t) * expDecay(t, 34) + rand() * 0.35 * expDecay(t, 90)) * env(t, len, 0.001, 0.02);

/** Filtered noise swell, for the rush of air at speed. */
function whoosh(out, start, seconds, gain, from = 400, to = 2600) {
  let y = 0;
  add(out, start, seconds, (t, len) => {
    const k = t / len;
    const cutoff = from + (to - from) * Math.sin(Math.PI * k);
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    y += a * (rand() - y);
    return y * Math.sin(Math.PI * k);
  }, gain);
}

// ---------- sfx ----------
function coinBlip(out, start, freq, gain = 0.5) {
  add(out, start, 0.08, (t, len) => (Math.sin(TAU * freq * t) * 0.7 + tri(freq * 2 * t) * 0.3) * env(t, len, 0.002, 0.05), gain);
  add(out, start + 0.07, 0.22, (t, len) => (Math.sin(TAU * freq * 1.335 * t) * 0.7 + tri(freq * 2.67 * t) * 0.3) * expDecay(t, 9) * env(t, len, 0.002, 0.08), gain);
}

/** Milestone: a quick rush of air past the horse. */
export function sfxTick() {
  const b = buffer(0.32);
  whoosh(b, 0, 0.3, 1.2, 600, 4200);
  add(b, 0, 0.05, (t, len) => Math.sin(TAU * 1600 * t) * expDecay(t, 70) * env(t, len, 0.001, 0.01), 0.25);
  return normalize(b, 0.55);
}

/** Round start: the yard latch lifts, two hoof stamps, and the rider is away. */
export function sfxBet() {
  const b = buffer(0.7);
  add(b, 0, 0.06, (t, len) => (square(1900 * t) * 0.4 + rand() * 0.6) * expDecay(t, 60) * env(t, len, 0.0005, 0.02), 0.5);
  add(b, 0.12, 0.12, hoof(1), 1);
  add(b, 0.24, 0.12, hoof(1.15), 0.9);
  whoosh(b, 0.3, 0.38, 0.9, 500, 3000);
  return normalize(b);
}

export function sfxSetback() {
  const b = buffer(1.0);
  const notes = [76, 75, 74, 73];
  notes.forEach((n, i) =>
    add(b, i * 0.09, 0.14, (t, len) => (saw(midi(n) * t) * 0.6 + square(midi(n - 12) * t) * 0.3) * env(t, len, 0.003, 0.05), 0.45),
  );
  for (let i = 0; i < 7; i++) coinBlip(b, 0.36 + i * 0.07 + Math.abs(rand()) * 0.03, 1500 + Math.abs(rand()) * 900, 0.28);
  return normalize(lowpass(b, 7000));
}

function fanfare(b, start, notes, step, sustain, gain = 0.5) {
  notes.forEach((n, i) => {
    const last = i === notes.length - 1;
    const len = last ? sustain : step * 1.4;
    add(b, start + i * step, len, (t, l) => (square(midi(n) * t) * 0.35 + tri(midi(n) * t) * 0.65) * env(t, l, 0.004, last ? 0.3 : 0.05) * (1 + 0.15 * Math.sin(TAU * 6 * t)), gain);
  });
}

/** Good mole: a short rising two-note blip, quieter than the win fanfare. */
export function sfxBoost() {
  const b = buffer(0.36);
  [72, 79].forEach((n, i) =>
    add(b, i * 0.07, 0.22, (t, len) => (Math.sin(TAU * midi(n) * t) * 0.7 + tri(midi(n) * 2 * t) * 0.3) * expDecay(t, 9) * env(t, len, 0.004, 0.08), 0.42),
  );
  add(b, 0.14, 0.18, (t, len) => Math.sin(TAU * midi(84) * t) * expDecay(t, 12) * env(t, len, 0.003, 0.06), 0.22);
  return normalize(lowpass(b, 9000), 0.7);
}

/** Neutral chime for a cash-out at or below the stake: no fanfare, no rising run (RTS 14F). */
export function sfxReturn() {
  const b = buffer(0.4);
  [69, 69].forEach((n, i) =>
    add(b, i * 0.1, 0.24, (t, len) => (Math.sin(TAU * midi(n) * t) * 0.8 + tri(midi(n) * 2 * t) * 0.2) * expDecay(t, 7) * env(t, len, 0.006, 0.12), 0.32),
  );
  return normalize(lowpass(b, 6000), 0.55);
}

export function sfxWin() {
  const b = buffer(1.1);
  fanfare(b, 0, [72, 76, 79, 84], 0.1, 0.6);
  add(b, 0.3, 0.6, (t, len) => (tri(midi(64) * t) + tri(midi(67) * t)) * 0.3 * env(t, len, 0.01, 0.3), 0.6);
  return normalize(lowpass(b, 9000));
}

export function sfxBigWin() {
  const b = buffer(2.2);
  fanfare(b, 0, [72, 76, 79, 84], 0.09, 0.2);
  fanfare(b, 0.4, [74, 77, 81, 86], 0.09, 0.2);
  fanfare(b, 0.8, [76, 79, 83, 88], 0.09, 1.1);
  for (let i = 0; i < 14; i++) coinBlip(b, 0.9 + i * 0.07, 1800 + Math.abs(rand()) * 1200, 0.18);
  add(b, 0.8, 0.12, kick, 0.8);
  return normalize(lowpass(b, 10000));
}

/** IN!: three quick hoofbeats on turf, then the yard latch clicking behind the horse. */
export function sfxCollect() {
  const b = buffer(0.62);
  [0, 0.11, 0.2].forEach((at, i) => {
    add(b, at, 0.09, (t, len) => Math.sin(TAU * (120 - i * 10) * t) * expDecay(t, 38) * env(t, len, 0.001, 0.03), 0.9);
    add(b, at, 0.02, (t, len) => rand() * env(t, len, 0.0005, 0.015), 0.35);
  });
  add(b, 0.42, 0.05, (t, len) => (square(2200 * t) * 0.4 + rand() * 0.6) * expDecay(t, 60) * env(t, len, 0.0005, 0.02), 0.5);
  return normalize(lowpass(b, 7000));
}

/**
 * CRASH: the yard gate slams shut. A heavy wooden thud and the latch dropping. It plays only on the
 * CRASH event; there is no creak or wind-up beforehand, which would be a warning.
 */
export function sfxGateSlam() {
  const b = buffer(0.9);
  add(b, 0, 0.35, (t, len) => Math.sin(TAU * 62 * t) * expDecay(t, 9) * env(t, len, 0.001, 0.08), 1);
  add(b, 0, 0.12, (t, len) => rand() * expDecay(t, 30) * env(t, len, 0.0005, 0.05), 0.9);
  add(b, 0.02, 0.25, (t, len) => (square(310 * t) * 0.5 + square(465 * t) * 0.3) * expDecay(t, 22) * env(t, len, 0.001, 0.05), 0.35);
  add(b, 0.16, 0.3, (t, len) => (Math.sin(TAU * 1850 * t) + Math.sin(TAU * 2710 * t) * 0.6) * expDecay(t, 16) * env(t, len, 0.001, 0.05), 0.3);
  return normalize(lowpass(b, 6500));
}

// ---------- music (seamless 4-bar loops) ----------
const CHORDS = [
  [48, 55, 60, 64], // C
  [45, 52, 57, 60], // Am
  [41, 48, 53, 57], // F
  [43, 50, 55, 59], // G
];

export function stemBase() {
  const b = buffer(LOOP_SECONDS);
  for (let bar = 0; bar < 4; bar++) {
    const chord = CHORDS[bar];
    for (let e = 0; e < 8; e++) {
      const t0 = (bar * 4 + e / 2) * BEAT;
      const root = midi(chord[0] - 12 + (e % 4 === 3 ? 12 : 0));
      add(b, t0, BEAT * 0.45, (t, len) => (square(root * t) * 0.5 + Math.sin(TAU * root * t) * 0.5) * expDecay(t, 7) * env(t, len, 0.003, 0.03), 0.5, true);
    }
    for (let beat = 0; beat < 4; beat++) {
      const t0 = (bar * 4 + beat + 0.5) * BEAT;
      chord.slice(1).forEach((n) =>
        add(b, t0, BEAT * 0.4, (t, len) => tri(midi(n) * t) * expDecay(t, 6) * env(t, len, 0.005, 0.05), 0.16, true),
      );
    }
  }
  return normalize(lowpass(b, 5000), 0.7);
}

/** Gallop rhythm: a three-beat "da-da-DUM" per beat on low toms and kick, backbeat snare, driving hats. */
export function stemDrums() {
  const b = buffer(LOOP_SECONDS);
  for (let beat = 0; beat < LOOP_BEATS; beat++) {
    const t0 = beat * BEAT;
    add(b, t0, 0.14, hoof(0.9), 0.55, true);
    add(b, t0 + BEAT / 4, 0.14, hoof(1.05), 0.6, true);
    add(b, t0 + BEAT / 2, 0.25, kick, 1, true);
    if (beat % 2 === 1) add(b, t0 + BEAT / 2, 0.18, snare, 0.5, true);
    for (let s = 0; s < 4; s++) add(b, t0 + (s / 4) * BEAT, 0.05, hat, s % 2 ? 0.16 : 0.26, true);
  }
  return normalize(b, 0.8);
}

/** Rising brass-like lead: detuned saws climbing the chord, a lift on the last bar. Rush, not reward. */
export function stemLead() {
  const b = buffer(LOOP_SECONDS);
  const climb = [0, 1, 2, 3, 1, 2, 3, 2];
  for (let bar = 0; bar < 4; bar++) {
    const chord = CHORDS[bar].map((n) => n + 12);
    for (let s = 0; s < 8; s++) {
      const n = chord[climb[s]] + (bar === 3 && s >= 4 ? 2 : 0);
      const t0 = (bar * 4 + s / 2) * BEAT;
      add(b, t0, BEAT * 0.46, (t, len) => (saw(midi(n) * t) * 0.45 + saw(midi(n) * 1.006 * t) * 0.35 + Math.sin(TAU * midi(n) * 0.5 * t) * 0.2) * env(t, len, 0.02, 0.06), 0.3, true);
    }
    whoosh(b, (bar * 4 + 3) * BEAT, BEAT, 0.25, 300, 1800);
  }
  return normalize(lowpass(b, 4200), 0.6);
}

/**
 * Lobby loop: upbeat arcade chiptune for the betting screen. Its own chord progression (Am-F-C-G) and
 * riff keep it distinct from the round stems, with lighter drums so it can play indefinitely.
 */
export function lobbyLoop() {
  const b = buffer(LOOP_SECONDS);
  const chords = [
    [45, 52, 57, 60], // Am
    [41, 48, 53, 57], // F
    [48, 55, 60, 64], // C
    [43, 50, 55, 59], // G
  ];
  const riff = [0, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1, 2, 0, 2, 1, 0];
  for (let bar = 0; bar < 4; bar++) {
    const chord = chords[bar];
    const scale = [chord[0], chord[1], chord[2], chord[3], chord[2] + 5];
    for (let s = 0; s < 16; s++) {
      const t0 = (bar * 4 + s / 4) * BEAT;
      // Lead: bright detuned square riff, an octave and a half up.
      const n = scale[riff[s]] + 24;
      add(b, t0, BEAT * 0.2, (t, len) => (square(midi(n) * t) * 0.5 + saw(midi(n) * 1.005 * t) * 0.3) * env(t, len, 0.002, 0.05), 0.3, true);
      // Bass: pumping eighths on the root, with an octave lift at the end of each bar.
      if (s % 2 === 0) {
        const root = midi(chord[0] - 12 + (s === 14 ? 12 : 0));
        add(b, t0, BEAT * 0.42, (t, len) => (square(root * t) * 0.55 + Math.sin(TAU * root * t) * 0.45) * expDecay(t, 6) * env(t, len, 0.003, 0.04), 0.5, true);
      }
      // Hats on every eighth, kick on the downbeats, clap on 2 and 4.
      if (s % 2 === 0) add(b, t0, 0.05, hat, s % 4 === 0 ? 0.2 : 0.12, true);
      if (s === 0 || s === 8) add(b, t0, 0.25, kick, 0.8, true);
      if (s === 4 || s === 12) add(b, t0, 0.18, snare, 0.35, true);
    }
    // Chord stabs on the off-beats give it the arcade bounce.
    [1.5, 3.5].forEach((beat) => {
      const t0 = (bar * 4 + beat) * BEAT;
      chord.slice(1).forEach((n) => add(b, t0, BEAT * 0.3, (t, len) => tri(midi(n + 12) * t) * expDecay(t, 8) * env(t, len, 0.004, 0.05), 0.14, true));
    });
  }
  return normalize(lowpass(b, 7000), 0.62);
}

/**
 * The tone slot plays a gallop: two strides a second, four hoof strikes each, over a bed of wind. The
 * engine raises its playback rate with the multiplier (toneRate), so the hooves quicken and lift in pitch
 * as the value climbs. It follows the multiplier only, never the crash time.
 */
export function toneLoop() {
  const b = buffer(TONE_SECONDS);
  const stride = TONE_SECONDS / 2;
  for (let k = 0; k < 2; k++) {
    const t0 = k * stride;
    [0, 0.07, 0.15, 0.26].forEach((dt, i) => add(b, t0 + dt, 0.12, hoof(i === 3 ? 0.85 : 1 + i * 0.08), i === 3 ? 1 : 0.75, true));
  }
  let y = 0;
  add(b, 0, TONE_SECONDS, (t) => {
    const a = 1 - Math.exp((-TAU * 900) / SR);
    y += a * (rand() - y);
    return y * (0.55 + 0.45 * Math.sin(TAU * 2 * t));
  }, 0.35, true);
  return normalize(b, 0.7);
}

/** Two copies back to back; the game loops the middle region, away from encoder padding at the edges. */
export function doubled(loop) {
  const out = new Float32Array(loop.length * 2);
  out.set(loop, 0);
  out.set(loop, loop.length);
  return out;
}
