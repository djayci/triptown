## Why

For Nigeria and Ghana the user wants the horse game to play like this: there is no visible gate while the horse is out, and at any moment the player can turn for home and find the yard gate open or shut. A fixed 50/50 at that moment was rejected (17 Sep 2026): it breaks the equal-return-for-every-strategy rule and GLI-19 §4.8.5.

The version that holds up is **Gate Rush**. The value climbs with a live "gate open" chance of RTP ÷ value. IN! turns the horse for home, and the gate is revealed open (win stake × value) or shut (stake lost).

On the certified rising-only crash engine, the chance a round is still running at value *m* is exactly RTP ÷ *m* (`packages/fairness/src/model.ts`, P(T > t) = RTP / E[m(t)]). A 2M-round check gave 48.52% at x2.00 against 48.50% expected. So Gate Rush needs no new maths: it is the same round with the crash revealed when the player goes in, not when it happens, and the exact odds on screen.

What changes is observable server behaviour (when the loss becomes known), and that is a rules change a lab has to certify. Designs: page "Gate Rush (Africa)" on https://claude.ai/artifact/Ridsu7Z6oEvNYbwP3ufCsi

## What Changes

- **Deferred crash reveal in the round engine.** A round played in deferred mode keeps its crash time secret past the crash, until the reveal. The reveal happens at:
  - the player's cash-out;
  - the auto cash-out target;
  - the max win cap or max duration;
  - the disconnect settlement.

  The round is settled lost or won by comparing the reveal time with the crash time. Nothing observable changes at the hidden crash time: the stream, the balance, history, recall and the operator bridge stay silent. **BREAKING** (behaviour, opt-in only): a cash-out after the crash time is settled as a revealed loss instead of being rejected.
- **Opt-in by game and by market, never a fork.**
  - A game registration declares whether it supports deferred reveal.
  - A jurisdiction profile's `crashReveal` flag (`live` default, or `onCollect`) turns it on.
  - Deferred reveal is refused on any configuration with setbacks or boosts, because only then is the odds formula exact.
  - `ng-draft` and `gh-draft` enable it; no other profile does.
- **Gate Rush presentation in `apps/gate`.**
  - While out: no gate; the value, the payout if the gate is open, and the live odds bar.
  - On IN!: the value locks and the horse turns for home.
  - Then the reveal: gate open (celebrated only above the stake) or gate shut (horse stopped calmly out in the field).
  - Rules include the full odds table.

  Under a `live` profile the same app still plays Beat the Gate.
- **Shared client support in `@triptown/crash-client`:** an odds line and a "heading home" state between the press and the settlement. The celebration rule stays in the base.
- **Evidence:** a committed test pinning the odds display to the engine's survival probability, and a presentation check that nothing reveals the outcome before settlement.

Out of scope:
- any change to growth, hazard, RTP, rounding or config ids;
- live-reveal markets (Beat the Gate stays as specified in `beat-the-gate-mvp`);
- optional double-or-nothing features.

## Capabilities

### New Capabilities
- `gate-odds-client`: how the horse game presents a deferred-reveal round, covering:
  - the live odds and their exactness;
  - the locked "heading home" state;
  - an open or shut reveal that cannot read as a near miss;
  - recall that never shows the hidden crash value;
  - the odds table before betting.

### Modified Capabilities
- `round-engine`:
  - "Crash ends the round" and "Cash-out settles at server receive time" gain the deferred-reveal behaviour;
  - a new requirement makes deferred reveal opt-in by game and market, and restricts it to configurations without setbacks or boosts.

## Impact

- **Packages:**
  - `core`: RoundHost settlement and stream, profile flag and validation, game registry option;
  - `rgs-client`: shared service suite cases for deferred rounds, mock and remote;
  - `crash-client`: odds line, heading-home state, controller handling;
  - `fairness`: an odds-exactness test only, no config or report changes.
- **Apps:**
  - `apps/api`: stream, cash-out and history routes honour the reveal;
  - `apps/gate`: Gate Rush scene, words and rules.
- **Certification:** RNG and maths unchanged; the committed rising-config reports apply. The reveal rules are new, so the game version needs its own certificate. Lagos certifies each version anyway (Lagos Law 2021 s.59; LSLGA homologation notice, Jul 2026).
- **Markets:**
  - Nigeria and Ghana only. Deferred reveal is likely incompatible with Brazil 1.207 item 14(d)(iv) (a crash ends the game) and AGCO 2.15 (no unachievable amounts displayed), so no profile for those markets may enable it.
  - A concept-stage compliance addendum gates the build.
- **Coordination:** `core` and `crash-client` are owned by the `the-lift-mvp` / `compliance-baseline` sessions. The order of edits is agreed first (task 1.1).
