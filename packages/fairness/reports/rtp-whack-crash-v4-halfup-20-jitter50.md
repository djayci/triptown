# RTP simulation: whack-crash/v4

- Rounds: 4,000,000 (seed 1), 57.7s
- Config: `{"id":"whack-crash/v4","rtp":0.97,"r0":0.048,"rmax":0.38,"tRamp":30,"lambda":0.048,"setbackFactor":0.5,"boostRate":0.16,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 20 minor units per paper
- Target RTP 97.000%; rounding band at 20 minor units per cash-out: 94.634% .. 99.366%; jurisdiction minimum 85.000%
- Round length: mean 9.216 s, median 8.437 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.048/s; boosts x1.05 at 0.16/s
- Instant bust share: 3.001% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.586% | 97.029% (±0.036%) | 96.977% (±0.012%) | PASS |
| auto cash-out x2 | 48.466% | 97.067% (±0.050%) | 96.979% (±0.015%) | PASS |
| auto cash-out x10 | 9.694% | 97.023% (±0.148%) | 96.978% (±0.023%) | PASS |
| auto cash-out x100 | 0.978% | 97.842% (±0.492%) | 96.963% (±0.029%) | PASS |
| cash out at 2s | 89.021% | 97.448% (±0.019%) | 97.418% (±0.008%) | PASS |
| cash out at 5s | 71.999% | 97.110% (±0.034%) | 97.071% (±0.012%) | PASS |
| cash out at 10s | 40.525% | 97.017% (±0.065%) | 96.964% (±0.018%) | PASS |
| cash out right after first setback | 33.150% | 99.861% (±3.365%) | 96.909% (±0.033%) | PASS |
| cash out right after first boost | 66.495% | 96.753% (±0.153%) | 96.970% (±0.013%) | PASS |
| never cash out (caps only) | 0.010% | 99.250% (±4.981%) | 96.901% (±0.037%) | PASS |
