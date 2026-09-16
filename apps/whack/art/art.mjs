// Placeholder vector art for Whack Crash, matching design/whack-crash (Candy Arcade Pop).
// Each entry is a standalone SVG. scripts/build-atlas.mjs rasterizes and packs them.

export const INK = '#1d1424';
export const CREAM = '#fff4d6';
export const PINK = '#ff3d8b';
export const LIME = '#7ed957';
export const SKY = '#3ec6ff';
export const VIOLET = '#8b5cf6';
export const RED = '#ff3b30';

const svg = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;

function mole(kind, face) {
  const c = {
    gold: { body: '#ffb627', snout: '#ffe08a', shine: '#fff1b8' },
    decoy: { body: '#c98a55', snout: '#f3cf9f', shine: '#e2ac7c' },
    bad: { body: VIOLET, snout: '#c9b8ff', shine: '#b39bff' },
    // Good mole: mint body with a lime shine, so it reads as the friendly opposite of the bad mole.
    good: { body: '#49c46a', snout: '#d6f5c9', shine: '#9be86d' },
  }[kind];
  let eyes = '';
  let mouth = `<rect x="92" y="144" width="16" height="13" rx="2" fill="#fff" stroke="${INK}" stroke-width="4"/>`;
  if (face === 'happy') {
    eyes = `<circle cx="78" cy="100" r="9" fill="${INK}"/><circle cx="122" cy="100" r="9" fill="${INK}"/><circle cx="81" cy="97" r="3" fill="#fff"/><circle cx="125" cy="97" r="3" fill="#fff"/>`;
  } else if (face === 'sleep') {
    eyes = `<path d="M66 100 Q78 110 90 100" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M110 100 Q122 110 134 100" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    mouth = `<path d="M94 150 h12" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  } else if (face === 'dizzy') {
    const sp = (x) => `<path d="M${x - 10} 100 a10 10 0 1 0 20 0 a7 7 0 1 0 -14 0 a3 3 0 1 0 6 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    eyes = sp(78) + sp(122);
    mouth = `<path d="M88 148 q6 8 12 0 q6 -8 12 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  } else if (face === 'shock') {
    eyes = `<circle cx="78" cy="98" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="122" cy="98" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="78" cy="100" r="4" fill="${INK}"/><circle cx="122" cy="100" r="4" fill="${INK}"/>`;
    mouth = `<ellipse cx="100" cy="152" rx="9" ry="11" fill="#5a1630" stroke="${INK}" stroke-width="4"/>`;
  } else if (face === 'smug') {
    // Escaping mole: one eye winking, a pleased grin. The mole won this round, and shows it.
    eyes = `<path d="M66 102 Q78 92 90 102" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="122" cy="100" r="9" fill="${INK}"/><circle cx="125" cy="97" r="3" fill="#fff"/>`;
    mouth = `<path d="M84 144 q16 16 32 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  } else if (face === 'angry') {
    eyes = `<path d="M32 86 Q100 70 168 86 L168 116 Q100 104 32 116 Z" fill="${INK}"/><circle cx="78" cy="98" r="8" fill="${RED}"/><circle cx="122" cy="98" r="8" fill="${RED}"/><circle cx="80" cy="95" r="2.5" fill="#fff"/><circle cx="124" cy="95" r="2.5" fill="#fff"/><path d="M60 74 L92 84 M140 74 L108 84" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
    mouth = `<path d="M84 146 l6 8 l5 -8 l5 8 l5 -8 l5 8 l6 -8" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  const crown =
    kind === 'gold'
      ? `<path d="M68 42 L76 10 L100 30 L124 10 L132 42 Z" fill="#ffe14d" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><circle cx="100" cy="30" r="5" fill="${PINK}" stroke="${INK}" stroke-width="3"/>`
      : '';
  const ears = `<circle cx="42" cy="66" r="14" fill="${c.body}" stroke="${INK}" stroke-width="6"/><circle cx="158" cy="66" r="14" fill="${c.body}" stroke="${INK}" stroke-width="6"/>`;
  return svg(
    200,
    300,
    `${ears}<path d="M30 303 L30 110 C30 58 62 34 100 34 C138 34 170 58 170 110 L170 303 Z" fill="${c.body}" stroke="${INK}" stroke-width="6"/>${crown}<ellipse cx="62" cy="80" rx="8" ry="16" fill="${c.shine}"/>${eyes}<ellipse cx="56" cy="126" rx="11" ry="7" fill="#ff7eb6" opacity="0.9"/><ellipse cx="144" cy="126" rx="11" ry="7" fill="#ff7eb6" opacity="0.9"/><ellipse cx="100" cy="130" rx="26" ry="18" fill="${c.snout}" stroke="${INK}" stroke-width="5"/><ellipse cx="100" cy="121" rx="10" ry="7" fill="${PINK}" stroke="${INK}" stroke-width="4"/>${mouth}`,
  );
}

const holeBack = svg(
  272,
  56,
  `<ellipse cx="136" cy="28" rx="133.5" ry="25.5" fill="#3b2032" stroke="${INK}" stroke-width="5"/><path d="M8 26 A128 22 0 0 1 264 26 A128 16 0 0 0 8 26 Z" fill="#24121f"/>`,
);

const tuft = (x, flip) =>
  `<path d="M${x} 34 l${flip * 6} -22 l${flip * 6} 16 l${flip * 7} -26 l${flip * 5} 30 Z" fill="#4fbf3a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
// Lip is drawn in the hole's 280-wide coordinate space, padded so the tufts don't clip.
const holeLip = svg(
  304,
  80,
  `<path d="M4 28 A136 28 0 0 0 276 28 A136 44 0 0 1 4 28 Z" fill="#6fd14a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>${tuft(-6, 1)}${tuft(286, -1)}`,
  '-12 0 304 80',
);

const icon = (paths, size = 48, color = INK, sw = 2.6) =>
  svg(size, size, `<g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`, '0 0 24 24');

const ICONS = {
  hammer: '<path d="M13.5 3.5l7 7-3 3-7-7z"/><path d="M12 9l-8.5 8.5a2.1 2.1 0 0 0 3 3L15 12"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
};

const star = (fill) =>
  svg(48, 48, `<path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`, '0 0 24 24');

const coin = svg(
  40,
  40,
  `<circle cx="20" cy="20" r="16.5" fill="#ffe14d" stroke="${INK}" stroke-width="4"/><circle cx="20" cy="20" r="10" fill="none" stroke="#ffb627" stroke-width="4"/>`,
);

const puff = svg(80, 80, `<circle cx="40" cy="40" r="35" fill="${CREAM}" stroke="${INK}" stroke-width="5"/><ellipse cx="28" cy="28" rx="9" ry="6" fill="#fff"/>`);

function starburst(fill) {
  const pts = [];
  const n = 14;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 48 : 36;
    const a = (Math.PI * i) / n;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return svg(200, 200, `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`, '0 0 100 100');
}

export const SPRITES = {
  'mole-gold-happy': mole('gold', 'happy'),
  'mole-gold-shock': mole('gold', 'shock'),
  'mole-gold-dizzy': mole('gold', 'dizzy'),
  'mole-gold-sleep': mole('gold', 'sleep'),
  'mole-gold-smug': mole('gold', 'smug'),
  'mole-bad-angry': mole('bad', 'angry'),
  'mole-good-happy': mole('good', 'happy'),
  'mole-decoy-happy': mole('decoy', 'happy'),
  'mole-decoy-shock': mole('decoy', 'shock'),
  'mole-decoy-sleep': mole('decoy', 'sleep'),
  'hole-back': holeBack,
  'hole-lip': holeLip,
  coin,
  puff,
  'star-gold': star('#ffe14d'),
  'star-sky': star(SKY),
  'star-pink': star(PINK),
  'burst-red': starburst(RED),
  'burst-sky': starburst(SKY),
  'burst-gold': starburst('#ffe14d'),
  'burst-lime': starburst(LIME),
  ...Object.fromEntries(Object.entries(ICONS).map(([k, p]) => [`icon-${k}`, icon(p)])),
  ...Object.fromEntries(Object.entries(ICONS).map(([k, p]) => [`icon-${k}-cream`, icon(p, 48, CREAM, 2.8)])),
};
