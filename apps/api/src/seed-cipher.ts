import type { SeedCipher } from '@triptown/core';
import { webcrypto } from 'node:crypto';

const PREFIX = 'enc:v1:';

/** AES-256-GCM seed encryption with a key held outside the store (env or KMS). */
export async function aesGcmSeedCipher(base64Key: string): Promise<SeedCipher> {
  const raw = Buffer.from(base64Key, 'base64');
  if (raw.length !== 32) throw new Error('SEED_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  const key = await webcrypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return {
    async encrypt(seed) {
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, Buffer.from(seed, 'utf8')));
      return PREFIX + Buffer.concat([iv, ct]).toString('base64');
    },
    async decrypt(stored) {
      if (!stored.startsWith(PREFIX)) throw new Error('Seed is not encrypted with this cipher');
      const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
      const pt = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12) }, key, buf.subarray(12));
      return Buffer.from(pt).toString('utf8');
    },
  };
}
