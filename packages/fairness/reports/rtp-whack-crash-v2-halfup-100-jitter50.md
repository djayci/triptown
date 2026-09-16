# RTP simulation: whack-crash/v2

- Rounds: 4,000,000 (seed 2), 64.5s
- Config: `{"id":"whack-crash/v2","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0.12,"setbackFactor":0.5,"boostRate":0.4,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 100 minor units per paper
- Target RTP 97.000%; rounding band at 100 minor units per cash-out: 96.522% .. 97.478%; jurisdiction minimum 85.000%
- Round length: mean 3.685 s, median 3.357 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.12/s; boosts x1.05 at 0.4/s
- Instant bust share: 2.985% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.560% | 97.007% (±0.036%) | 96.977% (±0.013%) | PASS |
| auto cash-out x2 | 48.441% | 97.017% (±0.050%) | 96.976% (±0.015%) | PASS |
| auto cash-out x10 | 9.680% | 96.884% (±0.148%) | 97.007% (±0.023%) | PASS |
| auto cash-out x100 | 0.970% | 97.024% (±0.490%) | 96.999% (±0.029%) | PASS |
| cash out at 2s | 72.024% | 97.043% (±0.034%) | 96.983% (±0.012%) | PASS |
| cash out at 5s | 27.394% | 96.977% (±0.088%) | 96.990% (±0.020%) | PASS |
| cash out at 10s | 1.375% | 96.878% (±0.481%) | 97.007% (±0.029%) | PASS |
| cash out right after first setback | 33.126% | 95.334% (±3.177%) | 96.966% (±0.033%) | PASS |
| cash out right after first boost | 66.470% | 96.912% (±0.287%) | 96.992% (±0.013%) | PASS |
| never cash out (caps only) | 0.010% | 99.000% (±4.975%) | 96.920% (±0.037%) | PASS |
