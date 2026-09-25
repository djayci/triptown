/**
 * The games the site shows. The only place a game is named: adding one is an entry here and a preview
 * under public/previews/. Shared packages stay game-neutral; an app may name its games.
 */
export type GameStatus = 'live' | 'in-development';

/** The game's own look, drawn as a logo tile rather than a screenshot. */
export type TileTheme = 'whack-candy' | 'gate-paddock' | 'gate-track';

export type Entry = {
  /** URL segment under /play/. */
  slug: string;
  /** Folder under apps/ whose `dist-demo` is copied into public/play/<slug>/. */
  app: string;
  name: string;
  /** One line on how it plays. No win, skill, multiplier or RTP claims (checked at build). */
  pitch: string;
  status: GameStatus;
  /** The two words of the game's in-game logo sticker, drawn in its own colours. */
  logo: readonly [string, string];
  /** Backdrop and colours of the logo tile; none for a game whose art is not settled. */
  tile?: TileTheme;
  /** Colour of the row's spine. */
  accent: string;
  /**
   * Query the demo opens with. Empty: each game opens exactly as its demo build boots, in its own look
   * and default market (the user's decision, 17 Sep 2026).
   */
  demoQuery: Record<string, string>;
};

export const catalogue: readonly Entry[] = [
  {
    slug: 'whack',
    app: 'whack',
    name: 'Whack Crash',
    pitch: 'A mole rises with the multiplier. Whack to cash out; the dive comes without warning.',
    status: 'live',
    logo: ['WHACK', 'CRASH'],
    tile: 'whack-candy',
    accent: '#e5383b',
    demoQuery: {},
  },
  {
    slug: 'gate',
    app: 'gate',
    name: 'Gate Rush',
    pitch:
      'The value climbs while the live chance falls. Call the horse in and the gate reveals open or shut.',
    status: 'live',
    logo: ['GATE', 'RUSH'],
    tile: 'gate-track',
    accent: '#3abef9',
    demoQuery: {},
  },
];

export const liveEntries = (entries: readonly Entry[] = catalogue) =>
  entries.filter((e) => e.status === 'live');

/**
 * Where a game's Play link goes, or null for a game that is not playable. Always index.html: the demos
 * resolve their assets relative to the page, and Next normalises directory URLs.
 */
export function playUrl(entry: Entry): string | null {
  if (entry.status !== 'live') return null;
  const query = new URLSearchParams(entry.demoQuery).toString();
  return `/play/${encodeURIComponent(entry.slug)}/index.html${query ? `?${query}` : ''}`;
}
