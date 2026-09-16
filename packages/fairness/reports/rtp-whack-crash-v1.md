# RTP simulation: whack-crash/v1

- Rounds: 10,000,000 (seed 1), 28.9s
- Config: `{"id":"whack-crash/v1","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0.12,"setbackFactor":0.5,"maxWinMultiplier":10000,"tMax":60,"papers":1}`
- Minimum cash-out: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Instant bust share: 2.996% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.674% | 97.011% (±0.023%) | 97.001% (±0.008%) | PASS |
| auto cash-out x2 | 48.495% | 96.990% (±0.032%) | 96.995% (±0.010%) | PASS |
| auto cash-out x10 | 9.691% | 96.911% (±0.094%) | 97.004% (±0.015%) | PASS |
| auto cash-out x100 | 0.971% | 97.101% (±0.310%) | 96.988% (±0.018%) | PASS |
| cash out at 2s | 74.929% | 97.016% (±0.020%) | 96.999% (±0.008%) | PASS |
| cash out at 5s | 30.279% | 97.029% (±0.052%) | 97.002% (±0.012%) | PASS |
| cash out at 10s | 1.678% | 97.395% (±0.274%) | 96.992% (±0.018%) | PASS |
| cash out right after first setback | 34.641% | 97.726% (±2.047%) | 96.999% (±0.021%) | PASS |
| never cash out (caps only) | 0.010% | 97.700% (±3.126%) | 97.001% (±0.023%) | PASS |
