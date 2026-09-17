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
  const rtps = d.rows.map((r) => r.conditionalRtp);
  const band = { stakeMinor, minRtp: Math.min(...rtps), maxRtp: Math.max(...rtps), rounds: d.rounds, report: file.replace('.json', '.md') };
  // One band per stake level, not one per config id. Rounding bites hardest at the smallest stake, so
  // a single band measured at 0.20 is pessimistic for a market whose minimum is 100.00 (NGN) and is
  // measured at a stake that market does not even offer. Every market publishes the figure measured at
  // the stake it actually sells (GLI-19 4.7.1(a) wants the minimum RTP at any single bet level).
  const list = (bands[d.config.id] ??= []);
  const existing = list.find((b) => b.stakeMinor === stakeMinor);
  // Several reports can share a stake level (different seeds or strategy sets): keep the worst floor.
  if (!existing) list.push(band);
  else if (band.minRtp < existing.minRtp) Object.assign(existing, band);
}
for (const list of Object.values(bands)) list.sort((a, b) => a.stakeMinor - b.stakeMinor);
writeFileSync(join(dir, 'bands.json'), JSON.stringify(bands, null, 2) + '\n');
console.info('bands', Object.keys(bands).length, 'ids,', Object.values(bands).reduce((n, l) => n + l.length, 0), 'stake levels');
