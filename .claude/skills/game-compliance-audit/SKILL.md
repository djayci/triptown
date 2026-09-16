---
name: game-compliance-audit
description: Audit a real-money casino/crash game in this repo for certification and licensing compliance (test-lab standards like GLI-19, UKGC RTS, MGA, Portugal SRIJ, Brazil SPA, Ontario AGCO, Kenya GRA, EU and other markets). Use when the user asks to audit, check compliance, prepare for certification or a test lab, check whether a game can be licensed or sold in a jurisdiction, or review a new game's math, RNG, UX or art for regulatory risk. Produces a dated report in docs/compliance/ with PASS/GAP/RISK findings, file:line evidence, sources and a ranked fix list.
---

# Game compliance audit

Audit one game against the lab standards and jurisdiction rules operators and regulators will check it against. The result is a dated report and updated project memory. This is research support, not legal advice. Every report must say so and name the items to confirm with counsel or the lab.

## Inputs to settle first (ask only if unclear)

1. **Which game:** its app folder (e.g. `apps/whack`) and its spec change (`openspec/changes/<change>/`).
2. **Target markets:** the default is every jurisdiction in `references/jurisdictions.md`. If the user names markets, audit those in depth and the rest briefly.
3. **Depth:**
   - **quick:** checklist and the existing jurisdiction notes, no new web research.
   - **full** (default): checklist plus fresh research for any jurisdiction note older than 90 days, and every item on the watch list.

## Workflow

### 1. Build the game fact sheet (from code, not memory)
Read the spec (`design.md`, `specs/*`) and the code. Fill `references/fact-sheet-template.md`. Every fact needs a `file:line`. Cover:
- **Math:** growth, crash sampling, setbacks or modifiers, RTP, max win, caps, minimum cash-out, rounding. Can the multiplier fall? Can a cash-out return less than the stake?
- **RNG:** entropy source, seeding, derivation, mapping to outcomes, whether crypto is platform or hand-written, float determinism, seed storage and rotation.
- **Settlement:** timing authority, latency handling, disconnect, refunds, idempotency, locking (per session or per player).
- **UX:** round length (run the simulator or compute median and percentiles), replay flow and input guards, autoplay or auto cash-out, win and loss presentation (effects, sounds, "+" labels), skill-like framing, interactive decorations, intensity or speed features.
- **Information:** rules/help, RTP display, history/replay, clock, net position, reality check, responsible-gambling links, language.
- **Art and audio:** how much a child might find it appealing (cartoon, candy, mascots), sound defaults.
- **Platform:** hosting provider and region, data stores, logs, integrity checks, environments, change control, operator bridge (postMessage target origin).

### 2. Refresh the rules (full depth)
- Open `references/jurisdictions.md`. Note each jurisdiction's `verified` date and the **Watch list**.
- For stale or missing jurisdictions and all watch-list items, spawn parallel research agents (one message, several Agent calls), using `references/research-prompts.md` with the fact sheet pasted in.
- Agents must prefer primary texts and give URLs, sections and H/M/L confidence. They must never invent citations.
- While agents run, do step 3 locally. Don't duplicate their searches.

### 3. Run the checklist
Go through `references/checklist.md`. Mark every item **PASS / GAP / RISK / UNKNOWN / N/A**, with:
- evidence (`file:line`, or a command output such as simulator or timing test results);
- the requirement's source (standard and section);
- the concrete fix, preferably as a per-jurisdiction config flag.

Verify behaviour where it's cheap:
- Run the RTP simulator (e.g. `pnpm --filter @triptown/fairness simulate -- --rounds 10000000`).
- Measure cycle times with an automated browser script (`scripts/play.mjs`), never by eye. Stakelogic was fined for stopwatch testing.
- Grep production bundles for demo or mock code.

### 4. Write the report
- Use `references/report-template.md`. Save to `docs/compliance/<game>-<YYYY-MM-DD>.md`.
- Sections: verdict, ranked critical fixes, what passes, licensing and market table, recommended path, code evidence, not verified, sources.
- Keep every claim sourced and tagged H/M/L.
- Put downloaded primary texts in `docs/compliance/sources/` (git-ignored) and list them in its README.

### 5. Update project memory
- Update the **Compliance** section of `AGENTS.md`: latest report link, top open gaps, and new hard rules that came out of the audit.
- Update `references/jurisdictions.md` with any changed facts, each with a `verified: YYYY-MM-DD` date and source. Move settled watch-list items out of the watch list.
- If findings change settled design decisions (math, UX), propose an OpenSpec change (`/opsx:propose`). Don't edit specs silently.

## Rules for the audit

- **Report what the code does, not what the spec says it should.** Where they differ, flag it.
- **Separate the rule from its scope.** Many rules are written for "slots" but have since been extended to all casino games (UK RTS 14 since Jan 2025). Always check which games a rule covers and when it took effect.
- **Treat marketing surfaces as advertising:** lobby tiles, thumbnails, demos, trailers.
- **A test passing isn't compliance.** Timing, celebration and information rules must be seen working in the real client.
- **Never mark a jurisdiction ALLOWED from affiliate sites alone.** Use L confidence and add it to "not verified".
- **Keep it short for the reader:** ranked fixes first, detail below.
