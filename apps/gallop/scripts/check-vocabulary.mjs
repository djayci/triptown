// Fails when player-facing text uses racing, sportsbook, skill, luck or wealth words.
// Classification (virtual race betting) and ad rules (Lagos RG reg.7, CAP) depend on it.
// Usage: node scripts/check-vocabulary.mjs [dist-dir]   (always scans src/i18n)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const FORBIDDEN = [
  'race', 'races', 'racing', 'racecourse', 'meet', 'derby', 'furlong', 'furlongs', 'tote', 'slip', 'slips',
  'odds', 'favourite', 'favorite', 'stakes', 'jackpot',
  'skill', 'timing', 'lucky', 'luck', 'fortune', 'rich', 'boss',
];
const ALLOWED_PHRASES = [/no race result/gi];

export function findForbidden(text) {
  let cleaned = text;
  for (const re of ALLOWED_PHRASES) cleaned = cleaned.replace(re, '');
  const words = cleaned.toLowerCase().match(/[a-z]+/g) ?? [];
  return [...new Set(words.filter((w) => FORBIDDEN.includes(w)))];
}

/** Player-facing strings in a built bundle: string literals with a space or an uppercase word. */
function bundleStrings(source) {
  const out = [];
  for (const m of source.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.){3,200})\1/g)) {
    const s = m[2];
    if (/\s/.test(s) && /[A-Za-z]{3}/.test(s) && !/[{}();=<>]|https?:|\.\w+\(/.test(s)) out.push(s);
  }
  return out;
}

const walk = (dir, files = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (/\.(js|mjs|html)$/.test(name)) files.push(p);
  }
  return files;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = [];
  const catalogue = readFileSync(new URL('../src/i18n/en.ts', import.meta.url), 'utf8');
  for (const m of catalogue.matchAll(/^\s*\w+: '((?:[^'\\]|\\.)*)'/gm)) {
    const hits = findForbidden(m[1]);
    if (hits.length) problems.push(`catalogue "${m[1]}": ${hits.join(', ')}`);
  }
  const dist = process.argv[2];
  if (dist) {
    for (const file of walk(dist)) {
      for (const s of bundleStrings(readFileSync(file, 'utf8'))) {
        const hits = findForbidden(s);
        if (hits.length && catalogueHas(catalogue, s)) problems.push(`${file} "${s.slice(0, 60)}": ${hits.join(', ')}`);
      }
    }
  }
  if (problems.length) {
    console.error(`Forbidden player-facing vocabulary:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.info(`Vocabulary check passed${dist ? ` (catalogue + ${dist})` : ' (catalogue)'}.`);
}

// Bundle literals come from many libraries; only strings that also appear in our catalogue are ours.
function catalogueHas(catalogue, s) {
  return catalogue.includes(s);
}
