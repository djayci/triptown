// Procedural placeholder audio for Gate Rush and Beat the Gate. Pure JS synthesis, 48 kHz mono Float32.
// Every sound here is generated from code in this file, so there are no third-party licences.
//
// The horse game has its own sound, not Whack Crash's arcade chiptune: a highlife groove, the guitar-and-
// horns dance music of Ghana and Nigeria where the game launches. Plucked palm-wine guitar, an agogo bell,
// shaker, talking drum, bass and horn stabs in D major at 120 BPM, with the gallop, the yard latch and the
// gate on top.

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

/** A soft sustained chord, sine-based, fading out: the bed a result sound resolves onto. */
function pad(out, start, seconds, notes, gain) {
  notes.forEach((n, i) =>
    add(out, start, seconds, (t, len) => (Math.sin(TAU * midi(n) * t) * 0.7 + Math.sin(TAU * midi(n) * 2.001 * t) * 0.15) * Math.min(1, t / 0.04) * Math.exp(-t * 1.4) * env(t, len, 0.02, 0.4), gain / (1 + i * 0.3)),
  );
}

/**
 * Win: the ride's tune resolves. A quick guitar strum up D major, the lead climbs A-B to a held high D,
 * horns and a pad sustain the chord, a bell and a shaker roll, and it fades out over two seconds.
 */
export function sfxWin() {
  const b = buffer(2.3);
  [62, 66, 69, 74, 78].forEach((n, i) => add(b, i * 0.025, 1.4, guitar(midi(n), 0.7), 0.5));
  add(b, 0, 0.3, punch, 0.7);
  [
    [0.08, 81, 0.14],
    [0.22, 83, 0.14],
    [0.36, 86, 1.3],
  ].forEach(([at, n, len]) => add(b, at, len, leadVoice(n), 0.4));
  add(b, 0.36, 1.5, horn(74), 0.22);
  pad(b, 0.36, 1.9, [62, 66, 69], 0.3);
  add(b, 0.36, 0.5, bell(1), 0.3);
  for (let i = 0; i < 8; i++) add(b, 0.4 + i * 0.1, 0.08, shaker(), 0.2 - i * 0.02);
  return normalize(lowpass(b, 8500), 0.82);
}

/** Big win: the tune's opening line on the lead, a talking-drum fill, then the same resolve held longer. */
export function sfxBigWin() {
  const b = buffer(3.4);
  [62, 66, 69, 74, 78, 81].forEach((n, i) => add(b, i * 0.025, 1.2, guitar(midi(n), 0.7), 0.45));
  [
    [0, 78, 0.12],
    [0.13, 78, 0.12],
    [0.26, 81, 0.12],
    [0.39, 83, 0.12],
    [0.52, 81, 0.12],
    [0.65, 83, 0.12],
  ].forEach(([at, n, len]) => add(b, at, len, leadVoice(n), 0.38));
  [0.66, 0.74, 0.82, 0.9].forEach((at, i) => add(b, at, 0.2, talkingDrum(320 - i * 30, 160), 0.4));
  add(b, 1.0, 0.3, punch, 0.9);
  [62, 66, 69, 74].forEach((n, i) => add(b, 1.0 + i * 0.02, 1.8, guitar(midi(n + 12), 0.7), 0.4));
  add(b, 1.0, 2.1, leadVoice(86), 0.42);
  add(b, 1.0, 2.1, horn(74), 0.25);
  pad(b, 1.0, 2.4, [50, 62, 66, 69], 0.32);
  [1.0, 1.5].forEach((at) => add(b, at, 0.5, bell(at === 1 ? 1 : 1.26), 0.3));
  for (let i = 0; i < 14; i++) add(b, 1.05 + i * 0.08, 0.07, shaker(), 0.24 - i * 0.012);
  return normalize(lowpass(b, 9000), 0.85);
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
 * CRASH, which in Gate Rush is the gate revealed shut: a heavy wooden thud and the latch, then a short,
 * calm falling phrase that settles on B minor and fades. Nothing before the reveal (no creak or wind-up,
 * which would be a warning), and nothing comic or dramatic after it: the loss is stated, not played up,
 * and nothing suggests the ride came close.
 */
export function sfxGateSlam() {
  const b = buffer(2.0);
  add(b, 0, 0.35, (t, len) => Math.sin(TAU * 62 * t) * expDecay(t, 9) * env(t, len, 0.001, 0.08), 1);
  add(b, 0, 0.12, (t, len) => rand() * expDecay(t, 30) * env(t, len, 0.0005, 0.05), 0.9);
  add(b, 0.02, 0.25, (t, len) => (square(310 * t) * 0.5 + square(465 * t) * 0.3) * expDecay(t, 22) * env(t, len, 0.001, 0.05), 0.35);
  add(b, 0.16, 0.3, (t, len) => (Math.sin(TAU * 1850 * t) + Math.sin(TAU * 2710 * t) * 0.6) * expDecay(t, 16) * env(t, len, 0.001, 0.05), 0.3);
  [
    [0.3, 66],
    [0.48, 62],
    [0.66, 59],
  ].forEach(([at, n]) => add(b, at, 0.6, guitar(midi(n), 0.3), 0.45));
  pad(b, 0.66, 1.3, [47, 54, 59, 62], 0.3);
  return normalize(lowpass(b, 5000), 0.8);
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
