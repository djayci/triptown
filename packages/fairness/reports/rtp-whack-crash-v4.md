# RTP simulation: whack-crash/v4

- Rounds: 10,000,000 (seed 1), 146.8s
- Config: `{"id":"whack-crash/v4","rtp":0.97,"r0":0.048,"rmax":0.38,"tRamp":30,"lambda":0.048,"setbackFactor":0.5,"boostRate":0.16,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 9.210 s, median 8.425 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.048/s; boosts x1.05 at 0.16/s
- Instant bust share: 3.003% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.542% | 96.982% (±0.023%) | 97.000% (±0.008%) | PASS |
| auto cash-out x2 | 48.418% | 96.971% (±0.032%) | 97.003% (±0.010%) | PASS |
| auto cash-out x10 | 9.684% | 96.921% (±0.094%) | 97.007% (±0.015%) | PASS |
| auto cash-out x100 | 0.972% | 97.257% (±0.310%) | 97.005% (±0.018%) | PASS |
| cash out at 2s | 88.990% | 96.997% (±0.012%) | 97.001% (±0.005%) | PASS |
| cash out at 5s | 71.962% | 96.977% (±0.021%) | 97.002% (±0.008%) | PASS |
| cash out at 10s | 40.490% | 96.943% (±0.041%) | 97.001% (±0.011%) | PASS |
| cash out right after first setback | 33.104% | 96.191% (±2.028%) | 96.962% (±0.021%) | PASS |
| cash out right after first boost | 66.481% | 96.887% (±0.109%) | 96.996% (±0.008%) | PASS |
| never cash out (caps only) | 0.010% | 96.700% (±3.110%) | 96.926% (±0.024%) | PASS |
