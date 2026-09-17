# RTP simulation: whack-crash/v4-rising

- Rounds: 4,000,000 (seed 1), 39.4s
- Config: `{"id":"whack-crash/v4-rising","rtp":0.97,"r0":0.06,"rmax":0.475,"tRamp":24,"lambda":0,"setbackFactor":0.5,"boostRate":0.2,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 20 minor units per paper
- Target RTP 97.000%; rounding band at 20 minor units per cash-out: 94.634% .. 99.366%; jurisdiction minimum 85.000%
- Round length: mean 6.332 s, median 5.592 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0/s; boosts x1.05 at 0.2/s
- Instant bust share: 2.996% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.561% | 96.997% (±0.036%) | 96.984% (±0.002%) | PASS |
| auto cash-out x2 | 48.416% | 96.973% (±0.050%) | 97.002% (±0.003%) | PASS |
| auto cash-out x10 | 9.671% | 96.796% (±0.148%) | 97.005% (±0.004%) | PASS |
| auto cash-out x100 | 0.971% | 97.106% (±0.490%) | 97.010% (±0.005%) | PASS |
| cash out at 2s | 81.465% | 96.162% (±0.023%) | 96.158% (±0.002%) | PASS |
| cash out at 5s | 55.057% | 96.876% (±0.044%) | 96.893% (±0.003%) | PASS |
| cash out at 10s | 20.270% | 96.894% (±0.096%) | 96.988% (±0.003%) | PASS |
| cash out right after first setback | 0.009% | 94.000% (±4.847%) | 96.956% (±0.006%) | PASS |
| cash out right after first boost | 60.946% | 97.052% (±0.193%) | 96.968% (±0.002%) | PASS |
| never cash out (caps only) | 0.009% | 94.000% (±4.847%) | 96.956% (±0.006%) | PASS |
