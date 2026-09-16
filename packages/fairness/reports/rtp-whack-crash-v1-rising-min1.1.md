# RTP simulation: whack-crash/v1-rising

- Rounds: 10,000,000 (seed 3), 20.7s
- Config: `{"id":"whack-crash/v1-rising","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0,"setbackFactor":0.5,"maxWinMultiplier":10000,"tMax":60,"papers":1}`
- Minimum cash-out: x1.1
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Instant bust share: 2.999% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.683% | 97.024% (±0.023%) | 97.000% (±0.000%) | PASS |
| auto cash-out x2 | 48.494% | 96.987% (±0.032%) | 97.000% (±0.000%) | PASS |
| auto cash-out x10 | 9.698% | 96.978% (±0.094%) | 97.000% (±0.000%) | PASS |
| auto cash-out x100 | 0.965% | 96.539% (±0.309%) | 97.000% (±0.000%) | PASS |
| cash out at 2s | 66.456% | 97.016% (±0.022%) | 97.000% (±0.000%) | PASS |
| cash out at 5s | 22.413% | 96.952% (±0.057%) | 97.000% (±0.000%) | PASS |
| cash out at 10s | 0.915% | 96.499% (±0.318%) | 97.000% (±0.000%) | PASS |
| cash out right after first setback | 0.010% | 96.700% (±3.110%) | 97.000% (±0.000%) | PASS |
| never cash out (caps only) | 0.010% | 96.700% (±3.110%) | 97.000% (±0.000%) | PASS |
