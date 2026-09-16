import { fromHex, toHex, utf8 } from './bytes';
import { hmacSha256, sha256 } from './sha256';

/** Named, independent random streams per round. */
export type StreamName = 'crash' | 'setbacks' | 'boosts';

export interface RoundSeeds {
  /** 32 random bytes, hex encoded. Secret until revealed. */
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

interface CryptoLike {
  getRandomValues<T extends Uint8Array>(array: T): T;
}

const TWO_POW_52 = 2 ** 52;

export function generateServerSeed(): string {
  const crypto = (globalThis as { crypto?: CryptoLike }).crypto;
  if (!crypto) throw new Error('A secure random source (globalThis.crypto) is required');
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Default client seed for players who don't choose one. Not security-relevant. */
export function generateClientSeed(): string {
  return generateServerSeed().slice(0, 16);
}

/**
 * Hash functions used for commits and outcome streams. The pure implementation runs everywhere
 * (client verifiers); the server injects its platform crypto. Both must produce identical bytes.
 */
export interface CryptoProvider {
  sha256(data: Uint8Array): Uint8Array;
  hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array;
}

export const pureCrypto: CryptoProvider = Object.freeze({ sha256, hmacSha256 });

/** Public commitment published before any round uses the seed: SHA-256 over the raw seed bytes. */
export function commitServerSeed(serverSeed: string, crypto: CryptoProvider = pureCrypto): string {
  return toHex(crypto.sha256(fromHex(serverSeed)));
}

export function streamBytes(seeds: RoundSeeds, stream: StreamName, index: number, crypto: CryptoProvider = pureCrypto): Uint8Array {
  const message = utf8(`${seeds.clientSeed}:${seeds.nonce}:${stream}:${index}`);
  return crypto.hmacSha256(fromHex(seeds.serverSeed), message);
}

/** First 52 bits of the digest as a float in [0, 1). */
export function bytesToUnit(bytes: Uint8Array): number {
  const hi = bytes[0]! * 2 ** 44 + bytes[1]! * 2 ** 36 + bytes[2]! * 2 ** 28 + bytes[3]! * 2 ** 20;
  const lo = bytes[4]! * 2 ** 12 + bytes[5]! * 2 ** 4 + (bytes[6]! >> 4);
  return (hi + lo) / TWO_POW_52;
}

/** Uniform in (0, 1] for stream[index]. Never 0, so logs and divisions are safe. */
export function streamUniform(seeds: RoundSeeds, stream: StreamName, index: number, crypto: CryptoProvider = pureCrypto): number {
  return 1 - bytesToUnit(streamBytes(seeds, stream, index, crypto));
}
