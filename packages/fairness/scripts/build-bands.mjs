// Collects the worst-case measured RTP band at the smallest simulated stake for each config id, so the
// rules screen can publish a figure that came from the committed reports rather than from a design note.
// Usage: node scripts/build-bands.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports');
const bands = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f.includes('-halfup-'))) {
  const d = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  if (!d.rows || !d.config) continue;
  const stakeMinor = Math.round((d.config.stakeParts ?? 1) * Number(file.match(/-halfup-(\d+)/)[1]));
  const current = bands[d.config.id];
  // Keep the smallest stake: rounding bites hardest there, and that is the figure to publish.
  if (current && current.stakeMinor < stakeMinor) continue;
  const rtps = d.rows.map((r) => r.conditionalRtp);
  const band = { stakeMinor, minRtp: Math.min(...rtps), maxRtp: Math.max(...rtps), rounds: d.rounds, report: file.replace('.json', '.md') };
  if (!current || current.stakeMinor > stakeMinor || band.minRtp < current.minRtp) bands[d.config.id] = band;
}
writeFileSync(join(dir, 'bands.json'), JSON.stringify(bands, null, 2) + '\n');
console.info('bands', Object.keys(bands).length);
