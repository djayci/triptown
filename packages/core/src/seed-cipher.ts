/**
 * Encrypts server seeds at rest. The API uses AES-256-GCM with a key held outside the store;
 * tests, local dev and the browser mock use the pass-through cipher.
 */
export interface SeedCipher {
  encrypt(serverSeed: string): Promise<string>;
  decrypt(stored: string): Promise<string>;
}

export const passThroughCipher: SeedCipher = Object.freeze({
  encrypt: async (seed: string) => seed,
  decrypt: async (stored: string) => stored,
});

const HEX_SEED = /\b[0-9a-f]{64}\b/gi;

/** Replaces anything that looks like a 32-byte hex seed, for logs and error reports. */
export function redactSeeds<T>(value: T): T {
  if (typeof value === 'string') return value.replace(HEX_SEED, '[redacted-seed]') as T;
  if (Array.isArray(value)) return value.map((v) => redactSeeds(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactSeeds(v)])) as T;
  }
  return value;
}
