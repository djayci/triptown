# RTP simulation: paper-route/v1-rising

- Rounds: 4,000,000 (seed 2), 51.0s
- Config: `{"id":"paper-route/v1-rising","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0,"setbackFactor":0.5,"maxWinMultiplier":10000,"tMax":60,"papers":5}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 20 minor units per paper
- Target RTP 97.000%; rounding band at 20 minor units per cash-out: 94.634% .. 99.366%; jurisdiction minimum 85.000%
- Instant bust share: 2.995% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| all 5 at x2 | 48.516% | 97.032% (±0.050%) | 97.000% (±0.000%) | PASS |
| 1 at x1.5, 4 at x5 | 64.713% | 97.079% (±0.082%) | 97.000% (±0.000%) | PASS |
| 1 per second | 83.108% | 97.022% (±0.043%) | 96.966% (±0.000%) | PASS |
| 1 per 0.7 s | 87.685% | 97.007% (±0.031%) | 96.978% (±0.000%) | PASS |
| all 5 at 1.3 s | 78.288% | 97.027% (±0.026%) | 97.012% (±0.000%) | PASS |
| 1 at x3, 4 never | 32.365% | 98.819% (±3.985%) | 97.000% (±0.000%) | PASS |
| all 5 at x10 | 9.697% | 96.966% (±0.148%) | 97.000% (±0.000%) | PASS |
| never throw (caps only) | 0.010% | 99.250% (±4.981%) | 97.000% (±0.000%) | PASS |
