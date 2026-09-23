// Procedural placeholder audio for Gate Rush and Beat the Gate. Pure JS synthesis, 48 kHz mono Float32.
// Every sound here is generated from code in this file, so there are no third-party licences.
//
// The horse game has its own sound, not Whack Crash's arcade chiptune: a highlife groove, the guitar-and-
// horns dance music of Ghana and Nigeria where the game launches. Plucked palm-wine guitar, an agogo bell,
// shaker, talking drum, bass and horn stabs in D major at 120 BPM, with the gallop, the yard latch and the
// gate on top.

import CUE from '../src/game/heading-cue.json' with { type: 'json' };

export const SR = 48000;
// The round music runs fast and speeds up further with the multiplier (manifest `stems.tempo`); the lobby
// is a separate, relaxed loop.
export const BPM = 150;
export const BEAT = 60 / BPM;
export const LOOP_BEATS = 16;
export const LOOP_SECONDS = LOOP_BEATS * BEAT; // 6.4 s, a whole number of milliseconds so the loop points are exact
export const LOBBY_BPM = 120;
const LOBBY_BEAT = 60 / LOBBY_BPM;
export const LOBBY_SECONDS = LOOP_BEATS * LOBBY_BEAT; // 8 s
export const TONE_SECONDS = 1;

const TAU = Math.PI * 2;
let seed = 7654321;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

/** The shared noise state, so the build can pin the music's noise sequence (build-audio.mjs). */
export const getSeed = () => seed;
export const setSeed = (value) => {
  seed = value;
};

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function buffer(seconds) {
  return new Float32Array(Math.round(seconds * SR));
}

/**
 * Adds a voice into `out` starting at `start` seconds. `fn` is called once per sample in order, so a voice
 * may keep state. `wrap` writes past the end back to the start (seamless loops).
 */
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
const saw = (ph) => 2 * (ph % 1) - 1;

/** One-pole low-pass. For a loop, the filter is first run over the tail so the seam doesn't click. */
function lowpass(buf, cutoff, loop = false) {
  let y = 0;
  const a = 1 - Math.exp((-TAU * cutoff) / SR);
  if (loop) for (let i = Math.max(0, buf.length - SR / 10); i < buf.length; i++) y += a * (buf[i] - y);
  for (let i = 0; i < buf.length; i++) buf[i] = y += a * (buf[i] - y);
  return buf;
}

function normalize(buf, peak = 0.85) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh((buf[i] / max) * peak * 1.2) / Math.tanh(1.2);
  return buf;
}

// ---------- instruments ----------

/** Palm-wine guitar: a Karplus-Strong plucked string. Stateful, so each note gets its own voice. */
function guitar(freq, brightness = 0.5) {
  const period = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = rand();
  let pos = 0;
  let prev = 0;
  const keep = 0.996 - (1 - brightness) * 0.01;
  return (t, len) => {
    const out = line[pos];
    const next = line[(pos + 1) % period];
    line[pos] = keep * (brightness * out + (1 - brightness) * (out + next) * 0.5);
    prev = prev * 0.2 + out * 0.8;
    pos = (pos + 1) % period;
    return prev * env(t, len, 0.001, 0.05);
  };
}

/** Agogo bell: two inharmonic partials, struck. */
const bell = (pitch = 1) => (t, len) =>
  (Math.sin(TAU * 1180 * pitch * t) * 0.6 + Math.sin(TAU * 2950 * pitch * t) * 0.4) * expDecay(t, 26) * env(t, len, 0.0008, 0.02);

/** Shaker: bright noise, a short swell and fall. */
function shaker() {
  let lp = 0;
  return (t, len) => {
    const n = rand();
    lp = lp * 0.7 + n * 0.3;
    return (n - lp) * Math.min(1, t / 0.012) * expDecay(t, 38) * env(t, len, 0.001, 0.02);
  };
}

/** Talking drum: a skin whose pitch bends down as the player squeezes it. */
const talkingDrum = (from, to) => {
  let ph = 0;
  return (t, len) => {
    const f = to + (from - to) * Math.exp(-t * 9);
    ph += f / SR;
    return (Math.sin(TAU * ph) * expDecay(t, 7) + rand() * 0.25 * expDecay(t, 120)) * env(t, len, 0.001, 0.04);
  };
};

/** Conga slap and open tone. */
const conga = (freq, slap = false) => (t, len) =>
  (Math.sin(TAU * freq * t) * expDecay(t, slap ? 30 : 16) + rand() * (slap ? 0.6 : 0.15) * expDecay(t, 80)) * env(t, len, 0.001, 0.03);

/** Bass guitar: warm fundamental with a touch of second harmonic. */
const bass = (n) => (t, len) => {
  const f = midi(n);
  return Math.tanh((Math.sin(TAU * f * t) + Math.sin(TAU * 2 * f * t) * 0.25) * 1.4) * expDecay(t, 3) * env(t, len, 0.004, 0.05);
};

/** Horn section stab: stacked saws a third apart, a quick swell and a little vibrato. */
const horn = (n, third = 4) => (t, len) => {
  const vib = 1 + 0.006 * Math.sin(TAU * 5.5 * t) * Math.min(1, t / 0.15);
  const f1 = midi(n) * vib;
  const f2 = midi(n + third) * vib;
  return (saw(f1 * t) * 0.5 + saw(f1 * 1.004 * t) * 0.3 + saw(f2 * t) * 0.35) * env(t, len, 0.03, 0.09);
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

/** Milestone: a quick rush of air past the horse and a light bell tap. */
export function sfxTick() {
  const b = buffer(0.32);
  whoosh(b, 0, 0.3, 1.2, 600, 4200);
  add(b, 0, 0.12, bell(1.2), 0.3);
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

/** Setback (not played on the rising configurations this game runs): one talking drum dropping in pitch. */
export function sfxSetback() {
  const b = buffer(0.6);
  add(b, 0, 0.55, talkingDrum(260, 110), 1);
  return normalize(lowpass(b, 5000), 0.6);
}

/** Boost (not played on the rising configurations): two bell taps rising. */
export function sfxBoost() {
  const b = buffer(0.36);
  add(b, 0, 0.14, bell(1), 0.6);
  add(b, 0.09, 0.2, bell(1.26), 0.6);
  return normalize(b, 0.6);
}

/**
 * A return at or below the stake: one muted guitar note and nothing after it. No rising run, no horns, no
 * bell (UK RTS 14F). It must never sound like the win.
 */
export function sfxReturn() {
  const b = buffer(0.45);
  add(b, 0, 0.4, guitar(midi(57), 0.2), 0.7);
  return normalize(lowpass(b, 2500), 0.45);
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

// ---------- the reveal: studio tools ----------
//
// The ride home, the win and the lights going out are the game's big moments, so they are built with more
// than the one-pole filters above: biquad filters that can sweep, a stadium reverb, and orchestral voices.

/** Adds `src` into `out` from `at` seconds, scaled by `gain`. */
function mix(out, src, gain = 1, at = 0) {
  const s0 = Math.round(at * SR);
  for (let i = 0; i < src.length && s0 + i < out.length; i++) if (s0 + i >= 0) out[s0 + i] += src[i] * gain;
}

/**
 * RBJ biquad over `buf`: 'lp', 'hp' or 'bp'. `freq` may be a function of time in seconds, for a sweep; the
 * coefficients are then refreshed every 32 samples.
 */
function biquad(buf, type, freq, q = 0.707) {
  const out = new Float32Array(buf.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const set = (f) => {
    const w = (TAU * Math.min(Math.max(20, f), SR * 0.45)) / SR;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const c = type === 'lp' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : type === 'hp' ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2] : [alpha, 0, -alpha];
    b0 = c[0] / a0;
    b1 = c[1] / a0;
    b2 = c[2] / a0;
    a1 = (-2 * cos) / a0;
    a2 = (1 - alpha) / a0;
  };
  const sweep = typeof freq === 'function';
  if (!sweep) set(freq);
  for (let i = 0; i < buf.length; i++) {
    if (sweep && i % 32 === 0) set(freq(i / SR));
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** Freeverb (8 damped combs into 4 all-passes): the stadium the game plays in. */
function reverb(buf, { room = 0.84, damp = 0.3, wet = 0.3 } = {}) {
  const k = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((n) => ({ line: new Float32Array(Math.round(n * k)), i: 0, store: 0 }));
  const alls = [556, 441, 341, 225].map((n) => ({ line: new Float32Array(Math.round(n * k)), i: 0 }));
  const feedback = room * 0.28 + 0.7;
  const out = new Float32Array(buf.length);
  for (let n = 0; n < buf.length; n++) {
    const x = buf[n] * 0.015;
    let acc = 0;
    for (const c of combs) {
      const y = c.line[c.i];
      c.store = y * (1 - damp) + c.store * damp;
      c.line[c.i] = x + c.store * feedback;
      c.i = (c.i + 1) % c.line.length;
      acc += y;
    }
    for (const a of alls) {
      const b = a.line[a.i];
      a.line[a.i] = acc + b * 0.5;
      acc = b - acc;
      a.i = (a.i + 1) % a.line.length;
    }
    out[n] = buf[n] + acc * wet * 3;
  }
  return out;
}

/** Snare: a tuned body that drops a little, under two bands of noise for the wires. */
function snareHit(vel) {
  const len = 0.22;
  const body = buffer(len);
  let ph = 0;
  add(body, 0, len, (t, l) => {
    ph += (205 - 45 * Math.min(1, t * 30)) / SR;
    return Math.sin(TAU * ph) * expDecay(t, 42) * env(t, l, 0.0005, 0.02);
  });
  const noise = buffer(len);
  add(noise, 0, len, (t, l) => rand() * expDecay(t, 24) * env(t, l, 0.0005, 0.03));
  const wires = biquad(noise, 'bp', 2400, 0.8);
  const air = biquad(noise, 'hp', 6500);
  for (let i = 0; i < body.length; i++) body[i] = (body[i] * 0.55 + wires[i] * 1.2 + air[i] * 0.5) * vel;
  return body;
}

/** Timpani: a drum head's inharmonic modes, the pitch settling after the mallet, and the felt thump. */
function timpaniHit(f0, len = 1.6) {
  const modes = [[1, 1, 2.2], [1.504, 0.5, 3], [1.742, 0.3, 3.6], [2.0, 0.28, 4.2], [2.44, 0.16, 5.5]];
  const phases = modes.map(() => 0);
  const b = buffer(len);
  add(b, 0, len, (t, l) => {
    const glide = 1 + 0.05 * Math.exp(-t * 16);
    let v = 0;
    modes.forEach(([ratio, amp, decay], j) => {
      phases[j] += (f0 * ratio * glide) / SR;
      v += Math.sin(TAU * phases[j]) * amp * Math.exp(-t * decay);
    });
    return v * env(t, l, 0.002, 0.08);
  });
  const felt = buffer(0.06);
  add(felt, 0, 0.06, (t) => rand() * expDecay(t, 80));
  mix(b, biquad(felt, 'lp', 700), 0.9);
  return b;
}

/** Crash cymbal: six detuned square waves (the metallic ring) and noise, high-passed, decaying. */
function cymbal(len = 2.4, decay = 1.8) {
  const freqs = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 2.4);
  const phases = freqs.map(() => Math.abs(rand()));
  const b = buffer(len);
  add(b, 0, len, (t, l) => {
    let v = 0;
    freqs.forEach((f, j) => {
      phases[j] += f / SR;
      v += square(phases[j]);
    });
    return ((v / 6) * 0.55 + rand() * 0.6) * Math.exp(-t * decay) * env(t, l, 0.001, 0.15);
  });
  return biquad(biquad(b, 'hp', 4200, 0.6), 'lp', 14000);
}

/** String section: five detuned saws a note, a slow bow, through a low-pass that can open as it swells. */
function strings(len, notes, { attack = 0.4, release = 0.3, from = 900, to = 900 } = {}) {
  const b = buffer(len);
  for (const n of notes) {
    for (let v = 0; v < 5; v++) {
      const f = midi(n) * (1 + (v - 2) * 0.0032);
      const rate = 4.6 + v * 0.37;
      let ph = Math.abs(rand());
      add(b, 0, len, (t, l) => {
        ph += (f * (1 + 0.0028 * Math.sin(TAU * rate * t))) / SR;
        return saw(ph) * env(t, l, attack, release);
      }, 1 / (notes.length * 5));
    }
  }
  return biquad(b, 'lp', from === to ? from : (t) => from + (to - from) * Math.min(1, t / len) ** 1.4, 0.7);
}

/** Brass section stab: bright detuned saws that scoop up to pitch, the filter snapping open then closing. */
function brass(len, notes) {
  const b = buffer(len);
  for (const n of notes) {
    for (let v = 0; v < 3; v++) {
      const f = midi(n) * (1 + (v - 1) * 0.004);
      let ph = Math.abs(rand());
      add(b, 0, len, (t, l) => {
        ph += (f * (1 - 0.02 * Math.exp(-t * 30))) / SR;
        return saw(ph) * env(t, l, 0.015, 0.25);
      }, 1 / (notes.length * 3));
    }
  }
  return biquad(b, 'lp', (t) => 900 + 4200 * Math.exp(-t * 3.5), 1.1);
}

/**
 * A stadium crowd roaring: noise through three vowel bands, moved by slow unrelated swells so it sounds like
 * many people, not one hiss. `shape(t)` is its loudness over time.
 */
function crowdRoar(len, shape) {
  const n = buffer(len);
  add(n, 0, len, () => rand());
  const low = biquad(n, 'bp', 620, 1.4);
  const mid = biquad(n, 'bp', 1150, 1.8);
  const high = biquad(n, 'bp', 2500, 2.4);
  const swells = [0.6, 1.1, 1.9, 3.1].map((f) => ({ f, p: Math.abs(rand()) }));
  const out = buffer(len);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let m = 1;
    for (const s of swells) m *= 0.82 + 0.18 * Math.sin(TAU * (s.f * t + s.p));
    out[i] = (low[i] + mid[i] * 0.75 + high[i] * 0.35) * m * shape(t);
  }
  return out;
}

/** Someone in the stand whistling: a rising two-finger whistle with a wobble. */
function whistle(out, at, gain) {
  let ph = 0;
  add(out, at, 0.7, (t, l) => {
    ph += (2300 + 700 * Math.min(1, t / 0.25) - 250 * Math.max(0, t - 0.45)) * (1 + 0.01 * Math.sin(TAU * 7 * t)) / SR;
    return Math.sin(TAU * ph) * env(t, l, 0.04, 0.15);
  }, gain);
}

/** A firework: the thump of the shell bursting, then the crackle of the stars falling. */
function fireworkPop(out, at, gain) {
  add(out, at, 0.4, (t, l) => (Math.sin(TAU * 62 * t) * expDecay(t, 14) + rand() * expDecay(t, 35) * 0.7) * env(t, l, 0.001, 0.08), gain);
  for (let k = 0; k < 30; k++) {
    const when = at + 0.1 + Math.abs(rand()) ** 1.5 * 0.9;
    add(out, when, 0.01, (t) => rand() * expDecay(t, 400), gain * 0.55 * Math.abs(rand()));
  }
}

/** A floodlight breaker going: a heavy relay thunk in the stand's steel, and its click. */
function breaker(out, at, gain) {
  add(out, at, 0.6, (t, l) => (Math.sin(TAU * 46 * t) * expDecay(t, 9) + Math.sin(TAU * 92 * t) * 0.45 * expDecay(t, 16)) * env(t, l, 0.001, 0.08), gain);
  const n = buffer(0.07);
  add(n, 0, 0.07, (t) => rand() * expDecay(t, 70));
  mix(out, biquad(n, 'bp', 2100, 2.5), gain * 1.3, at);
}

/** The floodlights' mains hum dying away as the power goes: it drops in pitch and fades. */
function powerDown(out, at, len, gain) {
  let ph = 0;
  const hum = buffer(len);
  add(hum, 0, len, (t, l) => {
    ph += (100 * (1 - 0.65 * Math.min(1, t / l) ** 0.7)) / SR;
    return (saw(ph) * 0.6 + square(ph * 2) * 0.25) * (1 - t / l) ** 1.5 * env(t, l, 0.003, 0.05);
  });
  mix(out, biquad(hum, 'lp', 1400, 0.9), gain, at);
}

/** Final level: a gentle soft clip to `peak`. */
function master(buf, peak = 0.85) {
  return normalize(buf, peak);
}

// ---------- the reveal: ride home, win, lights out ----------

/**
 * The ride home's timeline, shared with the client (stage.ts and view.ts read the same file): its fixed
 * length, and the accent hits the screen pulses on, so every drum hit lands on a visual beat.
 */
export const HEADING_CUE = CUE;
export const HEADING_HOME_SECONDS = CUE.seconds;

/** A choir on "aah": stacked detuned saws shaped by the vowel's three formants, bowed in slowly. */
function choir(len, notes, { attack = 0.3, release = 0.1 } = {}) {
  const b = buffer(len);
  for (const n of notes) {
    for (let v = 0; v < 4; v++) {
      const f = midi(n) * (1 + (v - 1.5) * 0.004);
      const rate = 5 + v * 0.3;
      let ph = Math.abs(rand());
      add(b, 0, len, (t, l) => {
        ph += (f * (1 + 0.004 * Math.sin(TAU * rate * t))) / SR;
        return saw(ph) * env(t, l, attack, release);
      }, 1 / (notes.length * 4));
    }
  }
  const out = buffer(len);
  mix(out, biquad(b, 'bp', 800, 2.2), 1);
  mix(out, biquad(b, 'bp', 1150, 3), 0.7);
  mix(out, biquad(b, 'bp', 2700, 4), 0.25);
  return out;
}

/** Strings bowed tremolo: the section's fast shiver, `rate` strokes a second. */
function tremoloStrings(len, notes, rate, { attack = 0.03, release = 0.05 } = {}) {
  const b = strings(len, notes, { attack, release, from: 3800, to: 3800 });
  for (let i = 0; i < b.length; i++) b[i] *= 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * rate * (i / SR)));
  return b;
}

/** Glue: a soft-knee compressor with make-up gain, so the layers sit together as one full sound. */
function compress(buf, { threshold = 0.25, ratio = 3, attack = 0.005, release = 0.12 } = {}) {
  const out = new Float32Array(buf.length);
  const ga = Math.exp(-1 / (attack * SR));
  const gr = Math.exp(-1 / (release * SR));
  let envl = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = Math.abs(buf[i]);
    envl = x > envl ? ga * envl + (1 - ga) * x : gr * envl + (1 - gr) * x;
    const gain = envl > threshold ? (threshold + (envl - threshold) / ratio) / envl : 1;
    out[i] = buf[i] * gain;
  }
  return out;
}

/**
 * The ride home's harmony, one chord per hit of the cue, all over a low A: A, F/A, G/A, A7, A7 flat 9, A7,
 * then A high and wide. The top line climbs every step (E F G G B-flat C-sharp E), and A7 is the one chord
 * that leads both to the win's D major and, deceptively, to the loss's B minor.
 */
const HEADING_CHORDS = [
  [45, 52, 57, 64],
  [45, 53, 57, 65],
  [45, 55, 59, 67],
  [45, 55, 61, 67],
  [45, 58, 61, 67, 70],
  [45, 57, 61, 67, 73],
  [45, 57, 64, 69, 73, 76],
];

/**
 * Heading home: 2.5 s, the same every time, in place of the round music. A scored build, not a sound effect:
 * a low boom as the horse turns; a pedal A pulsing in the bass and quickening; the harmony climbing a chord
 * on every hit of the cue, in tremolo strings and a choir, with a brass stab on each hit, higher and louder;
 * the game's own talking drum squeezing upward and agogo bell running faster; a snare roll growing out of
 * nothing, timpani on the hits, a shaker, a noise riser sweeping up and a cymbal played backwards; all in the
 * stadium, glued together, and cut dead a breath before the gate is shown so the result lands as the hit.
 * Nothing in it knows the result.
 */
export function sfxHeading() {
  const total = HEADING_HOME_SECONDS;
  const stop = total - 0.12;
  const hits = CUE.hits;
  const b = buffer(total);
  const at = (i) => hits[i] ?? stop;

  // The turn for home: a sub boom dropping, and a low brass swell under it.
  add(b, 0, 1.0, (t, l) => Math.sin(TAU * (48 * t - 10 * t * t)) * expDecay(t, 3.2) * env(t, l, 0.004, 0.2), 0.9);
  mix(b, biquad(brass(0.9, [33, 45, 52]), 'lp', 900), 0.55);

  // Bass: A pulsing in eighths, then sixteenths, opening up as it goes.
  const bassLine = buffer(total);
  for (let t0 = 0.2, k = 0; t0 < stop - 0.05; k++) {
    const p = t0 / stop;
    add(bassLine, t0, 0.14, bass(k % 2 ? 45 : 33), 0.55 + 0.35 * p);
    t0 += 0.2 - 0.11 * p;
  }
  mix(b, biquad(bassLine, 'lp', (t) => 300 + 2500 * (t / total) ** 2), 0.9);

  // Harmony: one chord per hit, tremolo strings and choir carrying it, a brass stab on each hit.
  HEADING_CHORDS.forEach((notes, i) => {
    const start = at(i);
    const len = Math.max(0.08, at(i + 1) - start + 0.04);
    const p = start / stop;
    const lift = 0.35 + 0.65 * p;
    mix(b, tremoloStrings(len, notes.map((n) => n + 12), 7 + 9 * p), 0.55 * lift, start);
    mix(b, choir(len, notes.slice(1), { attack: i === 0 ? 0.4 : 0.03, release: 0.05 }), 0.5 * lift, start);
    mix(b, brass(Math.min(0.35, len), notes.slice(1)), 0.35 + 0.45 * p, start);
  });

  // Percussion: snare roll from nothing, timpani on the hits, talking drum squeezing up, bell and shaker.
  let hand = 0;
  for (let t0 = 0.35; t0 < stop - 0.02; hand++) {
    const p = t0 / stop;
    const vel = (0.04 + 0.96 * p ** 2.2) * (hand % 2 ? 0.82 : 1) * (0.9 + 0.1 * Math.abs(rand()));
    mix(b, snareHit(vel), 0.4, t0 + rand() * 0.002);
    t0 += 1 / (12 + 22 * p ** 1.2);
  }
  hits.forEach((t0, i) => mix(b, timpaniHit(55), 0.35 + 0.08 * i, t0));
  hits.slice(2).forEach((t0, i) => add(b, t0 + 0.05, 0.22, talkingDrum(150 + i * 25, 260 + i * 45), 0.28 + 0.06 * i));
  for (let t0 = 0.9, k = 0; t0 < stop - 0.03; k++) {
    const p = t0 / stop;
    if (BELL[k % 16]) add(b, t0, 0.1, bell(k % 4 === 0 ? 0.94 : 1), 0.1 + 0.12 * p);
    add(b, t0, 0.07, shaker(), 0.06 + 0.12 * p);
    t0 += 0.1 - 0.045 * p;
  }

  // Riser: noise swept up through a band-pass, and a cymbal played backwards, both into the stop.
  const riser = buffer(total);
  add(riser, 0.5, stop - 0.5, (t, l) => rand() * (t / l) ** 2.2 * env(t, l, 0.05, 0.005));
  mix(b, biquad(riser, 'bp', (t) => 300 + 7000 * Math.max(0, (t - 0.5) / (stop - 0.5)) ** 1.8, 1.6), 0.45);
  mix(b, cymbal(1.4, 2.4).reverse(), 0.6, stop - 1.4);

  const glued = compress(reverb(b, { room: 0.8, damp: 0.35, wet: 0.18 }), { threshold: 0.3, ratio: 3.5 });
  // The dead stop: everything, the reverb too, is cut, so the reveal comes out of silence.
  for (let i = Math.round(stop * SR); i < glued.length; i++) glued[i] *= Math.max(0, 1 - (i - stop * SR) / (0.01 * SR));
  return master(glued, 0.86);
}

/**
 * Win, above the stake only (the client routes it through the celebrate decision). The gate is open: a
 * cymbal crash, a timpani hit and the band's D major chord, strings and brass; the palm-wine guitar strums
 * up it; the stand roars; and the fireworks go up with the picture, a pop and a crackle for each.
 */
export function sfxWin() {
  const len = 3.0;
  const b = buffer(len);
  mix(b, cymbal(2.6, 1.3), 0.55);
  mix(b, timpaniHit(73.42, 1.8), 0.9);
  mix(b, brass(0.9, [50, 57, 62, 66, 69]), 0.9);
  mix(b, strings(2.4, [50, 57, 62, 66, 69, 74], { attack: 0.03, release: 1.2, from: 4200, to: 2200 }), 0.9);
  [62, 66, 69, 74, 78].forEach((n, i) => add(b, 0.04 + i * 0.03, 1.5, guitar(midi(n), 0.75), 0.35));
  mix(b, crowdRoar(len, (t) => Math.min(1, t / 0.35) * (t < 1.4 ? 1 : Math.max(0, 1 - (t - 1.4) / 1.6))), 1.2);
  for (let i = 0; i < 5; i++) fireworkPop(b, 0.05 + i * 0.3, 0.55);
  whistle(b, 0.4, 0.07);
  whistle(b, 1.0, 0.05);
  return master(reverb(b, { room: 0.86, damp: 0.3, wet: 0.2 }), 0.86);
}

/** Big win (x10 and up): a brass fanfare up the D major chord first, then the same arrival held longer. */
export function sfxBigWin() {
  const len = 4.0;
  const b = buffer(len);
  [[0, [62]], [0.14, [66]], [0.28, [69]]].forEach(([at, notes]) => mix(b, brass(0.2, notes), 0.8, at));
  const hit = 0.42;
  mix(b, cymbal(3.2, 1.0), 0.6, hit);
  mix(b, timpaniHit(73.42, 2.2), 1, hit);
  mix(b, brass(1.4, [50, 57, 62, 66, 69, 74]), 1, hit);
  mix(b, strings(3.2, [38, 50, 57, 62, 66, 69, 74, 78], { attack: 0.03, release: 1.6, from: 5200, to: 2400 }), 1, hit);
  [62, 66, 69, 74, 78, 81].forEach((n, i) => add(b, hit + 0.04 + i * 0.03, 1.8, guitar(midi(n), 0.75), 0.35));
  mix(b, crowdRoar(len, (t) => Math.min(1, t / 0.5) * (t < 2.2 ? 1 : Math.max(0, 1 - (t - 2.2) / 1.8))), 1);
  for (let i = 0; i < 9; i++) fireworkPop(b, 0.05 + i * 0.22, 0.55);
  [0.5, 1.1, 1.8].forEach((at, i) => whistle(b, at, 0.07 - i * 0.015));
  return master(reverb(b, { room: 0.88, damp: 0.3, wet: 0.22 }), 0.88);
}

/**
 * CRASH, which in Gate Rush is the gate revealed shut: the floodlights go, two breakers a beat apart with the
 * picture, the mains hum dying under them, the thunks echoing round an emptying stadium, and then a low,
 * dark B minor chord that fades. Stated, not played up: no crowd, no sting, and nothing that sounds like the
 * ride came close. It must never sound like the win.
 */
export function sfxGateSlam() {
  const len = 2.6;
  const b = buffer(len);
  breaker(b, 0, 1);
  breaker(b, 0.22, 0.9);
  powerDown(b, 0, 1.5, 0.45);
  mix(b, strings(2.0, [35, 42, 47, 50], { attack: 0.35, release: 1.0, from: 700, to: 450 }), 0.9, 0.45);
  return master(reverb(b, { room: 0.92, damp: 0.25, wet: 0.35 }), 0.8);
}

// ---------- music (seamless 4-bar loops) ----------

// Lobby: highlife's I-IV-V-IV in D (D, G, A, G). Round: a darker, more urgent vi-IV-I-V (Bm, G, D, A).
const CHORDS = [
  [50, 54, 57, 62], // D
  [55, 59, 62, 67], // G
  [57, 61, 64, 69], // A
  [55, 59, 62, 67], // G
];
const RUSH_CHORDS = [
  [47, 50, 54, 59], // Bm
  [43, 47, 50, 55], // G
  [50, 54, 57, 62], // D
  [45, 49, 52, 57], // A
];

/** The 12-note bell pattern folded into 16ths: the timeline every highlife part locks to. */
const BELL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0];

/** Punchy kick for the round: a pitched thump with a click on top. */
const punch = (t, len) =>
  (Math.sin(TAU * (52 * t + (110 * (1 - Math.exp(-t * 34))) / 34)) * expDecay(t, 13) + rand() * 0.2 * expDecay(t, 200)) * env(t, len, 0.0008, 0.03);

/** Hand clap: three quick noise bursts and a tail. */
function clap() {
  let lp = 0;
  return (t, len) => {
    const n = rand();
    lp = lp * 0.5 + n * 0.5;
    const bursts = t < 0.03 ? (Math.floor(t / 0.01) % 2 === 0 ? 1 : 0.3) : expDecay(t - 0.03, 18);
    return (n - lp * 0.6) * bursts * env(t, len, 0.0005, 0.03);
  };
}

/** Rhythm bed: four-on-the-floor kick, octave bass, guitar sixteenths below the tune, shaker and claps. */
function rhythmBed() {
  const b = buffer(LOOP_SECONDS);
  const pick = [0, 2, 3, 2, 1, 2, 3, 2, 0, 2, 3, 2, 1, 3, 2, 3];
  for (let bar = 0; bar < 4; bar++) {
    const chord = RUSH_CHORDS[bar];
    const bar0 = bar * 4 * BEAT;
    for (let beat = 0; beat < 4; beat++) add(b, bar0 + beat * BEAT, 0.28, punch, 0.8, true);
    [1, 3].forEach((beat) => add(b, bar0 + beat * BEAT, 0.25, clap(), 0.55, true));
    for (let e = 0; e < 8; e++) {
      // Octave bass pitched high enough (B2 and up) that phone and laptop speakers still carry it.
      const n = chord[0] + (e % 2 ? 12 : 0);
      add(b, bar0 + (e / 2) * BEAT, BEAT * 0.45, bass(n), 0.42, true);
    }
    for (let s = 0; s < 16; s++) {
      const t0 = bar0 + (s / 4) * BEAT;
      add(b, t0, BEAT * 0.5, guitar(midi(chord[pick[s]]), 0.65), s % 4 === 0 ? 0.34 : 0.24, true);
      add(b, t0, 0.08, shaker(), s % 2 ? 0.2 : 0.12, true);
    }
  }
  return normalize(lowpass(b, 7500, true), 0.8);
}

/** Bright single-voice lead, trumpet-like: a narrow pulse and a saw, vibrato after the attack. */
const leadVoice = (n) => (t, len) => {
  const vib = 1 + 0.008 * Math.sin(TAU * 6 * t) * Math.min(1, Math.max(0, (t - 0.08) / 0.12));
  const f = midi(n) * vib;
  const ph = (f * t) % 1;
  const pulse = ph < 0.3 ? 1 : -1;
  return (pulse * 0.45 + saw(f * t) * 0.35 + Math.sin(TAU * f * t) * 0.3) * env(t, len, 0.01, 0.06);
};

/**
 * The round tune, four bars over Bm-G-D-A: [beat within the loop, MIDI note, length in beats]. It climbs
 * through the first three bars and turns back on the A chord to lead into the top again, so the loop reads
 * as one phrase rather than a riff.
 */
const MELODY = [
  // Bm: repeated F#, up to A, stepping down
  [0, 78, 0.5], [0.5, 78, 0.5], [1, 81, 0.5], [1.5, 78, 0.25], [1.75, 76, 0.75], [2.5, 74, 0.5], [3, 76, 0.5], [3.5, 78, 0.5],
  // G: dip to B, climb to G
  [4, 74, 0.5], [4.5, 71, 0.5], [5, 74, 0.5], [5.5, 76, 0.5], [6, 79, 1], [7, 78, 0.5], [7.5, 76, 0.5],
  // D: the same opening, reaching the top B
  [8, 78, 0.5], [8.5, 78, 0.5], [9, 81, 0.5], [9.5, 83, 0.5], [10, 81, 0.75], [10.75, 78, 0.25], [11, 76, 0.5], [11.5, 74, 0.5],
  // A: turn around and lead back into the top
  [12, 76, 0.75], [12.75, 73, 0.25], [13, 76, 0.5], [13.5, 81, 1], [14.5, 79, 0.5], [15, 78, 0.5], [15.5, 76, 0.5],
];

/** The tune on the lead voice, with a quiet guitar an octave below for body. */
function melodyLine(octave = 0) {
  const b = buffer(LOOP_SECONDS);
  for (const [beat, n, len] of MELODY) {
    add(b, beat * BEAT, len * BEAT * 0.92, leadVoice(n + octave), 0.42, true);
    add(b, beat * BEAT, len * BEAT, guitar(midi(n + octave - 12), 0.6), 0.16, true);
  }
  return normalize(lowpass(b, 6500, true), 0.7);
}

/**
 * Round base, the layer that always plays: the rhythm bed and the tune together, so the ride has its melody
 * from the first beat. The shared audio player brings the other two stems in as the round speeds up.
 */
export function stemBase() {
  const rhythm = rhythmBed();
  const tune = melodyLine();
  const b = buffer(LOOP_SECONDS);
  for (let i = 0; i < b.length; i++) b[i] = rhythm[i] * 0.55 + tune[i] * 0.75;
  return normalize(b, 0.85);
}

/** Joins at medium speed: rolling congas, the bell timeline and a talking-drum run into each bar. */
export function stemDrums() {
  const b = buffer(LOOP_SECONDS);
  const congaLine = [262, 0, 196, 262, 0, 196, 262, 196, 262, 0, 196, 262, 196, 262, 196, 330];
  for (let bar = 0; bar < 4; bar++) {
    const bar0 = bar * 4 * BEAT;
    for (let s = 0; s < 16; s++) {
      const t0 = bar0 + (s / 4) * BEAT;
      if (BELL[s]) add(b, t0, 0.12, bell(s === 0 ? 0.94 : 1), 0.36, true);
      if (congaLine[s]) add(b, t0, 0.14, conga(congaLine[s], s % 3 === 0), s % 4 === 0 ? 0.42 : 0.3, true);
    }
    [3, 3.25, 3.5, 3.75].forEach((beat, i) => add(b, bar0 + beat * BEAT, 0.2, talkingDrum(300 - i * 25, 150), 0.4, true));
  }
  return normalize(b, 0.82);
}

/** Joins at high speed: horn stabs on the off-beats and the tune doubled an octave up, quieter. */
export function stemLead() {
  const b = buffer(LOOP_SECONDS);
  for (let bar = 0; bar < 4; bar++) {
    const chord = RUSH_CHORDS[bar];
    [0.5, 1.5, 2.5, 3.5].forEach((beat) => add(b, (bar * 4 + beat) * BEAT, 0.3 * BEAT, horn(chord[1] + 12, 3), 0.3, true));
  }
  const high = melodyLine(12);
  for (let i = 0; i < b.length; i++) b[i] = b[i] + high[i] * 0.35;
  return normalize(lowpass(b, 6000, true), 0.62);
}

/**
 * Lobby loop for the betting screen: the same groove, relaxed. Guitar and bell over a light shaker, no horns
 * and no kick, so it can sit under the menu indefinitely.
 */
export function lobbyLoop() {
  const b = buffer(LOBBY_SECONDS);
  const lobbyChords = [CHORDS[0], CHORDS[1], CHORDS[0], CHORDS[2]];
  const melody = [2, 3, 2, 1, 0, 1, 2, 3];
  for (let bar = 0; bar < 4; bar++) {
    const chord = lobbyChords[bar];
    const bar0 = bar * 4 * LOBBY_BEAT;
    for (let e = 0; e < 8; e++) {
      add(b, bar0 + (e / 2) * LOBBY_BEAT, LOBBY_BEAT * 1.2, guitar(midi(chord[melody[e]] + 12), 0.5), e % 2 ? 0.24 : 0.32, true);
    }
    add(b, bar0, LOBBY_BEAT * 3, bass(chord[0] - 12), 0.4, true);
    for (let s = 0; s < 16; s++) {
      if (BELL[s] && s % 4 === 0) add(b, bar0 + (s / 4) * LOBBY_BEAT, 0.14, bell(), 0.2, true);
      if (s % 2 === 0) add(b, bar0 + (s / 4) * LOBBY_BEAT, 0.1, shaker(), 0.12, true);
    }
  }
  return normalize(lowpass(b, 6000, true), 0.58);
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
