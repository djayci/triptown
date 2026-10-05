// Vector art for Flock, ported from the approved design canvas (design/flock/world2.js, flock.js).
// scripts/build-atlas.mjs rasterizes these at 2x and packs them into public/assets/atlas-dusk.{png,json}.
//
// Art rules (flock-mvp spec "Adult art and plain copy", audit docs/compliance/flock-2026-10-04.md):
// - every ram is a grown male: a full curl of horn, a long Roman nose, a matted working fleece;
// - no eyes, no face, no lamb, no mascot; life-like proportions in a muted dusk palette (GH Underage ii,
//   KE reg 92(1)(d));
// - no ram is ever drawn butting, clashing or squaring up, and nothing here is a sacrifice or festival
//   cue (Lagos reg 7(1)(t));
// - the wolf is a lean adult silhouette with no eyes or face, drawn only for the crash.
//
// One look, Dusk, for every profile skin (flock-mvp D6).

/** Units: a ram is drawn facing right, ground at y 0, about 250 x 150 units. Sprites render at UNIT. */
export const UNIT = 0.5;
/** Frames in one stride. The view steps through them by gait phase. */
export const GAIT_FRAMES = 8;

const TONES = {
  // The player's ram: the lightest fleece and the strongest rim light, so he reads in any crowd.
  hero: {
    fleece: '#8c7a5e',
    dark: '#5e5040',
    head: '#4d4134',
    horn: '#b49c74',
    hornDark: '#6e5c43',
    rim: '#ffc478',
    rimA: 1,
    leg: '#2a2219',
    farLeg: '#1a140e',
  },
  // The flock: drawn in the near tone; the stage tints far rows down into dusk silhouettes.
  flock: {
    fleece: '#6a5d4b',
    dark: '#463c31',
    head: '#322a23',
    horn: '#86755a',
    hornDark: '#4a3e30',
    rim: '#ffaa60',
    rimA: 0.7,
    leg: '#1a140f',
    farLeg: '#110d09',
  },
};

const f = (n) => Math.round(n * 10) / 10;

/** A leg with a hock, as in the canvas: thigh and cannon swing with the gait phase. */
function leg(hx, hy, len, ph, run, w, col, back) {
  const th = ph * 2 * Math.PI;
  const swing = Math.sin(th) * (0.08 + 0.5 * run);
  const bend = Math.max(0, Math.cos(th)) * (back ? 0.6 : 0.42) * (0.2 + 0.8 * run);
  const kx = hx + Math.sin(swing) * len * 0.55;
  const ky = hy + Math.cos(swing) * len * 0.55;
  const a2 = swing - bend * (back ? 1 : -1);
  const fx = kx + Math.sin(a2) * len * 0.45;
  const fy = ky + Math.cos(a2) * len * 0.45;
  return `<path d="M${f(hx)} ${f(hy)}L${f(kx)} ${f(ky)}L${f(fx)} ${f(fy)}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const FLEECE =
  'M-70 -60C-84 -80 -80 -102 -66 -112C-58 -120 -46 -117 -40 -124C-30 -129 -22 -121 -12 -126C0 -131 10 -123 20 -127C34 -131 44 -121 54 -122C66 -121 70 -112 76 -104C86 -92 84 -76 78 -66C70 -54 52 -50 30 -52C10 -48 -16 -48 -36 -52C-52 -50 -64 -52 -70 -60Z';
const FRINGE =
  'M-62 -58L-57 -46L-50 -54L-43 -41L-35 -53L-24 -43L-15 -52L-5 -40L4 -51L13 -43L23 -52L33 -42L43 -53L53 -47L62 -58Z';
const CRIMP =
  'M-44 -108l-3 11M-20 -112l-2 11M6 -114l-1 11M30 -110l2 11M52 -104l3 10M-56 -88l-3 10M-30 -90l-2 10M-4 -92l0 10M22 -88l2 10M46 -82l3 9M-40 -70l-2 8M-12 -70l0 8M16 -68l2 8';
const TOPLINE =
  'M-66 -112C-58 -120 -46 -117 -40 -124C-30 -129 -22 -121 -12 -126C0 -131 10 -123 20 -127C34 -131 44 -121 54 -122';
const NECK = 'M56 -118C74 -126 92 -118 100 -102L106 -88C94 -78 76 -80 68 -92Z';
const HEAD =
  'M84 -112C96 -124 112 -122 120 -112C128 -102 137 -90 141 -79C145 -70 140 -63 131 -64C119 -66 106 -74 96 -84C88 -92 82 -100 84 -112Z';
const FACE_RIM = 'M108 -120C114 -118 118 -115 120 -112C128 -102 137 -90 141 -79';
const CURL = 'M98 -120C84 -136 60 -124 62 -102C64 -84 84 -78 94 -90C102 -100 94 -110 84 -104';
const RIDGES = 'M88 -129l-1 5M77 -129l1 5M67 -121l4 3M64 -107l5 0M69 -93l3 -3';

/**
 * One ram pose, in ram units. `run` 0..1 opens the stride; `ph` is the gait phase 0..1; `tilt` leans the
 * body (negative leans back, as when pulling up); `drop` lowers the head when running hard.
 */
function ramBody(T, { run, ph, tilt = 0, drop = 0 }) {
  const rimA = (a) => f(a * T.rimA);
  return [
    `<g transform="translate(0 -60) rotate(${f((tilt * 180) / Math.PI)}) translate(0 60)">`,
    leg(-46, -58, 60, ph + 0.5, run, 7, T.farLeg, true),
    leg(46, -58, 60, ph + 0.1, run, 7, T.farLeg, false),
    `<path d="M-72 -98Q-88 -90 -86 -72" stroke="${T.dark}" stroke-width="10" fill="none" stroke-linecap="round"/>`,
    `<path d="${FLEECE}" fill="${T.fleece}"/>`,
    `<path d="${FRINGE}" fill="${T.dark}"/>`,
    `<path d="${CRIMP}" stroke="${T.dark}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".55"/>`,
    // Rim light on the fleece topline. It stops at the withers, short of the neck and the horn.
    `<path d="${TOPLINE}" stroke="${T.rim}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity="${rimA(0.85)}"/>`,
    `<path d="M-70 -62C-84 -80 -80 -102 -66 -112" stroke="${T.rim}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="${rimA(0.5)}"/>`,
    `<g transform="translate(0 ${f(drop)}) translate(70 -100) rotate(${f(drop * 0.9)}) translate(-70 100)">`,
    `<path d="${NECK}" fill="${T.fleece}"/>`,
    `<path d="${HEAD}" fill="${T.head}"/>`,
    `<path d="${FACE_RIM}" stroke="${T.rim}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="${rimA(0.75)}"/>`,
    // The horn last, so nothing crosses it.
    `<path d="${CURL}" stroke="${T.hornDark}" stroke-width="13" fill="none" stroke-linecap="round"/>`,
    `<path d="${CURL}" stroke="${T.horn}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
    `<path d="${RIDGES}" stroke="${T.hornDark}" stroke-width="2" stroke-linecap="round"/>`,
    `</g>`,
    leg(-52, -58, 60, ph, run, 8, T.leg, true),
    leg(54, -58, 60, ph + 0.6, run, 8, T.leg, false),
    `</g>`,
  ].join('');
}

const WOLF_B = '#07080e';
const WOLF_RIM = '#aabee6';

/** The wolf, facing right. `stride` 0..1 is the entry stride; at rest it stands braced, head low. */
function wolfBody(ph, stride) {
  const legs = (pairs, col) =>
    pairs.map(([hx, hy, len, p, back]) => leg(hx, hy, len, p, stride * 0.6, 8, col, back)).join('');
  return [
    legs(
      [
        [-64, -64, 66, 0.25 + ph, true],
        [54, -60, 62, 0.6 + ph, false],
      ],
      '#000000',
    ),
    `<path fill="${WOLF_B}" d="M-80 -76C-104 -70 -118 -50 -126 -24C-114 -28 -100 -42 -84 -58Z"/>`,
    `<path fill="${WOLF_B}" d="M-80 -80C-60 -94 -10 -92 20 -96C44 -104 66 -104 78 -94C88 -80 84 -62 70 -56C50 -50 20 -56 -10 -58C-40 -58 -64 -56 -78 -62C-88 -68 -90 -74 -80 -80Z"/>`,
    `<path fill="${WOLF_B}" d="M24 -96L32 -110L38 -100L46 -114L52 -102L60 -112L66 -100L74 -104L80 -92Z"/>`,
    `<path fill="${WOLF_B}" d="M66 -102C84 -106 100 -100 108 -92C114 -88 120 -86 124 -84L142 -76C147 -74 146 -67 140 -66L118 -63C106 -61 94 -64 84 -70C76 -76 68 -86 66 -102Z"/>`,
    `<path fill="${WOLF_B}" d="M94 -94L101 -118L110 -91ZM84 -98L87 -120L97 -96Z"/>`,
    // A cold rim, so it reads against the dust without a face or eyes.
    `<path d="M-80 -81C-60 -95 -10 -93 20 -97C30 -104 44 -112 60 -112C70 -106 78 -100 84 -92C92 -102 104 -96 112 -89L142 -76" stroke="${WOLF_RIM}" stroke-width="2.5" fill="none" opacity=".6" stroke-linecap="round" stroke-linejoin="round"/>`,
    legs(
      [
        [-52, -62, 64, 0.75 + ph, true],
        [68, -60, 62, 0.1 + ph, false],
      ],
      WOLF_B,
    ),
  ].join('');
}

/**
 * Wraps a drawing in an SVG whose box puts the animal's feet at a known anchor:
 * the sprite's anchor is (ANCHOR_X / W, 1 - PAD_B / H).
 */
const BOX = { x0: -135, x1: 160, y0: -178, y1: 14 };
export const RAM_ANCHOR = { x: -BOX.x0 / (BOX.x1 - BOX.x0), y: -BOX.y0 / (BOX.y1 - BOX.y0) };
function sprite(body) {
  const w = (BOX.x1 - BOX.x0) * UNIT;
  const h = (BOX.y1 - BOX.y0) * UNIT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="${BOX.x0} ${BOX.y0} ${BOX.x1 - BOX.x0} ${BOX.y1 - BOX.y0}">${body}</svg>`;
}

/** Every frame the game draws, by name. */
export function buildSprites() {
  const out = {};
  for (const [tone, T] of Object.entries(TONES)) {
    out[`${tone}-stand`] = sprite(ramBody(T, { run: 0, ph: 0 }));
    // Grazing, head down to the grass: the flock on the betting screen, before the run (flock rams only).
    if (tone === 'flock') out['flock-graze'] = sprite(ramBody(T, { run: 0, ph: 0, drop: 38 }));
    // Pulling up: braced legs, leaning back, head up. Used at the pen and when the wolf appears.
    out[`${tone}-brake`] = sprite(ramBody(T, { run: 0.25, ph: 0.15, tilt: -0.16, drop: -10 }));
    for (let i = 0; i < GAIT_FRAMES; i++) {
      const ph = i / GAIT_FRAMES;
      out[`${tone}-trot-${i}`] = sprite(ramBody(T, { run: 0.35, ph, tilt: 0.02, drop: 3 }));
      out[`${tone}-gallop-${i}`] = sprite(ramBody(T, { run: 1, ph, tilt: 0.06, drop: 8 }));
    }
  }
  out['wolf-stand'] = sprite(wolfBody(0, 0));
  for (let i = 0; i < 4; i++) out[`wolf-stride-${i}`] = sprite(wolfBody(i / 4, 1));
  return out;
}

export const SKINS = ['dusk'];
