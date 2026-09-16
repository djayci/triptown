---
name: new-game-concept
description: Take a new Triptown game from a loose idea to a compliant, specced concept. Use when the user wants to brainstorm a new game, explore a mechanic, pitch game #N, work up a theme or market idea, or turn a rough concept into something buildable. Runs mechanics brainstorming, an OpenSpec explore pass, a concept-stage compliance gate and a design canvas, and ends with an OpenSpec proposal.
---

# New game concept

Take a new game from "what if" to a concept that is worth building: mechanics that hold up as a martingale, art and copy that clear the regulators, a design canvas the user can push pixels around in, and an OpenSpec change ready to implement.

The order matters. Compliance runs **before** the canvas and the proposal, because the cheapest time to kill a mechanic is while it is still a sentence. Whack Crash and Night Meet both had to be reshaped after the audit; do that work up front instead.

## Before anything

Read, in this order, and do not ask the user for what is in them:

1. `AGENTS.md` — hard rules, compliance rules, layout, the settled decisions.
2. `docs/compliance/` — the most recent audits. Their critical fixes are the starting constraints for any new game, not findings to rediscover.
3. `openspec/changes/` — `compliance-baseline` for the shared fixes, and the newest game change for the shape of a finished spec.

Then settle three things with the user (ask only what you cannot infer):

- **The seed:** a theme, a mechanic, a market, a name, or just a feeling.
- **Target markets.** This drives everything downstream: Portugal kills setbacks, Lagos needs its own lab, Ghana pre-approves ads. If unnamed, assume the markets in `.claude/skills/game-compliance-audit/references/jurisdictions.md` and say so.
- **How far this session goes.** Default is all five phases. The user may want only a brainstorm, or may arrive with mechanics already settled and want to start at phase 3.

## Phase 1 — Mechanics brainstorm

Diverge first. Produce **three to five distinct concepts**, not one concept with variations. Each gets a short block:

```
NAME          one line of fantasy: what the player thinks is happening
RISE          what makes the number go up, and what the player sees rise
CRASH         what ends the round, and why it reads as sudden and fair
DECISION      the one thing the player does (the cash-out verb)
TWIST         one mechanic that is not in Whack Crash
MARKET        who this is for, and why it lands there
```

Pull the twist from a real axis, not decoration. The axes that exist in this codebase: **setbacks** (a value that can fall), **splits** (several bets in one cycle, Night Meet's two slips), **auto collect thresholds**, **round length and pacing**, **what the multiplier is attached to**. A twist that only changes the art is a skin, not a concept — say so and keep it as a skin option.

Then converge. For every concept, check these before the user gets attached:

- **Is the payout still a martingale?** Growth `G(t)`, hazard depending only on elapsed time, RTP invariant across strategies (hard rule 2). If a twist gives a clever player an edge, it is dead. Say exactly where the edge comes from.
- **Does it need new fairness math, or does it reuse `packages/fairness`?** New crash sampling means a fresh `simulate` run and a new report before anything ships.
- **Does it read as skill?** Reflex, timing on a visual cue, anything that looks interactive but is not (AGENTS compliance rule 5).
- **Is it a casino game, not a sport or a race?** Night Meet fix 3. A racing or match fantasy risks being classed as virtual sports, which is a different licence.
- **Does anything celebrate a return at or below stake?** Per-partial-cash-out celebration is the usual trap (compliance rules 1 and 11).

Recommend one. Give the reason in a sentence, and name the runner-up and what would make it win instead. Get the user's pick before phase 2.

## Phase 2 — Explore

Invoke the **`opsx:explore`** skill on the chosen concept.

Explore is for thinking, not writing. Use it to ground the concept in the code that already exists: what `core`, `fairness`, `engine` and `rgs-client` already give this game for free, what is genuinely new, where the round state machine changes shape, what the API has to carry. Surface the hidden complexity — new event types, new settlement paths, anything that touches money.

Come out of it with:

- the round lifecycle as states and events, drawn;
- the list of shared-package changes, separated into "reuse", "extend", "new";
- the config flags this game needs (per hard rule / compliance rule 8, per-market differences are flags, never forks);
- the open questions, named and left open.

Do not let explore write the change yet. The compliance gate can still move the mechanics.

## Phase 3 — Compliance gate

Invoke the **`game-compliance-audit`** skill, concept-stage. There is no code, so tell it so: the inputs are the phase 1 concept, the phase 2 lifecycle and flags, and the shared packages this game will reuse. `docs/compliance/night-meet-2026-09-16.md` is the model for a concept-stage report.

What is different from a code audit:

- Evidence is the concept and the shared-package code it will reuse, not this game's files. Say plainly that facts about the new game are design intent, not verified behaviour.
- Run the checklist sections that a concept can answer: **A** (math and RTP), **D** (game design and player protection), **E** (information), **F** (art, audio and marketing), **H** (licensing and certification). Sections **B**, **C** and **G** inherit from the platform audits — cite them, don't redo them.
- Research the target markets properly, in parallel agents, using `references/research-prompts.md`. A new market means new primary texts; never carry a jurisdiction over on memory.
- The report is `docs/compliance/<game>-<YYYY-MM-DD>.md`.

Then **feed the findings back into the concept** before drawing anything. Name what changed: mechanics dropped or flagged off per market, words that have to change (racing and sportsbook vocabulary, "skill", "win"), art direction constraints, and the flags the report adds. If a critical fix kills the concept, say so and go back to phase 1's runner-up — that is a good outcome, not a failure.

## Phase 4 — Design canvas

Invoke the **`design`** skill to draft the game as artboards on one canvas.

Cover the round states as separate artboards, at minimum: pre-bet with rules access, betting, running, the twist state (setback, split, whatever phase 1 chose), cashed out, crashed, and the at-or-below-stake return — that last one is a compliance artboard and is the one people forget.

Carry the constraints in, don't rediscover them:

- Art direction per `AGENTS.md`. Candy Arcade Pop is the house style but is a minors-appeal risk; for regulated markets draw the adult skin. Adults with age cues and work gear, no cute animals, no runner-game look (compliance rules 6 and 10).
- Always visible: session clock, net position, rules entry before any bet.
- Copy is regulated. No skill language, no near-miss, no "would have reached", no celebration at or below stake. Draft the real rules text on an artboard — RTP and how it is derived, max win, caps, minimum cash-out, disconnect and latency, rounding, and that tapping does nothing.
- Check the layouts at 390×844 and 1440×900.

Give the user the canvas URL and let them refine it. Their edits are input to phase 5.

## Phase 5 — Propose

Invoke the **`opsx:propose`** skill to create the OpenSpec change.

It must carry, and cite, everything the earlier phases settled:

- **`design.md`:** the decisions, numbered like `whack-crash-mvp`'s D1–D10, each with the reason. Every compliance-driven decision cites the report and its section.
- **`specs/*/spec.md`:** requirements, including the compliance ones as testable requirements — cycle gap, celebration threshold, rules availability, recall records.
- **`tasks.md`:** each task with its verify step. Fairness math tasks verify with a committed `simulate` report at 97% ± 0.1% across strategies; timing tasks verify with an automated test, never a stopwatch.
- The jurisdiction profile flags as a named part of the change.
- The open questions from phases 2 and 3, listed as open, with who decides.

Finish by updating project memory: add the game to `AGENTS.md` if it changes shared structure, and write a `project` memory for the concept (name, mechanic, markets, report date, canvas URL, change id) linked to the existing game memories.

## Rules for this skill

- **Compliance before pixels, pixels before specs.** Reordering wastes the expensive work.
- **One phase at a time, with the user's pick between phases.** Do not run all five in one pass and present a finished game.
- **Shared packages must never depend on one game.** If a concept needs a game-specific hook in `core` or `fairness`, that is a design smell — find the general shape or put it in the app.
- **Every "we could" gets a rule check.** The interesting ideas are usually the illegal ones, and it is faster to say why than to discover it in phase 3.
- **Don't quietly diverge from settled decisions.** A new game that wants different math raises it through OpenSpec.
- **Nothing here is legal advice.** The report says so; so should you.
