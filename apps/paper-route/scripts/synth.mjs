// Procedural placeholder audio for Paper Route. Pure JS synthesis, 48 kHz mono Float32.
// Every sound is generated from code in this file, so there are no third-party licences.
// Tone: understated and adult. Throws are neutral; only the round-win cue is a (short) chime.

export const SR = 48000;
export const ENGINE_LOOP_SECONDS = 2;

const TAU = Math.PI * 2;
let seed = 7654321;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

function buffer(seconds) {
  return new Float32Array(Math.round(seconds * SR));
}

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

function lowpass(buf, cutoff) {
  let y = 0;
  const a = 1 - Math.exp((-TAU * cutoff) / SR);
  for (let i = 0; i < buf.length; i++) buf[i] = y += a * (buf[i] - y);
  return buf;
}

function highpass(buf, cutoff) {
  const lp = lowpass(Float32Array.from(buf), cutoff);
  for (let i = 0; i < buf.length; i++) buf[i] -= lp[i];
  return buf;
}

function normalize(buf, peak = 0.8) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] / max) * peak;
  return buf;
}

const pluck = (freq) => (t, len) => (Math.sin(TAU * freq * t) * 0.8 + Math.sin(TAU * freq * 2 * t) * 0.2) * expDecay(t, 7) * env(t, len, 0.003, 0.06);

export function sfxTick() {
  const b = buffer(0.05);
  add(b, 0, 0.05, (t, len) => Math.sin(TAU * 1800 * t) * expDecay(t, 90) * env(t, len, 0.001, 0.01), 0.5);
  return normalize(b, 0.5);
}

export function sfxBet() {
  const b = buffer(0.35);
  add(b, 0, 0.3, pluck(392), 0.5);
  add(b, 0.06, 0.28, pluck(523.25), 0.4);
  return normalize(b, 0.6);
}

/** Neutral throw: a short airy whoosh. Same sound whatever the timing (audit D6). */
export function sfxThrow() {
  const b = buffer(0.32);
  add(b, 0, 0.32, (t, len) => rand() * Math.sin((Math.PI * t) / len) ** 2, 0.8);
  highpass(b, 600);
  lowpass(b, 3200);
  return normalize(b, 0.55);
}

/** Paper landing on a porch: a soft muffled thump. */
export function sfxLand() {
  const b = buffer(0.2);
  add(b, 0, 0.2, (t, len) => (rand() * 0.6 + Math.sin(TAU * 110 * t) * 0.6) * expDecay(t, 35) * env(t, len, 0.001, 0.05), 0.9);
  lowpass(b, 900);
  return normalize(b, 0.55);
}

/** Round ended at or below the stake: one mellow, non-celebratory tone (RTS 14F). */
export function sfxReturn() {
  const b = buffer(0.5);
  add(b, 0, 0.5, (t, len) => Math.sin(TAU * 293.66 * t) * expDecay(t, 5) * env(t, len, 0.01, 0.2), 0.6);
  return normalize(b, 0.45);
}

/** Round ended above the stake: a short, restrained three-note chime. */
export function sfxWin() {
  const b = buffer(0.9);
  add(b, 0, 0.6, pluck(523.25), 0.5);
  add(b, 0.1, 0.6, pluck(659.25), 0.5);
  add(b, 0.2, 0.7, pluck(783.99), 0.5);
  return normalize(b, 0.6);
}

/** Wipeout: tyre skid narrowing into a low thud. No comedy effects. */
export function sfxWipeout() {
  const b = buffer(0.9);
  add(b, 0, 0.55, (t, len) => rand() * (0.4 + 0.6 * Math.sin(TAU * (900 - 500 * (t / len)) * t)) * env(t, len, 0.01, 0.1), 0.6);
  add(b, 0.55, 0.35, (t, len) => (Math.sin(TAU * 70 * t) + rand() * 0.4) * expDecay(t, 14) * env(t, len, 0.001, 0.1), 1);
  lowpass(b, 2400);
  return normalize(b, 0.7);
}

/** Setback splash (light profiles only): filtered water burst with a few droplets. */
export function sfxSplash() {
  const b = buffer(0.6);
  add(b, 0, 0.45, (t, len) => rand() * expDecay(t, 9) * env(t, len, 0.002, 0.1), 0.9);
  lowpass(b, 1800);
  for (const [at, f] of [[0.18, 1400], [0.26, 1900], [0.34, 1600]]) add(b, at, 0.06, (t, len) => Math.sin(TAU * f * t) * expDecay(t, 60) * env(t, len, 0.001, 0.02), 0.25);
  return normalize(b, 0.6);
}

/** Seamless moped engine idle-ride loop; its playback rate follows speed only when intensity effects are on. */
export function engineLoop() {
  const b = buffer(ENGINE_LOOP_SECONDS);
  const pulses = 48;
  for (let p = 0; p < pulses * ENGINE_LOOP_SECONDS; p++) {
    add(b, p / pulses, 0.03, (t, len) => (Math.sin(TAU * 62 * t) + rand() * 0.3) * expDecay(t, 70) * env(t, len, 0.001, 0.01), 0.7, true);
  }
  add(b, 0, ENGINE_LOOP_SECONDS, () => rand() * 0.08, 1, true);
  lowpass(b, 1200);
  return normalize(b, 0.4);
}
