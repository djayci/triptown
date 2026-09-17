// Vector art for Beat the Gate, in the house sticker language (thick ink outlines) with adult proportions.
// scripts/build-atlas.mjs rasterizes these at 2x and packs them into public/assets/atlas.{png,json}.
//
// Art rules (beat-the-gate-mvp spec "Adult, harm-free art"): the rider has adult proportions and a
// realistic, non-cute horse; nothing shows a whip, a fall or an injury. The saddle cloth carries no
// number, so a mirrored sprite (riding home) never shows a backwards numeral.

// One palette per skin, as on Whack Crash (packages/crash-client/src/theme.ts):
// - candy: Candy Paddock (chosen 17 Sep 2026), Whack's yellow, pink and sky stickers;
// - adult: Adult Sticker, the charcoal, teal and brass set regulated builds and marketing use.
// The shapes and proportions are the same in both; only colour changes, so the adult-horse rules hold for
// either skin. `buildSprites(skin)` selects the palette before drawing.
const PALETTES = {
  candy: {
    INK: '#1d1424',
    CREAM: '#fff4d6',
    GOLD: '#ffd43b',
    RED: '#ff3d8b',
    DUST: '#f6ead2',
    BARN: ['#e03131', '#8a1c1c'],
    horse: { coat: '#a0602f', shade: '#6f3e1d', light: '#c98a55', mane: '#2a1712', blaze: '#f6ead2', tack: '#2a1712', silks: '#3ec6ff', silks2: '#fff4d6', cloth: '#ff3d8b', skin: '#7a4a2b' },
    halo: 0,
  },
  adult: {
    INK: '#14161a',
    CREAM: '#e8e3d9',
    GOLD: '#b98a3c',
    RED: '#a33b33',
    DUST: '#d9d2c6',
    BARN: ['#b8431a', '#5e1f0c'],
    horse: { coat: '#8c8279', shade: '#645b54', light: '#a89e94', mane: '#3b3431', blaze: '#f4f1ea', tack: '#3b3431', silks: '#2f5d73', silks2: '#e8e3d9', cloth: '#b98a3c', skin: '#7a4a2b' },
    halo: 0.14,
  },
};
export const SKINS = Object.keys(PALETTES);

let INK = PALETTES.adult.INK;
let CREAM = PALETTES.adult.CREAM;
let GOLD = PALETTES.adult.GOLD;
let RED = PALETTES.adult.RED;
let P = PALETTES.adult;

const svg = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;

/** The horse and rider for the selected palette: a bay in pink and sky (candy), a grey in teal and brass (adult). */
const horseColors = () => ({ ...P.horse, clothStripe: CREAM, breeches: CREAM });

// ---------- limbs ----------

const seg = (x1, y1, x2, y2, w, fill) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${w + 10}" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;

/** A leg as [hip, joint, fetlock], tapering, with a hoof angled to the ground. */
function leg([a, b, c], fill, w1, w2, hoofAngle = 0) {
  return `<g>${seg(a[0], a[1], b[0], b[1], w1, fill)}${seg(b[0], b[1], c[0], c[1], w2, fill)}
  <circle cx="${b[0]}" cy="${b[1]}" r="${w2 / 2 + 3}" fill="${fill}"/>
  <path d="M-10 -6 L10 -6 L12 8 L-12 8 Z" fill="${INK}" transform="translate(${c[0]} ${c[1] + 4}) rotate(${hoofAngle})"/></g>`;
}

// ---------- horse body and rider (facing right, 400x300 space) ----------

const BODY =
  'M100 116 C130 108 165 126 200 114 C220 106 240 92 262 70 C278 54 290 42 300 36 L298 16 L314 34 C332 46 352 72 368 96 C374 108 362 118 350 113 C338 108 326 102 316 95 C306 99 300 108 292 118 C282 134 274 150 266 166 C258 186 240 194 220 190 C190 192 160 196 136 188 C112 186 92 178 84 158 C76 140 80 122 100 116 Z';

function body(c, tail) {
  return `
  <path d="${tail}" fill="${c.mane}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="${BODY}" fill="${c.coat}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M108 134 C104 150 112 168 130 176" fill="none" stroke="${c.shade}" stroke-width="9" stroke-linecap="round" opacity="0.6"/>
  <path d="M232 170 C246 162 258 150 262 136" fill="none" stroke="${c.shade}" stroke-width="8" stroke-linecap="round" opacity="0.6"/>
  <path d="M150 128 C180 126 214 118 236 104" fill="none" stroke="${c.light}" stroke-width="7" stroke-linecap="round" opacity="0.45"/>
  <path d="M212 110 C236 96 262 72 300 38 L294 64 C274 82 252 102 232 118 Z" fill="${c.mane}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M320 50 C334 66 348 84 358 104" stroke="${c.blaze}" stroke-width="9" stroke-linecap="round" fill="none"/>
  <path d="M312 62 C318 58 326 58 330 64" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="321" cy="66" r="4.5" fill="${INK}"/>
  <path d="M352 106 C356 102 362 102 364 106" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M300 48 L346 108 M336 90 C340 100 350 104 358 96" stroke="${c.tack}" stroke-width="4" fill="none"/>`;
}

const cloth = (c) => `
  <path d="M146 106 L204 102 L200 146 L148 148 Z" fill="${c.cloth}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M150 132 L201 129" stroke="${c.clothStripe}" stroke-width="8"/>`;

function riderCrouched(c) {
  return `${cloth(c)}
  ${seg(184, 84, 222, 100, 18, c.breeches)}${seg(222, 100, 204, 126, 13, c.breeches)}
  <path d="M192 122 L216 124 L214 136 L190 134 Z" fill="${INK}"/>
  <path d="M166 90 C166 66 206 50 240 54 C256 56 258 76 246 82 C224 94 190 98 166 90 Z" fill="${c.silks}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M196 60 L204 92 M220 54 L226 88" stroke="${c.silks2}" stroke-width="8"/>
  ${seg(240, 66, 266, 90, 13, c.silks)}${seg(266, 90, 292, 96, 11, c.silks)}
  <circle cx="296" cy="96" r="8" fill="${c.skin}" stroke="${INK}" stroke-width="4"/>
  <path d="M302 98 C318 104 334 108 348 110" stroke="${INK}" stroke-width="4" fill="none"/>
  <circle cx="264" cy="46" r="17" fill="${c.skin}" stroke="${INK}" stroke-width="6"/>
  <path d="M246 44 C244 22 282 20 284 42 L290 46 L246 48 Z" fill="${c.silks2}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <rect x="264" y="44" width="20" height="8" rx="3" fill="${INK}"/>
  <path d="M268 60 C272 62 278 61 280 58" stroke="${INK}" stroke-width="3" fill="none"/>`;
}

function riderUpright(c) {
  return `${cloth(c)}
  ${seg(184, 98, 214, 122, 18, c.breeches)}${seg(214, 122, 204, 150, 13, c.breeches)}
  <path d="M194 146 L218 150 L214 162 L190 158 Z" fill="${INK}"/>
  <path d="M166 100 C160 70 172 48 196 44 C214 44 218 66 212 100 Z" fill="${c.silks}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M180 48 L180 98 M198 46 L200 98" stroke="${c.silks2}" stroke-width="8"/>
  ${seg(204, 56, 232, 80, 13, c.silks)}${seg(232, 80, 262, 86, 11, c.silks)}
  <circle cx="266" cy="86" r="8" fill="${c.skin}" stroke="${INK}" stroke-width="4"/>
  <path d="M272 88 C300 96 326 104 348 110" stroke="${INK}" stroke-width="4" fill="none"/>
  <circle cx="196" cy="26" r="17" fill="${c.skin}" stroke="${INK}" stroke-width="6"/>
  <path d="M178 24 C176 2 214 0 216 22 L222 26 L178 28 Z" fill="${c.silks2}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <circle cx="204" cy="30" r="2.6" fill="${INK}"/><path d="M198 40 C202 42 208 41 210 38" stroke="${INK}" stroke-width="3" fill="none"/>`;
}

/** Floodlight rim light, drawn first so it sits behind the legs as well as the body. */
const halo = () => `<path d="${BODY}" fill="none" stroke="${CREAM}" stroke-width="18" stroke-linejoin="round" opacity="${P.halo}"/>`;

// Tail shapes: streaming at speed, hanging at rest.
const TAIL_FLOW = 'M90 124 C58 118 34 134 14 168 C36 156 52 158 70 160 C60 170 54 182 50 196 C70 176 84 164 96 150 Z';
const TAIL_REST = 'M92 124 C70 130 62 160 66 214 C76 196 84 184 90 176 C92 196 96 210 102 222 C104 190 104 160 100 140 Z';

/**
 * A four-frame gallop cycle. Hips stay fixed; joints and hooves move; the whole horse bobs.
 * Order of each frame's legs: far hind, far fore, near hind, near fore.
 */
const GALLOP = [
  {
    bob: 0,
    legs: [
      [[130, 162], [104, 204], [66, 216], -40],
      [[248, 176], [292, 192], [332, 180], -80],
      [[118, 170], [88, 214], [44, 238], -30],
      [[236, 182], [276, 214], [322, 224], -70],
    ],
  },
  {
    bob: -6,
    legs: [
      [[130, 162], [128, 214], [110, 254], -10],
      [[248, 176], [246, 214], [222, 226], 40],
      [[118, 170], [112, 220], [92, 262], -10],
      [[236, 182], [228, 222], [204, 236], 50],
    ],
  },
  {
    bob: -12,
    legs: [
      [[130, 162], [150, 206], [176, 232], 30],
      [[248, 176], [232, 212], [210, 236], 30],
      [[118, 170], [140, 212], [168, 244], 30],
      [[236, 182], [214, 214], [196, 244], 20],
    ],
  },
  {
    bob: -4,
    legs: [
      [[130, 162], [110, 210], [84, 240], -20],
      [[248, 176], [270, 218], [284, 256], 0],
      [[118, 170], [96, 216], [66, 252], -20],
      [[236, 182], [260, 226], [270, 266], 0],
    ],
  },
];

function gallop(c, frame) {
  const f = GALLOP[frame];
  const [farHind, farFore, nearHind, nearFore] = f.legs;
  return svg(
    400,
    300,
    `<g transform="translate(0 ${f.bob + 12})">${halo()}
    ${leg(farHind.slice(0, 3), c.shade, 26, 12, farHind[3])}
    ${leg(farFore.slice(0, 3), c.shade, 20, 11, farFore[3])}
    ${leg(nearHind.slice(0, 3), c.coat, 28, 13, nearHind[3])}
    ${leg(nearFore.slice(0, 3), c.coat, 22, 12, nearFore[3])}
    ${body(c, TAIL_FLOW)}${riderCrouched(c)}</g>`,
  );
}

function standing(c) {
  return svg(
    400,
    300,
    `${halo()}${leg([[132, 176], [128, 230], [130, 274]], c.shade, 26, 12)}
    ${leg([[252, 182], [254, 232], [256, 274]], c.shade, 20, 11)}
    ${leg([[116, 172], [106, 228], [110, 274]], c.coat, 28, 13)}
    ${leg([[236, 186], [238, 232], [238, 274]], c.coat, 22, 12)}
    ${body(c, TAIL_REST)}${riderUpright(c)}`,
  );
}

// ---------- the yard ----------

/** A gate post, 44x280. The cap is red and gold so the gate reads at a glance. */
const gatePost = () =>
  svg(
    44,
    280,
    `<rect x="9" y="22" width="26" height="254" rx="5" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>
     <rect x="4" y="6" width="36" height="22" rx="5" fill="${RED}" stroke="${INK}" stroke-width="6"/>
     <circle cx="22" cy="17" r="4" fill="${GOLD}"/>`,
  );

/**
 * One gate panel drawn shut and front-on, 96x200, hinged on its left edge. The stage opens it by
 * squashing its width about the hinge, so there is one texture for open and shut.
 */
const gatePanel = () =>
  svg(
    96,
    200,
    `<rect x="4" y="4" width="88" height="192" rx="4" fill="${RED}" stroke="${INK}" stroke-width="7"/>
     <path d="M16 52 H80 M16 100 H80 M16 148 H80" stroke="${CREAM}" stroke-width="9"/>
     <path d="M16 170 L80 30" stroke="${CREAM}" stroke-width="7"/>`,
  );

const gateLatch = () =>
  svg(64, 34, `<rect x="4" y="4" width="56" height="26" rx="7" fill="${GOLD}" stroke="${INK}" stroke-width="6"/><rect x="26" y="11" width="12" height="12" rx="2" fill="${INK}"/>`);

const barn = () =>
  svg(
    180,
    130,
    `<path d="M6 126 L6 52 L90 8 L174 52 L174 126 Z" fill="${P.BARN[0]}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
     <path d="M6 52 L90 8 L174 52" fill="none" stroke="${CREAM}" stroke-width="8" stroke-linecap="round"/>
     <rect x="62" y="62" width="56" height="64" fill="${P.BARN[1]}" stroke="${INK}" stroke-width="6"/>
     <path d="M62 62 L118 126 M118 62 L62 126" stroke="${CREAM}" stroke-width="5"/>
     <rect x="22" y="70" width="26" height="22" rx="3" fill="${GOLD}" stroke="${INK}" stroke-width="5"/>
     <rect x="132" y="70" width="26" height="22" rx="3" fill="${GOLD}" stroke="${INK}" stroke-width="5"/>`,
  );

const floodlight = () =>
  svg(
    70,
    120,
    `<rect x="31" y="40" width="8" height="78" fill="${INK}"/>
     <rect x="4" y="4" width="62" height="40" rx="6" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>
     <g fill="${GOLD}">${[14, 30, 46].map((x) => `<rect x="${x}" y="12" width="10" height="9" rx="2"/><rect x="${x}" y="26" width="10" height="9" rx="2"/>`).join('')}</g>`,
  );

const dust = () =>
  svg(120, 62, `<path d="M10 52 C0 38 16 22 30 30 C34 12 58 10 64 26 C74 14 98 18 96 36 C112 36 116 56 100 58 Z" fill="${P.DUST}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`);

const flash = () =>
  svg(40, 40, `<path d="M20 2 L25 15 L38 20 L25 25 L20 38 L15 25 L2 20 L15 15 Z" fill="${CREAM}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);

export function buildSprites(skin = 'candy') {
  P = PALETTES[skin];
  if (!P) throw new Error(`unknown skin ${skin}`);
  ({ INK, CREAM, GOLD, RED } = P);
  const BAY = horseColors();
  return {
    'horse-gallop-0': gallop(BAY, 0),
    'horse-gallop-1': gallop(BAY, 1),
    'horse-gallop-2': gallop(BAY, 2),
    'horse-gallop-3': gallop(BAY, 3),
    'horse-stand': standing(BAY),
    'gate-post': gatePost(),
    'gate-panel': gatePanel(),
    'gate-latch': gateLatch(),
    barn: barn(),
    floodlight: floodlight(),
    dust: dust(),
    flash: flash(),
  };
}
