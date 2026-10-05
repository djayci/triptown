// Fails the production build if the demo round service leaked into the bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['__triptown_mock_round_service__', 'MockRoundService'];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|html)$/.test(name)) files.push(p);
  }
};
const dir = process.argv[2] ?? 'dist';
walk(dir);
const leaks = files.filter((f) => MARKERS.some((m) => readFileSync(f, 'utf8').includes(m)));
if (leaks.length) {
  console.error(`Mock round service found in production bundle: ${leaks.join(', ')}`);
  process.exit(1);
}
console.info(`No mock code in ${files.length} bundle files.`);
