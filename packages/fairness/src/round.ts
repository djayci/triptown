import { assertValidConfig, type GameConfig } from './config';
import { boostTimesFromUniforms, crashTimeFromUniform, setbackTimesFromUniforms } from './model';
import { commitServerSeed, pureCrypto, streamUniform, type CryptoProvider, type RoundSeeds } from './seeds';

export interface RoundOutcome {
  /** Seconds after start when the round crashes. 0 = instant bust. */
  crashTime: number;
  /** Seconds after start of each setback, ascending, all before min(crashTime, tMax). */
  setbacks: number[];
  /** Seconds after start of each boost, ascending, all before min(crashTime, tMax). */
  boosts: number[];
}

export function deriveRound(seeds: RoundSeeds, config: GameConfig, crypto: CryptoProvider = pureCrypto): RoundOutcome {
  assertValidConfig(config);
  const crashTime = crashTimeFromUniform(streamUniform(seeds, 'crash', 0, crypto), config);
  const horizon = Math.min(crashTime, config.tMax);
  const setbacks = setbackTimesFromUniforms(
    (i) => streamUniform(seeds, 'setbacks', i, crypto),
    config,
    horizon,
  );
  const boosts = boostTimesFromUniforms((i) => streamUniform(seeds, 'boosts', i, crypto), config, horizon);
  return { crashTime, setbacks, boosts };
}

export interface VerifyInput extends RoundSeeds {
  /** The commit published before the round. */
  commit: string;
  config: GameConfig;
}

export interface VerifyResult extends RoundOutcome {
  /** The revealed server seed hashes to the published commit. */
  verified: boolean;
  computedCommit: string;
}

export function verifyRound(input: VerifyInput): VerifyResult {
  let computedCommit = '';
  try {
    computedCommit = commitServerSeed(input.serverSeed);
  } catch {
    return { verified: false, computedCommit, crashTime: Number.NaN, setbacks: [], boosts: [] };
  }
  const outcome = deriveRound(input, input.config);
  return {
    ...outcome,
    computedCommit,
    verified: computedCommit === input.commit.toLowerCase(),
  };
}
