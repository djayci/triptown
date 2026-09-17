/**
 * Colours per skin. `candy` is the arcade look; `adult` is the muted charcoal/teal/brass set for
 * regulated markets, where cartoon styling is a minors-appeal risk (CAP under-18 guidance Oct 2025,
 * Kenya reg 95(1)(d), PT R7c, BR 1.231 art. 12 XVIII). The keys are identical so nothing else changes.
 */
export type SkinName = 'candy' | 'adult';

interface Palette {
  ink: number;
  sun: number;
  sun2: number;
  cream: number;
  pink: number;
  lime: number;
  lime2: number;
  sky: number;
  violet: number;
  red: number;
  coral: number;
  coral2: number;
  white: number;
  muted: number;
  mutedInk: number;
  meterOff: number;
}

const PALETTES: Record<SkinName, Palette> = {
  candy: {
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
  },
  adult: {
    ink: 0x14161a,
    sun: 0x2c333b,
    sun2: 0x232930,
    cream: 0xe8e3d9,
    pink: 0xb98a3c,
    lime: 0x2f6f63,
    lime2: 0x3d8a7b,
    sky: 0x2f5d73,
    violet: 0x3f4b57,
    red: 0xa33b33,
    coral: 0x5a4045,
    coral2: 0x4a343a,
    white: 0xf4f1ea,
    muted: 0x6c6a66,
    mutedInk: 0x9a958c,
    meterOff: 0x3a3f46,
  },
};

/** Mutable so the boot sequence can pick the profile's skin before anything renders. */
export let COLORS: Palette = PALETTES.candy;
export let SKIN: SkinName = 'candy';

export function useSkin(skin: SkinName) {
  SKIN = skin;
  COLORS = PALETTES[skin];
}

export const FONT_DISPLAY = 'Lilita One, Arial Black, Impact, sans-serif';
/** The adult skin uses the body face for display text too: no bubbly lettering. */
export const displayFont = () => (SKIN === 'adult' ? FONT_BODY : FONT_DISPLAY);
export const FONT_BODY = 'Bricolage Grotesque, Trebuchet MS, sans-serif';

const METERS: Record<SkinName, number[]> = {
  candy: [0x7ed957, 0x7ed957, 0xa6e04a, 0xcfe63d, 0xffd43b, 0xffb020, 0xff8a2a, 0xff5f4a, 0xff3d8b, 0xff3d8b],
  // Brass ramp: reads as speed without the arcade rainbow.
  adult: [0x2f6f63, 0x37796c, 0x4a8474, 0x6d8f6a, 0x8f9160, 0xa88a4e, 0xb98a3c, 0xb5793a, 0xa95f38, 0xa33b33],
};

/** Per-skin meter ramp; read at draw time so the skin can be chosen at boot. */
export const meterColors = () => METERS[SKIN];

/** History chip colors by multiplier band. */
export function bandColors(multiplier: number): { fill: number; text: number } {
  if (multiplier <= 1) return { fill: COLORS.red, text: COLORS.cream };
  if (multiplier < 2) return { fill: COLORS.cream, text: COLORS.ink };
  if (multiplier < 10) return { fill: COLORS.lime, text: COLORS.ink };
  return { fill: COLORS.pink, text: COLORS.cream };
}
