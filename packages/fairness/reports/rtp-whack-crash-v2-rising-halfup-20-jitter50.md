# RTP simulation: whack-crash/v2-rising

- Rounds: 4,000,000 (seed 2), 41.4s
- Config: `{"id":"whack-crash/v2-rising","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0,"setbackFactor":0.5,"boostRate":0.4,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 20 minor units per paper
- Target RTP 97.000%; rounding band at 20 minor units per cash-out: 94.634% .. 99.366%; jurisdiction minimum 85.000%
- Round length: mean 3.163 s, median 2.789 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0/s; boosts x1.05 at 0.4/s
- Instant bust share: 3.009% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.480% | 96.875% (±0.036%) | 96.979% (±0.002%) | PASS |
| auto cash-out x2 | 48.350% | 96.842% (±0.050%) | 96.998% (±0.003%) | PASS |
| auto cash-out x10 | 9.666% | 96.738% (±0.148%) | 96.997% (±0.004%) | PASS |
| auto cash-out x100 | 0.972% | 97.228% (±0.491%) | 96.999% (±0.005%) | PASS |
| cash out at 2s | 63.772% | 96.779% (±0.037%) | 96.884% (±0.002%) | PASS |
| cash out at 5s | 20.245% | 96.767% (±0.096%) | 96.991% (±0.003%) | PASS |
| cash out at 10s | 0.758% | 97.687% (±0.562%) | 96.998% (±0.005%) | PASS |
| cash out right after first setback | 0.010% | 99.500% (±4.987%) | 96.948% (±0.006%) | PASS |
| cash out right after first boost | 60.903% | 96.907% (±0.292%) | 96.969% (±0.002%) | PASS |
| never cash out (caps only) | 0.010% | 99.500% (±4.987%) | 96.948% (±0.006%) | PASS |
