# RTP simulation: whack-crash/v4

- Rounds: 10,000,000 (seed 1), 151.4s
- Config: `{"id":"whack-crash/v4","rtp":0.97,"r0":0.06,"rmax":0.475,"tRamp":24,"lambda":0.06,"setbackFactor":0.5,"boostRate":0.2,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 7.367 s, median 6.717 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.06/s; boosts x1.05 at 0.2/s
- Instant bust share: 3.003% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.528% | 96.960% (±0.023%) | 96.994% (±0.008%) | PASS |
| auto cash-out x2 | 48.393% | 96.922% (±0.032%) | 96.991% (±0.010%) | PASS |
| auto cash-out x10 | 9.688% | 96.956% (±0.094%) | 97.003% (±0.015%) | PASS |
| auto cash-out x100 | 0.969% | 96.939% (±0.310%) | 96.983% (±0.018%) | PASS |
| cash out at 2s | 86.497% | 96.993% (±0.013%) | 96.994% (±0.005%) | PASS |
| cash out at 5s | 63.951% | 96.934% (±0.025%) | 96.989% (±0.009%) | PASS |
| cash out at 10s | 27.362% | 96.907% (±0.055%) | 96.999% (±0.013%) | PASS |
| cash out right after first setback | 33.107% | 99.339% (±2.106%) | 96.966% (±0.021%) | PASS |
| cash out right after first boost | 66.451% | 96.947% (±0.147%) | 96.990% (±0.008%) | PASS |
| never cash out (caps only) | 0.010% | 100.000% (±3.162%) | 96.947% (±0.024%) | PASS |
