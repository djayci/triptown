## Why

Triptown now has more than one game (Whack Crash, Gate Rush / Beat the Gate, and The Cable Car on the way), and each lives in its own app with its own dev port and demo build. Nobody can see the catalogue in one place or open a game without knowing its port and query string. The studio needs one entry point that shows each game and lets someone play it.

That entry point is marketing for real-money gambling products, and the audits say what that means. The studio is directly liable for its own adverts in Nigeria (ARCON Act s.54, s.63 covers a lobby tile). UK CAP 16.3.12, AGCO 2.03 and Brazil 1.231 reach tiles and demos. Free play is advertising (hard rule 9). So the site has to follow the compliance rules, not just link to games.

## What Changes

- **New app `apps/site`** (`@triptown/site`): a static Vite page that lists the games from one catalogue file and links each game to a playable demo. It has no Pixi, no round logic and no dependency on `core` or `fairness`.
- **One deployment serves the site and every listed demo.** The site build assembles each listed game's `build:demo` output under `/play/<slug>/`. The games already build with `base: './'`, so they run from a sub-path unchanged. The deployment is a demo/showcase environment, kept separate from any production game deployment.
- **A catalogue is the single source of truth for what is shown.** One typed entry per game: slug, name, one-line pitch, status (`live`, `in-development`), tile image, the app it builds from, and the demo query it opens with (profile, skin). Adding a game means adding one entry. The catalogue lives in the site app because apps may name games and shared packages may not.
- **The showcase is B2B and adult-facing by construction.**
  - It is framed for operators and partners, and says so.
  - An 18+ confirmation comes before any tile or demo link is shown.
  - Every demo shows its DEMO label and says it uses play money, with no real-money wagering and no sign-up.
  - Tiles and default demo links use the adult skin. No Candy art on the site.
  - The copy carries no win promises, no "easy money", no skill claims and no multiplier boasts.
  - Only `live` games get a play link. An `in-development` game can appear as "coming soon" with no playable demo, or not at all.
- **Build guard.** The site build fails if a catalogue entry points at a missing demo build, at a tile that uses the Candy skin, or at a demo query that selects `skin=candy`.
- **Out of scope:** real-money play, operator login, a player wallet, analytics or tracking, localisation, a custom domain, and any change to a game, a shared package, the maths or the API.

## Capabilities

### New Capabilities
- `games-showcase-site`: the studio's catalogue site. It covers what the catalogue must contain, how each game's demo is reached, the adult-only and B2B framing, the ban on child-appealing tiles and on promotional gambling copy, the rule that only playable games get a play link, and the build checks that keep those rules true.

### Modified Capabilities
None. The games, `round-engine`, `provably-fair` and `whack-game-client` are consumed as they are. Their demo builds already take `?profile=` and `?skin=`.

## Impact

- **New:** `apps/site/**` (catalogue, page, styles, tile images, build and assembly scripts, `vercel.json`).
- **Touched, minimally:** `AGENTS.md` layout and commands; `turbo.json` only if the site's build needs the games' `build:demo` outputs declared as dependencies.
- **Reads, never edits:** `apps/whack`, `apps/gate` and `apps/cable-car` demo builds; `scripts/shot.mjs` to capture tiles.
- **Compliance:** a short marketing-stage note under `docs/compliance/` covering the site as an advert (Nigeria ARCON, UK CAP under-18 guidance, free-play-as-advertising).
- **No change** to `packages/*`, `apps/api`, any config id, report or profile.
