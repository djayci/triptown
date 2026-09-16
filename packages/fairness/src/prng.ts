/**
 * Fast seeded PRNG (sfc32) for simulations and tests only.
 * Real rounds always use the HMAC streams in seeds.ts.
 */
export function createPrng(seed: number): () => number {
  let a = 0x9e3779b9 ^ seed;
  let b = 0x243f6a88 ^ Math.imul(seed, 0x85ebca6b);
  let c = 0xb7e15162 ^ Math.imul(seed, 0xc2b2ae35);
  let d = 1;
  const next = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 16; i++) next();
  // 53-bit float in (0, 1].
  return () => 1 - ((next() >>> 5) * 67108864 + (next() >>> 6)) / 9007199254740992;
}
