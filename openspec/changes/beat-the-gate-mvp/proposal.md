## Why

The horse game for Nigeria and Ghana was built as Fence Run, a step game with its own engine, and the user rejected it: the mechanic made no sense, the visuals were poor, and it was nothing like Whack Crash. Beat the Gate replaces it. It keeps the part that works in Whack Crash (one idea, one hero, one number, one button) and runs on the already-certified crash engine, so the new work is art and copy, not maths.

**The premise:** "Ride out. Get back in before the gate slams."
- BET opens the yard gate and the rider heads out.
- The value climbs while the horse laps the field.
- **IN!** rides the horse home and cashes out.
- If the gate slams while the horse is still out, the stake is lost.

**Designs:** the Floodlight Gold look, chosen on 17 Sep 2026. Canvas: https://claude.ai/artifact/Ridsu7Z6oEvNYbwP3ufCsi

## What Changes

- **A new game on the existing engine.** `registerGame('beat-the-gate', 'whack-crash')`. The game plays `whack-crash/v1-rising` and its capped variants, so the committed RTP reports already cover it. There is no new config id, no new report and no new lab family.
- **`apps/gate`**: a client that supplies the gate scene, art and copy on top of the shared `@triptown/crash-client` that `the-lift-mvp` is extracting. It adds no compliance logic of its own.
- **Presentation:**
  - a night track in the Floodlight Gold look;
  - an adult jockey on a realistic horse lapping the field in front of a fixed yard gate;
  - IN! rides home through the gate;
  - the crash slams the gate while the horse is well out in the field.
- **Market profile flags move here from `night-gallop-mvp`:**
  - blocked regions;
  - hosting region and transfer basis;
  - withholding notice;
  - live bets feed off;
  - `ng-draft` and `gh-draft`;
  - NGN and GHS.

  They are already implemented in `core`. This change carries their spec and ticks their tasks. The step-only flag `stepAbandonAfterMs` is removed.
- **BREAKING (internal):** Fence Run is shelved. `packages/steps`, `apps/gallop`, the step service in `rgs-client` and the `/v1/steps` API routes leave the working tree. They are kept on branch `shelf/fence-run` and in commit `10f3fa7`. The change `night-gallop-mvp` is withdrawn in favour of this one.

Out of scope:
- any change to growth, hazard, setbacks, boosts, RTP or settlement;
- boosts, which need their own lab acceptance before a regulated market;
- more than one bet per round;
- extracting the shared client, which `the-lift-mvp` owns.

## Capabilities

### New Capabilities
- `gate-game-client`: how Beat the Gate presents a crash round, covering:
  - the states and what each shows;
  - the fixed gate and lap loop that convey progress without revealing the outcome;
  - cash-out and crash sequences that cannot read as a near miss;
  - adult, harm-free art and vocabulary;
  - the information a player can reach before betting.
- `market-profile-flags`: jurisdiction flags any game can use for:
  - blocked regions, hosting and transfer basis;
  - withholding notices and the live bets feed;
  - the Nigeria and Ghana draft profiles and NGN/GHS currency rules.

  Moved unchanged from `night-gallop-mvp`.

### Modified Capabilities
<!-- none: the round engine and fairness requirements are unchanged; Beat the Gate plays an existing configuration -->

## Impact

- **Packages:**
  - `core` loses `stepAbandonAfterMs` from `JurisdictionProfile`;
  - `rgs-client` loses its step service exports;
  - `packages/steps` is removed;
  - `crash-client` is consumed, not changed;
  - `fairness` is untouched.
- **Apps:**
  - `apps/api` loses the `/v1/steps` routes and the step reconcile sweep; the region gate on `/v1/sessions` stays;
  - `apps/gallop` is removed;
  - `apps/gate` is added.
- **RTP:** none. No report changes, and none is needed.
- **Compliance:**
  - the market, data and advertising findings in `docs/compliance/night-meet-2026-09-16.md` still apply;
  - the step addendum and the Fence Run built-game audit move to the shelf branch;
  - a concept-stage check of the gate theme gates the art (task 3.1).
- **Depends on:** `the-lift-mvp` tasks 2.3 and 2.4 (shared controller and view) before `apps/gate` can play a round.
