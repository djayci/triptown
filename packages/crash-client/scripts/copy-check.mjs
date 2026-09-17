// Copy review: every player-facing string must live in src/i18n/en.ts, so a market can translate it
// and a reviewer can read the whole catalogue at once (GLI-19 §4.4.1, PT R7 language, and the copy
// bans: no skill or urgency framing, no near-miss wording — Spain RD 176/2023 art. 17.2).
// Usage: node scripts/copy-check.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Scans the app's own source AND the shared client, so a string cannot escape review by living in
// whichever of the two a reviewer did not think to open. Run from an app directory.
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
  });
}
const SHARED = '../../packages/crash-client/src';
const FILES = [...walk('src'), ...walk(SHARED)].filter((f) => !f.includes('i18n'));
if (FILES.length === 0) {
  console.error('copy-check FAIL: found no source to review — wrong directory?');
  process.exit(1);
}
// Words that would be a finding wherever they appear, catalogue or not.
const BANNED = [/\bfrenzy\b/i, /\bnear miss\b/i, /would have\b/i, /\bskill\b/i, /\balmost\b/i, /\bso close\b/i];
// A game may ban words of its own theme in copy-banned.json (an array of regex sources, matched
// case-insensitively), e.g. racing vocabulary for a horse game. Optional; absent means none.
if (existsSync('copy-banned.json')) {
  for (const source of JSON.parse(readFileSync('copy-banned.json', 'utf8'))) BANNED.push(new RegExp(source, 'i'));
}

let problems = 0;
for (const file of FILES) {
  const src = readFileSync(file, 'utf8');
  src.split('\n').forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    const trimmed = line.trim();
    // Comments are not player copy: line comments, block bodies, and single-line JSDoc.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    for (const re of BANNED) {
      if (re.test(line)) {
        console.error(`BANNED  ${where}: ${line.trim()}`);
        problems++;
      }
    }
    // Event-type literals are protocol, not player copy.
    // Event types and internal enums are protocol, not player copy. `IntensityName` is a key the
    // view maps through the catalogue at render time; it is never drawn raw.
    const PROTOCOL = new Set([
      'START', 'SETBACK', 'BOOST', 'VOID', 'CRASH', 'CASHED_OUT', 'PART_SETTLED', 'THROWN',
      'SLOW', 'MEDIUM', 'FAST',
    ]);
    // Uppercase literals are display text; they belong in the catalogue.
    for (const m of line.matchAll(/'([A-Z][A-Z !?·…%+-]{3,})'/g)) {
      // ISO 3166-2 region codes (NG-LA) are operator protocol, never drawn.
      if (PROTOCOL.has(m[1]) || /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(m[1])) continue;
      console.error(`LITERAL ${where}: ${m[1]} should come from i18n/en.ts`);
      problems++;
    }
  });
}

const catalogue = readFileSync('src/i18n/en.ts', 'utf8');
for (const re of BANNED) {
  if (re.test(catalogue.replace(/^\s*(\/\/|\*).*$/gm, ''))) {
    console.error(`BANNED  src/i18n/en.ts matches ${re}`);
    problems++;
  }
}

console.info(problems === 0 ? 'copy-check PASS' : `copy-check FAIL (${problems})`);
if (problems) process.exit(1);
