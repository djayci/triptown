# RTP simulation: paper-route/v1-rising+cap100

- Rounds: 10,000,000 (seed 1), 136.6s
- Config: `{"id":"paper-route/v1-rising+cap100","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0,"setbackFactor":0.5,"maxWinMultiplier":100,"tMax":60,"papers":5}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Instant bust share: 3.008% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| all 5 at x2 | 48.492% | 96.983% (±0.032%) | 97.000% (±0.000%) | PASS |
| 1 at x1.5, 4 at x5 | 64.656% | 97.015% (±0.052%) | 97.000% (±0.000%) | PASS |
| 1 per second | 83.106% | 97.000% (±0.027%) | 97.000% (±0.000%) | PASS |
| 1 per 0.7 s | 87.696% | 96.988% (±0.020%) | 97.000% (±0.000%) | PASS |
| all 5 at 1.3 s | 78.265% | 96.984% (±0.016%) | 97.000% (±0.000%) | PASS |
| 1 at x3, 4 never | 32.327% | 97.258% (±0.250%) | 97.000% (±0.000%) | PASS |
| all 5 at x10 | 9.701% | 97.008% (±0.094%) | 97.000% (±0.000%) | PASS |
| never throw (caps only) | 0.973% | 97.327% (±0.310%) | 97.000% (±0.000%) | PASS |
