# RTP simulation: whack-crash/v4-rising

- Rounds: 10,000,000 (seed 1), 99.2s
- Config: `{"id":"whack-crash/v4-rising","rtp":0.97,"r0":0.06,"rmax":0.475,"tRamp":24,"lambda":0,"setbackFactor":0.5,"boostRate":0.2,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 6.331 s, median 5.597 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0/s; boosts x1.05 at 0.2/s
- Instant bust share: 3.003% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.522% | 96.958% (±0.023%) | 97.000% (±0.001%) | PASS |
| auto cash-out x2 | 48.405% | 96.951% (±0.032%) | 96.998% (±0.002%) | PASS |
| auto cash-out x10 | 9.686% | 96.944% (±0.094%) | 97.001% (±0.002%) | PASS |
| auto cash-out x100 | 0.970% | 97.108% (±0.310%) | 97.001% (±0.003%) | PASS |
| cash out at 2s | 81.459% | 96.998% (±0.015%) | 97.001% (±0.001%) | PASS |
| cash out at 5s | 55.040% | 96.952% (±0.028%) | 96.999% (±0.002%) | PASS |
| cash out at 10s | 20.273% | 96.915% (±0.061%) | 96.999% (±0.002%) | PASS |
| cash out right after first setback | 0.010% | 100.400% (±3.168%) | 96.958% (±0.004%) | PASS |
| cash out right after first boost | 60.934% | 97.090% (±0.204%) | 96.998% (±0.001%) | PASS |
| never cash out (caps only) | 0.010% | 100.400% (±3.168%) | 96.958% (±0.004%) | PASS |
