# RTP simulation: whack-crash/v2-rising

- Rounds: 10,000,000 (seed 1), 103.1s
- Config: `{"id":"whack-crash/v2-rising","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0,"setbackFactor":0.5,"boostRate":0.4,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 3.166 s, median 2.792 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0/s; boosts x1.05 at 0.4/s
- Instant bust share: 3.008% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.534% | 96.976% (±0.023%) | 97.000% (±0.001%) | PASS |
| auto cash-out x2 | 48.421% | 96.984% (±0.032%) | 96.999% (±0.002%) | PASS |
| auto cash-out x10 | 9.690% | 96.984% (±0.094%) | 97.000% (±0.002%) | PASS |
| auto cash-out x100 | 0.968% | 96.894% (±0.310%) | 96.999% (±0.003%) | PASS |
| cash out at 2s | 63.822% | 96.974% (±0.023%) | 97.000% (±0.001%) | PASS |
| cash out at 5s | 20.302% | 97.058% (±0.061%) | 96.999% (±0.002%) | PASS |
| cash out at 10s | 0.753% | 96.933% (±0.354%) | 96.999% (±0.003%) | PASS |
| cash out right after first setback | 0.009% | 92.900% (±3.048%) | 96.951% (±0.004%) | PASS |
| cash out right after first boost | 60.950% | 96.972% (±0.217%) | 96.998% (±0.001%) | PASS |
| never cash out (caps only) | 0.009% | 92.900% (±3.048%) | 96.951% (±0.004%) | PASS |
