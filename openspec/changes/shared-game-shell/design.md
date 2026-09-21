## Context

See `proposal.md` — Why. The structural facts that shape the approach:

- `CrashScreen` (`packages/crash-client/src/game/screen.ts`) is an abstract class over `CrashViewBase`. Its `layout()` is one method of hard-coded coordinates in a fixed 390×844 frame, and `fit()` is a four-line uniform min-scale. It already carries three per-game hooks with safe defaults (`resultCardTop`, `hideControlsInRound`, `demoBadgeUnderHistory`) plus `counterFor` and `hasAutoCashout`. That hook pattern is the seam to extend.
- `apps/whack/src/game/view.ts` is a sibling implementation: `extends CrashViewBase implements CrashView`. It owns two design frames, a phase-dependent relayout, a tweened stage height, text auto-shrink, an effects-layer lifecycle and a practice button — five things `CrashScreen` has no concept of.
- Whack's scene is not a `GameStage`. `apps/whack/src/ui/stage.ts` exposes a `content` container the *view* fills with holes and positions frame by frame. `GateStage` is the opposite: it owns everything inside itself and takes `setMultiplier`.
- `MockRoundService.forceNext` plus `?force=` already make a demo round deterministic, and `scripts/shot.mjs` / `scripts/play.mjs` already drive the real client in headless Chrome. That is the pixel-identity harness; it does not need building from scratch.
- `packages/crash-client/src/i18n.ts` is a translator *indirection* with no catalogue. Each app ships its own `EN` map and its own `t()`. The mechanism is right; only the catalogue is duplicated.

## Goals / Non-Goals

**Goals:**

- One screen, one catalogue, one bootstrap, one build — with the flagship on them, not beside them.
- Prove the Whack migration visually rather than assert it. A reviewer should be able to see that nothing moved.
- Make the four corrections in `proposal.md` separable from the refactor in the history, so a compliance reviewer can read them alone.

**Non-Goals:**

- Redesigning any screen, or "improving" a layout while moving it.
- Giving Gate the elastic fit or the desktop layout. Both are genuine improvements and both are visible changes; they belong to a later, deliberate change.
- Unifying the two games' scenes. A stage is a game's own art and stays that way.
- Renaming the `'candy'` skin token. It is a `core` type change with its own blast radius.

## Decisions

### D1. The new layout capabilities are opt-in, defaulting to today's behaviour

`CrashScreen` gains a declared presentation per game — fixed-frame portrait (today's behaviour and the default), elastic portrait, desktop — rather than changing its fit for everyone.

*Why:* the constraint is that no game's UI changes. Whack needs elastic portrait and desktop; Gate must keep letterboxed portrait. Making the new fits the default would silently restyle Gate the moment Whack's needs landed — the same class of accident this change exists to end. Declaring it puts the choice in the game, where a reviewer can see it.

*Alternative considered:* make elastic the default because it is better (Whack's own comment records why the letterbox was wrong). Rejected for this change and logged as a follow-up: it is a visible change to Gate and deserves its own before/after review, not a side effect.

### D2. Layout becomes a resolved frame plus placement, not a second `layout()`

`layout()` stops reading module constants `W`/`H` and reads a resolved frame (`width`, `height`, `mode`). Portrait placement keeps its current arithmetic verbatim with `W`/`H` substituted; desktop is a separate placement branch. Element *construction* is untouched.

*Why:* the risk in this migration is arithmetic drift — a control landing two pixels off. Keeping portrait's expressions character-for-character and only re-binding the two symbols makes the diff reviewable and makes "portrait is unchanged" checkable by reading, before any screenshot runs.

*Alternative considered:* a layout description object (a declarative list of elements and anchors) interpreted per mode. Cleaner in the abstract, but it rewrites every coordinate in the same commit that claims nothing moved. Rejected on reviewability.

### D3. The stage becomes a sized region with a declared height, and Whack's scene becomes a `GameStage`

`GameStage` gains an optional `resize(width, height)`. `CrashScreen` gains a `stageFrame()` hook returning the region the scene occupies, and animates changes to it when a game asks. Whack's `Stage`/`Hole`/`Meter` move behind a `WhackStage` that implements `GameStage` and owns the hole placement, the meter and the stage scaling that `view.ts:945-994` does today.

*Why:* Whack's view drives the scene from outside, which is what makes it 1223 lines. Inverting it is the migration. The `resize` seam is what lets a scene keep its own internal scale factor — `GateStage` already has exactly this in `u` — without the screen knowing anything about holes or fields.

### D4. The scene's disclosed inputs are named, not smuggled

Whack's stage spin speed is driven by `pace` — a function of elapsed round time — passed through `view.ts:403`. That is not an outcome leak: `pace` derives from the growth rate, not the crash time, and the same information is already on screen as the compliant SLOW/MEDIUM/FAST meter the game's spec requires. But it reaches the scene as an unnamed number through a contract that says "the only input: the current multiplier", which is how it escaped notice.

The fix is disclosure, not removal: `GameStage` takes `setIntensity(level)` alongside `setMultiplier`, documented as "the readout the player can already see". Whack passes the same value it renders in the meter.

*Why:* removing it would change Whack's animation — a visible change, and it would also contradict the game's own spec'd intensity meter. Naming it keeps the behaviour identical and makes the channel auditable, which is what the contract was actually for.

*Alternative considered:* derive spin speed from the multiplier instead. Rejected: it changes what the player sees after a setback, and the meter would then disagree with the scene.

### D5. Pixel-identity is proved by forced rounds at fixed states, with motion off

A `scripts/pixel-compare.mjs` harness drives the real client through `?force=` with `prefers-reduced-motion` forced on, screenshots a fixed list of named states at 390×844 and 1440×900, and compares against a baseline captured from `main` before the migration.

States: betting idle, betting with the stake stepped, round running at a fixed multiplier, a setback moment, a boost moment, cashed-out above stake, returned below stake, returned even, crashed, instant bust, the countdown, the demo badge, and each of the four dialogs. Both skins.

Reduced motion is on because it removes shake, tilt and confetti — the three things that are deliberately non-deterministic (`Math.random()` is allowed for cosmetic effects). A small per-pixel tolerance covers text rasterisation; any structural difference fails.

*Why:* "it looks the same" is the entire promise of this change, and it is the one claim a test can make directly. The harness is temporary scaffolding for the migration, not a permanent check — the permanent checks stay `presentation-check` and `timing-check`.

*Alternative considered:* rely on those two existing checks. Rejected: they read decisions (`celebrated`, `shakes`, gaps), not positions. They would pass with every control moved 40 px.

### D6. Corrections land as their own commits, before the refactor that would hide them

The five corrections are made first, each as a separate commit against today's code, each with its own before/after evidence. The refactor then moves code that is already correct.

*Why:* three of them change what a regulated build displays (Gate's negative net, the model words in the history and fairness panels, the adult skin reaching the dialogs). A compliance reviewer must be able to read those diffs without a 700-line move around them. It also means the pixel baseline is captured *after* the corrections, so the migration's diff is genuinely zero.

*Consequence:* Gate's pixel baseline is captured after correction 1 and 2, not before. The corrections are intentionally visible; the migration is not.

### D7. The catalogue ships defaults in `crash-client`; apps ship overrides

`crash-client` exports `BASE_EN` (every key the shared client looks up, with the 32 byte-identical values as defaults) and one `t()`/`makeCatalogue()`. An app composes `{ ...BASE_EN, ...ownWords }`.

The two `t()` implementations disagree on a missing parameter — Whack keeps `{build}`, Gate renders empty. **Whack's is correct and becomes the shared behaviour:** a missing parameter on a certification screen must be visible, not silently blank. This changes Gate's output only in a case that should never occur in a correct build, and a dev-mode warning is added alongside.

*Why a default catalogue rather than a required one:* a game that forgets a key today renders the raw key into a rules panel. Defaults make the failure mode "shared English" instead of `rules.voidRefund`.

### D8. New shared homes

- `packages/crash-client` — `BASE_EN`, `t()`, `bootCrashGame()`, the extended `CrashScreen`, themed DOM panels.
- `packages/rgs-client` — `createRoundService()` and `demoBetMinor()`, since that is where the mock and the remote already live and where hard rule 7's gate belongs.
- **New `packages/game-build`** — the atlas packer, the audio encoder and manifest writer, the synth kit (the nine duplicated DSP primitives) and the art kit (`svg()`, the icon set, the particle sprites). Node-only, no browser imports, used by app scripts.
- Root `scripts/` — `check-no-mock.mjs` and `check-audio-budget.mjs`, joining `release-manifest.mjs`.
- Root `vite.game.config.ts` and `tsconfig.game.json` — each app's file becomes a two-line extension.

*Why a new package rather than `engine`:* `engine` is browser Pixi helpers loaded at runtime; the build kit is Node tooling with `@resvg/resvg-js`, `pngjs` and `lamejs` behind it. Putting them together would pull build-only dependencies into every game bundle's dependency graph.

### D9. Each game keeps its own sounds and shapes, and that is enforced by what moves

Only the encoders and the signal-generation primitives move (`midi`, `buffer`, `add`, `env`, `expDecay`, `square`, `saw`, `lowpass`, `normalize`, `doubled`). Every voice, every sting, every melody and every figure stays in its game. Gate's loop-seam-safe `lowpass` is the version that moves, since it is strictly the better of the two.

*Why this line:* the project rule is that a game's audio is its own. A shared oscillator is not a shared sound any more than a shared `Graphics` is a shared drawing — but a shared `sfxWin` would be. The nine primitives are all currently byte-identical in both games, which is the evidence that they are infrastructure.

### D10. The site's tile becomes three colours on the catalogue entry

`Entry` gains `tile?: { ground: string; ray: string; ink: string }`, emitted as inline CSS custom properties by `LogoTile`, with one generic `.tile` rule. The existing per-game blocks in `globals.css` supply the initial values, so every tile renders identically.

*Why:* `accent` on the same type already proves the pattern. `globals.css:321-322` documents that these values are hand-copied from `crash-client/theme.ts` and `gate/stage.ts` — three synced copies, and the check at `checks.ts:38` already enforces that a live game has one.

## Risks / Trade-offs

- **The migration changes Whack's appearance somewhere the state list does not cover** → D5's state list is the contract; it is written into `tasks.md` and reviewed before the baseline is captured, not after. Any state a reviewer names gets added before the work starts, when adding one is free.
- **Text rasterises differently once Whack's `sharpenText` moves** → `sharpenText` (`view.ts:773-783`) re-rasterises `Text` at true on-screen scale and has no equivalent in `CrashScreen`. It moves into the shared screen as part of D2 rather than being dropped, and the tolerance in D5 is set low enough that losing it would fail.
- **A 700-line deletion hides a behaviour nobody listed** → Whack has zero tests today; all its safety is in `crash-client`'s tests, which it bypasses. Before deleting, the four optional contract members it lacks are implemented and the existing `presentation-check` and `timing-check` are run against every active Whack profile to capture a *pre*-migration baseline, so "it passed before" is a recorded fact rather than an assumption.
- **Desktop lands in `CrashScreen` and Gate picks it up by accident** → D1 makes it opt-in and adds a scenario asserting a game that declares neither is unaffected. Gate's pixel baseline is checked at 1440×900 too, so an accidental opt-in fails visibly.
- **Whack's stage inversion (D3) is the largest single step and cannot be partially landed** → it is sequenced last, after the shell can already host the rest of Whack's screen, so the stage is the only variable at that point.
- **Five corrections plus a large refactor is a long-lived branch** → D6's ordering means the corrections are independently shippable; if the migration stalls, the compliance fixes are already in.
- **`crash-client` gains a Node-facing sibling and the dependency direction blurs** → `packages/game-build` depends on nothing in the runtime packages and nothing depends on it at runtime; it is referenced only by app `scripts/`. The `fairness` ← `core` ← `rgs-client` ← app chain is untouched.

## Migration Plan

1. **Corrections** (D6), each its own commit with evidence: Gate's negative net; the model words in the history and fairness panels; the DOM panels reading `theme.ts`; Gate's release manifest and atlas cache-bust. Whack's missing disclosures come with step 4.
2. **Catalogue** (D7): `BASE_EN` and one `t()`; apps reduced to overrides; Whack's dead `error.*` keys deleted. No visible change.
3. **Build layer** (D8, D9): shared gates, config bases, atlas packer, audio encoder, synth kit, art kit. Verified by rebuilding both games' atlases and audio and confirming the outputs are byte-identical to the committed ones.
4. **Shell** (D1, D2): `CrashScreen` learns declared presentations, the resolved frame, desktop placement, the stage frame and `sharpenText`; Whack's four missing disclosures are implemented on it. Gate re-checked: unchanged.
5. **Bootstrap** (D8): `bootCrashGame()` and the shared round-service factory; overlay copy into the catalogue.
6. **Whack's stage** (D3, D4): `WhackStage` implements `GameStage`; the view's scene plumbing moves into it.
7. **Whack onto the shell**: `GameView extends CrashScreen`; the ~700 duplicated lines deleted.
8. **Site tile data** (D10).

Baseline for D5 is captured at the end of step 1. Steps 2–8 each re-run the comparison; the first step to move a pixel names itself.

**Rollback:** steps 1–3 and 8 are independent and individually revertible. Steps 4–7 are one unit for Whack: reverting step 7 restores the old view, which still compiles against the extended `CrashScreen` because D1 makes every addition opt-in. Gate is unaffected by steps 4–7 by construction and by check.

## Open Questions

- Whether Gate should later adopt the elastic portrait fit and the desktop layout. Deliberately deferred: both are visible changes to a shipped game and neither blocks anything here (D1).
- Whether `packages/game-build` should also absorb `scripts/shot.mjs` and `scripts/play.mjs`. They are dev helpers used from the repo root today and nothing in this change depends on where they live.
