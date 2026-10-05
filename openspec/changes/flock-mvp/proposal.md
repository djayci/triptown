## Why

Game #4 started as Drove: a ram running through a cattle drive at dusk. On 4 Oct 2026 the user replaced the cattle with a flock. The ram starts almost alone, rams join the run as the value climbs, and a wolf ends it. This makes the multiplier visible as something the player can see grow. It plays on the already-certified Whack Crash engine, so the work is art, motion, words and audio, not maths.

**The premise:** "Run with the flock. Cash out before the wolf comes."
- BET starts the run. Your ram sets off almost alone.
- As the value climbs, rams catch up from behind and fall in beside him. A handful run with him by x1.5, a crowd by x3, and the flock reaches the horizon past x10.
- **CASH OUT** cashes out, and the flock pulls up with him.
- The wolf appears only at the crash. The flock bolts and the stake is lost. No ram is taken.

**Designs:** approved 4 Oct 2026 on the "Flock — rams join" page of https://claude.ai/artifact/YNuJp8cLRw7sAVo89cMtMh. The "Drove — cattle" page is the superseded direction.

## What Changes

- **A new game on the existing engine.** `registerGame('flock', 'whack-crash')`.
  - The Nigeria and Ghana drafts play `whack-crash/v3-rising`. The unregulated `light` test profile plays `whack-crash/v4` (setbacks and boosts); a boost shows as a few more rams joining.
  - Both already have committed RTP reports and bands. There is no new config id, report or lab family.
  - Deferred reveal is not registered.
- **`apps/flock`** (`@triptown/flock`): a skin on `@triptown/crash-client`.
  - It extends `CrashScreen` and supplies a `FlockStage`, its words and a couple of scene cues.
  - It has no layout or compliance logic of its own.
- **Presentation:**
  - a dusk field at eye level;
  - an adult ram as the player, picked out by a lighter fleece and his own clear lane;
  - a flock whose size is a pure function of the multiplier on screen, joining near him first and then out to the horizon;
  - a camera that runs with the flock, at a pace drawn from the round's elapsed time;
  - on collect, the flock pulls up;
  - on a crash, a wolf steps in ahead and the flock bolts.
  - Under a setbacks profile, half the flock splits off as the value halves.
- **Words:**
  - the cash-out button reads CASH OUT, and CASHED OUT once settled;
  - the crash title is WOLF;
  - after a crash the button reads RUN OVER;
  - the working wordmark is FLOCK.
- **Audio and music of Flock's own**, synthesized in `apps/flock/scripts/synth.mjs`:
  - hoof rhythm and music that follow the multiplier;
  - sounds for a ram joining, the pen, and the wolf and scatter;
  - a win sound only on a winning result.

  It shares no files, synth code or music with any other game, and the shared player in `packages/engine` is not modified.
- **Design sources move into the repo** under `design/flock/`. They are the canvas scene code and the board generators, kept as the art reference.
- **The studio site** gets an `in-development` catalogue entry with a tile in the Flock palette, so the game stays off the live site until the user flips it.

Out of scope:
- any change to growth, hazard, setbacks, boosts, RTP or settlement;
- boosts, which need their own lab acceptance;
- deferred reveal;
- split stakes;
- a ram counter that could stand in for the multiplier;
- changes to `crash-client`, `engine` or another game's files beyond what a skin consumes.

## Capabilities

### New Capabilities
- `flock-game-client`: how Flock presents a crash round, covering:
  - the states and what each shows;
  - how the flock and the pace show the multiplier without revealing the outcome;
  - the pen and wolf sequences, which cannot read as a near miss or show harm;
  - the setback split;
  - adult art and vocabulary;
  - Flock's own audio;
  - what a player can reach before betting.

### Modified Capabilities
<!-- none: the round engine, fairness and site requirements are unchanged; Flock plays existing configurations and joins the site as a catalogue entry -->

## Impact

- **Packages:** `core`, `fairness`, `rgs-client`, `crash-client` and `engine` are consumed, not changed.
- **Apps:**
  - `apps/flock` is added;
  - `apps/api` registers `flock` beside the other skins;
  - `apps/site` gets a catalogue entry, tile theme and a `build:demo` hook while `in-development`.
- **RTP:** none. No report changes.
- **Compliance** (target markets Nigeria, Ghana and Kenya, user decision 4 Oct 2026):
  - The concept audit `docs/compliance/flock-2026-10-04.md` found no rule on sheep, rams or wolves in any of the three markets.
  - Its fixes are folded in: life-like, non-cartoon art (GH, KE cartoon bans); no ram fights and no sacrifice or festival cues (Lagos reg 7(1)(t)); no toughness framing (reg 7(1)(q)); public assets only after advert vetting.
  - Setbacks stay off wherever a profile sets `setbacksMode: 'off'`.
- **Audio:** new files under `apps/flock/public/assets/audio/` only. `git status` on other apps' audio and on `packages/engine` must stay clean.
