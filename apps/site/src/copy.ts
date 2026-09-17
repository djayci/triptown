/**
 * Every visible string on the site, in one place so the build's copy check reads all of it.
 * This is advertising for gambling products: no win promises, skill claims, multiplier boasts, RTP
 * figures or success language (docs/compliance/games-showcase-site-2026-09-17.md F3, F4).
 */
export const TRIPTYCH_URL = 'https://triptych-studio.com/';

export const copy = {
  meta: {
    title: 'Triptown',
    description: 'Crash games for regulated operators. Triptown, proudly powered by Triptych.',
  },
  nav: {
    label: 'Main',
    chip: '18+ · FOR OPERATORS',
    games: 'GAMES',
    triptych: 'TRIPTYCH',
  },
  wordmark: 'TRIPTOWN',
  tagline: 'Crash games for regulated operators.',
  poweredBy: 'Triptown, proudly powered by',
  triptych: 'Triptych',
  b2b: 'A showcase for operators and industry partners.',
  gate: {
    question: 'These demos are for adults. Are you 18 or over?',
    yes: 'YES, 18+',
    no: 'NO',
    declined: 'This site is for adults only. You can close this page.',
  },
  games: {
    heading: 'TAPES ON THE SHELF',
    swipe: 'SWIPE →',
    playMoney: 'PLAY MONEY · NO REAL-MONEY WAGERING · NO ACCOUNT',
    play: 'PLAY DEMO',
    playLabel: (name: string) => `Play ${name} demo`,
    logoLabel: (name: string) => `${name} logo`,
    comingSoon: 'COMING SOON',
    locked: 'CONFIRM 18+ TO PLAY',
    noSignal: 'NO SIGNAL',
  },
  footer: {
    left: '© 2026 TRIPTOWN GAMES · 18+ · FOR OPERATORS AND INDUSTRY PARTNERS',
    poweredBy: 'PROUDLY POWERED BY',
    triptych: 'TRIPTYCH',
  },
} as const;

/** Every copy string, flattened, for the copy check. Functions are sampled with a placeholder name. */
export function allCopyStrings(node: unknown = copy): string[] {
  if (typeof node === 'string') return [node];
  if (typeof node === 'function') return [String((node as (s: string) => string)('Game'))];
  if (node && typeof node === 'object') return Object.values(node).flatMap((v) => allCopyStrings(v));
  return [];
}
