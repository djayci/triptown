export const COLORS = {
  ink: 0x1d1424,
  sun: 0xffd43b,
  sun2: 0xffc414,
  cream: 0xfff4d6,
  pink: 0xff3d8b,
  lime: 0x7ed957,
  lime2: 0x9be86d,
  sky: 0x3ec6ff,
  violet: 0x8b5cf6,
  red: 0xff3b30,
  coral: 0xff8a7a,
  coral2: 0xff7361,
  white: 0xffffff,
  muted: 0xe3d6bd,
  mutedInk: 0x9b8e7d,
  meterOff: 0xf0e2bf,
} as const;

export const FONT_DISPLAY = 'Lilita One, Arial Black, Impact, sans-serif';
export const FONT_BODY = 'Bricolage Grotesque, Trebuchet MS, sans-serif';

export const METER_COLORS = [
  0x7ed957, 0x7ed957, 0xa6e04a, 0xcfe63d, 0xffd43b, 0xffb020, 0xff8a2a, 0xff5f4a, 0xff3d8b, 0xff3d8b,
];

/** History chip colors by multiplier band. */
export function bandColors(multiplier: number): { fill: number; text: number } {
  if (multiplier <= 1) return { fill: COLORS.red, text: COLORS.cream };
  if (multiplier < 2) return { fill: COLORS.cream, text: COLORS.ink };
  if (multiplier < 10) return { fill: COLORS.lime, text: COLORS.ink };
  return { fill: COLORS.pink, text: COLORS.cream };
}
