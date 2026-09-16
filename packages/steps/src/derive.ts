import { bytesToUnit, commitServerSeed, fromHex, pureCrypto, utf8, type CryptoProvider, type RoundSeeds } from '@triptown/fairness';
import { clearChance, fenceCount, stepConfigById, type StepConfig } from './config';

// Fence k is cleared when u_k < clearChance(k), where u_k is the first 52 bits of
// HMAC_SHA256(serverSeed, "clientSeed:nonce:fences:k") (hard rule 6). The 52-bit comparison bias is < 2^-52.

export const FENCE_STREAM = 'fences';

export function fenceUniform(seeds: RoundSeeds, k: number, crypto: CryptoProvider = pureCrypto): number {
  const message = utf8(`${seeds.clientSeed}:${seeds.nonce}:${FENCE_STREAM}:${k}`);
  return bytesToUnit(crypto.hmacSha256(fromHex(seeds.serverSeed), message));
}

export interface StepOutcome {
  /** First fence not cleared (1-based), or null when every fence is cleared. */
  refusedAt: number | null;
}

export function deriveFences(seeds: RoundSeeds, config: StepConfig, crypto: CryptoProvider = pureCrypto): StepOutcome {
  for (let k = 1; k <= fenceCount(config); k++) {
    if (!(fenceUniform(seeds, k, crypto) < clearChance(config, k))) return { refusedAt: k };
  }
  return { refusedAt: null };
}

export interface StepVerifyInput extends RoundSeeds {
  configId: string;
  /** Commitment shown before the round; checked against the revealed seed when given. */
  commit?: string;
}

export interface StepVerifyResult extends StepOutcome {
  configId: string;
  commitMatches: boolean | null;
  /** Result of every fence up to and including the refusal (or all fences). */
  fences: { fence: number; uniform: number; clearChance: number; cleared: boolean }[];
}

/** Player-side verifier: recomputes a round's fences from revealed seeds. */
export function verifyStepRound(input: StepVerifyInput, crypto: CryptoProvider = pureCrypto): StepVerifyResult {
  const config = stepConfigById(input.configId);
  if (!config) throw new Error(`Unknown step config ${input.configId}`);
  const fences: StepVerifyResult['fences'] = [];
  let refusedAt: number | null = null;
  for (let k = 1; k <= fenceCount(config); k++) {
    const uniform = fenceUniform(input, k, crypto);
    const chance = clearChance(config, k);
    const cleared = uniform < chance;
    fences.push({ fence: k, uniform, clearChance: chance, cleared });
    if (!cleared) {
      refusedAt = k;
      break;
    }
  }
  const commitMatches = input.commit === undefined ? null : commitServerSeed(input.serverSeed, crypto) === input.commit;
  return { configId: config.id, refusedAt, commitMatches, fences };
}
