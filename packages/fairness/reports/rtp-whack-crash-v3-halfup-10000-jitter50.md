# RTP simulation: whack-crash/v3

- Rounds: 4,000,000 (seed 1), 14.5s
- Config: `{"id":"whack-crash/v3","rtp":0.97,"r0":0.048,"rmax":0.38,"tRamp":30,"lambda":0.048,"setbackFactor":0.5,"boostRate":0,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 10000 minor units per paper
- Target RTP 97.000%; rounding band at 10000 minor units per cash-out: 96.995% .. 97.005%; jurisdiction minimum 85.000%
- Round length: mean 9.718 s, median 9.005 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.048/s; boosts off
- Instant bust share: 2.994% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.651% | 96.977% (±0.036%) | 97.001% (±0.013%) | PASS |
| auto cash-out x2 | 48.494% | 96.988% (±0.050%) | 97.000% (±0.015%) | PASS |
| auto cash-out x10 | 9.676% | 96.756% (±0.148%) | 96.970% (±0.023%) | PASS |
| auto cash-out x100 | 0.964% | 96.422% (±0.489%) | 96.944% (±0.029%) | PASS |
| cash out at 2s | 90.433% | 96.998% (±0.018%) | 96.996% (±0.008%) | PASS |
| cash out at 5s | 74.892% | 96.973% (±0.031%) | 96.998% (±0.012%) | PASS |
| cash out at 10s | 43.864% | 96.967% (±0.061%) | 97.002% (±0.017%) | PASS |
| cash out right after first setback | 34.591% | 99.470% (±3.280%) | 96.940% (±0.032%) | PASS |
| never cash out (caps only) | 0.010% | 104.500% (±5.111%) | 96.925% (±0.037%) | PASS |
