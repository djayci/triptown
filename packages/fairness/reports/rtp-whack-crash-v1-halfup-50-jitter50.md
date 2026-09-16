# RTP simulation: whack-crash/v1

- Rounds: 4,000,000 (seed 7), 10.5s
- Config: `{"id":"whack-crash/v1","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0.12,"setbackFactor":0.5,"maxWinMultiplier":10000,"tMax":60,"papers":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 50 minor units per paper
- Target RTP 97.000%; rounding band at 50 minor units per cash-out: 96.058% .. 97.960%; jurisdiction minimum 85.000%
- Instant bust share: 2.994% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.665% | 96.997% (±0.036%) | 96.996% (±0.013%) | PASS |
| auto cash-out x2 | 48.481% | 96.961% (±0.050%) | 96.996% (±0.015%) | PASS |
| auto cash-out x10 | 9.697% | 96.974% (±0.148%) | 97.002% (±0.023%) | PASS |
| auto cash-out x100 | 0.970% | 97.043% (±0.490%) | 97.018% (±0.029%) | PASS |
| cash out at 2s | 74.908% | 96.976% (±0.031%) | 96.984% (±0.012%) | PASS |
| cash out at 5s | 30.262% | 96.930% (±0.082%) | 97.003% (±0.020%) | PASS |
| cash out at 10s | 1.675% | 97.258% (±0.434%) | 97.019% (±0.029%) | PASS |
| cash out right after first setback | 34.610% | 95.141% (±3.121%) | 97.042% (±0.032%) | PASS |
| never cash out (caps only) | 0.010% | 96.250% (±4.905%) | 97.059% (±0.037%) | PASS |
