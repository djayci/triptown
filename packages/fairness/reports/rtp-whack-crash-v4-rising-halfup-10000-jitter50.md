# RTP simulation: whack-crash/v4-rising

- Rounds: 4,000,000 (seed 1), 38.4s
- Config: `{"id":"whack-crash/v4-rising","rtp":0.97,"r0":0.048,"rmax":0.38,"tRamp":30,"lambda":0,"setbackFactor":0.5,"boostRate":0.16,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 10000 minor units per paper
- Target RTP 97.000%; rounding band at 10000 minor units per cash-out: 96.995% .. 97.005%; jurisdiction minimum 85.000%
- Round length: mean 7.920 s, median 6.974 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0/s; boosts x1.05 at 0.16/s
- Instant bust share: 2.992% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.564% | 97.022% (±0.036%) | 97.003% (±0.002%) | PASS |
| auto cash-out x2 | 48.461% | 97.063% (±0.050%) | 97.001% (±0.003%) | PASS |
| auto cash-out x10 | 9.710% | 97.186% (±0.148%) | 97.003% (±0.004%) | PASS |
| auto cash-out x100 | 0.976% | 97.702% (±0.492%) | 97.007% (±0.005%) | PASS |
| cash out at 2s | 84.856% | 97.038% (±0.021%) | 97.001% (±0.001%) | PASS |
| cash out at 5s | 63.853% | 97.021% (±0.037%) | 97.002% (±0.002%) | PASS |
| cash out at 10s | 31.893% | 97.099% (±0.071%) | 97.001% (±0.003%) | PASS |
| cash out right after first setback | 0.010% | 100.750% (±5.018%) | 96.958% (±0.006%) | FAIL |
| cash out right after first boost | 61.002% | 97.205% (±0.227%) | 97.001% (±0.002%) | PASS |
| never cash out (caps only) | 0.010% | 100.750% (±5.018%) | 96.958% (±0.006%) | FAIL |
