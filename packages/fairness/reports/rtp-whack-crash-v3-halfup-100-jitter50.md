# RTP simulation: whack-crash/v3

- Rounds: 4,000,000 (seed 1), 15.9s
- Config: `{"id":"whack-crash/v3","rtp":0.97,"r0":0.06,"rmax":0.475,"tRamp":24,"lambda":0.06,"setbackFactor":0.5,"boostRate":0,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 100 minor units per paper
- Target RTP 97.000%; rounding band at 100 minor units per cash-out: 96.522% .. 97.478%; jurisdiction minimum 85.000%
- Round length: mean 7.779 s, median 7.218 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.06/s; boosts off
- Instant bust share: 2.997% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.657% | 96.986% (±0.036%) | 96.995% (±0.013%) | PASS |
| auto cash-out x2 | 48.513% | 97.027% (±0.050%) | 97.009% (±0.015%) | PASS |
| auto cash-out x10 | 9.710% | 97.103% (±0.148%) | 96.991% (±0.023%) | PASS |
| auto cash-out x100 | 0.975% | 97.513% (±0.491%) | 96.973% (±0.029%) | PASS |
| cash out at 2s | 88.248% | 96.978% (±0.020%) | 96.978% (±0.008%) | PASS |
| cash out at 5s | 67.256% | 97.006% (±0.038%) | 97.012% (±0.014%) | PASS |
| cash out at 10s | 30.294% | 97.110% (±0.082%) | 97.006% (±0.020%) | PASS |
| cash out right after first setback | 34.604% | 91.981% (±3.047%) | 97.012% (±0.032%) | PASS |
| never cash out (caps only) | 0.009% | 92.500% (±4.809%) | 96.995% (±0.037%) | PASS |
