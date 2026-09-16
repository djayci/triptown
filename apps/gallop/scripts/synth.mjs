// Procedural placeholder audio for Night Gallop: Fence Run. Pure JS synthesis, 48 kHz mono Float32.
// Every sound here is generated from code in this file, so there are no third-party licences.

export const SR = 48000;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const LOOP_BEATS = 16;
export const LOOP_SECONDS = LOOP_BEATS * BEAT; // 8 s
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

// Filtered noise: a one-pole low-pass on white noise, cutoff in Hz (can vary over time).
function noisy(cutoffAt) {
  let y = 0;
  return (t, len) => {
    const a = 1 - Math.exp((-TAU * cutoffAt(t, len)) / SR);
    y += a * (rand() - y);
    return y;
  };
}

/** A hoof strike on turf: a soft low thump with a short dirt scatter. */
const hoof = (t, len) => (Math.sin(TAU * (70 * t + (60 * (1 - Math.exp(-t * 40))) / 40)) * expDecay(t, 28) + rand() * 0.25 * expDecay(t, 60)) * env(t, len, 0.001, 0.02);

// ---------- sfx ----------
export function sfxBet() {
  const b = buffer(0.5);
  [76, 83].forEach((n, i) => add(b, i * 0.06, 0.3, (t, len) => (Math.sin(TAU * midi(n) * t) * 0.7 + tri(midi(n) * 2 * t) * 0.3) * expDecay(t, 8) * env(t, len, 0.003, 0.1), 0.5));
  add(b, 0, 0.2, hoof, 0.6);
  return normalize(lowpass(b, 9000), 0.7);
}

/** Take-off: gathering hoofbeats and a rising whoosh. The same sound for every jump, whatever the result. */
export function sfxJump() {
  const b = buffer(0.8);
  [0, 0.12, 0.22].forEach((s, i) => add(b, s, 0.18, hoof, 0.7 + i * 0.15));
  add(b, 0.28, 0.45, (t, len) => noisy((u) => 400 + 3500 * (u / len))(t, len) * env(t, len, 0.05, 0.12), 0.9);
  return normalize(b, 0.8);
}

/** Landing: heavy double thud and turf spray. */
export function sfxLand() {
  const b = buffer(0.6);
  add(b, 0, 0.3, hoof, 1.2);
  add(b, 0.07, 0.3, hoof, 1.0);
  add(b, 0.02, 0.4, (t, len) => noisy(() => 2500)(t, len) * expDecay(t, 9) * env(t, len, 0.002, 0.1), 0.5);
  return normalize(b, 0.85);
}

/** Refusal: hooves plant and skid, a dull thud. Neutral, no sting (no near-miss drama). */
export function sfxRefuse() {
  const b = buffer(0.7);
  add(b, 0, 0.5, (t, len) => noisy((u) => 1800 * Math.exp(-u * 5) + 150)(t, len) * env(t, len, 0.01, 0.2), 0.8);
  add(b, 0.05, 0.25, hoof, 0.9);
  add(b, 0.18, 0.25, hoof, 0.6);
  return normalize(lowpass(b, 4000), 0.6);
}

/** Collect: a clean broadcast chime. */
export function sfxCollect() {
  const b = buffer(0.5);
  [79, 84].forEach((n, i) => add(b, i * 0.08, 0.35, (t, len) => (Math.sin(TAU * midi(n) * t) * 0.8 + tri(midi(n) * 2 * t) * 0.2) * expDecay(t, 6) * env(t, len, 0.004, 0.12), 0.45));
  return normalize(lowpass(b, 8000), 0.65);
}

function fanfare(b, start, notes, step, sustain, gain = 0.5) {
  notes.forEach((n, i) => {
    const last = i === notes.length - 1;
    const len = last ? sustain : step * 1.4;
    add(b, start + i * step, len, (t, l) => (square(midi(n) * t) * 0.35 + tri(midi(n) * t) * 0.65) * env(t, l, 0.004, last ? 0.3 : 0.05) * (1 + 0.15 * Math.sin(TAU * 6 * t)), gain);
  });
}


/** Win sting for a return above the stake. */
export function sfxWin() {
  const b = buffer(1.2);
  fanfare(b, 0, [67, 72, 76, 79], 0.09, 0.7, 0.45);
  add(b, 0.25, 0.9, (t, len) => noisy(() => 1200)(t, len) * env(t, len, 0.2, 0.4), 0.25);
  return normalize(lowpass(b, 9000));
}

/** Finish line: bigger sting with a crowd swell. */
export function sfxFinish() {
  const b = buffer(2.2);
  fanfare(b, 0, [67, 72, 76, 79], 0.09, 0.3, 0.45);
  fanfare(b, 0.45, [69, 74, 77, 81], 0.09, 1.2, 0.45);
  add(b, 0.2, 1.9, (t, len) => noisy(() => 1400)(t, len) * env(t, len, 0.4, 0.8), 0.45);
  return normalize(lowpass(b, 10000));
}

// ---------- music (seamless 4-bar loops at 120 BPM) ----------

/** Crowd murmur with slow swells; the bed under everything. */
export function stemBase() {
  const b = buffer(LOOP_SECONDS);
  add(b, 0, LOOP_SECONDS, (t, len) => noisy(() => 900)(t, len) * (0.6 + 0.4 * Math.sin((TAU * t) / len)), 0.9, true);
  add(b, 0, LOOP_SECONDS, (t) => Math.sin(TAU * 55 * t) * 0.15, 1, true);
  return normalize(lowpass(b, 2500), 0.5);
}

/** Gallop rhythm: three hoofbeats and a gap per beat, like a horse at full stride. */
export function stemDrums() {
  const b = buffer(LOOP_SECONDS);
  for (let beat = 0; beat < LOOP_BEATS; beat++) {
    [0, 0.18, 0.36].forEach((o, i) => add(b, (beat + o) * BEAT, 0.16, hoof, [0.7, 0.8, 1][i], true));
  }
  return normalize(b, 0.7);
}

/** Broadcast pulse: a driving minor figure for when the value is climbing. */
export function stemLead() {
  const b = buffer(LOOP_SECONDS);
  const roots = [45, 41, 48, 43];
  for (let bar = 0; bar < 4; bar++) {
    for (let s = 0; s < 8; s++) {
      const n = roots[bar] + 12 + [0, 7, 12, 7][s % 4];
      add(b, (bar * 4 + s / 2) * BEAT, BEAT * 0.35, (t, len) => (saw(midi(n) * t) * 0.4 + square(midi(n) * 1.004 * t) * 0.3) * expDecay(t, 5) * env(t, len, 0.004, 0.05), 0.3, true);
    }
  }
  return normalize(lowpass(b, 5000), 0.55);
}

/** Between rounds: soft crowd and a distant floodlight hum. */
export function lobbyLoop() {
  const b = buffer(LOOP_SECONDS);
  add(b, 0, LOOP_SECONDS, (t, len) => noisy(() => 600)(t, len) * (0.5 + 0.2 * Math.sin((TAU * 2 * t) / len)), 0.7, true);
  add(b, 0, LOOP_SECONDS, (t) => Math.sin(TAU * 100 * t) * 0.06 + Math.sin(TAU * 200 * t) * 0.03, 1, true);
  return normalize(lowpass(b, 1800), 0.4);
}

/** Required by the audio manifest; Fence Run does not use a pitch-following tone. */
export function toneLoop() {
  const b = buffer(TONE_SECONDS);
  add(b, 0, TONE_SECONDS, (t) => Math.sin(TAU * 110 * t) * 0.2, 1, true);
  return normalize(b, 0.2);
}

/** Two copies back to back; the game loops the middle region, away from encoder padding at the edges. */
export function doubled(loop) {
  const out = new Float32Array(loop.length * 2);
  out.set(loop, 0);
  out.set(loop, loop.length);
  return out;
}
