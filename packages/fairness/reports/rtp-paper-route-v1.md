# RTP simulation: paper-route/v1

- Rounds: 10,000,000 (seed 1), 139.7s
- Config: `{"id":"paper-route/v1","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0.12,"setbackFactor":0.5,"maxWinMultiplier":10000,"tMax":60,"papers":5}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Instant bust share: 2.996% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| all 5 at x2 | 48.495% | 96.990% (±0.032%) | 96.995% (±0.010%) | PASS |
| 1 at x1.5, 4 at x5 | 64.674% | 97.034% (±0.052%) | 97.004% (±0.011%) | PASS |
| 1 per second | 88.267% | 97.015% (±0.025%) | 96.999% (±0.008%) | PASS |
| 1 per 0.7 s | 91.460% | 97.011% (±0.018%) | 96.997% (±0.007%) | PASS |
| all 5 at 1.3 s | 84.644% | 97.020% (±0.015%) | 97.001% (±0.006%) | PASS |
| 1 right after each setback | 34.641% | 97.991% (±2.644%) | 97.000% (±0.022%) | PASS |
| 1 at x3, 4 never | 32.339% | 97.564% (±2.501%) | 97.001% (±0.020%) | PASS |
| all 5 at x10 | 9.691% | 96.911% (±0.094%) | 97.004% (±0.015%) | PASS |
| never throw (caps only) | 0.010% | 97.700% (±3.126%) | 97.001% (±0.023%) | PASS |
