import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Software integrity (GLI-19 §2.3.2–2.3.3, App. B.2.6): every release ships a signed manifest of
// SHA-256 file hashes; the running server re-hashes its own bundle and compares.

export const MANIFEST_FILE = 'integrity-manifest.json';
export const SIGNATURE_FILE = 'integrity-manifest.sig';

export interface IntegrityManifest {
  version: string;
  gitSha: string;
  createdAt: string;
  /** Relative path -> sha256 hex. */
  files: Record<string, string>;
}

export interface IntegrityResult {
  ok: boolean;
  signatureValid: boolean;
  manifestVersion: string | null;
  checked: number;
  mismatched: string[];
  missing: string[];
  unexpected: string[];
  error?: string;
}

const IGNORED = new Set([MANIFEST_FILE, SIGNATURE_FILE]);

export function hashFiles(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = relative(dir, p).split('\\').join('/');
        if (!IGNORED.has(rel)) out[rel] = createHash('sha256').update(readFileSync(p)).digest('hex');
      }
    }
  };
  walk(dir);
  return out;
}

/** Canonical bytes that are signed: sorted file list. */
export function manifestBytes(m: IntegrityManifest): Buffer {
  const files = Object.fromEntries(Object.entries(m.files).sort(([a], [b]) => (a < b ? -1 : 1)));
  return Buffer.from(JSON.stringify({ version: m.version, gitSha: m.gitSha, createdAt: m.createdAt, files }));
}

export function checkIntegrity(dir: string, publicKeyPem: string): IntegrityResult {
  const empty = { signatureValid: false, manifestVersion: null, checked: 0, mismatched: [], missing: [], unexpected: [] };
  let manifest: IntegrityManifest;
  let signature: Buffer;
  try {
    manifest = JSON.parse(readFileSync(join(dir, MANIFEST_FILE), 'utf8')) as IntegrityManifest;
    signature = Buffer.from(readFileSync(join(dir, SIGNATURE_FILE), 'utf8').trim(), 'base64');
  } catch (err) {
    return { ok: false, ...empty, error: `manifest unreadable: ${(err as Error).message}` };
  }
  const signatureValid = verifySignature(null, manifestBytes(manifest), createPublicKey(publicKeyPem), signature);
  const actual = hashFiles(dir);
  const mismatched = Object.keys(manifest.files).filter((f) => actual[f] !== undefined && actual[f] !== manifest.files[f]);
  const missing = Object.keys(manifest.files).filter((f) => actual[f] === undefined);
  const unexpected = Object.keys(actual).filter((f) => manifest.files[f] === undefined);
  const ok = signatureValid && !mismatched.length && !missing.length && !unexpected.length;
  return { ok, signatureValid, manifestVersion: manifest.version, checked: Object.keys(manifest.files).length, mismatched, missing, unexpected };
}
