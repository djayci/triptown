# RTP simulation: whack-crash/v3

- Rounds: 10,000,000 (seed 1), 38.8s
- Config: `{"id":"whack-crash/v3","rtp":0.97,"r0":0.048,"rmax":0.38,"tRamp":30,"lambda":0.048,"setbackFactor":0.5,"boostRate":0,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 9.721 s, median 8.992 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.048/s; boosts off
- Instant bust share: 3.004% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.646% | 96.969% (±0.023%) | 96.988% (±0.008%) | PASS |
| auto cash-out x2 | 48.502% | 97.005% (±0.032%) | 96.984% (±0.010%) | PASS |
| auto cash-out x10 | 9.684% | 96.837% (±0.094%) | 96.980% (±0.015%) | PASS |
| auto cash-out x100 | 0.975% | 97.536% (±0.311%) | 96.991% (±0.018%) | PASS |
| cash out at 2s | 90.421% | 96.991% (±0.011%) | 97.000% (±0.005%) | PASS |
| cash out at 5s | 74.906% | 96.975% (±0.020%) | 96.989% (±0.008%) | PASS |
| cash out at 10s | 43.865% | 96.947% (±0.038%) | 96.986% (±0.011%) | PASS |
| cash out right after first setback | 34.640% | 98.682% (±2.055%) | 96.999% (±0.021%) | PASS |
| never cash out (caps only) | 0.010% | 99.200% (±3.149%) | 97.005% (±0.023%) | PASS |
