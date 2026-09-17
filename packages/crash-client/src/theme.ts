/**
 * Colours per skin. `candy` is the arcade look; `adult` is the muted charcoal/teal/brass set for
 * regulated markets, where cartoon styling is a minors-appeal risk (CAP under-18 guidance Oct 2025,
 * Kenya reg 95(1)(d), PT R7c, BR 1.231 art. 12 XVIII). The keys are identical so nothing else changes.
 */
export type SkinName = 'candy' | 'adult';

export interface Palette {
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

let displayOverride: string | undefined;

/** Relative luminance of a packed RGB colour, per WCAG 2.1. */
function luminance(rgb: number): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((rgb >> 16) & 0xff) + 0.7152 * channel((rgb >> 8) & 0xff) + 0.0722 * channel(rgb & 0xff);
}

export function contrastRatio(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** The multiplier and the money must stay legible against the stage they sit on. */
const MIN_PRIMARY_CONTRAST = 3;

/**
 * Selects the profile's skin, optionally recolouring tokens for a game whose stage the base palette
 * was not drawn for — `candy` assumes a yellow ground and `adult` a light one, and neither suits a
 * night scene.
 *
 * `skin` stays exactly what the profile chose, so asset selection and every audit keyed on
 * `SKIN === 'adult'` are unaffected: a game may recolour, never reclassify itself.
 *
 * The one thing an override may not do is hide the primary values. Brazil Annex I item 14(c)
 * requires the rising multiplier to be displayed *clearly*, AGCO 4.15 requires the bet and outcome
 * to be clearly displayed, and UK RTS 7E requires the player to be able to determine the value of
 * any winnings. A multiplier that sinks into the background fails all three, so the contrast of the
 * multiplier and the payout against the stage is checked here rather than left to review.
 */
export interface SkinOptions {
  /** Token overrides for a game whose stage the base palette was not drawn for. */
  colors?: Partial<Palette>;
  /** Display face, e.g. a condensed poster face for a night scene. */
  display?: string;
  /**
   * The colour the primary values actually sit on. Only the game knows this — the base palettes
   * assume a yellow ground (candy) or a light one (adult), and a night scene is neither. Required
   * when `colors` is given, because that is exactly when legibility can be lost.
   */
  ground?: number;
}

export function useSkin(skin: SkinName, options: SkinOptions = {}) {
  const { colors = {}, display, ground } = options;
  const next = { ...PALETTES[skin], ...colors };

  // Only checked when a game recolours. The shipped palettes are reviewed against the stages they
  // were drawn for; a game that changes them takes on the duty of saying what its ground is.
  if (Object.keys(colors).length > 0) {
    if (ground === undefined) {
      throw new Error(
        `useSkin(${skin}): recolouring requires \`ground\` — the colour the multiplier and the money ` +
          `sit on. Without it their legibility cannot be checked, and it is the thing most easily lost.`,
      );
    }
    for (const [name, token] of [
      ['multiplier', next.sun],
      ['payout', next.lime],
    ] as const) {
      const ratio = contrastRatio(token, ground);
      if (ratio < MIN_PRIMARY_CONTRAST) {
        throw new Error(
          `useSkin(${skin}): the ${name} colour has ${ratio.toFixed(2)}:1 contrast against the ground, ` +
            `below the ${MIN_PRIMARY_CONTRAST}:1 floor. The multiplier and the money must be plainly ` +
            `visible (BR Annex I 14(c), AGCO 4.15, UK RTS 7E).`,
        );
      }
    }
  }

  SKIN = skin;
  COLORS = next;
  displayOverride = display;
}

export const FONT_DISPLAY = 'Lilita One, Arial Black, Impact, sans-serif';
/** The adult skin uses the body face for display text too: no bubbly lettering. */
export const displayFont = () => displayOverride ?? (SKIN === 'adult' ? FONT_BODY : FONT_DISPLAY);
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
