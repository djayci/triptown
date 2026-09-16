# RTP simulation: whack-crash/v1

- Rounds: 10,000,000 (seed 2), 31.1s
- Config: `{"id":"whack-crash/v1","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0.12,"setbackFactor":0.5,"maxWinMultiplier":10000,"tMax":60,"papers":1}`
- Minimum cash-out: x1.1
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Instant bust share: 3.009% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.661% | 96.992% (±0.023%) | 96.998% (±0.008%) | PASS |
| auto cash-out x2 | 48.483% | 96.966% (±0.032%) | 96.997% (±0.010%) | PASS |
| auto cash-out x10 | 9.701% | 97.006% (±0.094%) | 96.995% (±0.015%) | PASS |
| auto cash-out x100 | 0.966% | 96.607% (±0.309%) | 96.986% (±0.018%) | PASS |
| cash out at 2s | 68.889% | 96.984% (±0.021%) | 96.997% (±0.008%) | PASS |
| cash out at 5s | 29.807% | 96.890% (±0.052%) | 96.983% (±0.012%) | PASS |
| cash out at 10s | 1.677% | 96.656% (±0.273%) | 96.984% (±0.018%) | PASS |
| cash out right after first setback | 24.286% | 101.156% (±2.114%) | 96.992% (±0.021%) | PASS |
| never cash out (caps only) | 0.010% | 102.200% (±3.197%) | 96.986% (±0.023%) | PASS |
