// Writes a signed SHA-256 manifest for a release directory.
// Usage: node scripts/release-manifest.mjs <dir> [--version x] [--out <dir>]
// Signing key: RELEASE_SIGNING_KEY (Ed25519 PKCS#8 PEM). Without it, a throwaway key is used and the
// manifest is marked dev-signed, which fails verification against the committed public key.
import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const MANIFEST_FILE = 'integrity-manifest.json';
const SIGNATURE_FILE = 'integrity-manifest.sig';
const [dir, ...rest] = process.argv.slice(2);
if (!dir) throw new Error('usage: release-manifest.mjs <dir>');
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

const files = {};
const walk = (d) => {
  for (const name of readdirSync(d).sort()) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const rel = relative(dir, p).split('\\').join('/');
      if (rel !== MANIFEST_FILE && rel !== SIGNATURE_FILE) files[rel] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  }
};
walk(dir);

let gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown';
try {
  gitSha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // Not a git checkout or no commits yet.
}
const manifest = { version: flag('version') ?? process.env.RELEASE_VERSION ?? '0.0.0-dev', gitSha, createdAt: new Date().toISOString(), files };
const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
const bytes = Buffer.from(JSON.stringify({ version: manifest.version, gitSha: manifest.gitSha, createdAt: manifest.createdAt, files: sorted }));

const key = process.env.RELEASE_SIGNING_KEY
  ? createPrivateKey(process.env.RELEASE_SIGNING_KEY.replace(/\\n/g, '\n'))
  : generateKeyPairSync('ed25519').privateKey;
const signature = sign(null, bytes, key).toString('base64');
const out = flag('out') ?? dir;
writeFileSync(join(out, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
writeFileSync(join(out, SIGNATURE_FILE), signature + '\n');
console.info(`manifest: ${Object.keys(files).length} files, ${process.env.RELEASE_SIGNING_KEY ? 'signed' : 'DEV-SIGNED (throwaway key)'}`);
