import { describe, expect, it } from 'vitest';
import { COLORS, SKIN, contrastRatio, readableOn, useSkin } from './theme';

const NIGHT = 0x0a1020;

describe('skin palette overrides', () => {
  it('lets a game recolour for the stage it actually drew', () => {
    useSkin('adult', { colors: { sun: 0xffc414, lime: 0x8ce99a }, ground: NIGHT });
    expect(COLORS.sun).toBe(0xffc414);
  });

  it('never lets a game reclassify its skin', () => {
    // Asset selection and every audit key on SKIN; recolouring must not change what the game IS.
    useSkin('adult', { colors: { sun: 0xffc414, lime: 0x8ce99a }, ground: NIGHT });
    expect(SKIN).toBe('adult');
  });

  it('refuses a recolour that does not say what the values sit on', () => {
    expect(() => useSkin('adult', { colors: { sun: 0xffc414 } })).toThrow(/ground/);
  });

  it('refuses an override that hides the multiplier', () => {
    expect(() => useSkin('adult', { colors: { sun: 0x111111, lime: 0x8ce99a }, ground: NIGHT })).toThrow(/multiplier/);
  });

  it('refuses an override that hides the payout', () => {
    // sun is legible here, so only the payout can be the finding.
    expect(() => useSkin('adult', { colors: { sun: 0xffc414, lime: 0x0b0f18 }, ground: NIGHT })).toThrow(/payout/);
  });

  it('catches the real case that prompted this seam: the adult palette on a night stage', () => {
    // The shipped adult multiplier is 1.48:1 against a dark navy ground, which is why a game with a
    // night scene must recolour rather than inherit.
    expect(() => useSkin('adult', { colors: { lime: 0x8ce99a }, ground: NIGHT })).toThrow(/multiplier/);
  });

  it('leaves the shipped palettes alone', () => {
    expect(() => useSkin('candy')).not.toThrow();
    expect(() => useSkin('adult')).not.toThrow();
    expect(SKIN).toBe('adult');
  });

  it('reads the settled result on a card a game recoloured dark', () => {
    // The real case: a game overrode the crash card to a deep violet and the result line, then
    // hardcoded to `ink`, vanished into it. The screen now picks its text from the fill, so the
    // override is legible instead of banned.
    useSkin('adult', { colors: { sun: 0xffc414, lime: 0x8ce99a, violet: 0x3a1030 }, ground: NIGHT });
    expect(readableOn(0x3a1030)).toBe(COLORS.cream);
    expect(readableOn(0x8ce99a)).toBe(COLORS.ink);
  });

  it('refuses a palette that leaves the result line nothing readable to pick', () => {
    // readableOn can only save the settled result while ink and cream sit far apart. Collapse them
    // and every card goes dim at once, which no per-fill choice can fix. Which guard names it first
    // is not the point — a darkened cream also sinks the multiplier — so this asserts the refusal.
    expect(() => useSkin('adult', { colors: { cream: 0x1a1c20 }, ground: NIGHT })).toThrow(/useSkin/);
  });

  it('accepts a card fill with readable text', () => {
    expect(() =>
      useSkin('adult', { colors: { sun: 0xffc414, lime: 0x8ce99a, violet: 0xf1a9a0 }, ground: NIGHT }),
    ).not.toThrow();
  });

  it('measures contrast symmetrically', () => {
    expect(contrastRatio(0xffffff, 0x000000)).toBeCloseTo(21, 0);
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 0);
  });
});
