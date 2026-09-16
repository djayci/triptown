# Evidence 2026-09-15

Automated browser checks, run in headless Chrome against the Paper Route demo client (Vite dev server, mock round service with the named profile). Real key presses and clicks, no stopwatch.

| File | Check | Result |
|---|---|---|
| `paper-route-timing-regulated-uk.json` | `apps/paper-route` `pnpm check:timing --profile regulated-uk --rounds 20` | PASS: min gap between round starts 5001 ms (limit 5000), 2–3 throws in most rounds, held Space started 0 rounds, server refused a start inside the cycle (`cycle_too_soon`) |
| `paper-route-timing-regulated-on.json` | same, `--profile regulated-on` | PASS: min gap 2501 ms (limit 2500) |
| `paper-route-presentation.json` | `pnpm check:presentation` for light, regulated-uk, regulated-on, regulated-br, pt-draft | PASS for all profiles (see below) |

Presentation check, for each profile:
- **Loss:** a forced instant bust. No win copy, no win sound.
- **Below stake** (profiles with papers): one paper thrown, then a wipeout. The result showed RETURNED 1.11 · NET −3.89 with no win copy and no win sound.
- **Setback** (light only): the splash sound played, and the result followed return against stake.
- **Win:** a throw, then all papers. The result card showed ROUND WON and the win sound played.
- **Live label:** every frame, WIN NOW showed only while banked plus riding value was above the stake.
- **Result card:** no multiplier, so no crash point.
- **Rising-only profiles:** no splash sound.

Not covered here:
- **pt-draft below stake:** with partial cash-out off and rising-only growth, a cash-out can't return less than the stake, because minCashout is 1.01.
- **Exactly-even totals:** covered by the unit test `allowsWinPresentation` (10.00 on a 10.00 stake), since min cash-out 1.01 makes them unreachable by play.

These checks ran against the dev build with the mock service. The preview deployment check is 10.4 and real phones are 10.5; neither is done yet.
