// Top-down art for the Dirt Track look (design canvas "Aerial lane · 5 variants", variant B, chosen
// 24 Sep 2026): a horse and rider seen from directly above, galloping up the screen, the yard's fence and
// gate seen from above, and the yard's furniture. scripts/build-atlas.mjs rasterizes these into
// public/assets/atlas-track.{png,json}.
//
// Art rules (beat-the-gate-mvp spec "Adult, harm-free art"): an adult rider on a realistic horse; no whip,
// no fall, no injury, no number on the saddle cloth.

const INK = '#1c1c1c';
const CREAM = '#fff9ec';
const RIDDEN = { coat: '#3e2618', shade: '#2a190f', light: '#5a3a24', mane: '#141010', blaze: '#f4efe6' };
const SILKS = { silks: '#1d4ed8', silks2: '#facc15', helmet: '#1d4ed8' };
/** The horses at grass in the yard: none shares the ridden horse's coat. */
export const AT_GRASS = [
  { coat: '#b9b2a8', shade: '#8e877e', light: '#d6d0c7', mane: '#4a423d', blaze: '#f4efe6' },
  { coat: '#b0602e', shade: '#7f4220', light: '#cd7f4a', mane: '#6e3717', blaze: '#f4efe6' },
  { coat: '#c9a15a', shade: '#957238', light: '#e1c07f', mane: '#3b2e1e', blaze: '#f4efe6' },
  { coat: '#6e5a50', shade: '#4d3e37', light: '#8f7a6e', mane: '#2a211d', blaze: '#f4efe6' },
];

/** The horse's frame: 80 x 170 units, nose at the top; the sprite adds room for hooves and tail. */
const W = 88;
const H = 186;
const svg = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;
const horseSvg = (body) => svg(W, H, body, '-4 -6 88 186');

const BODY = 'M40 44 C 55 46 58 62 57 82 C 56 102 55 118 40 124 C 25 118 24 102 23 82 C 22 62 25 46 40 44 Z';

/**
 * The gallop, seen from above. A horse's legs stay under its body line; from overhead you see the forelegs
 * reach out past the chest and the hind legs push out past the rump, then all four fold under the belly for
 * the moment of suspension. It is a four-beat gait: left hind, right hind, left fore, right fore, then the
 * gathered flight. Each leg's reach is a phase of one stride, the right of each pair a little behind the
 * left, the fores a quarter-stride behind the hinds, so the two ends are stretched together mid-stride and
 * gathered together in flight.
 */
export const GALLOP_FRAMES = 8;
/** A leg's reach through the stride: out past the body for most of it, folded under only briefly (the flight). */
const reach = (p) => 0.42 + 0.58 * Math.sin(2 * Math.PI * p);
function stride(frame) {
  const p = frame / GALLOP_FRAMES;
  return {
    hindL: reach(p),
    hindR: reach(p - 0.08),
    foreL: reach(p - 0.2),
    foreR: reach(p - 0.28),
  };
}

/**
 * One leg from above: from where it leaves the body to the hoof, `ext` of its reach (1 fully out past the
 * body, -1 folded under it). Drawn before the body, so the part under the belly is hidden by it.
 */
function limb(x, y, dir, ext, len, c, sock = false) {
  const out = x < 40 ? -1 : 1;
  const kneeX = x + out * 0.8 * Math.max(0, ext);
  const kneeY = y + dir * ext * len * 0.5;
  const x2 = x + out * 2 * Math.max(0, ext);
  const y2 = y + dir * ext * len;
  // The cannon bone and pastern below the knee: a sock is white there, which makes the stride easy to follow.
  const lower = sock ? '#f4efe6' : c.shade;
  return (
    `<path d="M${x} ${y} L${kneeX} ${kneeY} L${x2} ${y2}" fill="none" stroke="${INK}" stroke-width="6.8" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${x} ${y} L${kneeX} ${kneeY}" stroke="${c.coat}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M${kneeX} ${kneeY} L${x2} ${y2}" stroke="${lower}" stroke-width="3.6" stroke-linecap="round"/>` +
    `<circle cx="${kneeX}" cy="${kneeY}" r="2.3" fill="${c.coat}" stroke="${INK}" stroke-width="0.8"/>` +
    `<ellipse cx="${x2}" cy="${y2}" rx="3" ry="2.6" fill="#2a2420" stroke="${INK}" stroke-width="0.8"/>`
  );
}

/**
 * Neck and head from above, as one shape: the neck widens into the shoulders, narrows at the throat, swells
 * at the jowls and tapers to the muzzle. The ears stand at the poll, the eyes sit at the widest point of the
 * head, the mane runs down the crest. `dy` stretches the head forward with the stride; `graze` drops it to
 * the water or the grass, which from above shortens it.
 */
function head(c, dy = 0, graze = false) {
  // Points above the throat (y < 32) belong to the head: they move with the nod and fold when it drops.
  const at = (y) => (y >= 32 ? y : graze ? 32 - (32 - y) * 0.62 + 6 : y + dy);
  const outline =
    `M25 58 C 27 ${at(46)} 31.5 ${at(37)} 33.6 ${at(31)} ` +
    `C 32 ${at(28)} 31.2 ${at(24)} 31.6 ${at(20)} ` +
    `C 32.2 ${at(12)} 35 ${at(4)} 40 ${at(2)} ` +
    `C 45 ${at(4)} 47.8 ${at(12)} 48.4 ${at(20)} ` +
    `C 48.8 ${at(24)} 48 ${at(28)} 46.4 ${at(31)} ` +
    `C 48.5 ${at(37)} 53 ${at(46)} 55 58 Z`;
  const ear = (side) =>
    `<path d="M${40 + side * 5} ${at(24)} C ${40 + side * 8.5} ${at(25)} ${40 + side * 10} ${at(28)} ${40 + side * 9.2} ${at(31.5)} C ${40 + side * 7.2} ${at(30.5)} ${40 + side * 5.6} ${at(28.5)} ${40 + side * 5} ${at(24)} Z" fill="${c.coat}" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M${40 + side * 5.8} ${at(25.5)} C ${40 + side * 7.8} ${at(26.5)} ${40 + side * 8.6} ${at(28.5)} ${40 + side * 8.3} ${at(30.2)}" fill="none" stroke="${c.light}" stroke-width="1.2" stroke-linecap="round"/>`;
  return (
    // Filled closed, but stroked open: the neck runs into the shoulders with no seam across them.
    `<path d="${outline}" fill="${c.coat}"/>` +
    `<path d="${outline.replace(' Z', '')}" fill="none" stroke="${INK}" stroke-width="1.4"/>` +
    // The crest's light, and the mane falling a little to the off side.
    `<path d="M40 ${at(30)} C 39.5 40 39.5 48 40 56" fill="none" stroke="${c.light}" stroke-width="7" stroke-linecap="round" opacity="0.7" filter="url(#soft)"/>` +
    `<path d="${outline.replace(' Z', '')}" fill="none" stroke="${c.shade}" stroke-width="3" opacity="0.5" filter="url(#soft)"/>` +
    `<path d="M41 ${at(28)} C 42.5 38 42.5 47 41.5 56" fill="none" stroke="${c.mane}" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M40 ${at(27)} C 38.5 ${at(24)} 38.8 ${at(21)} 40.5 ${at(19)}" fill="none" stroke="${c.mane}" stroke-width="2.4" stroke-linecap="round"/>` +
    ear(-1) +
    ear(1) +
    // Blaze from the forehead to the muzzle, the muzzle lighter, the nostrils, and the eyes at the widest point.
    `<path d="M40 ${at(19)} C 42.4 ${at(15)} 41.8 ${at(9)} 40.8 ${at(5)} L39.2 ${at(5)} C 38.2 ${at(9)} 37.6 ${at(15)} 40 ${at(19)} Z" fill="${c.blaze}"/>` +
    `<path d="M35.6 ${at(5.5)} C 36.6 ${at(2.4)} 43.4 ${at(2.4)} 44.4 ${at(5.5)} C 43 ${at(7.2)} 37 ${at(7.2)} 35.6 ${at(5.5)} Z" fill="${c.light}" stroke="${INK}" stroke-width="0.7"/>` +
    `<circle cx="37.8" cy="${at(4.4)}" r="0.8" fill="${INK}"/><circle cx="42.2" cy="${at(4.4)}" r="0.8" fill="${INK}"/>` +
    `<ellipse cx="31.9" cy="${at(16)}" rx="1.1" ry="1.8" fill="${INK}"/><ellipse cx="48.1" cy="${at(16)}" rx="1.1" ry="1.8" fill="${INK}"/>`
  );
}

/**
 * The barrel, rounded: a soft darker rim inside the outline and a soft highlight along the back, both blurred,
 * so the body reads as a volume from any direction it is turned (the yard's horses stand sideways).
 */
function body(c) {
  return (
    `<defs><clipPath id="barrel"><path d="${BODY}"/></clipPath>` +
    `<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter></defs>` +
    `<path d="${BODY}" fill="${c.coat}"/>` +
    `<g clip-path="url(#barrel)">` +
    `<path d="${BODY}" fill="none" stroke="${c.shade}" stroke-width="12" opacity="0.75" filter="url(#soft)"/>` +
    `<ellipse cx="40" cy="80" rx="7.5" ry="30" fill="${c.light}" opacity="0.9" filter="url(#soft)"/>` +
    `<ellipse cx="40" cy="104" rx="10" ry="9" fill="${c.light}" opacity="0.55" filter="url(#soft)"/>` +
    `</g>` +
    `<path d="${BODY}" fill="none" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M31 106 C 34 114 46 114 49 106" fill="none" stroke="${INK}" stroke-width="0.8" opacity="0.4"/>`
  );
}

/**
 * Standing, the tail hangs straight down, so from above only the dock and the top of the hair show: a short
 * tuft behind the rump, falling a little to one side, the hair fanning where it drops out of sight.
 */
function hangingTail(c) {
  return (
    `<path d="M40 121 C 35 124 33 131 35 139 C 37 143 42 144 44 140 C 47 133 45 125 40 121 Z" fill="${c.mane}" stroke="${INK}" stroke-width="0.9"/>` +
    `<path d="M38 126 L37 138 M41 125 L41 140 M43.5 128 L43 137" stroke="#3a2a20" stroke-width="0.6"/>` +
    `<path d="M36.5 124 C 38 122.5 41.5 122.5 43 124" fill="none" stroke="${c.light}" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>`
  );
}

function tail(c, sway = 0) {
  const d = `M40 122 C ${35 + sway} 136 ${33 + sway} 152 ${37 + sway} 170 C ${39 + sway} 160 ${41 + sway} 154 ${43 + sway} 170 C ${47 + sway} 152 ${45 + sway} 136 40 122 Z`;
  return (
    `<path d="${d}" fill="${c.mane}" stroke="${INK}" stroke-width="0.9"/>` +
    `<path d="M40 128 L${39 + sway} 162 M42 130 L${43 + sway} 160 M38 132 L${36 + sway} 154" stroke="#3a2a20" stroke-width="0.6"/>`
  );
}

/** The rider from above: helmet, shoulders in silks, arms to the reins, knees against the saddle. */
function rider(s = SILKS) {
  return (
    `<rect x="27" y="62" width="26" height="32" rx="5" fill="${s.silks2}" stroke="${INK}" stroke-width="1"/>` +
    `<rect x="29.5" y="64.5" width="21" height="27" rx="3" fill="none" stroke="${CREAM}" stroke-width="1" opacity="0.85"/>` +
    `<path d="M37.5 52 L37.5 20 M42.5 52 L42.5 20" stroke="#2a1a10" stroke-width="1.1"/>` +
    `<ellipse cx="27.5" cy="80" rx="3.4" ry="7.5" fill="${s.silks}" stroke="${INK}" stroke-width="0.8"/>` +
    `<ellipse cx="52.5" cy="80" rx="3.4" ry="7.5" fill="${s.silks}" stroke="${INK}" stroke-width="0.8"/>` +
    `<path d="M33 72 L37.5 52 M47 72 L42.5 52" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M33 72 L37.5 52 M47 72 L42.5 52" stroke="${s.silks}" stroke-width="4.4" stroke-linecap="round"/>` +
    `<ellipse cx="40" cy="76" rx="11.5" ry="10" fill="${s.silks}" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M40 67 L46 76 L40 85 L34 76 Z" fill="${s.silks2}"/>` +
    `<circle cx="37.5" cy="51.5" r="1.9" fill="#e9c9a8" stroke="${INK}" stroke-width="0.5"/>` +
    `<circle cx="42.5" cy="51.5" r="1.9" fill="#e9c9a8" stroke="${INK}" stroke-width="0.5"/>` +
    `<circle cx="40" cy="66" r="6.6" fill="${s.helmet}" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M34.5 63 C 36 58.5 44 58.5 45.5 63" fill="${INK}" opacity="0.55"/>` +
    `<path d="M40 59.6 L40 72.4" stroke="${CREAM}" stroke-width="1.2" opacity="0.8"/>`
  );
}

function gallop(frame) {
  const st = stride(frame);
  // Forelegs leave the body at the shoulders, outside the neck, and reach forward past the chest; hind
  // legs leave it at the hips and push back past the rump.
  // Socks on the near hind and the off fore, a common marking.
  const legs = [
    limb(29, 58, -1, st.foreL, 42, RIDDEN),
    limb(51, 58, -1, st.foreR, 42, RIDDEN, true),
    limb(30, 106, 1, st.hindL, 46, RIDDEN, true),
    limb(50, 106, 1, st.hindR, 46, RIDDEN),
  ].join('');
  // The head and neck stretch forward as the forelegs reach, and come back as they fold.
  const nod = -2.2 * (st.foreL + st.foreR) / 2;
  const sway = 2.5 * reach(frame / GALLOP_FRAMES + 0.25);
  return horseSvg(tail(RIDDEN, sway) + legs + body(RIDDEN) + head(RIDDEN, nod) + rider());
}

/** Standing: head up (or down to the grass), weight on all four. */
function standing(c, withRider, graze = false) {
  // Square on all four: the legs are straight down, so from above only the hooves show at the corners.
  const legs = [limb(33, 56, -1, 0.12, 34, c), limb(47, 56, -1, 0.12, 34, c, c === RIDDEN), limb(33, 108, 1, 0.3, 40, c, c === RIDDEN), limb(47, 108, 1, 0.3, 40, c)].join('');
  return horseSvg(hangingTail(c) + legs + body(c) + head(c, 0, graze) + (withRider ? rider() : ''));
}

/** One door of the yard gate seen from above: the top rail, red with cream bands, and its hinge. */
function door() {
  const bands = [10, 22, 34, 46].map((x) => `<rect x="${x}" y="2" width="5" height="10" fill="${CREAM}"/>`).join('');
  return svg(62, 14, `<rect x="1" y="1" width="60" height="12" rx="3" fill="#c8102e" stroke="${INK}" stroke-width="2"/>${bands}<circle cx="6" cy="7" r="3" fill="#8a8a80" stroke="${INK}" stroke-width="1"/>`);
}

function post() {
  return svg(20, 20, `<rect x="1.5" y="1.5" width="17" height="17" rx="3" fill="#8a5a34" stroke="${INK}" stroke-width="2"/><rect x="5" y="5" width="10" height="10" rx="2" fill="#a8744a"/><circle cx="10" cy="10" r="2" fill="${INK}" opacity="0.5"/>`);
}

function latch() {
  return svg(18, 14, `<rect x="1" y="1" width="16" height="12" rx="3" fill="#d4a017" stroke="${INK}" stroke-width="1.6"/><rect x="6" y="4" width="6" height="6" rx="1" fill="#8a6a10"/>`);
}

/** A loose pile of hay on the ground, side-on. */
function sideHay() {
  const strands = Array.from({ length: 16 }, (_, i) => {
    const x = 6 + i * 3.2;
    return `<path d="M${x} 26 q ${2 - (i % 3)} -${8 + (i % 4) * 3} ${(i % 2 ? 4 : -3)} -${12 + (i % 5) * 2}" stroke="#b8963e" stroke-width="1.3" fill="none"/>`;
  }).join('');
  return svg(62, 30, `<path d="M2 28 C 6 10 20 4 31 5 C 44 4 57 12 60 28 Z" fill="#e2c26b" stroke="${INK}" stroke-width="2"/>${strands}<path d="M2 28 L60 28" stroke="${INK}" stroke-width="2"/>`);
}

/**
 * A horse at liberty seen side-on (the yard's horses stand side-on to the tilted camera), facing right, in a
 * 400 x 300 frame with the ground at y = 274. The neck and head are one piece pivoting at the shoulder, so
 * every pose has the same head: `angle` 0 looks about, ~80 lowers the muzzle to a trough, ~96 to the grass.
 * A racehorse's build: deep chest, belly tucked up to the flank, sloping croup over round quarters, and long,
 * fine legs with the hock set well back.
 */
const SIDE_PIVOT = [270, 138];
/**
 * A limb as one smooth tapered shape: `pts` is its centre line from the body down, each point [x, y, width].
 * The outline is offset either side of the centre line and smoothed (Catmull-Rom as cubic Béziers), so a
 * leg has a muscled top, fine cannon and a fetlock, with no hard corners at the joints.
 */
function taper(pts) {
  const side = (sign) =>
    pts.map(([x, y, w], i) => {
      const [ax, ay] = pts[Math.max(0, i - 1)];
      const [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      return [x + (sign * -dy * w) / 2 / len, y + (sign * dx * w) / 2 / len];
    });
  const smooth = (p) => {
    let d = `${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[Math.min(p.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const left = side(1);
  const right = side(-1).reverse();
  const [ex, ey] = pts[pts.length - 1];
  return `M${smooth(left)} L ${ex} ${ey + 1} L ${smooth(right)} Z`;
}

/** A hoof at the foot of a limb, toe forward (the horse faces right). */
const hoof = (x) => `M${x - 8} 262 L${x + 7} 262 L${x + 11} 274 L${x - 9} 274 Z`;

/** The yard horses' legs, from the body down: forearm, knee, cannon, fetlock, pastern; gaskin, hock behind. */
const LEGS = {
  nearFore: [[272, 146, 30], [271, 180, 22], [270, 200, 17], [270, 236, 11], [271, 250, 13.5], [274, 258, 10], [276, 263, 9]],
  farFore: [[290, 148, 26], [292, 182, 19], [293, 202, 15], [293, 236, 10], [294, 250, 12.5], [297, 258, 9], [299, 263, 8.5]],
  nearHind: [[134, 136, 40], [124, 172, 28], [112, 200, 17], [110, 212, 15], [114, 238, 11], [116, 250, 13.5], [119, 258, 10], [121, 263, 9]],
  farHind: [[152, 140, 32], [144, 174, 23], [134, 200, 15], [133, 212, 13], [137, 238, 10], [139, 250, 12.5], [142, 258, 9], [144, 263, 8.5]],
};

/**
 * Lying down, at rest: the body settles to the ground, the forelegs fold forward under the chest and the
 * hind leg tucks under the belly, hoof forward. Same centre-line limbs as standing.
 */
const LEGS_FOLDED = {
  farHind: [[152, 232, 30], [170, 254, 20], [194, 264, 12], [206, 267, 9]],
  farFore: [[290, 238, 20], [308, 254, 13], [304, 262, 10], [290, 267, 8.5]],
  nearHind: [[132, 226, 40], [148, 248, 28], [176, 260, 17], [204, 266, 12], [222, 268, 10]],
  nearFore: [[270, 236, 24], [292, 252, 16], [294, 260, 12], [278, 266, 10], [262, 268, 9]],
};
/** How far the body drops to lie on its folded legs. */
const LIE_DROP = 82;

function sideHorse(c, angle, lying = false) {
  const legs = lying ? LEGS_FOLDED : LEGS;
  const limb = (pts, colour) => {
    const [fx, fy] = pts[pts.length - 1];
    // Standing, a hoof on the ground; folded, the hoof shows at the end of the tucked leg.
    const foot = lying
      ? `<ellipse cx="${fx}" cy="${fy}" rx="8" ry="5.5" fill="#2a2420" stroke="${INK}" stroke-width="3"/>`
      : `<path d="${hoof(fx)}" fill="#2a2420" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
    return `<path d="${taper(pts)}" fill="${colour}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>` + foot;
  };
  const far = limb(legs.farHind, c.shade) + limb(legs.farFore, c.shade);
  const near = limb(legs.nearHind, c.coat) + limb(legs.nearFore, c.coat);
  const drop = lying ? LIE_DROP : 0;
  // Croup, a gentle dip of back, the withers; the chest; a belly that rises to the flank; the quarters.
  const barrel =
    'M118 96 C 160 90 212 96 240 90 C 254 86 264 84 272 88 C 296 94 314 112 314 134 C 314 152 304 166 288 170 ' +
    'C 250 176 210 170 182 160 C 166 154 152 150 142 156 C 128 164 110 162 100 150 C 90 136 94 108 118 96 Z';
  // Standing, the tail hangs; lying, it lies out along the ground behind.
  const tail = lying
    ? 'M106 116 C 84 128 66 150 56 170 C 72 174 88 168 100 158 C 98 172 112 178 126 172 C 118 156 114 140 110 128 Z'
    : 'M106 116 C 84 128 76 170 82 226 C 92 204 98 190 104 180 C 108 200 114 214 120 226 C 118 188 114 152 110 128 Z';
  // Neck and head, drawn head up, rotated at the shoulder by `angle`.
  const neck = 'M246 106 C 262 82 290 52 318 36 L 340 60 C 334 96 318 132 302 160 C 288 170 262 166 250 150 Z';
  const head =
    'M314 30 C 330 22 350 28 360 46 L 390 90 C 395 99 390 110 379 110 L 364 110 C 353 108 344 100 338 90 L 330 74 C 320 66 308 50 314 30 Z';
  // The ear, drawn upright at its base (0, 0): it rides on the poll but turns only about half as far as the
  // head, so a lowered head keeps its ear pricked up rather than pointing forward like a horn.
  const ear = 'M-5 1 C -8 -12 -5 -24 1 -31 C 6 -22 7 -10 4 1 Z';
  const rad = (angle * Math.PI) / 180;
  const pollX = SIDE_PIVOT[0] + (321 - SIDE_PIVOT[0]) * Math.cos(rad) - (33 - SIDE_PIVOT[1]) * Math.sin(rad);
  const pollY = SIDE_PIVOT[1] + (321 - SIDE_PIVOT[0]) * Math.sin(rad) + (33 - SIDE_PIVOT[1]) * Math.cos(rad);
  const [px, py] = SIDE_PIVOT;
  const headGroup =
    `<g transform="rotate(${angle} ${px} ${py})">` +
    `<path d="${neck}" fill="${c.coat}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="M250 102 C 266 80 292 52 318 36" fill="none" stroke="${c.mane}" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="${head}" fill="${c.coat}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="M336 40 C 352 58 368 78 380 96" stroke="${c.blaze}" stroke-width="8" stroke-linecap="round" fill="none"/>` +
    `<path d="M340 50 C 344 46 350 46 352 52" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
    `<circle cx="345" cy="54" r="4.2" fill="${INK}"/>` +
    `<path d="M380 104 C 383 100 388 100 389 104" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M344 96 C 350 104 358 108 366 108" stroke="${INK}" stroke-width="2.5" fill="none" opacity="0.5"/>` +
    `</g>` +
    `<g transform="translate(${pollX.toFixed(1)} ${pollY.toFixed(1)}) rotate(${(angle * 0.45).toFixed(1)})">` +
    `<path d="${ear}" fill="${c.coat}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M-2 -4 C -3 -12 -2 -19 0 -24" fill="none" stroke="${c.light}" stroke-width="2.5" stroke-linecap="round"/></g>`;
  const shading =
    `<path d="M150 100 C 190 94 226 98 256 92" fill="none" stroke="${c.light}" stroke-width="9" stroke-linecap="round" opacity="0.55"/>` +
    `<path d="M186 156 C 220 166 256 170 290 164" fill="none" stroke="${c.shade}" stroke-width="10" stroke-linecap="round" opacity="0.5"/>` +
    `<path d="M126 116 C 110 130 110 148 126 156" fill="none" stroke="${c.shade}" stroke-width="7" stroke-linecap="round" opacity="0.55"/>` +
    `<path d="M284 104 C 300 116 304 136 296 156" fill="none" stroke="${c.shade}" stroke-width="6" stroke-linecap="round" opacity="0.4"/>`;
  // Legs and neck go behind the barrel, and the barrel's outline is masked wherever a leg or the neck leaves
  // it, so the horse is one piece: no line across the tops of the legs or where the neck leaves the shoulder.
  // The frame is wide enough for the lowered head (it reaches past x = 400).
  const joins =
    `<mask id="joins" maskUnits="userSpaceOnUse" x="-20" y="0" width="440" height="300">` +
    `<rect x="-20" y="0" width="440" height="300" fill="#fff"/>` +
    `<g transform="translate(0 ${drop}) rotate(${angle} ${px} ${py})"><path d="${neck}" fill="#000" stroke="#000" stroke-width="2"/></g>` +
    Object.values(legs).map((pts) => `<path d="${taper(pts)}" fill="#000" stroke="#000" stroke-width="1"/>`).join('') +
    `</mask>`;
  // Declared at 120 px wide: the yard shows them at about that size, so the atlas stays small (the stage
  // scales them up by SIDE_SCALE to the size the positions were drawn for).
  return svg(
    120,
    82,
    `<defs>${joins}</defs>` +
      far +
      `<g transform="translate(0 ${drop})"><path d="${tail}" fill="${c.mane}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>${headGroup}</g>` +
      near +
      `<g transform="translate(0 ${drop})"><path d="${barrel}" fill="${c.coat}"/></g>` +
      `<g mask="url(#joins)"><path d="${barrel}" transform="translate(0 ${drop})" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>` +
      `<g transform="translate(0 ${drop})">${shading}</g>`,
    '-20 0 440 300',
  );
}

/**
 * What each yard horse is doing (the stage places them: track.ts): the head angle when lowered and raised,
 * and how many frames between. 0 and 3 drink at a trough, 1 eats hay, 2 lies down and nods.
 */
export const YARD_POSES = [
  { down: 80, up: 0, lying: false, frames: 6 },
  { down: 96, up: 0, lying: false, frames: 6 },
  { down: 14, up: -6, lying: true, frames: 4 },
  { down: 80, up: 0, lying: false, frames: 6 },
];

/** A low galvanised trough side-on, in two halves: the back (rim and water) goes behind a drinking horse's head, the front face in front of it. */
function tubBack() {
  return svg(70, 26, `<ellipse cx="35" cy="9" rx="32" ry="6.5" fill="#c3cacd" stroke="${INK}" stroke-width="2"/><ellipse cx="35" cy="9.5" rx="28" ry="4.4" fill="#3f86ad"/><path d="M20 9 q 4 -1.6 8 0 t 8 0 t 8 0" stroke="#d6ecf5" stroke-width="1.2" fill="none"/>`);
}
function tubFront() {
  const ribs = [18, 35, 52].map((x) => `<line x1="${x}" y1="12" x2="${x}" y2="23" stroke="#7b858a" stroke-width="1.6"/>`).join('');
  return svg(70, 26, `<path d="M3 9 C 3 13 18 15.5 35 15.5 C 52 15.5 67 13 67 9 L 64 23 C 64 24.5 62 25 60 25 L 10 25 C 8 25 6 24.5 6 23 Z" fill="#a9b2b7" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>${ribs}`);
}

/** A kicked-up puff of track dirt. */
function dust() {
  return svg(64, 44, `<g fill="#e3c28f" stroke="${INK}" stroke-width="2"><circle cx="18" cy="26" r="13"/><circle cx="34" cy="18" r="15"/><circle cx="48" cy="27" r="12"/></g><g fill="#f1dcb4"><circle cx="30" cy="15" r="6"/><circle cx="16" cy="23" r="4"/></g>`);
}

export function trackSprites() {
  const out = {
    ...Object.fromEntries(Array.from({ length: GALLOP_FRAMES }, (_, i) => [`td-gallop-${i}`, gallop(i)])),
    'td-stand': standing(RIDDEN, true),
    'td-door': door(),
    'td-post': post(),
    'td-latch': latch(),
    'side-hay': sideHay(),
    'tub-back': tubBack(),
    'tub-front': tubFront(),
    'td-dust': dust(),
  };
  // Each yard horse's head, from lowered (frame 0) to raised (the last), every angle in between, so it
  // lifts and lowers smoothly.
  YARD_POSES.forEach(({ down, up, lying, frames }, i) => {
    for (let k = 0; k < frames; k++) out[`yard-${i}-${k}`] = sideHorse(AT_GRASS[i], down + ((up - down) * k) / (frames - 1), lying);
  });
  return out;
}
