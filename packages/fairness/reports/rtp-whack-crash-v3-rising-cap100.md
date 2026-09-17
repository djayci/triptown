# RTP simulation: whack-crash/v3-rising+cap100

- Rounds: 10,000,000 (seed 1), 25.4s
- Config: `{"id":"whack-crash/v3-rising+cap100","rtp":0.97,"r0":0.048,"rmax":0.38,"tRamp":30,"lambda":0,"setbackFactor":0.5,"boostRate":0,"boostFactor":1.05,"maxWinMultiplier":100,"tMax":60,"stakeParts":1}`
- Minimum cash-out: none
- Time strategy jitter: none
- Rounding: none (theoretical)
- Target RTP 97.000%, tolerance ±0.100%
- Round length: mean 8.313 s, median 7.458 s (first 200,000 rounds)
- Modifiers: setbacks x0.5 at 0/s; boosts off
- Instant bust share: 3.008% (±0.005% SE), target 3.000% ±0.05% → PASS

"Direct" counts a payout only when the stop beats the sampled crash time.
"Conditional" averages m(stop) × P(crash after stop) on the same paths, which removes crash-time noise.
PASS requires the conditional RTP within the tolerance and the direct RTP within 4 standard errors of the target.

| Strategy | Win rate | Direct RTP (± SE) | Conditional RTP (± SE) | Result |
|---|---|---|---|---|
| auto cash-out x1.5 | 64.656% | 96.984% (±0.023%) | 97.000% (±0.000%) | PASS |
| auto cash-out x2 | 48.492% | 96.983% (±0.032%) | 97.000% (±0.000%) | PASS |
| auto cash-out x10 | 9.701% | 97.008% (±0.094%) | 97.000% (±0.000%) | PASS |
| auto cash-out x100 | 0.973% | 97.327% (±0.310%) | 97.000% (±0.000%) | PASS |
| cash out at 2s | 86.195% | 97.004% (±0.012%) | 97.000% (±0.000%) | PASS |
| cash out at 5s | 66.440% | 96.993% (±0.022%) | 97.000% (±0.000%) | PASS |
| cash out at 10s | 34.506% | 96.977% (±0.042%) | 97.000% (±0.000%) | PASS |
| cash out right after first setback | 0.973% | 97.327% (±0.310%) | 97.000% (±0.000%) | PASS |
| never cash out (caps only) | 0.973% | 97.327% (±0.310%) | 97.000% (±0.000%) | PASS |
