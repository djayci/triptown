import type { Entry } from './catalogue';

/**
 * The site's compliance rules, as pure functions so the build runs them and a fixture test proves each
 * one fails. Sources: spec "No promotional gambling claims" and "Every live game is playable from the
 * site"; docs/compliance/games-showcase-site-2026-09-17.md F2–F4.
 */
export type Problem = { rule: string; detail: string };

export function duplicateSlugs(entries: readonly Entry[]): Problem[] {
  const seen = new Set<string>();
  const problems: Problem[] = [];
  for (const e of entries) {
    if (seen.has(e.slug)) problems.push({ rule: 'duplicate-slug', detail: `slug "${e.slug}" is used twice` });
    seen.add(e.slug);
  }
  return problems;
}

export function missingFiles(
  entries: readonly Entry[],
  exists: (publicPath: string) => boolean,
  /** Files under public/play/<slug>/assets, for the demo-bundle check. Absent means "not checked". */
  assetsOf?: (slug: string) => string[],
): Problem[] {
  const problems: Problem[] = [];
  for (const e of entries.filter((x) => x.status === 'live')) {
    if (!exists(`play/${e.slug}/index.html`)) {
      problems.push({ rule: 'demo-build', detail: `${e.name}: no demo build at public/play/${e.slug}/index.html` });
    } else if (assetsOf && !assetsOf(e.slug).some((f) => /^mock-.*\.js$/.test(f))) {
      // A production bundle has no mock chunk: it would ask for VITE_API_URL and fail to boot. That
      // shipped once, because .env.demo was gitignored and CI built the games without VITE_DEMO.
      problems.push({
        rule: 'demo-bundle',
        detail: `${e.name}: public/play/${e.slug}/ is not a demo build (no mock chunk). Check apps/${e.app}/.env.demo is present and \`build:demo\` ran.`,
      });
    }
    if (!e.tile) problems.push({ rule: 'tile', detail: `${e.name}: a live game needs a logo tile theme` });
  }
  return problems;
}

/** Advert copy rules. Each pattern names what it catches, so a failure says why. */
export const BANNED_WORDING: readonly { category: string; pattern: RegExp }[] = [
  { category: 'win promise', pattern: /\b(win|wins|winner|winning|winnings|jackpot|payouts?|prizes?|cash prize)\b/i },
  { category: 'easy or guaranteed money', pattern: /\b(easy money|guarantee[ds]?|risk[- ]free|sure thing|free money)\b/i },
  { category: 'skill or timing claim', pattern: /\b(skill|skilful|skillful|skilled|reflex(es)?|timing|outsmart|beat the (odds|house|crash)|strategy|master)\b/i },
  { category: 'multiplier boast', pattern: /\bup to\s*x?\s*\d|\bx\s?\d{3,}\b|\b\d{3,}\s?x\b|\bmax(imum)? (win|multiplier)/i },
  { category: 'RTP figure', pattern: /\bRTP\b|\breturn to player\b|\d+(\.\d+)?\s?%/i },
  { category: 'success or wealth', pattern: /\b(rich|riches|wealth|wealthy|fortune|life[- ]changing|success|successful|millionaire|luxury)\b/i },
];

export function bannedWording(strings: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  for (const text of strings) {
    for (const { category, pattern } of BANNED_WORDING) {
      const match = text.match(pattern);
      if (match) problems.push({ rule: 'copy', detail: `${category}: "${match[0]}" in "${text}"` });
    }
  }
  return problems;
}

export function requiredStatements(strings: readonly string[], triptychUrl: string): Problem[] {
  const problems: Problem[] = [];
  const all = strings.join('\n');
  if (!/PLAY MONEY/i.test(all) || !/NO REAL-MONEY WAGERING/i.test(all)) {
    problems.push({ rule: 'play-money', detail: 'the play-money statement is missing from the copy' });
  }
  if (!/18\+/.test(all)) problems.push({ rule: 'age', detail: 'no "18+" statement in the copy' });
  if (triptychUrl !== 'https://triptych-studio.com/') {
    problems.push({ rule: 'triptych', detail: `Triptych link is ${triptychUrl}, expected https://triptych-studio.com/` });
  }
  return problems;
}
