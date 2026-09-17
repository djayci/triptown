# RTP simulation: whack-crash/v3-rising

- Rounds: 4,000,000 (seed 1), 8.4s
- Config: `{"id":"whack-crash/v3-rising","rtp":0.97,"r0":0.06,"rmax":0.475,"tRamp":24,"lambda":0,"setbackFactor":0.5,"boostRate":0,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 20 minor units per paper
- Target RTP 97.000%; rounding band at 20 minor units per cash-out: 94.634% .. 99.366%; jurisdiction minimum 85.000%
- Round length: mean 6.650 s, median 5.955 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0/s; boosts off
- Instant bust share: 2.996% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.683% | 97.025% (±0.036%) | 97.000% (±0.000%) | PASS |
| auto cash-out x2 | 48.482% | 96.964% (±0.050%) | 97.000% (±0.000%) | PASS |
| auto cash-out x10 | 9.698% | 96.984% (±0.148%) | 97.000% (±0.000%) | PASS |
| auto cash-out x100 | 0.973% | 97.320% (±0.491%) | 97.000% (±0.000%) | PASS |
| cash out at 2s | 83.124% | 95.592% (±0.022%) | 95.573% (±0.000%) | PASS |
| cash out at 5s | 57.900% | 97.043% (±0.041%) | 97.029% (±0.001%) | PASS |
| cash out at 10s | 22.421% | 96.995% (±0.090%) | 97.006% (±0.000%) | PASS |
| cash out right after first setback | 0.010% | 96.750% (±4.918%) | 97.000% (±0.000%) | PASS |
| never cash out (caps only) | 0.010% | 96.750% (±4.918%) | 97.000% (±0.000%) | PASS |
