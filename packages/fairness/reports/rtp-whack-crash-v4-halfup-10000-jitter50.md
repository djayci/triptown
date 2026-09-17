# RTP simulation: whack-crash/v4

- Rounds: 4,000,000 (seed 1), 58.0s
- Config: `{"id":"whack-crash/v4","rtp":0.97,"r0":0.06,"rmax":0.475,"tRamp":24,"lambda":0.06,"setbackFactor":0.5,"boostRate":0.2,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 10000 minor units per paper
- Target RTP 97.000%; rounding band at 10000 minor units per cash-out: 96.995% .. 97.005%; jurisdiction minimum 85.000%
- Round length: mean 7.363 s, median 6.716 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.06/s; boosts x1.05 at 0.2/s
- Instant bust share: 2.996% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.530% | 96.964% (±0.036%) | 97.004% (±0.012%) | PASS |
| auto cash-out x2 | 48.385% | 96.905% (±0.050%) | 97.005% (±0.015%) | PASS |
| auto cash-out x10 | 9.670% | 96.782% (±0.148%) | 97.010% (±0.023%) | PASS |
| auto cash-out x100 | 0.971% | 97.152% (±0.491%) | 97.019% (±0.029%) | PASS |
| cash out at 2s | 86.482% | 96.990% (±0.021%) | 97.002% (±0.009%) | PASS |
| cash out at 5s | 63.931% | 96.937% (±0.040%) | 97.007% (±0.014%) | PASS |
| cash out at 10s | 27.336% | 96.819% (±0.088%) | 96.993% (±0.020%) | PASS |
| cash out right after first setback | 33.082% | 100.919% (±3.368%) | 96.967% (±0.033%) | PASS |
| cash out right after first boost | 66.443% | 97.017% (±0.284%) | 97.014% (±0.013%) | PASS |
| never cash out (caps only) | 0.010% | 101.500% (±5.037%) | 96.948% (±0.037%) | PASS |
