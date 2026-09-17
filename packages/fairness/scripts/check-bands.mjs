// Every registered config id must have a measured rounding band. The rules screen drops the band
// silently when one is missing (`bandMinRtp === undefined`) and publishes a bare 97.00% instead, which
// is the flat figure GLI-19 4.7.1(a) and 4.7.2(a) exist to prevent. A missing band must therefore fail
// the build, not degrade the disclosure. Usage: node scripts/check-bands.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_CONFIGS } from '../src/config.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports');
const bands = JSON.parse(readFileSync(join(dir, 'bands.json'), 'utf8'));

const missing = Object.keys(GAME_CONFIGS).filter((id) => !bands[id]);
const target = { low: 0.969, high: 0.971 };
const outside = Object.entries(bands)
  .filter(([id]) => GAME_CONFIGS[id])
  .filter(([, b]) => b.minRtp < target.low || b.maxRtp > target.high);

for (const id of missing) console.error(`MISSING band: ${id} (no committed -halfup- report)`);
for (const [id, b] of outside) {
  console.warn(
    `BAND OUTSIDE 97% +/- 0.1%: ${id} ${(b.minRtp * 100).toFixed(2)}-${(b.maxRtp * 100).toFixed(2)}% at stake ${b.stakeMinor} ` +
      `(expected at the minimum stake; it must be published, never replaced by the flat figure)`,
  );
}

if (missing.length) {
  console.error(`\ncheck-bands FAIL: ${missing.length} registered config id(s) would publish a flat RTP.`);
  process.exit(1);
}
console.info(`check-bands PASS: ${Object.keys(GAME_CONFIGS).length} registered ids all have a measured band.`);
