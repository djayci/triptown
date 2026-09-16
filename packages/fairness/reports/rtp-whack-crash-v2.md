# RTP simulation: whack-crash/v2

- Rounds: 10,000,000 (seed 1), 162.6s
- Config: `{"id":"whack-crash/v2","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0.12,"setbackFactor":0.5,"boostRate":0.4,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 3.683 s, median 3.367 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.12/s; boosts x1.05 at 0.4/s
- Instant bust share: 3.009% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.552% | 96.997% (±0.023%) | 97.010% (±0.008%) | PASS |
| auto cash-out x2 | 48.420% | 96.975% (±0.032%) | 97.007% (±0.010%) | PASS |
| auto cash-out x10 | 9.680% | 96.880% (±0.094%) | 97.024% (±0.015%) | PASS |
| auto cash-out x100 | 0.969% | 96.948% (±0.310%) | 97.009% (±0.018%) | PASS |
| cash out at 2s | 71.963% | 96.989% (±0.021%) | 97.010% (±0.008%) | PASS |
| cash out at 5s | 27.381% | 96.999% (±0.055%) | 97.018% (±0.013%) | PASS |
| cash out at 10s | 1.368% | 96.922% (±0.304%) | 97.009% (±0.018%) | PASS |
| cash out right after first setback | 33.083% | 96.118% (±2.019%) | 96.974% (±0.021%) | PASS |
| cash out right after first boost | 66.477% | 97.054% (±0.209%) | 97.003% (±0.008%) | PASS |
| never cash out (caps only) | 0.009% | 93.700% (±3.061%) | 96.958% (±0.024%) | PASS |
