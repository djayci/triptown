# RTP simulation: whack-crash/v4-rising

- Rounds: 10,000,000 (seed 1), 98.0s
- Config: `{"id":"whack-crash/v4-rising","rtp":0.97,"r0":0.048,"rmax":0.38,"tRamp":30,"lambda":0,"setbackFactor":0.5,"boostRate":0.16,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 7.917 s, median 6.985 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0/s; boosts x1.05 at 0.16/s
- Instant bust share: 3.002% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.552% | 97.004% (±0.023%) | 97.002% (±0.001%) | PASS |
| auto cash-out x2 | 48.427% | 96.995% (±0.032%) | 97.002% (±0.002%) | PASS |
| auto cash-out x10 | 9.702% | 97.101% (±0.094%) | 97.004% (±0.002%) | PASS |
| auto cash-out x100 | 0.975% | 97.540% (±0.311%) | 97.002% (±0.003%) | PASS |
| cash out at 2s | 84.827% | 97.005% (±0.013%) | 97.000% (±0.001%) | PASS |
| cash out at 5s | 63.835% | 96.995% (±0.023%) | 97.002% (±0.001%) | PASS |
| cash out at 10s | 31.864% | 97.012% (±0.045%) | 97.002% (±0.002%) | PASS |
| cash out right after first setback | 0.010% | 101.500% (±3.186%) | 96.953% (±0.004%) | PASS |
| cash out right after first boost | 60.968% | 97.049% (±0.178%) | 97.001% (±0.001%) | PASS |
| never cash out (caps only) | 0.010% | 101.500% (±3.186%) | 96.953% (±0.004%) | PASS |
