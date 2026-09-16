import type { CryptoProvider } from '@triptown/fairness';
import { createHash, createHmac } from 'node:crypto';

/** Server-side hashing through Node's audited crypto library (GLI-19 §3.2.1). */
export const nodeCrypto: CryptoProvider = Object.freeze({
  sha256: (data: Uint8Array) => new Uint8Array(createHash('sha256').update(data).digest()),
  hmacSha256: (key: Uint8Array, message: Uint8Array) => new Uint8Array(createHmac('sha256', key).update(message).digest()),
});
