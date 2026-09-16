import { DEFAULT_CONFIG, PAPER_ROUTE_CONFIG, WHACK_CRASH_RISING_CONFIG, commitServerSeed, deriveRound, pureCrypto } from '@triptown/fairness';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { nodeCrypto } from './node-crypto';

describe('server crypto provider (3.1)', () => {
  it('derives bit-identical outcomes to the pure verifier over 100k random rounds', () => {
    const configs = [DEFAULT_CONFIG, WHACK_CRASH_RISING_CONFIG, PAPER_ROUTE_CONFIG];
    let mismatches = 0;
    for (let i = 0; i < 100_000; i++) {
      const seeds = {
        serverSeed: randomBytes(32).toString('hex'),
        clientSeed: randomBytes(1 + (i % 32)).toString('base64'),
        nonce: i % 5000,
      };
      const config = configs[i % configs.length]!;
      const a = deriveRound(seeds, config, nodeCrypto);
      const b = deriveRound(seeds, config, pureCrypto);
      if (a.crashTime !== b.crashTime || a.setbacks.length !== b.setbacks.length || a.setbacks.some((t, k) => t !== b.setbacks[k])) {
        mismatches++;
      }
      if (i % 1000 === 0) expect(commitServerSeed(seeds.serverSeed, nodeCrypto)).toBe(commitServerSeed(seeds.serverSeed, pureCrypto));
    }
    expect(mismatches).toBe(0);
  }, 120_000);
});
