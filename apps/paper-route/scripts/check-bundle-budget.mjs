// Fails the build if the download before the first playable frame exceeds the budget, or if Pixi leaked in.
// Audio is excluded from the budget (it loads after the first frame).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const BUDGET_BYTES = 1.5 * 1024 * 1024;
const AUDIO = new Set(['.webm', '.mp3', '.ogg', '.opus', '.m4a']);
const dir = process.argv[2] ?? 'dist';

const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(dir);

const counted = files.filter((f) => !AUDIO.has(extname(f)) && !f.endsWith('.map'));
const total = counted.reduce((sum, f) => sum + statSync(f).size, 0);
const pixi = files.filter((f) => /\.(js|mjs)$/.test(f) && /pixi\.js|PIXI\.|@pixi\//.test(readFileSync(f, 'utf8')));

const mb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;
if (pixi.length) console.error(`Pixi found in the Paper Route bundle: ${pixi.join(', ')}`);
if (total > BUDGET_BYTES) {
  const biggest = counted.sort((a, b) => statSync(b).size - statSync(a).size).slice(0, 5);
  console.error(`Initial download ${mb(total)} exceeds budget ${mb(BUDGET_BYTES)}. Largest: ${biggest.map((f) => `${f} ${mb(statSync(f).size)}`).join(', ')}`);
}
if (pixi.length || total > BUDGET_BYTES) process.exit(1);
console.info(`Initial download ${mb(total)} of ${mb(BUDGET_BYTES)} budget, ${counted.length} files, no Pixi.`);
