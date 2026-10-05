// Flock's own synthesizer, written for this game alone (no code or sound from any other game).
// Everything is mono Float32 PCM at RATE. scripts/build-audio.mjs renders the cues with it and encodes them.
//
// The palette is dusk on open ground: hand drums and hoof thuds, a plucked low string, a breathy reed
// lead, a wide pad, wind. No bleat: the cutest sound a sheep makes (flock-mvp D7).

export const RATE = 48000;

// ---- randomness: seeded, so a rebuild is byte-stable -------------------------------------------

let seed = 0x5eed;
/** Pins the noise source. build-audio pins MUSIC_SEED before the music so re-voicing effects never moves it. */
export function setSeed(s) {
  seed = s >>> 0 || 1;
}
export function random() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---- buffers -------------------------------------------------------------------------------------

export const buffer = (seconds) => new Float32Array(Math.max(1, Math.round(seconds * RATE)));
export const secs = (buf) => buf.length / RATE;

/** Adds `src` into `dst` at `at` seconds, scaled by `gain`. */
export function mix(dst, src, at = 0, gain = 1) {
  const o = Math.round(at * RATE);
  for (let i = 0; i < src.length && o + i < dst.length; i++)
    if (o + i >= 0) dst[o + i] += src[i] * gain;
  return dst;
}

/** Adds `src` into a loop buffer, wrapping anything past the end back to the start, so the loop is seamless. */
export function mixWrap(dst, src, at = 0, gain = 1) {
  const o = Math.round(at * RATE);
  for (let i = 0; i < src.length; i++)
    dst[(((o + i) % dst.length) + dst.length) % dst.length] += src[i] * gain;
  return dst;
}

export function gain(buf, g) {
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

/** Scales so the loudest sample sits at `peak`, then softly limits anything that still pokes out. */
export function normalize(buf, peak = 0.89) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max > 0) gain(buf, peak / max);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * 1.1) / Math.tanh(1.1);
  return buf;
}

/** Short fades at both ends so a one-shot never clicks. */
export function declick(buf, ms = 4) {
  const n = Math.min(buf.length >> 1, Math.round((ms / 1000) * RATE));
  for (let i = 0; i < n; i++) {
    buf[i] *= i / n;
    buf[buf.length - 1 - i] *= i / n;
  }
  return buf;
}

// ---- envelopes -----------------------------------------------------------------------------------

/** Attack, decay to sustain, hold, release: a value per sample. */
export function adsr(len, { a = 0.005, d = 0.1, s = 0.6, r = 0.2 } = {}) {
  const env = new Float32Array(len);
  const A = a * RATE,
    D = d * RATE,
    R = r * RATE;
  const relStart = Math.max(A + D, len - R);
  for (let i = 0; i < len; i++) {
    let v;
    if (i < A) v = i / A;
    else if (i < A + D) v = 1 - ((i - A) / D) * (1 - s);
    else v = s;
    if (i >= relStart) v *= Math.max(0, 1 - (i - relStart) / R);
    env[i] = v;
  }
  return env;
}

/** Exponential decay from 1 with time constant `tau` seconds. */
export const decay = (i, tau) => Math.exp(-i / (tau * RATE));

// ---- filters (RBJ biquads) -----------------------------------------------------------------------

export function biquad(buf, type, freq, q = 0.707, dbGain = 0) {
  const w = (2 * Math.PI * Math.min(freq, RATE * 0.45)) / RATE;
  const cos = Math.cos(w),
    sin = Math.sin(w),
    alpha = sin / (2 * q),
    A = Math.pow(10, dbGain / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass')
    [b0, b1, b2, a0, a1, a2] = [
      (1 - cos) / 2,
      1 - cos,
      (1 - cos) / 2,
      1 + alpha,
      -2 * cos,
      1 - alpha,
    ];
  else if (type === 'highpass')
    [b0, b1, b2, a0, a1, a2] = [
      (1 + cos) / 2,
      -(1 + cos),
      (1 + cos) / 2,
      1 + alpha,
      -2 * cos,
      1 - alpha,
    ];
  else if (type === 'bandpass')
    [b0, b1, b2, a0, a1, a2] = [alpha, 0, -alpha, 1 + alpha, -2 * cos, 1 - alpha];
  else if (type === 'peak')
    [b0, b1, b2, a0, a1, a2] = [
      1 + alpha * A,
      -2 * cos,
      1 - alpha * A,
      1 + alpha / A,
      -2 * cos,
      1 - alpha / A,
    ];
  else throw new Error(`unknown filter ${type}`);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    buf[i] = y;
  }
  return buf;
}

// ---- reverb: a small Freeverb-style network, written here -----------------------------------------

/** Returns a new buffer `tail` seconds longer: dry plus a diffuse room. `mixAmt` is the wet level. */
export function reverb(
  buf,
  { room = 0.82, damp = 0.35, mixAmt = 0.25, tail = 1.2, wrap = false, spread = 0 } = {},
) {
  // `spread` lengthens every line a little: the right channel of a stereo room (Freeverb's stereo spread).
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((n) =>
    Math.round(((n + spread) * RATE) / 44100),
  );
  const alls = [556, 441, 341, 225].map((n) => Math.round(((n + spread) * RATE) / 44100));
  const extra = wrap ? 0 : Math.round(tail * RATE);
  const out = new Float32Array(buf.length + extra);
  const wet = new Float32Array(out.length);
  // In wrap mode the input is fed twice so the room is already full when the loop starts over.
  const passes = wrap ? 2 : 1;
  for (const len of combs) {
    const line = new Float32Array(len);
    let idx = 0,
      store = 0;
    for (let p = 0; p < passes; p++) {
      for (let i = 0; i < out.length; i++) {
        const x = i < buf.length ? buf[i] : 0;
        const y = line[idx];
        store = y * (1 - damp) + store * damp;
        line[idx] = x * 0.015 + store * room;
        idx = (idx + 1) % len;
        if (p === passes - 1) wet[i] += y;
      }
    }
  }
  for (const len of alls) {
    const line = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < wet.length; i++) {
      const b = line[idx];
      const x = wet[i];
      line[idx] = x + b * 0.5;
      wet[i] = b - x;
      idx = (idx + 1) % len;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = (i < buf.length ? buf[i] : 0) + wet[i] * mixAmt;
  return out;
}

// ---- sources -------------------------------------------------------------------------------------

export function noise(seconds) {
  const b = buffer(seconds);
  for (let i = 0; i < b.length; i++) b[i] = random() * 2 - 1;
  return b;
}

/** An oscillator whose frequency may change per sample (`freq` a number or a function of seconds). */
export function osc(seconds, freq, shape = 'sine') {
  const b = buffer(seconds);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const f = typeof freq === 'function' ? freq(i / RATE) : freq;
    ph += f / RATE;
    ph -= Math.floor(ph);
    if (shape === 'sine') b[i] = Math.sin(2 * Math.PI * ph);
    else if (shape === 'saw') b[i] = 2 * ph - 1;
    else if (shape === 'tri') b[i] = 1 - 4 * Math.abs(ph - 0.5);
  }
  return b;
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---- instruments ---------------------------------------------------------------------------------

/** A hand drum: a pitched membrane that drops, a soft skin noise, a long low body. */
export function handDrum(pitch = 90, { len = 0.6, body = 0.18, slap = 0.25 } = {}) {
  const b = buffer(len);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / RATE;
    ph += (pitch * (1 + 1.4 * Math.exp(-t / 0.018))) / RATE;
    b[i] = Math.sin(2 * Math.PI * ph) * decay(i, body);
  }
  const skin = biquad(noise(0.08), 'bandpass', 900, 1.2);
  for (let i = 0; i < skin.length; i++) skin[i] *= decay(i, 0.012) * slap;
  return declick(mix(b, skin));
}

/** One hoof on packed earth: a dull low thump with a little grit. */
export function hoof(weight = 1, pitch = 70) {
  const b = buffer(0.18);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / RATE;
    ph += (pitch + ((pitch * 6) / 7) * Math.exp(-t / 0.01)) / RATE;
    b[i] = Math.sin(2 * Math.PI * ph) * decay(i, 0.035) * weight;
  }
  const grit = biquad(biquad(noise(0.06), 'bandpass', 420 + random() * 200, 0.9), 'lowpass', 2000);
  for (let i = 0; i < grit.length; i++) grit[i] *= decay(i, 0.014) * 0.6 * weight;
  return declick(mix(b, grit));
}

/** A plucked low string (Karplus-Strong with a warm loop filter). */
export function pluck(freq, { len = 1.6, bright = 0.5, damp = 0.996 } = {}) {
  const b = buffer(len);
  const n = Math.max(2, Math.round(RATE / freq));
  const line = new Float32Array(n);
  for (let i = 0; i < n; i++) line[i] = (random() * 2 - 1) * (0.5 + bright * 0.5);
  biquad(line, 'lowpass', 600 + bright * 4000);
  let idx = 0,
    last = 0;
  for (let i = 0; i < b.length; i++) {
    const cur = line[idx];
    const next = line[(idx + 1) % n];
    const v = ((cur + next) / 2) * damp;
    line[idx] = v * 0.6 + last * 0.4;
    last = v;
    b[i] = cur;
    idx = (idx + 1) % n;
  }
  return declick(b);
}

/** A low wolf call, far off: a voice that rises, holds and falls away, with breath. No snarl, no attack. */
export function howl(len = 1.5) {
  const f = (t) => {
    const p = t / len;
    return (
      180 + 160 * Math.sin(Math.PI * Math.min(1, p * 1.25)) * (p < 0.8 ? 1 : 1 - (p - 0.8) * 2.5)
    );
  };
  const v = osc(len, (t) => f(t) * (1 + 0.012 * Math.sin(2 * Math.PI * 4.6 * t)), 'saw');
  biquad(v, 'bandpass', 700, 1.6);
  biquad(v, 'peak', 1100, 2, 6);
  biquad(v, 'lowpass', 1800);
  const air = biquad(noise(len), 'bandpass', 900, 0.8);
  const env = adsr(v.length, { a: 0.25, d: 0.3, s: 0.8, r: 0.5 });
  for (let i = 0; i < v.length; i++) v[i] = (v[i] + air[i] * 0.12) * env[i];
  return v;
}

// ---- stereo ----------------------------------------------------------------------------------------

/** A stereo buffer pair. */
export const stereo = (seconds) => ({ L: buffer(seconds), R: buffer(seconds) });

/**
 * Adds a mono source into a stereo loop at `pan` (-1 left .. 1 right, equal power), wrapping past the
 * end back to the start so the loop is seamless.
 */
export function panWrap(dst, src, at = 0, g = 1, pan = 0) {
  const a = ((pan + 1) * Math.PI) / 4;
  mixWrap(dst.L, src, at, g * Math.cos(a));
  mixWrap(dst.R, src, at, g * Math.sin(a));
  return dst;
}

/** The same into a one-shot (no wrap). */
export function panMix(dst, src, at = 0, g = 1, pan = 0) {
  const a = ((pan + 1) * Math.PI) / 4;
  mix(dst.L, src, at, g * Math.cos(a));
  mix(dst.R, src, at, g * Math.sin(a));
  return dst;
}

/** A stereo room: each side its own reverb, the right one spread wider. */
export function reverbStereo(st, opts = {}) {
  return { L: reverb(st.L, { ...opts, spread: 0 }), R: reverb(st.R, { ...opts, spread: 23 }) };
}
