// Flock's music: "Stampede", written from scratch on 5 Oct 2026 after every earlier score was rejected
// and deleted. The brief (the user): country and ranch, uplifting, upbeat, exciting, melodic and catchy,
// "like Cotton Eye Joe", speeding up through the round with the pitch fixed. Flock's alone: no code,
// notes or sound taken from another game.
//
// The style is a hoedown on a dance floor: a fiddle section plays the hook over a four-on-the-floor
// kick, an off-beat bass, off-beat open hats and claps, with a banjo rolling underneath. That is what
// makes the reference tune work, and it is also what synthesizes well: the drums and bass are electronic
// by nature, and the fiddle is a section of bowed voices, which hides what a single synthetic fiddle
// would give away.
//
// What it does to sound good on a phone:
// - the hook is short (two bars), stated, answered, stated again and resolved, in eight bars;
// - every oscillator is band-limited (PolyBLEP), every plucked string is tuned to the exact pitch;
// - the bass and kick carry harmonics a small speaker can play, nothing sits below 40 Hz;
// - one reverb and one echo send, kick-ducked bass and chords, a glue compressor and a look-ahead
//   limiter; loops are seamless (every effect runs over two copies of the loop and keeps the second).
import { RATE } from './synth.mjs';

const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---- randomness: seeded, so a rebuild is byte-stable ---------------------------------------------------

let seed = 0x57a3ed;
function rand() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const white = () => rand() * 2 - 1;

// ---- buffers -------------------------------------------------------------------------------------------

const S = (seconds) => Math.max(1, Math.round(seconds * RATE));
const stereo = (n) => ({ L: new Float32Array(n), R: new Float32Array(n) });

/** Adds a mono voice into a stereo bus at sample `at`, equal-power `pan`; `wrap` folds the tail round. */
function put(bus, src, at, g = 1, pan = 0, wrap = true) {
  if (!bus) return;
  const a = ((pan + 1) * Math.PI) / 4;
  const gl = g * Math.cos(a) * Math.SQRT2;
  const gr = g * Math.sin(a) * Math.SQRT2;
  const n = bus.L.length;
  for (let i = 0; i < src.length; i++) {
    let j = at + i;
    if (wrap) j = ((j % n) + n) % n;
    else if (j < 0 || j >= n) continue;
    bus.L[j] += src[i] * gl;
    bus.R[j] += src[i] * gr;
  }
}

function addInto(dst, src, g = 1) {
  for (let i = 0; i < dst.L.length; i++) {
    dst.L[i] += src.L[i] * g;
    dst.R[i] += src.R[i] * g;
  }
  return dst;
}

/** Runs a stateful effect over a loop with no seam: it hears the loop twice, the second pass is kept. */
function seamless(bus, fx) {
  const n = bus.L.length;
  const two = stereo(n * 2);
  two.L.set(bus.L);
  two.L.set(bus.L, n);
  two.R.set(bus.R);
  two.R.set(bus.R, n);
  const out = fx(two);
  return { L: out.L.slice(n), R: out.R.slice(n) };
}

// ---- filters (RBJ biquads, in place) ----------------------------------------------------------------

function biquad(buf, type, freq, q = 0.707, db = 0) {
  const w = (TAU * Math.min(freq, RATE * 0.45)) / RATE;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const A = Math.pow(10, db / 40);
  let c;
  if (type === 'lp') c = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
  else if (type === 'hp')
    c = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
  else if (type === 'bp') c = [alpha, 0, -alpha, 1 + alpha, -2 * cos, 1 - alpha];
  else if (type === 'peak')
    c = [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A];
  else throw new Error(`unknown filter ${type}`);
  const [b0, b1, b2, , a1, a2] = c.map((v) => v / c[3]);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    buf[i] = y;
  }
  return buf;
}
const both = (st, ...args) => (biquad(st.L, ...args), biquad(st.R, ...args), st);

/** Short fades at both ends so no voice ever clicks. */
function edges(buf, inMs = 1, outMs = 6) {
  const a = Math.min(buf.length >> 1, S(inMs / 1000));
  const r = Math.min(buf.length >> 1, S(outMs / 1000));
  for (let i = 0; i < a; i++) buf[i] *= i / a;
  for (let i = 0; i < r; i++) buf[buf.length - 1 - i] *= i / r;
  return buf;
}

/** The band-limiting correction for a saw's reset (PolyBLEP), so a bright saw never aliases. */
function blep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** A band-limited saw at a fixed `freq`, `len` seconds. */
function saw(freq, len, phase = rand()) {
  const out = new Float32Array(S(len));
  const dt = freq / RATE;
  let t = phase;
  for (let i = 0; i < out.length; i++) {
    out[i] = 2 * t - 1 - blep(t, dt);
    t += dt;
    if (t >= 1) t -= 1;
  }
  return out;
}

// ---- the fiddle section ----------------------------------------------------------------------------------

/**
 * One bowed voice playing a whole line as one continuous bow rather than separate notes: the pitch moves
 * from note to note (scooping up into the accented ones), the bow eases off between notes and digs in on
 * each, the vibrato grows on the long ones, and a little bow noise scratches at each start. `notes` are
 * { at, len, m, scoop, g } in seconds. The tail past `n` folds to the start, so loops are seamless.
 */
function bowedLine(notes, n, { cents = 0, vibRate = 5.8, vibPhase = 0, delay = 0 } = {}) {
  const total = n + S(0.4);
  const freq = new Float32Array(total);
  const amp = new Float32Array(total);
  const bite = new Float32Array(total);
  const sorted = [...notes].sort((a, b) => a.at - b.at);
  sorted.forEach((nt, k) => {
    const s = S(nt.at + delay);
    const next = sorted[k + 1];
    const until = next ? S(next.at + delay) : total;
    const len = S(nt.len);
    const base = nt.m + cents / 100;
    for (let i = s; i < until && i < total; i++) {
      const t = (i - s) / RATE;
      const scoop = (nt.scoop ? -1 : -0.12) * Math.exp(-t / 0.035);
      const vib = 0.16 * Math.min(1, Math.max(0, (t - 0.11) / 0.18));
      freq[i] = mtof(base + scoop + vib * Math.sin(TAU * vibRate * t + vibPhase));
    }
    const rel = S(0.05);
    for (let i = 0; i < len + rel && s + i < total; i++) {
      const t = i / RATE;
      const att = 1 - Math.exp(-t / 0.012);
      const travel = 1 - 0.18 * Math.min(1, t / Math.max(0.05, nt.len)); // the bow travels, then eases
      const end = i < len ? 1 : 1 - (i - len) / rel;
      const e = att * travel * end * (nt.g ?? 1);
      if (e > amp[s + i]) amp[s + i] = e;
      if (t < 0.04) bite[s + i] = Math.max(bite[s + i], 1 - t / 0.04);
    }
  });
  // Before the first note the oscillator sits on its pitch, silent.
  let first = freq.findIndex((f) => f > 0);
  if (first < 0) first = 0;
  for (let i = 0; i < first; i++) freq[i] = freq[first];
  const out = new Float32Array(total);
  let t = rand();
  let nz = 0;
  for (let i = 0; i < total; i++) {
    const dt = freq[i] / RATE;
    const s = 2 * t - 1 - blep(t, dt);
    t += dt;
    if (t >= 1) t -= 1;
    nz += 0.3 * (white() - nz);
    out[i] = amp[i] * (s + nz * (0.05 + 0.5 * bite[i]));
  }
  // The body of a fiddle: the low air and wood resonances, the bright bridge hill around 3 kHz, and a
  // steep fall above it (a real fiddle has little past 7 kHz, which is what keeps it from buzzing).
  biquad(out, 'hp', 190, 0.8);
  biquad(out, 'peak', 290, 1.6, 6);
  biquad(out, 'peak', 520, 1.2, -3);
  biquad(out, 'peak', 1050, 1.3, 2.5);
  biquad(out, 'peak', 2900, 1.1, 6);
  biquad(out, 'lp', 6200, 0.7);
  biquad(out, 'lp', 7000, 0.6);
  const folded = new Float32Array(n);
  for (let i = 0; i < total; i++) folded[i % n] += out[i];
  return folded;
}

const SECTION = [
  { cents: -6, vibRate: 5.6, vibPhase: 0, delay: 0, side: -1 },
  { cents: 7, vibRate: 6.1, vibPhase: 2.1, delay: 0.007, side: 1 },
  { cents: 0, vibRate: 5.9, vibPhase: 4.2, delay: 0.003, side: 0 },
];

/** Three bowed voices a few cents and a few milliseconds apart, spread left to right. */
function fiddles(
  bus,
  notes,
  n,
  { g = 1, spread = 0.6, verb = null, delayBus = null, send = 0.2 } = {},
) {
  for (const v of SECTION) {
    const line = bowedLine(notes, n, v);
    const pan = v.side * spread;
    put(bus, line, 0, g * 0.33, pan);
    put(verb, line, 0, g * 0.33 * send, pan);
    put(delayBus, line, 0, g * 0.33 * 0.18, pan);
  }
}

// ---- the banjo ------------------------------------------------------------------------------------------

/**
 * A banjo string at exactly `m` (Karplus-Strong; the fractional part of the period is an allpass, so the
 * top notes are in tune). Short and bright, with the drum-head honk a banjo has around 1.5 kHz.
 */
function banjo(m, dur = 0.5, { bright = 0.85, ring = 0.7 } = {}) {
  const freq = mtof(m);
  const n = S(dur + 0.08);
  const out = new Float32Array(n);
  const P = RATE / freq - 0.5;
  let D = Math.floor(P);
  let frac = P - D;
  if (frac < 0.2) {
    D -= 1;
    frac += 1;
  }
  const C = (1 - frac) / (1 + frac);
  const raw = new Float32Array(D);
  let lp = 0;
  const k = 0.2 + 0.8 * bright;
  for (let i = 0; i < D; i++) raw[i] = lp += k * (white() - lp);
  // Picked near the bridge: comb the excitation, then remove its offset so the string settles at zero.
  const pk = Math.max(1, Math.round(0.13 * D));
  const line = Float32Array.from(raw, (v, i) => v - 0.9 * raw[(i - pk + D) % D]);
  const mean = line.reduce((s, v) => s + v, 0) / D;
  for (let i = 0; i < D; i++) line[i] -= mean;
  const loss = Math.pow(10, -3 / (freq * ring));
  const mute = Math.pow(10, -3 / (freq * 0.03));
  const off = S(dur);
  let idx = 0,
    prev = 0,
    ax = 0,
    ay = 0;
  for (let i = 0; i < n; i++) {
    const x = line[idx];
    out[i] = x;
    const avg = 0.5 * (x + prev);
    prev = x;
    const y = C * avg + ax - C * ay;
    ax = avg;
    ay = y;
    line[idx] = y * (i < off ? loss : mute);
    idx = idx + 1 === D ? 0 : idx + 1;
  }
  biquad(out, 'hp', 220);
  biquad(out, 'peak', 1500, 1, 5);
  biquad(out, 'peak', 4200, 1, 3);
  let peak = 1e-9;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < n; i++) out[i] /= peak;
  return edges(out, 0.3, 8);
}

// ---- drums ----------------------------------------------------------------------------------------------

/** The dance kick: a falling sine with a click, driven a little so a phone speaker hears its knock. */
function kick() {
  const n = S(0.32);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = 50 + 150 * Math.exp(-t / 0.028) + 40 * Math.exp(-t / 0.004);
    ph += (TAU * f) / RATE;
    out[i] = Math.tanh(1.8 * Math.sin(ph) * Math.exp(-t / 0.13)) / Math.tanh(1.8);
  }
  const click = biquad(
    Float32Array.from({ length: S(0.006) }, () => white()),
    'bp',
    3500,
    0.9,
  );
  for (let i = 0; i < click.length; i++) out[i] += click[i] * 0.35 * (1 - i / click.length);
  return edges(out, 0.2, 20);
}

/** Filtered noise with a decay. */
function noiseHit(len, tau, shape) {
  const out = Float32Array.from({ length: S(len) }, () => white());
  shape(out);
  for (let i = 0; i < out.length; i++) out[i] *= Math.exp(-i / (tau * RATE));
  return edges(out, 0.2, 5);
}

/** A clap: three quick slaps and the room's ring, with a stomp's low thump under it. */
function clap() {
  const n = S(0.35);
  const out = new Float32Array(n);
  [0, 0.009, 0.019].forEach((o, k) => {
    for (let i = 0; i < S(0.03); i++)
      out[S(o) + i] += white() * Math.exp(-i / (0.005 * RATE)) * (k === 2 ? 1 : 0.7);
  });
  const ring = S(0.019);
  for (let i = ring; i < n; i++) out[i] += white() * 0.5 * Math.exp(-(i - ring) / (0.09 * RATE));
  biquad(out, 'bp', 1250, 0.8);
  biquad(out, 'hp', 500);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    ph += (TAU * (110 + 60 * Math.exp(-t / 0.02))) / RATE;
    out[i] = out[i] * 2.2 + (t < 0.12 ? Math.sin(ph) * Math.exp(-t / 0.04) * 0.5 : 0);
  }
  return edges(out, 0.2, 10);
}

const openHat = () =>
  noiseHit(0.22, 0.06, (b) => (biquad(b, 'hp', 7000), biquad(b, 'peak', 10000, 1, 4)));
const closedHat = () =>
  noiseHit(0.05, 0.012, (b) => (biquad(b, 'hp', 8000), biquad(b, 'lp', 15000)));
const shaker = () =>
  noiseHit(0.07, 0.02, (b) => (biquad(b, 'bp', 6500, 1.2), biquad(b, 'hp', 4000)));
const crash = () =>
  noiseHit(
    1.6,
    0.5,
    (b) => (biquad(b, 'hp', 4500), biquad(b, 'peak', 7500, 0.8, 4), biquad(b, 'lp', 14000)),
  );

function snare(level = 1) {
  const n = S(0.2);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    ph += (TAU * (200 + 60 * Math.exp(-t / 0.01))) / RATE;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.03) * 0.6;
  }
  const nz = noiseHit(0.2, 0.05, (b) => (biquad(b, 'hp', 1800), biquad(b, 'peak', 5000, 1, 3)));
  for (let i = 0; i < n; i++) out[i] = (out[i] + nz[i]) * level;
  return out;
}

// ---- bass and chords -------------------------------------------------------------------------------------

/**
 * The off-beat bass: a saw through a closing two-pole filter, a sine under it. The saw's harmonics are
 * what a phone plays; the sine is what headphones feel.
 */
function bass(m, dur) {
  const f = mtof(m);
  const src = saw(f, dur + 0.03);
  const out = new Float32Array(src.length);
  let s1 = 0,
    s2 = 0;
  for (let i = 0; i < src.length; i++) {
    const t = i / RATE;
    const a = 1 - Math.exp((-TAU * (500 + 1100 * Math.exp(-t / 0.05))) / RATE);
    s1 += a * (src[i] - s1);
    s2 += a * (s1 - s2);
    const env =
      Math.min(1, t / 0.003) *
      (t < dur ? 1 - 0.3 * (t / dur) : Math.max(0, 0.7 * (1 - (t - dur) / 0.03)));
    out[i] = (s2 * 0.85 + Math.sin(TAU * f * t) * 0.4) * env;
  }
  return edges(out, 0.5, 4);
}

/** A chord of five detuned saws a voice, softened: a stab when short, a pad when long. */
function chordSaws(notes, len, { cutoff = 3200, attack = 0.004, release = 0.08 } = {}) {
  const n = S(len + release);
  const out = new Float32Array(n);
  for (const m of notes)
    for (const c of [-12, -5, 0, 6, 11]) {
      const s = saw(mtof(m + c / 100), len + release);
      for (let i = 0; i < n; i++) out[i] += s[i] * 0.2;
    }
  biquad(out, 'lp', cutoff, 0.7);
  biquad(out, 'hp', 250);
  const r = S(release);
  const l = S(len);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] *= (Math.min(1, t / attack) * (i < l ? 1 : 1 - (i - l) / r)) / notes.length;
  }
  return edges(out, 0.5, 4);
}

// ---- mix bus ------------------------------------------------------------------------------------------

/** A stereo room: eight damped combs into four allpasses, the right side spread a little wider. */
function reverb(st, { room = 0.8, damp = 0.35 } = {}) {
  const side = (input, spread) => {
    const out = new Float32Array(input.length);
    for (const base of [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]) {
      const len = Math.round(((base + spread) * RATE) / 44100);
      const line = new Float32Array(len);
      let idx = 0,
        store = 0;
      for (let i = 0; i < input.length; i++) {
        const y = line[idx];
        store = y * (1 - damp) + store * damp;
        line[idx] = input[i] * 0.02 + store * room;
        out[i] += y;
        idx = idx + 1 === len ? 0 : idx + 1;
      }
    }
    for (const base of [556, 441, 341, 225]) {
      const len = Math.round(((base + spread) * RATE) / 44100);
      const line = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < out.length; i++) {
        const b = line[idx];
        line[idx] = out[i] + b * 0.5;
        out[i] = b - out[i];
        idx = idx + 1 === len ? 0 : idx + 1;
      }
    }
    return out;
  };
  const out = { L: side(st.L, 0), R: side(st.R, 23) };
  // A bright room makes a fiddle hiss; a darker one sounds like a barn.
  both(out, 'lp', 6000);
  both(out, 'hp', 300);
  return out;
}

/** A ping-pong echo of `time` seconds, darker on every repeat. */
function echo(st, time, fb = 0.32) {
  const d = S(time);
  const n = st.L.length;
  const lineL = new Float32Array(n);
  const lineR = new Float32Array(n);
  const out = stereo(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const fromR = i >= d ? lineR[i - d] : 0;
    const fromL = i >= d ? lineL[i - d] : 0;
    lp += 0.4 * (fromR - lp);
    lineL[i] = (st.L[i] + st.R[i]) * 0.5 + lp * fb;
    lineR[i] = fromL;
    out.L[i] = fromL;
    out.R[i] = fromR;
  }
  return out;
}

/** Turns a bus down for a moment after every kick, so the kick punches through and the band pumps. */
function duck(st, kicks, depth) {
  const n = st.L.length;
  const g = new Float32Array(n).fill(1);
  for (const k of kicks)
    for (let i = 0; i < S(0.22); i++) {
      const t = i / RATE;
      const dip = depth * Math.min(1, t / 0.003) * Math.exp(-t / 0.08);
      const j = (k + i) % n;
      g[j] = Math.min(g[j], 1 - dip);
    }
  for (let i = 0; i < n; i++) {
    st.L[i] *= g[i];
    st.R[i] *= g[i];
  }
  return st;
}

/** A gentle bus compressor, linked across both sides. */
function glue(st, { threshold = 0.3, ratio = 2.5, attack = 0.008, release = 0.12 } = {}) {
  const a = Math.exp(-1 / (attack * RATE));
  const r = Math.exp(-1 / (release * RATE));
  let env = 0;
  for (let i = 0; i < st.L.length; i++) {
    const x = Math.max(Math.abs(st.L[i]), Math.abs(st.R[i]));
    env = x > env ? a * env + (1 - a) * x : r * env + (1 - r) * x;
    const gr = env > threshold ? Math.pow(env / threshold, 1 / ratio - 1) : 1;
    st.L[i] *= gr;
    st.R[i] *= gr;
  }
  return st;
}

/** A look-ahead limiter: it sees each peak 3 ms early and rides the gain smoothly under the ceiling. */
function limit(st, { ceiling = 0.92, release = 0.06 } = {}) {
  const look = S(0.003);
  const n = st.L.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(st.L[i]), Math.abs(st.R[i]));
    need[i] = x > ceiling ? ceiling / x : 1;
  }
  // The smallest gain needed anywhere in the next `look` samples (a monotonic deque).
  const ahead = new Float32Array(n);
  const q = [];
  let head = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (q.length > head && need[q[q.length - 1]] >= need[i]) q.pop();
    q.push(i);
    while (q[head] > i + look) head++;
    ahead[i] = need[q[head]];
  }
  const rel = Math.exp(-1 / (release * RATE));
  const att = Math.exp(-1 / (0.0015 * RATE));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const target = ahead[i];
    g = target < g ? att * g + (1 - att) * target : rel * g + (1 - rel) * target;
    const gg = Math.min(g, need[i]);
    st.L[i] *= gg;
    st.R[i] *= gg;
  }
  return st;
}

const rmsOf = (st) => {
  let s = 0;
  for (let i = 0; i < st.L.length; i++) s += st.L[i] * st.L[i] + st.R[i] * st.R[i];
  return Math.sqrt(s / (2 * st.L.length));
};

/**
 * Finishes a mix: the room and the echo added, glued, set to one loudness (`rms`) so a tier change never
 * jumps in level, and limited. Seamless when `loop` is set.
 */
function master({ dry, verb, delay, delayTime }, { loop = true, rms = 0.17, room = 0.8 } = {}) {
  const run = loop ? seamless : (b, fx) => fx(b);
  const out = addInto(
    dry,
    run(verb, (b) => reverb(b, { room })),
    0.8,
  );
  addInto(
    out,
    run(delay, (b) => echo(b, delayTime)),
    0.6,
  );
  // Nothing below 40 Hz: a phone cannot play it, and it would only eat headroom.
  both(out, 'hp', 40);
  both(out, 'hp', 40);
  const glued = run(out, (b) => glue(b));
  const k = rms / rmsOf(glued);
  for (const ch of [glued.L, glued.R]) for (let i = 0; i < ch.length; i++) ch[i] *= k;
  return run(glued, (b) => limit(b));
}

// ---- the tune -----------------------------------------------------------------------------------------

// D major, the fiddle's own key. D4 = 62.
const CHORDS = {
  D: { stab: [66, 69, 74], roll: [62, 66, 69, 74], root: 38 },
  G: { stab: [67, 71, 74], roll: [62, 67, 71, 74], root: 43 },
  A: { stab: [64, 69, 73], roll: [64, 69, 73, 76], root: 45 },
};
/** One chord a bar. */
const CHART = ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D'];
export const ROUND_BARS = CHART.length;
const chordOf = (bar) => CHORDS[CHART[bar % CHART.length]];

/**
 * The hook, in eighths: [eighth, MIDI, eighths, scoop]. A two-bar call (up to the high D, round the G
 * chord) is answered by a run up to the A and down onto the A chord; the call comes again, climbs higher
 * to the B, and the line falls back home to D with a pickup into the next time round.
 */
const HOOK = [
  // bar 1, D: the call
  [0, 69, 1],
  [1, 74, 1, 1],
  [2, 74, 1],
  [3, 76, 1],
  [4, 78, 2, 1],
  [6, 76, 1],
  [7, 74, 1],
  // bar 2, G
  [8, 71, 1],
  [9, 74, 1],
  [10, 79, 2, 1],
  [12, 78, 1],
  [13, 76, 1],
  [14, 74, 2],
  // bar 3, D: the answer runs up
  [16, 69, 1],
  [17, 74, 1, 1],
  [18, 74, 1],
  [19, 76, 1],
  [20, 78, 1],
  [21, 81, 1],
  [22, 81, 1],
  [23, 78, 1],
  // bar 4, A: and lands
  [24, 76, 2, 1],
  [26, 73, 1],
  [27, 76, 1],
  [28, 69, 2],
  [30, 73, 1],
  [31, 76, 1],
  // bar 5, D: the call again
  [32, 69, 1],
  [33, 74, 1, 1],
  [34, 74, 1],
  [35, 76, 1],
  [36, 78, 2, 1],
  [38, 76, 1],
  [39, 74, 1],
  // bar 6, G: higher this time
  [40, 71, 1],
  [41, 74, 1],
  [42, 79, 1, 1],
  [43, 81, 1],
  [44, 83, 2, 1],
  [46, 81, 1],
  [47, 79, 1],
  // bar 7, A
  [48, 78, 1],
  [49, 76, 1],
  [50, 76, 1],
  [51, 78, 1],
  [52, 76, 1],
  [53, 73, 1],
  [54, 69, 1],
  [55, 73, 1],
  // bar 8, D: home, and a pickup into the next time round
  [56, 74, 2, 1],
  [58, 78, 1],
  [59, 76, 1],
  [60, 74, 3],
  [63, 73, 1],
];

const SCALE = [2, 4, 6, 7, 9, 11, 1]; // D major pitch classes
/** The diatonic third below, for the harmony fiddle. */
function thirdBelow(m) {
  for (let d = 3; d <= 4; d++) if (SCALE.includes((((m - d) % 12) + 12) % 12)) return m - d;
  return m - 3;
}

/** The hook as bowed notes, at `beat` seconds a beat, `offsetBars` into the loop. */
function hookNotes(beat, { transpose = 0, map = (m) => m, g = 1, offsetBars = 0 } = {}) {
  const e = beat / 2;
  return HOOK.map(([q, m, len, scoop]) => ({
    at: (q + offsetBars * 8) * e,
    len: len * e * 0.9,
    m: map(m) + transpose,
    scoop: !!scoop,
    g,
  }));
}

const ROLL = [0, 1, 3, 0, 2, 3, 1, 3]; // a forward roll: thumb, index, middle

/** The banjo's forward roll through each bar's chord, in eighths or sixteenths. */
function banjoRoll(
  bus,
  verb,
  beat,
  bars,
  { sixteenths = false, g = 0.2, pan = -0.45, offsetBars = 0 } = {},
) {
  const step = sixteenths ? beat / 4 : beat / 2;
  const per = sixteenths ? 16 : 8;
  for (let bar = 0; bar < bars; bar++) {
    const c = chordOf(bar);
    for (let k = 0; k < per; k++) {
      const v = banjo(c.roll[ROLL[k % 8]], step * 1.6, { ring: 0.5 });
      const at = S(((bar + offsetBars) * per + k) * step);
      const accent = k % 4 === 0 ? 1 : 0.75;
      put(bus, v, at, g * accent, pan);
      put(verb, v, at, g * accent * 0.15, pan);
    }
  }
}

/** The banjo playing the hook itself, filling its long notes with a quick re-pick as banjo players do. */
function banjoHook(bus, verb, beat, { g = 0.35, pan = -0.2, offsetBars = 0 } = {}) {
  const e = beat / 2;
  for (const [q, m, len] of HOOK) {
    const at = S((q + offsetBars * 8) * e);
    const v = banjo(m, Math.max(e * len * 0.9, 0.12), { ring: 0.9 });
    put(bus, v, at, g, pan);
    put(verb, v, at, g * 0.2, pan);
    if (len >= 2)
      put(bus, banjo(m, e * 0.8, { ring: 0.6 }), S((q + 1 + offsetBars * 8) * e), g * 0.55, pan);
  }
}

/**
 * The rhythm section for `bars` bars: four-on-the-floor kick, claps and a stomp on 2 and 4, off-beat open
 * hats and the off-beat bass. Returns the kick positions, for ducking.
 */
function groove({ dry, verb, ducked }, beat, bars, layer, { lobby = false } = {}) {
  const kicks = [];
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * 4;
    const c = chordOf(bar);
    for (let q = 0; q < 4; q++) {
      const at = S((b0 + q) * beat);
      put(dry, kick(), at, lobby ? 0.65 : 0.8, 0);
      kicks.push(at);
      // The off-beat open hat: the "tss" that makes it a dance.
      put(dry, openHat(), S((b0 + q + 0.5) * beat), lobby ? 0.17 : 0.25, 0.25);
      // The off-beat bass, popping up an octave on the last off-beat of the bar from the second tier.
      const m = q === 3 && layer >= 2 ? c.root + 12 : c.root;
      put(ducked, bass(m, beat * 0.42), S((b0 + q + 0.5) * beat), lobby ? 0.42 : 0.5, 0);
      if (layer >= 4)
        put(ducked, bass(c.root + 12, beat * 0.18), S((b0 + q + 0.75) * beat), 0.22, 0);
      if (q % 2 === 1) {
        const cl = clap();
        put(dry, cl, at, lobby ? 0.42 : 0.5, 0);
        put(verb, cl, at, 0.2, 0);
      }
    }
    // Closed hats on the sixteenths in between.
    for (let s = 1; s < 16; s += 2)
      put(
        dry,
        closedHat(),
        S((b0 + s / 4) * beat),
        (s % 4 === 1 ? 0.06 : 0.09) * (lobby ? 0.8 : 1),
        -0.3,
      );
    if (layer >= 2)
      for (let s = 0; s < 16; s++)
        put(dry, shaker(), S((b0 + s / 4) * beat), s % 2 ? 0.07 : 0.04, 0.4);
    // From the third tier, a snare build into the top of the loop and a crash on the one.
    if (layer >= 3 && bar === bars - 1)
      for (let s = 0; s < 8; s++)
        put(dry, snare(0.4 + s * 0.08), S((b0 + 2 + s / 4) * beat), 0.3, 0);
    if ((layer >= 3 && bar === 0) || (lobby && bar % 8 === 0)) {
      const cr = crash();
      put(dry, cr, S(b0 * beat), lobby ? 0.08 : 0.15, 0.2);
      put(verb, cr, S(b0 * beat), 0.1, 0.2);
    }
  }
  return kicks;
}

/** Chord stabs on the off-beats: the dance floor's piano, here a soft synth brass. */
function stabs(bus, verb, beat, bars, { g = 0.22, offsetBars = 0 } = {}) {
  for (let bar = 0; bar < bars; bar++) {
    const v = chordSaws(chordOf(bar).stab, beat * 0.28, { cutoff: 2600 });
    for (let q = 0; q < 4; q++) {
      const at = S(((bar + offsetBars) * 4 + q + 0.5) * beat);
      put(bus, v, at, g, 0.3);
      put(verb, v, at, g * 0.35, 0.3);
    }
  }
}

/** A held chord under it all, soft, an octave down. */
function pad(bus, beat, bars, { g = 0.12 } = {}) {
  for (let bar = 0; bar < bars; bar++) {
    const v = chordSaws(
      chordOf(bar).stab.map((m) => m - 12),
      beat * 4,
      { cutoff: 1400, attack: 0.15, release: 0.12 },
    );
    put(bus, v, S(bar * 4 * beat), g, -0.1);
  }
}

// ---- round tiers ------------------------------------------------------------------------------------------

/**
 * Four tiers, each rendered at its own tempo with the same eight bars, so the band gets faster while the
 * pitch stays fixed (the user, 4 Oct 2026), and each adds a layer:
 * 1: kick, claps, hats, off-beat bass, the banjo rolling eighths, the fiddles on the hook;
 * 2: + shaker, the bass's octave pop, chord stabs, the banjo in sixteenths;
 * 3: + the hook an octave up, a crash on the one and a snare build into it;
 * 4: + the harmony fiddle a third below, the bass pumping sixteenths.
 */
export const ROUND_TIERS = [
  { bpm: 138, layer: 1 },
  { bpm: 144, layer: 2 },
  { bpm: 150, layer: 3 },
  { bpm: 156, layer: 4 },
];
export const ROUND_TIER_PACE = [0, 0.15, 0.35, 0.6];

/** Renders one round tier: a seamless 8-bar stereo loop at `bpm`, with the tier's layers. */
export function renderRound(bpm, layer) {
  const beat = 60 / bpm;
  const bars = CHART.length;
  const n = S(bars * 4 * beat);
  const dry = stereo(n);
  const verb = stereo(n);
  const delay = stereo(n);
  const ducked = stereo(n);
  const kicks = groove({ dry, verb, ducked }, beat, bars, layer);
  banjoRoll(dry, verb, beat, bars, { sixteenths: layer >= 2, g: layer >= 2 ? 0.14 : 0.18 });
  if (layer >= 2) stabs(ducked, verb, beat, bars, { g: 0.2 });
  pad(ducked, beat, bars, { g: layer >= 2 ? 0.12 : 0.08 });
  fiddles(dry, hookNotes(beat), n, { g: 0.62, verb, delayBus: delay, send: 0.22 });
  if (layer >= 3)
    fiddles(dry, hookNotes(beat, { transpose: 12 }), n, { g: 0.2, spread: 0.8, verb, send: 0.3 });
  if (layer >= 4)
    fiddles(dry, hookNotes(beat, { map: thirdBelow }), n, {
      g: 0.3,
      spread: 0.4,
      verb,
      send: 0.25,
    });
  addInto(dry, duck(ducked, kicks, 0.55));
  return master({ dry, verb, delay, delayTime: beat * 0.75 });
}

// ---- the lobby ------------------------------------------------------------------------------------------

export const LOBBY_BPM = 126;

/**
 * Between rounds: sixteen bars at a strut. The banjo states the hook over the groove while the fiddles
 * hold the chords; then the fiddles take the hook and the banjo rolls under them. Lighter than the run,
 * never sleepy.
 */
export function renderLobby() {
  const beat = 60 / LOBBY_BPM;
  const bars = CHART.length * 2;
  const n = S(bars * 4 * beat);
  const dry = stereo(n);
  const verb = stereo(n);
  const delay = stereo(n);
  const ducked = stereo(n);
  const kicks = groove({ dry, verb, ducked }, beat, bars, 2, { lobby: true });
  pad(ducked, beat, bars, { g: 0.14 });
  // First half: the banjo has the tune; the fiddles hold a chord tone under it.
  banjoHook(dry, verb, beat, { g: 0.55, pan: -0.15 });
  const held = CHART.map((_, bar) => ({
    at: bar * 4 * beat,
    len: 4 * beat * 0.96,
    m: chordOf(bar).stab[1],
    scoop: false,
    g: 0.8,
  }));
  fiddles(dry, held, n, { g: 0.18, spread: 0.7, verb, send: 0.35 });
  // Second half: the fiddles take the hook, the banjo rolls, the stabs come in.
  fiddles(dry, hookNotes(beat, { offsetBars: 8 }), n, {
    g: 0.5,
    verb,
    delayBus: delay,
    send: 0.25,
  });
  banjoRoll(dry, verb, beat, 8, { g: 0.15, offsetBars: 8 });
  stabs(ducked, verb, beat, 8, { g: 0.12, offsetBars: 8 });
  addInto(dry, duck(ducked, kicks, 0.45));
  return master({ dry, verb, delay, delayTime: beat * 0.75 }, { rms: 0.15, room: 0.82 });
}

// ---- stings (mono, for the effects sprite) -----------------------------------------------------------

const SB = 60 / 150;
const toMono = (st) => {
  const out = new Float32Array(st.L.length);
  for (let i = 0; i < out.length; i++) out[i] = (st.L[i] + st.R[i]) * 0.5;
  return out;
};
function sting(seconds, build, { rms = 0.16 } = {}) {
  const n = S(seconds);
  const dry = stereo(n);
  const verb = stereo(n);
  build(dry, verb, n);
  const out = master({ dry, verb, delay: stereo(n), delayTime: 0.2 }, { loop: false, rms });
  return edges(toMono(out), 1, 60);
}
const at = (beats) => S(beats * SB);

/** [beat, MIDI, beats, scoop] bowed by the section, with no wrap (a sting is not a loop). */
function bow(dry, verb, n, line, g = 0.6) {
  const notes = line.map(([b, m, len, scoop]) => ({
    at: b * SB,
    len: len * SB * 0.92,
    m,
    scoop: !!scoop,
  }));
  // bowedLine folds its tail to the start; give it room so nothing folds.
  const room = n + S(0.5);
  for (const v of SECTION) {
    const line = bowedLine(notes, room, v).subarray(0, n);
    put(dry, line, 0, g * 0.33, v.side * 0.5, false);
    put(verb, line, 0, g * 0.33 * 0.35, v.side * 0.5, false);
  }
}
function hit(dry, verb, beatAt, chord, g = 0.5) {
  put(dry, kick(), at(beatAt), 0.9, 0, false);
  const st = chordSaws(chord, 0.7, { cutoff: 3000, release: 0.4 });
  put(dry, st, at(beatAt), g, 0.2, false);
  put(verb, st, at(beatAt), g * 0.4, 0.2, false);
}

/** The run starts: a snare pickup, a kick, and the fiddles' call up to the high D. */
export function betSting() {
  // Short, and in the round music's key: it plays on the press and the round's own music starts
  // straight after, so anything longer, or carrying its own tune, ends up clashing with the hook.
  return sting(0.75, (dry, verb) => {
    // A quick banjo pickup up the D chord...
    [62, 66, 69, 74].forEach((m, i) =>
      put(dry, banjo(m, 0.12, { ring: 0.4 }), S(i * 0.045), 0.3 + i * 0.05, -0.2, false),
    );
    // ...with a short rush of air rising under it...
    const rise = Float32Array.from({ length: S(0.2) }, () => white());
    biquad(rise, 'hp', 2500);
    for (let i = 0; i < rise.length; i++) rise[i] *= (i / rise.length) ** 2 * 0.5;
    put(dry, rise, 0, 0.5, 0.3, false);
    // ...into one tight band hit: kick, clap, a bright D stab, a little crash.
    const go = S(0.18);
    put(dry, kick(), go, 0.9, 0, false);
    put(dry, clap(), go, 0.45, 0, false);
    const stab = chordSaws([74, 78, 81, 86], 0.09, { cutoff: 4200, release: 0.18 });
    put(dry, stab, go, 0.5, 0.15, false);
    put(verb, stab, go, 0.25, 0.15, false);
    put(dry, banjo(86, 0.25, { ring: 0.6 }), go, 0.3, -0.3, false);
    put(dry, crash(), go, 0.1, 0.2, false);
  });
}

/** A win: the banjo rolls up D major, the band hits, the fiddles run up to the top D and hold it. */
export function winSting() {
  return sting(2.4, (dry, verb, n) => {
    [62, 66, 69, 74, 78, 81].forEach((m, i) =>
      put(dry, banjo(m, 0.4), at(i * 0.2), 0.32, -0.4, false),
    );
    hit(dry, verb, 1.25, [74, 78, 81], 0.45);
    put(dry, crash(), at(1.25), 0.22, 0, false);
    bow(dry, verb, n, [
      [0.25, 78, 0.25],
      [0.5, 79, 0.25],
      [0.75, 81, 0.25],
      [1, 83, 0.25],
      [1.25, 86, 2.5, 1],
    ]);
    bow(dry, verb, n, [[1.25, 81, 2.5]], 0.3);
  });
}

/** A big win (x10 and up): a snare build, two band hits, the call played up a tone in E, ringing out. */
export function bigWinSting() {
  return sting(3.4, (dry, verb, n) => {
    for (let s = 0; s < 8; s++) put(dry, snare(0.35 + s * 0.08), at(s * 0.25), 0.35, 0, false);
    hit(dry, verb, 2, [71, 76, 80], 0.4);
    hit(dry, verb, 3.5, [76, 80, 83], 0.45);
    put(dry, crash(), at(3.5), 0.25, 0, false);
    for (let s = 0; s < 12; s++)
      put(dry, banjo([76, 80, 83, 88][ROLL[s % 8]], 0.3), at(3.5 + s * 0.25), 0.2, -0.5, false);
    bow(dry, verb, n, [
      [2, 71, 0.5],
      [2.5, 76, 0.5, 1],
      [3, 80, 0.5],
      [3.5, 83, 0.5, 1],
      [4, 88, 3, 1],
    ]);
    bow(dry, verb, n, [[4, 83, 3]], 0.3);
  });
}

/** A return at or below the stake: one soft, muted banjo note. Neutral on purpose, never a win sound. */
export function returnSting() {
  return sting(
    1,
    (dry) => put(dry, banjo(62, 0.35, { bright: 0.4, ring: 0.4 }), 0, 0.5, 0, false),
    { rms: 0.05 },
  );
}

/**
 * The crash, when the wolf appears: the band stops dead on one hard hit (a kick, a low boom and a heavy
 * B-flat chord, the run's D major cut off by its flat sixth), and a wolf howls far off across the field.
 * Only on the crash, never before it (flock-mvp spec). No snarl, no attack, nothing hurt: the flock's
 * scattering hooves are mixed in by build-audio.mjs. It shares nothing with the win cues.
 */
export function crashSting() {
  return sting(
    2.6,
    (dry, verb) => {
      // The stop: everything lands on one beat and is gone.
      put(dry, kick(), 0, 1, 0, false);
      const boom = new Float32Array(S(0.9));
      let ph = 0;
      for (let i = 0; i < boom.length; i++) {
        const t = i / RATE;
        ph += (TAU * (mtof(38) + 30 * Math.exp(-t / 0.05))) / RATE;
        boom[i] =
          Math.sin(ph) * Math.exp(-t / 0.28) + 0.25 * Math.sin(2 * ph) * Math.exp(-t / 0.12);
      }
      put(dry, edges(boom, 0.5, 30), 0, 0.7, 0, false);
      const chord = chordSaws([46, 50, 53, 58, 62], 0.22, { cutoff: 1900, release: 0.45 });
      put(dry, chord, 0, 0.75, 0, false);
      put(verb, chord, 0, 0.5, 0, false);
      const thud = noiseHit(0.25, 0.05, (b) => (biquad(b, 'lp', 900), biquad(b, 'hp', 60)));
      put(dry, thud, 0, 0.5, 0, false);
      put(dry, crash(), 0, 0.12, 0, false);
      // The howl, far off: mostly room.
      const h = howl(1.9);
      put(dry, h, S(0.32), 0.16, 0, false);
      put(verb, h, S(0.32), 0.55, 0, false);
    },
    { rms: 0.15 },
  );
}

/**
 * A wolf's howl: an almost pure voice that slides up into its note, holds it with a slow waver, and
 * falls away at the end. Few harmonics and a breath of air; heard from a distance, so softened above 3 kHz.
 */
function howl(len) {
  const n = S(len);
  const out = new Float32Array(n);
  const f0 = 520;
  let ph = 0;
  let drift = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const up = Math.min(1, t / 0.4);
    const rise = 0.72 + 0.28 * up * up * (3 - 2 * up);
    const fallStart = len - 0.55;
    const fall = t > fallStart ? 1 - 0.22 * ((t - fallStart) / 0.55) ** 1.6 : 1;
    drift += 0.0004 * (white() - drift * 0.02);
    const f =
      f0 *
      rise *
      fall *
      (1 + 0.035 * (t / len)) *
      (1 + 0.007 * Math.sin(TAU * 5.1 * t) + drift * 0.3);
    ph += (TAU * f) / RATE;
    const env =
      Math.min(1, t / 0.2) ** 1.5 *
      (t > len - 0.5 ? Math.cos(((t - (len - 0.5)) / 0.5) * (Math.PI / 2)) : 1);
    out[i] =
      env *
      (Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph) + 0.05 * Math.sin(4 * ph));
  }
  const air = Float32Array.from({ length: n }, () => white());
  biquad(air, 'bp', 1300, 0.7);
  for (let i = 0; i < n; i++) out[i] += air[i] * 0.05 * Math.abs(out[i]);
  biquad(out, 'lp', 3000, 0.7);
  biquad(out, 'hp', 200);
  return edges(out, 2, 20);
}
