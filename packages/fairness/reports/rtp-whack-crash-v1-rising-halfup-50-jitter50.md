# RTP simulation: whack-crash/v1-rising

- Rounds: 4,000,000 (seed 7), 7.1s
- Config: `{"id":"whack-crash/v1-rising","rtp":0.97,"r0":0.12,"rmax":0.95,"tRamp":12,"lambda":0,"setbackFactor":0.5,"maxWinMultiplier":10000,"tMax":60,"papers":1}`
- Minimum cash-out: none
- Time strategy jitter: ±50 ms
- Rounding: halfup at 50 minor units per paper
- Target RTP 97.000%; rounding band at 50 minor units per cash-out: 96.058% .. 97.960%; jurisdiction minimum 85.000%
- Instant bust share: 2.997% (±0.009% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.665% | 96.997% (±0.036%) | 97.000% (±0.000%) | PASS |
| auto cash-out x2 | 48.513% | 97.025% (±0.050%) | 97.000% (±0.000%) | PASS |
| auto cash-out x10 | 9.696% | 96.963% (±0.148%) | 97.000% (±0.000%) | PASS |
| auto cash-out x100 | 0.966% | 96.572% (±0.489%) | 97.000% (±0.000%) | PASS |
| cash out at 2s | 66.450% | 97.006% (±0.034%) | 96.998% (±0.000%) | PASS |
| cash out at 5s | 22.434% | 97.036% (±0.090%) | 96.999% (±0.000%) | PASS |
| cash out at 10s | 0.917% | 96.642% (±0.503%) | 97.000% (±0.000%) | PASS |
| cash out right after first setback | 0.010% | 97.500% (±4.937%) | 97.000% (±0.000%) | PASS |
| never cash out (caps only) | 0.010% | 97.500% (±4.937%) | 97.000% (±0.000%) | PASS |
