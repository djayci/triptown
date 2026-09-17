## Context

See proposal.md for why. What exists today:

- Each game is its own Vite app with `base: './'` and a `build:demo` script (`--mode demo --outDir dist-demo`). `apps/whack` and `apps/gate` both have one; `apps/cable-car` has one but is still being built (`the-cable-car` tasks 1.x–4.x open).
- Demo builds choose their market and look from the query string, and they do it differently:
  - `apps/whack/src/services.ts`: `?profile=` picks a template, and the skin follows that profile (`light` is candy; `regulated-uk`, `regulated-on`, `regulated-br`, `ng-draft`, `gh-draft` and `pt-draft` are adult).
  - `apps/gate/src/services.ts`: defaults to `ng-draft` (Gate Rush) and **forces candy unless `?skin=adult`**, whatever the profile says.
  - `apps/cable-car/src/services.ts`: `?profile=`, with `allowOverride` and `playerRegion` so the draft profiles run.
- Every demo already draws a DEMO label (`label.demo` in each catalogue).
- `apps/sandbox` is a fake operator page with its own `vercel.json`; `apps/whack`, `apps/sandbox` and `apps/api` each deploy as separate Vercel projects.
- `scripts/shot.mjs` captures a headless-Chrome screenshot of any URL, at any size.

## Goals / Non-Goals

**Goals:**
- One URL someone can open to see every game and play the playable ones, on a phone.
- Compliance rules for the site hold because the build enforces them, not because someone remembered them.
- A new game costs one catalogue entry and one tile.

**Non-Goals:**
- Changing any game's demo behaviour to suit the site. If a game needs a new query parameter, that change goes through that game's own OpenSpec change.
- Embedding games in the site page (an iframe lobby). That is `apps/sandbox`'s job, and it would pull operator bridge concerns into a marketing page.
- A framework (React, Astro). One page with a list does not need one.

## Decisions

### D1. A new static app, `apps/site`, in plain TypeScript and CSS
Vite with `index.html`, `src/main.ts`, `src/catalogue.ts` and `src/style.css`, like `apps/sandbox`. There are no runtime dependencies beyond two self-hosted fonts through `@fontsource`.
*Alternatives:* extending `apps/sandbox`, rejected because it is a test harness for operator embedding and should stay one; a framework, rejected because it adds weight and nothing needs it.

### D2. One deployment: the site build assembles the demos under `/play/<slug>/`
`apps/site` gets a `build` of three steps: `vite build`, then `scripts/assemble-demos.mjs`, then `scripts/check-site.mjs`. The assembly step copies `apps/<app>/dist-demo/` to `apps/site/dist/play/<slug>/` for every `live` entry. Turbo gets a `build:demo` task (outputs `dist-demo/**`), and `@triptown/site#build` depends on the listed apps' `build:demo`. The game apps are not added as package dependencies of the site: the site imports nothing from them. The `base: './'` the games already use makes a sub-path work unchanged.
*Alternatives:* linking to separately deployed demo projects per game, rejected because every game would need its own Vercel project and URLs, and the site could link to a demo that is stale or missing with nothing to catch it; running the games' production builds, rejected because they need `VITE_API_URL` and would reach the real service.
This is a demo environment. It never shares a Vercel project with a production game build (hard rule 14: separate preview and production).

### D3. The catalogue is a typed array in the site app
```ts
type Entry = {
  slug: string;              // URL segment under /play/
  app: string;               // folder under apps/ whose dist-demo is copied
  name: string;
  pitch: string;             // one line, checked by the copy check
  status: 'live' | 'in-development';
  tile: string;              // file under apps/site/public/tiles/
  demoQuery: Record<string, string>;
};
```
The initial entries:
- **Whack Crash**: `app: 'whack'`, `demoQuery: { profile: 'regulated-uk' }`. The adult skin comes from the profile, and setbacks are off in that market.
- **Gate Rush**: `app: 'gate'`, `demoQuery: { profile: 'ng-draft', skin: 'adult' }`. The explicit `skin` is required, because this app forces candy without it.
- **The Cable Car**: `app: 'cable-car'`, `status: 'in-development'`, shown as coming soon. It becomes `live` once `the-cable-car` finishes, which is a one-line edit.

The catalogue names games, which is allowed: it is an app, and only shared packages must stay game-neutral.

### D4. The skin check reads the query and the profile together
`check-site.mjs` imports `profileFromTemplate` from `@triptown/core`, a pure package that is fine in a Node script, as a dev dependency of the site. For each entry, the effective skin is `demoQuery.skin` if present, otherwise the template's `skin`. The check fails if that skin is not `adult`. For `apps/gate`, a missing `skin` fails too, because that app ignores the profile's skin, so the checker keeps a small list of apps whose demo forces candy by default.
This is as close as a static check can get to reading what actually ran, and task 5.2 backs it with a boot check that reads the skin the running game actually loaded.
*Alternative:* trusting the query only, rejected because Whack's skin comes from the profile.

### D5. The 18+ gate is a client-side interstitial, and the games are not in the initial HTML
`index.html` holds only the header, the B2B statement and the gate. `main.ts` renders the cards only after the visitor confirms, so no tile or `/play/` link exists in the DOM before that. The answer is kept in `localStorage` in a try/catch. A declined answer is not stored, so the visitor is asked again next time.
This is an honesty gate, not age verification. It matches the B2B framing, and a demo with play money and no sign-up does not trigger the verification duties of a real-money account. Direct `/play/` URLs stay reachable, as operators share them. That is recorded as a risk.

### D6. Build checks, one script
`scripts/check-site.mjs` fails the build on any of:
- a duplicate slug;
- a `live` entry with no `dist/play/<slug>/index.html`;
- a missing tile;
- a non-adult effective skin (D4);
- a banned-wording match in `name`, `pitch` or the static copy of `index.html`.

The banned-wording list is kept in the script, and a fixture test proves it catches each category in the spec. `packages/crash-client/scripts/copy-check.mjs` is reused if its matcher can be imported. If not, the site gets its own list, because in-game copy rules and advert copy rules overlap but are not the same.

### D7. Tiles are captured from the real demo, adult skin, betting screen
`scripts/capture-tiles.mjs` in the site app runs `vite preview` over the assembled `dist`. It calls `scripts/shot.mjs` for each `live` entry at `/play/<slug>/?<demoQuery>` on the betting screen, and writes `public/tiles/<slug>.webp`, which is committed. The betting screen is used, never a win screen: a tile showing a big multiplier or a payout is a win promise.
An `in-development` game uses a neutral text-only card rather than concept art that has not been audited.

### D8. Visual direction: studio-neutral and dark, not a game skin
The site uses its own quiet look (charcoal ground, cream text, one brass accent, Bricolage Grotesque for text), in line with the adult skins. It does not use Candy Arcade Pop, which is a game's art direction and a minors-appeal risk in marketing. Every card has the same size and layout, with the tile at 16:9, the name, the pitch, and Play or Coming soon.

### D9. Deployment
`apps/site/vercel.json` builds with `pnpm turbo run build --filter=@triptown/site`, from the repo root, so the demo builds run first, with `outputDirectory: dist`. It sets immutable caching for `/play/*/assets/*` and adds `X-Robots-Tag: noindex` on `/play/*`, so search engines index the showcase and not the raw demos. Connecting the Vercel project is a manual step, and a task records it.

## Risks / Trade-offs

- [The site is an advert in Nigeria, and the studio carries ARCON liability] → A marketing-stage compliance note (task 1.1) comes before the page copy is final. No ad placement or promotion comes with this change.
- [Direct `/play/` URLs skip the 18+ gate] → They are play-money demos with DEMO labels. `noindex` keeps them out of search. The note records this as an accepted B2B trade-off.
- [A game's demo changes its query contract, for example gate's forced candy default] → The boot check in task 5.2 reads the skin the running game loaded, not the query, so a change like that fails the site build.
- [The site build gets slower, because it runs every live game's demo build] → Turbo caches `build:demo`, so only changed games rebuild.
- [Whack on `regulated-uk` hides setbacks, the headline Whack mechanic] → This is deliberate. The showcase is for regulated buyers, and setbacks are off in the regulated markets.

## Migration Plan

This is additive. Deploy `apps/site` as a new Vercel project. Rollback is removing that project. No existing deployment changes.
