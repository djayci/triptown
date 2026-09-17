## 1. Gate

- [ ] 1.1 Write a marketing-stage compliance note for the site at `docs/compliance/games-showcase-site-<date>.md`, using the `game-compliance-audit` skill's `references/jurisdictions.md`. Cover the site as an advert: ARCON Act s.54/s.63, UK CAP 16.3.12 and the Oct 2025 under-18 guidance, AGCO 2.03, Brazil 1.231, free play as advertising, the 18+ gate, and direct `/play/` URLs that skip it. Verify the note exists and that any fix it requires is folded into groups 3–4 before the copy is final

## 2. Scaffold and catalogue

- [ ] 2.1 Create `@triptown/site` in `apps/site`: `package.json` with `dev` (port 5180), `build`, `preview`, `lint`, `typecheck` and `test`, plus `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts` and `src/style.css`, with `@triptown/core` only as a dev dependency. Verify `pnpm install` succeeds and `pnpm --filter @triptown/site typecheck lint` passes
- [ ] 2.2 Add `src/catalogue.ts` with the `Entry` type and the three entries from design D3: Whack Crash `live` on `regulated-uk`, Gate Rush `live` on `ng-draft` with `skin: 'adult'`, and The Cable Car `in-development`. Verify a colocated test asserts unique slugs, a non-empty name and pitch, and that no `in-development` entry is given a play URL by the helper that builds one
- [ ] 2.3 Add a `playUrl(entry)` helper that returns `play/<slug>/?<demoQuery>` for `live` entries and `null` otherwise. Verify unit tests cover query encoding and the `in-development` case

## 3. Page

- [ ] 3.1 Build the 18+ gate (design D5): the initial HTML holds only the header, the B2B statement and the gate. Confirming renders the cards, and declining shows an exit message. The answer is remembered in `localStorage` inside try/catch. Verify with a jsdom test that before confirmation the DOM has no element with an `href` containing `play/`, that a decline still has none, and that storage throwing on read and on write leaves the gate working
- [ ] 3.2 Render the game cards from the catalogue (design D8): tile with alt text, name, pitch, and either a Play link with the accessible name "Play <name> demo" or a "Coming soon" label with no link. Put the play-money, no-wagering and no-account statement above the cards. Verify with a jsdom test of card order, link names and the absence of links for `in-development` entries
- [ ] 3.3 Style the page in the studio-neutral dark look (D8), with a visible focus ring and a `prefers-reduced-motion` guard on any transition. Verify with `node scripts/shot.mjs` screenshots at 390x844 and 1440x900 under `docs/compliance/evidence/<date>/site/`, showing no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth` returned by the eval argument) and the play-money statement above the fold
- [ ] 3.4 Write the page copy and pitches under the constraints of the spec's "No promotional gambling claims" requirement and the note from 1.1. Verify the copy check in 4.2 passes on it

## 4. Build: assemble and check

- [ ] 4.1 Add a `build:demo` task to `turbo.json` (outputs `dist-demo/**`) and make `@triptown/site#build` depend on `@triptown/whack#build:demo`, `@triptown/gate#build:demo` and `@triptown/cable-car#build:demo`. Write `scripts/assemble-demos.mjs`, which copies each `live` entry's `apps/<app>/dist-demo/` to `dist/play/<slug>/`. Verify `pnpm turbo run build --filter=@triptown/site` produces `dist/play/whack/index.html` and `dist/play/gate/index.html`, and no `dist/play/cable-car/`
- [ ] 4.2 Write `scripts/check-site.mjs` (design D6): duplicate slugs, missing demo output, missing tile, non-adult effective skin (D4, including the gate app's forced-candy default) and banned wording (win promises, "easy money", "guaranteed", skill/reflex/timing claims, "up to xN" multiplier boasts, any RTP percentage). Run it as the last build step. Verify a fixture test makes the script fail once for each rule, with the entry or phrase named, and pass on the real catalogue
- [ ] 4.3 Confirm no production build or mock-free bundle is copied: the assembly reads only `dist-demo`. Verify `grep -rl "MockRoundService" apps/site/dist/play/*/assets` finds the mock in every assembled game (it is a demo), and that `pnpm --filter @triptown/whack build` still passes `check-no-mock.mjs` afterwards

## 5. Tiles and end-to-end

- [ ] 5.1 Write `scripts/capture-tiles.mjs` (design D7): preview the assembled `dist`, capture each `live` game's betting screen at its demo query, and write `public/tiles/<slug>.webp`. Commit the tiles. Verify each tile exists, is 16:9, and was captured with no result panel showing (the script asserts `__triptownView` reports the betting state before capturing)
- [ ] 5.2 Add a boot check to `check-site.mjs`, run by `pnpm --filter @triptown/site check:boot` against `vite preview`. For each `live` entry, open `/play/<slug>/?<demoQuery>` headless, wait for the betting screen, and assert that the DEMO label is present, that the skin the game loaded (its atlas request `atlas-adult`) is adult, that no request goes to a non-same-origin API, and that the landing page alone requested nothing under `/play/`. Verify it passes, and fails when Gate Rush's `skin: 'adult'` is temporarily removed from the catalogue
- [ ] 5.3 Keyboard check: with the gate confirmed, tab from the top and press Enter on the first Play link. Verify, in the same headless script, that focus order follows the catalogue and Enter lands on `/play/whack/`

## 6. Deploy and document

- [ ] 6.1 Add `apps/site/vercel.json` (design D9): build from the repo root through turbo, `outputDirectory: dist`, immutable caching on `/play/*/assets/*`, and `X-Robots-Tag: noindex` on `/play/*`. Verify `vercel build` locally produces `.vercel/output` with the header rules present in `config.json`
- [ ] 6.2 Create the Vercel project for `apps/site` (manual, needs the user) and deploy a preview. Verify the preview URL shows the gate, both live games boot on the adult skin from their Play links, and `curl -I <preview>/play/gate/` shows `x-robots-tag: noindex`. Record the URL here
- [ ] 6.3 Update `AGENTS.md`: add `apps/site` to the layout and its commands, and state that a new game becomes visible by adding a catalogue entry and a tile. Verify the text matches the implemented scripts
- [ ] 6.4 Run the gate for the touched packages. Verify `pnpm turbo run lint typecheck test --filter=@triptown/site` passes
