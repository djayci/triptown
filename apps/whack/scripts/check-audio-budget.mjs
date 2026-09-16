// Fails when audio assets exceed the budget from the whack-game-client spec (1.5 MB total).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'public/assets/audio';
const budget = Number(process.env.AUDIO_BUDGET_BYTES ?? 1_500_000);
const files = readdirSync(dir).filter((f) => /\.(webm|mp3|ogg|m4a|wav)$/.test(f));
const total = files.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
const kb = (b) => `${(b / 1000).toFixed(1)} KB`;
console.info(`audio: ${files.length} files, ${kb(total)} of ${kb(budget)} budget`);
if (total > budget) {
  console.error(`Audio budget exceeded by ${kb(total - budget)}`);
  process.exit(1);
}
