## Why

The 15 Sep 2026 audit (`docs/compliance/whack-crash-2026-09-15.md`) found that Whack Crash cannot be certified by a test lab or supplied to regulated operators as currently built. The concept is allowed in most markets. The implementation is not. It celebrates losses, has no minimum time between rounds, shows no rules and keeps no round history, lets the multiplier fall below x1.00, uses child-appealing art, has no player-protection hooks, and misses the platform integrity controls labs check. These blockers apply to every game Triptown will ship, so they need to be fixed once in shared code, before submission and before Paper Route repeats them.

## What Changes

- **Jurisdiction profiles.** The server holds a named profile for each market or operator. It controls:
  - game pacing (`minCycleMs`, `quickReplay`);
  - math variant (`setbacksMode: 'off' | 'halve'`, `maxMultiplier`, `minCashout`);
  - presentation (`skin`, `soundDefault`, `intensityEffects`, `showRtpInGame`, `language`);
  - player protection (`showSessionClock`, `showNetPosition`, `idlePromptMs`);
  - `disconnectPolicy`.

  Regulated profiles (UK, Ontario, Brazil, Portugal-ready) use a pure rising crash with no setbacks. Light profiles keep the halving bad mole. Each math variant gets its own game config id and its own RTP report.
- **No celebration at or below stake, in every profile.** A return at or below the stake shows a neutral result with the net amount. There is no confetti, win sound or "+" label. The live value reads "RETURN NOW" until it goes above the stake. **BREAKING** for the current result screen.
- **Minimum game cycle enforced by the server.** The API rejects a new bet until the profile's `minCycleMs` has passed since the previous round started. The player must release and press again. The client shows a countdown. The one-tap "BET AGAIN (same bet)" button is removed when `quickReplay` is false.
- **Rules and help screen** available before any bet. It is generated from the active config and profile: growth, setbacks (when on), instant bust, RTP, max win and caps, minimum cash-out, auto cash-out, rounding, server-time and latency policy, disconnect policy, provably-fair steps, and a statement that the outcome is fixed and tapping decorations does nothing. It also shows the version and build id.
- **Round history and recall.** An in-game history view shows the last rounds. Each entry has time, stake, balance before and after, result, net, crash point, setbacks and cash-out time. Also a per-session history API with a CSV export for operators and support.
- **Player protection and operator bridge.** A session clock and net position display, controlled by the profile. A reality-check pause that blocks new bets but lets a running round finish. An idle prompt. A versioned postMessage bridge with a pinned operator origin, replacing the current broadcast to `'*'`.
- **No illusion of skill.** Decoy moles are purely decorative and cannot be tapped. Copy is neutral (no "whack before it dives"). The FRENZY meter is renamed. The crash point is not shown on the cash-out result screen; it stays in history and the fairness panel.
- **Latency and disconnect handling.** Rules disclose the policy. Cash-out requests carry the client tap time and measured round-trip time, which are logged as evidence only. A `disconnectPolicy` of `lose` or `cashout-at-disconnect` is available (Portugal R41–43). System failures void and refund the stake.
- **Adult art skin.** A second skin with muted colours, non-mascot moles and no candy motifs, selected per profile. Candy stays for light profiles.
- **Platform hardening for labs:**
  - server-side outcome hashing through `node:crypto`/WebCrypto;
  - automatic server seed rotation;
  - seeds encrypted at rest;
  - one time authority for settlement;
  - an append-only, hash-chained audit log;
  - a SHA-256 build manifest with an integrity endpoint and a daily self-check;
  - a one-active-round lock per player, not just per session;
  - a kill switch per game, config and profile.

## Capabilities

### New Capabilities
- `jurisdiction-profiles`: named, server-authoritative per-market profiles. Covers their fields and validation, how a session gets its profile, math variants per `setbacksMode` with separate config ids and RTP reports, `maxMultiplier` and `minCashout` enforcement, and a kill switch.
- `responsible-play`: player-facing protections. Covers no celebration at or below stake with net display, minimum cycle time with fresh press, quick replay rules, session clock, net position, reality-check pause, idle prompt, intensity and sound defaults, no illusion of skill, crash point placement, and skin selection.
- `game-information`: rules/help before betting generated from config and profile, RTP and max-win display, latency and disconnect disclosure, version and build id, localisation hooks.
- `game-recall`: per-round history records, the in-game history view, the operator history API and CSV export, required fields and retention.
- `operator-bridge`: versioned postMessage protocol between game and operator page, with pinned origin, inbound pause/resume/close/limits/message, outbound lifecycle and round events.
- `platform-integrity`: lab-facing controls. Covers server crypto, automatic seed rotation, encrypted seed storage, time authority, audit log, build manifest and integrity self-check, per-player round lock, tap-time and RTT evidence logging, disconnect policies, and system-failure void and refund.

### Modified Capabilities
None registered. `round-engine`, `provably-fair` and `whack-game-client` still live in the unarchived `whack-crash-mvp` change. Where this change supersedes their behaviour, that is noted in `design.md`:
- win result presentation;
- setbacks being optional;
- seed rotation no longer only on player request;
- the one-active-round lock scope.

The deltas will be reconciled once `whack-crash-mvp` is archived.

## Impact

- **Code:**
  - `packages/fairness`: rising config variant, seed handling.
  - `packages/core`: profiles, cycle gate, min cash-out, recall records, void and refund, per-player lock, time source.
  - `packages/rgs-client`: service additions, mock parity, shared suite.
  - `packages/engine`: bridge, skin plumbing.
  - `apps/api`: profile resolution, new endpoints, audit log, integrity, encryption, crons.
  - `apps/whack`: result states, rules, history, clock/net, countdown, adult skin, decoys, copy.
  - `apps/sandbox`: bridge and profile picker.
- **Compatibility:** must stay compatible with the in-flight `paper-route-mvp` change, which adds `papers` to `GameConfig` and multi-cash-out rounds. Profiles and recall are game-agnostic, and nothing assumes N = 1.
- **New config and secrets:** `SEED_ENCRYPTION_KEY`, `OPERATOR_ORIGINS` / per-profile origins, `DEFAULT_PROFILE`, a Vercel cron for the daily integrity check.
- **Out of scope:**
  - licences, company registration, lab contracts and legal review;
  - hosting relocation and EU/Brazil/Kenya regions;
  - ISO 27001 certification;
  - real operator wallet integration;
  - the full Portugal profile (two-axis graph, Portuguese copy, 100× cap tuning), planned as a follow-up;
  - final adult art from an illustrator; this change ships placeholder vector art.
