# RTP simulation: paper-route/v1

- Rounds: 4,000,000 (seed 2), 72.0s
- Config: `{"id":"paper-route/v1","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0.12,"setbackFactor":0.5,"maxWinMultiplier":10000,"tMax":60,"papers":5}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 20 minor units per paper
- Target RTP 97.000%; rounding band at 20 minor units per cash-out: 94.634% .. 99.366%; jurisdiction minimum 85.000%
- Instant bust share: 3.008% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| all 5 at x2 | 48.464% | 96.928% (±0.050%) | 96.989% (±0.015%) | PASS |
| 1 at x1.5, 4 at x5 | 64.649% | 96.934% (±0.082%) | 96.987% (±0.018%) | PASS |
| 1 per second | 88.212% | 96.889% (±0.039%) | 96.968% (±0.013%) | PASS |
| 1 per 0.7 s | 91.417% | 96.940% (±0.028%) | 96.979% (±0.011%) | PASS |
| all 5 at 1.3 s | 84.601% | 96.967% (±0.023%) | 96.997% (±0.010%) | PASS |
| 1 right after each setback | 34.623% | 106.024% (±4.405%) | 96.986% (±0.035%) | PASS |
| 1 at x3, 4 never | 32.292% | 105.175% (±4.142%) | 96.983% (±0.032%) | PASS |
| all 5 at x10 | 9.674% | 96.740% (±0.148%) | 96.985% (±0.023%) | PASS |
| never throw (caps only) | 0.011% | 107.250% (±5.178%) | 96.981% (±0.037%) | PASS |
