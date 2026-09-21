## Why

`AGENTS.md` says a new game is a skin, not a product: it extends `CrashScreen`, supplies a stage and its words, and implements no layout and no compliance logic, so the presentation and timing rules "hold by construction rather than by each one remembering them." That is true of `apps/gate` (194 lines) and false of the flagship. `apps/whack/src/game/view.ts` (1223 lines) extends `CrashViewBase` and re-implements everything `CrashScreen` owns, so the repo carries **two parallel implementations of the same screen** — and `CrashScreen` is the copy, extracted from Whack for a later game and never applied back.

The fork is no longer theoretical. It has already cost behaviour in both directions:

- `fe11802` added the withholding-tax notice to `screen.ts` and added the strings to `apps/whack/src/i18n/en.ts:7-8`. Whack's view was never touched, so **Whack ships the string and never renders it** — `setDisclosures` has zero hits in `apps/whack/src`. Three more shared behaviours (`setAudioAvailable`, `setRevealOdds`, `showHeadingHome`) are likewise absent; all four are optional on the contract, so nothing fails.
- `controller.ts:713` passes an unsigned `net` (`Math.abs`). Whack's catalogue writes the minus sign back in; Gate's does not, so **Gate shows a below-stake return as "Net 0.50"** — the exact copy hard rule 1 requires to state the net result.
- Whack's `applyViewport` fixed a letterboxing bug that `screen.ts:269-273` still has, so Gate ships the bug Whack fixed.

Underneath the screen, ~450 lines of infrastructure are copy-pasted per game and have started to drift in four measurable places: Gate's `build` omits the signed release manifest both apps' `vite.config.ts` says a lab checks; Gate's `loadAtlas` omits the cache-bust that `engine/src/assets.ts:4-9` documents as silently serving a stale atlas; Gate's `lowpass` gained a loop-seam fix Whack's lacks; and the two apps' `t()` implementations disagree on a missing parameter (Whack renders `{build}`, Gate renders nothing) on a screen a lab reads.

Two of the shared client's own strings name one game's art: `history-panel.ts:143-144` and `fairness-panel.ts:133` label setbacks and boosts "Bad moles" / "Good moles", so **Gate Rush players read about moles** in their round history and in the provably-fair verification table. And none of the four DOM panels imports `theme.ts`, so an `adult`-skin build for Portugal, Kenya or Brazil still opens pink Lilita One dialogs for rules, history, fairness and the operator reality-check pause.

Each new game currently inherits a choice of which copy to fork. Game three makes this permanent.

## What Changes

Two commitments frame everything below. **No game's UI or mechanics change**, except the five corrections listed in "Divergences corrected" — which are the cases where a game is currently doing the wrong thing. And **no maths changes**: no growth, crash sampling, setbacks, boosts, config ids, RNG or settlement, so no `simulate` run and nothing to recertify.

- **`apps/whack` moves onto `CrashScreen`, pixel-identical.** `CrashScreen` first learns the two things that kept Whack off it: the desktop 1440×900 two-column layout, and Whack's elastic portrait fit (which fills the width rather than letterboxing to a fixed frame). Gate keeps its current portrait presentation unchanged. Whack's scene becomes a `GameStage`, so it receives the multiplier and nothing else. **BREAKING** for `CrashScreen` subclasses: new layout hooks and a stage-height seam.
- **One message catalogue.** `crash-client` gains `BASE_EN` covering the ~49 keys the shared client calls, with the 32 byte-identical values as defaults, and one `t()`. Each app keeps only its own words as overrides. Whack's 11 dead `error.*` keys are deleted.
- **One bootstrap.** `bootCrashGame()` and a shared `createRoundService()` / `demoBetMinor()` replace ~100 duplicated lines across both apps' `main.ts` and `services.ts`. The player-protection overlay copy — today hard-coded English in two places — moves into the catalogue. **BREAKING**: hard rule 7's mock-never-ships pattern becomes single-sourced rather than copy-pasted per game.
- **One build layer.** The two byte-identical build gates move to root `scripts/`; `vite.config.ts` and `tsconfig.json` become thin per-app files over a shared base; the atlas packer and the audio encoder become shared functions; the nine duplicated DSP primitives become a synth kit and the UI/particle sprites an art kit. Each game keeps its own sounds, its own shapes and its own atlas — only the encoders are shared.
- **Divergences corrected** (the only visible changes in this proposal):
  1. Gate states a below-stake return as a negative net, matching Whack.
  2. The shared history and fairness panels say "Setbacks" / "Boosts" through `t()`, so no game reads another game's vocabulary.
  3. The four DOM panels read `theme.ts`, so the `adult` skin reaches the rules, history, fairness and reality-check dialogs.
  4. Whack renders the withholding notice, the audio-availability state and the deferred-reveal disclosures it inherits but never showed.
  5. Gate's build emits the signed release manifest, and its atlas load carries the build hash.
- **The site's tile theme becomes data.** A catalogue entry carries its tile colours instead of naming a CSS class backed by four hand-written blocks in `globals.css`.
- **Out of scope, deliberately:** no change to the round model, the API, storage, config ids or any committed RTP report; no new game; no redesign of any screen; renaming the `'candy'` skin token (a `core` type change, worth its own change).

## Capabilities

### New Capabilities
- `crash-game-shell`: what every crash game gets from the shared client without implementing it — the screen layout and its viewport rules, the compliance behaviours that hold by construction, the single message catalogue and its per-game overrides, the single bootstrap, and the shared asset and build pipeline. This is the capability that makes "a game is a skin" checkable rather than aspirational.

### Modified Capabilities
- `whack-game-client`: Whack's presentation is supplied by the shared shell rather than implemented in the game, at identical appearance and behaviour; Whack gains the shared disclosures it was silently missing; the stale `BAD_MOLE` wording becomes `SETBACK`.
- `games-showcase-site`: a live entry carries its tile's colours as data, so adding a game touches no stylesheet.

## Impact

- **Packages:** `crash-client` (new `BASE_EN` + `t()`, `bootCrashGame`, desktop layout and stage seam on `CrashScreen`, themed DOM panels, de-moled panel strings); `engine` or a new sibling for the atlas packer, audio encoder, synth kit and art kit; `rgs-client` (shared `createRoundService`).
- **Apps:** `apps/whack` loses ~700 lines of view and gains a `GameStage`; `apps/gate` loses its bootstrap and build duplication; both lose their `vite.config.ts`, `tsconfig.json` and two build-gate scripts; `apps/site` gains tile data and loses four CSS blocks.
- **Compliance:** `presentation-check` and `timing-check` must pass for every active profile of both games, before and after, plus a new pixel-identity check for the Whack migration. The four corrections need recording in the audit trail — three of them change what a regulated build displays.
- **RTP and certification:** none. No config id, no maths, no settlement path is touched.
- **Root cause this closes:** a shared fix currently has to be applied twice or silently skips the flagship. After this change there is one screen, one catalogue, one bootstrap and one build.
