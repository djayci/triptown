// Fails the build when the site breaks one of its compliance rules. Runs after assemble-demos.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogue } from '../src/catalogue';
import { allCopyStrings, TRIPTYCH_URL } from '../src/copy';
import {
  bannedWording,
  duplicateSlugs,
  missingFiles,
  requiredStatements,
} from '../src/checks';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const strings = [...allCopyStrings(), ...catalogue.flatMap((e) => [e.name, e.pitch, ...e.logo])];

const problems = [
  ...duplicateSlugs(catalogue),
  ...missingFiles(
    catalogue,
    (p) => existsSync(join(publicDir, p)),
    (slug) => {
      try {
        return readdirSync(join(publicDir, 'play', slug, 'assets'));
      } catch {
        return [];
      }
    },
  ),
  ...bannedWording(strings),
  ...requiredStatements(allCopyStrings(), TRIPTYCH_URL),
];

if (problems.length > 0) {
  console.error(`check-site: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  [${p.rule}] ${p.detail}`);
  process.exit(1);
}
console.log(`check-site: ok (${catalogue.length} entries, ${strings.length} strings)`);
