// Copies each live game's demo build into public/play/<slug>/ so one deployment serves the site and its
// demos, behind the 18+ proxy. Only live games ship: an in-development game has no files on the site.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveEntries } from '../src/catalogue';

const siteDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const appsDir = join(siteDir, '..');
const playDir = join(siteDir, 'public', 'play');

rmSync(playDir, { recursive: true, force: true });
mkdirSync(playDir, { recursive: true });

const missing: string[] = [];
for (const entry of liveEntries()) {
  const source = join(appsDir, entry.app, 'dist-demo');
  if (!existsSync(join(source, 'index.html'))) {
    missing.push(`${entry.name}: run \`pnpm --filter ./apps/${entry.app} build:demo\` (no ${source}/index.html)`);
    continue;
  }
  cpSync(source, join(playDir, entry.slug), { recursive: true });
  console.log(`assemble-demos: ${entry.slug} <- apps/${entry.app}/dist-demo`);
}

if (missing.length > 0) {
  console.error('assemble-demos: missing demo builds');
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}
