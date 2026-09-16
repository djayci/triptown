# RTP simulation: Fence Run v1 (step game)

- Rounds per difficulty: 20,000,000 (seed 1); all strategies share the same fences each round.
- Paytable rule: clear chance of fence k = m[k-1] / m[k] with m[0] = RTP, so stopping after any fence returns exactly the RTP.
- PASS requires every theoretical stop at 97% ± 0.1% and every measured strategy within 4 standard errors of 97%.

## fence-run/v1-easy

| Fence | Multiplier | Clear chance | Reach chance | Theoretical RTP |
|---|---|---|---|---|
| 1 | x1.08 | 89.81% | 89.815% | 97.0000% |
| 2 | x1.20 | 90.00% | 80.833% | 97.0000% |
| 3 | x1.33 | 90.23% | 72.932% | 97.0000% |
| 4 | x1.48 | 89.86% | 65.541% | 97.0000% |
| 5 | x1.64 | 90.24% | 59.146% | 97.0000% |
| 6 | x1.83 | 89.62% | 53.005% | 97.0000% |
| 7 | x2.03 | 90.15% | 47.783% | 97.0000% |
| 8 | x2.25 | 90.22% | 43.111% | 97.0000% |
| 9 | x2.50 | 90.00% | 38.800% | 97.0000% |
| 10 | x2.78 | 89.93% | 34.892% | 97.0000% |

| Strategy | Win rate | Measured RTP (± SE) | Result |
|---|---|---|---|
| collect after fence 1 | 89.81% | 96.996% (±0.007%) | PASS |
| collect after fence 3 | 72.93% | 96.991% (±0.013%) | PASS |
| collect after fence 5 | 59.14% | 96.988% (±0.018%) | PASS |
| collect after fence 9 | 38.80% | 96.989% (±0.027%) | PASS |
| run to the finish | 34.89% | 96.989% (±0.030%) | PASS |
| collect at a random fence each round | 58.57% | 96.967% (±0.020%) | PASS |

| Stake (minor units) | RTP band after half-up rounding |
|---|---|
| 20 | 97.000% .. 98.796% |
| 100 | 97.000% .. 97.000% |
| 1000 | 97.000% .. 97.000% |
| 10000 | 97.000% .. 97.000% |

Theoretical: PASS · Measured: PASS

## fence-run/v1-medium

| Fence | Multiplier | Clear chance | Reach chance | Theoretical RTP |
|---|---|---|---|---|
| 1 | x1.21 | 80.17% | 80.165% | 97.0000% |
| 2 | x1.52 | 79.61% | 63.816% | 97.0000% |
| 3 | x1.89 | 80.42% | 51.323% | 97.0000% |
| 4 | x2.37 | 79.75% | 40.928% | 97.0000% |
| 5 | x2.96 | 80.07% | 32.770% | 97.0000% |
| 6 | x3.70 | 80.00% | 26.216% | 97.0000% |
| 7 | x4.63 | 79.91% | 20.950% | 97.0000% |
| 8 | x5.78 | 80.10% | 16.782% | 97.0000% |
| 9 | x7.23 | 79.94% | 13.416% | 97.0000% |
| 10 | x9.03 | 80.07% | 10.742% | 97.0000% |

| Strategy | Win rate | Measured RTP (± SE) | Result |
|---|---|---|---|
| collect after fence 1 | 80.16% | 96.998% (±0.011%) | PASS |
| collect after fence 3 | 51.32% | 97.003% (±0.021%) | PASS |
| collect after fence 5 | 32.77% | 96.996% (±0.031%) | PASS |
| collect after fence 9 | 13.41% | 96.971% (±0.055%) | PASS |
| run to the finish | 10.74% | 96.991% (±0.063%) | PASS |
| collect at a random fence each round | 35.71% | 96.984% (±0.039%) | PASS |

| Stake (minor units) | RTP band after half-up rounding |
|---|---|
| 20 | 95.724% .. 97.513% |
| 100 | 97.000% .. 97.000% |
| 1000 | 97.000% .. 97.000% |
| 10000 | 97.000% .. 97.000% |

Theoretical: PASS · Measured: PASS

## fence-run/v1-hard

| Fence | Multiplier | Clear chance | Reach chance | Theoretical RTP |
|---|---|---|---|---|
| 1 | x1.49 | 65.10% | 65.101% | 97.0000% |
| 2 | x2.30 | 64.78% | 42.174% | 97.0000% |
| 3 | x3.53 | 65.16% | 27.479% | 97.0000% |
| 4 | x5.43 | 65.01% | 17.864% | 97.0000% |
| 5 | x8.36 | 64.95% | 11.603% | 97.0000% |
| 6 | x12.86 | 65.01% | 7.543% | 97.0000% |
| 7 | x19.79 | 64.98% | 4.901% | 97.0000% |
| 8 | x30.44 | 65.01% | 3.187% | 97.0000% |
| 9 | x46.83 | 65.00% | 2.071% | 97.0000% |
| 10 | x72.05 | 65.00% | 1.346% | 97.0000% |

| Strategy | Win rate | Measured RTP (± SE) | Result |
|---|---|---|---|
| collect after fence 1 | 65.10% | 97.001% (±0.016%) | PASS |
| collect after fence 3 | 27.48% | 97.009% (±0.035%) | PASS |
| collect after fence 5 | 11.61% | 97.021% (±0.060%) | PASS |
| collect after fence 9 | 2.07% | 96.998% (±0.149%) | PASS |
| run to the finish | 1.35% | 97.088% (±0.186%) | PASS |
| collect at a random fence each round | 18.33% | 97.006% (±0.097%) | PASS |

| Stake (minor units) | RTP band after half-up rounding |
|---|---|
| 20 | 96.884% .. 97.651% |
| 100 | 97.000% .. 97.000% |
| 1000 | 97.000% .. 97.000% |
| 10000 | 97.000% .. 97.000% |

Theoretical: PASS · Measured: PASS

**Overall: PASS**
