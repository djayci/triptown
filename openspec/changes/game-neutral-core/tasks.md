## 1. Rename in `fairness`

- [x] 1.1 Rename `GameConfig.papers` to `stakeParts` and update `validateConfig`; verify `pnpm --filter @triptown/fairness test` passes with the existing vectors unchanged
- [x] 1.2 Remove the `PAPER_ROUTE_*` exports, add the retired-config table behind `resolveConfigId` (design D2), and move every consumer onto `resolveConfigId('paper-route/v1')`; verify a test resolves both retired ids to the parameters the archived reports used, and that neither appears in `GAME_CONFIGS`
- [x] 1.3 Drop the `--game paper-route` branch from `scripts/simulate-rtp.ts` in favour of `--config <id>`; verify `simulate -- --rounds 10000 --config whack-crash/v1-rising` still writes a report
- [x] 1.4 Confirm this change touched no growth, hazard or modifier code; verify `model.ts`, `round.ts` and `prng.ts` carry only `good-mole`'s edits and none of this change's — a plain `git diff` is not evidence, because `good-mole` recalibrated the hazard in the same files
- [x] 1.5 Make the simulator reject a misparsed argument instead of silently running the default config (unplanned; a forwarded bare `--` shifted every key and overwrote a committed report with a 1,000,000-round default run); verify the documented `simulate -- --rounds N --config <id>` form is honoured and a flag with no value throws

## 2. Rename in `core`

- [x] 2.1 Rename `BadMoleEvent`/`GoodMoleEvent` to `SetbackEvent`/`BoostEvent` (`BAD_MOLE` -> `SETBACK`, `GOOD_MOLE` -> `BOOST`), rename `setbackEvents()` to `modifierEvents()`, and sweep `describeRules`' boosts item and `apps/whack`'s `GOOD_MOLE` branch and `boostTimes` state; verify `pnpm --filter @triptown/core test` passes. Leave `boostsMode` and the `v1`/`v2` config ids alone (design D2)
- [x] 2.2 Rename the stake-part types and fields to the neutral names in design D4, keeping Redis key strings unchanged (design D5); verify the test files are renamed with them and their assertions are unchanged
- [x] 2.3 Change `PartialCashout` to `'off' | 'parts'` and rename the profile field; verify `profiles.test.ts` and `host-profiles.test.ts` pass
- [x] 2.4 Replace the `GameId` union with the open registry (design D1), keeping startup validation of unknown game ids, and drop `paper-route` from the default game list in `profiles.ts` so no profile binds to a retired game; verify a test registers a third game id, a second rejects an unregistered one, and profile validation still passes for every shipped profile
- [x] 2.5 Confirm `fairness` and `core` stayed pure; verify `pnpm --filter @triptown/core lint` passes with the import rules in `eslint.config.js` unweakened

## 3. Rename in `rgs-client` and the apps

- [x] 3.1 Rename the remaining part-model types and the `game?:` literal union in `remote.ts`; verify `pnpm --filter @triptown/rgs-client test` passes
- [x] 3.2 Follow the renames through `apps/whack` and `apps/api`; verify `pnpm turbo run typecheck` passes across the workspace
- [x] 3.3 Confirm the rename changed no behaviour; verify the shared suite in `rgs-client/testing/round-service-suite.ts` passes unchanged against both `MockRoundService` and `RemoteRoundService`

## 4. Closing checks

- [x] 4.1 Confirm no committed RTP report changed and none needs regenerating; verified — the three modified reports are `good-mole`'s 10M regenerations, and the only trace of this change is `stakeParts` inside their config line, which correctly records the config as it now is
- [x] 4.2 Confirm no mock markers leak; verify `pnpm --filter @triptown/whack build` passes `scripts/check-no-mock.mjs`
- [x] 4.3 Update `AGENTS.md` where it describes the shared packages' vocabulary; verify the described exports match `packages/*/src/index.ts`
- [x] 4.4 Run the full gate; verify `pnpm turbo run lint typecheck test` passes for every package
