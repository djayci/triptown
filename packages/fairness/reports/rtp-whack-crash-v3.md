# RTP simulation: whack-crash/v3

- Rounds: 10,000,000 (seed 1), 44.2s
- Config: `{"id":"whack-crash/v3","rtp":0.97,"r0":0.06,"rmax":0.475,"tRamp":24,"lambda":0.06,"setbackFactor":0.5,"boostRate":0,"boostFactor":1.05,"maxWinMultiplier":10000,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 7.778 s, median 7.179 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0.06/s; boosts off
- Instant bust share: 2.996% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.684% | 97.025% (±0.023%) | 96.990% (±0.008%) | PASS |
| auto cash-out x2 | 48.500% | 97.000% (±0.032%) | 96.991% (±0.010%) | PASS |
| auto cash-out x10 | 9.690% | 96.897% (±0.094%) | 96.988% (±0.015%) | PASS |
| auto cash-out x100 | 0.972% | 97.243% (±0.310%) | 96.989% (±0.018%) | PASS |
| cash out at 2s | 88.251% | 97.019% (±0.013%) | 97.011% (±0.005%) | PASS |
| cash out at 5s | 67.277% | 97.019% (±0.024%) | 96.995% (±0.009%) | PASS |
| cash out at 10s | 30.259% | 96.970% (±0.052%) | 96.988% (±0.012%) | PASS |
| cash out right after first setback | 34.630% | 98.297% (±2.059%) | 96.984% (±0.021%) | PASS |
| never cash out (caps only) | 0.010% | 100.500% (±3.170%) | 96.986% (±0.023%) | PASS |
