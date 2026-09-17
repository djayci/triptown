// Copy review: every player-facing string must live in src/i18n/en.ts, so a market can translate it
// and a reviewer can read the whole catalogue at once (GLI-19 §4.4.1, PT R7 language, and the copy
// bans: no skill or urgency framing, no near-miss wording — Spain RD 176/2023 art. 17.2).
// Usage: node scripts/copy-check.mjs
import { readFileSync } from 'node:fs';

const FILES = ['src/game/view.ts', 'src/game/controller.ts', 'src/ui/hud.ts', 'src/ui/stage.ts'];
// Words that would be a finding wherever they appear, catalogue or not.
const BANNED = [/\bfrenzy\b/i, /\bnear miss\b/i, /would have\b/i, /\bskill\b/i, /\balmost\b/i, /\bso close\b/i];

let problems = 0;
for (const file of FILES) {
  const src = readFileSync(file, 'utf8');
  src.split('\n').forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    for (const re of BANNED) {
      if (re.test(line)) {
        console.error(`BANNED  ${where}: ${line.trim()}`);
        problems++;
      }
    }
    // Event-type literals are protocol, not player copy.
    const PROTOCOL = new Set(['START', 'SETBACK', 'BOOST', 'VOID', 'CRASH', 'CASHED_OUT', 'PART_SETTLED', 'THROWN']);
    // Uppercase literals are display text; they belong in the catalogue.
    for (const m of line.matchAll(/'([A-Z][A-Z !?·…%+-]{3,})'/g)) {
      if (PROTOCOL.has(m[1])) continue;
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
