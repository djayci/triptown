## Why

Triptown now has more than one game: Whack Crash, Gate Rush / Beat the Gate, and The Cable Car, which is still being built. Each game lives in its own app, with its own dev port and demo build. Nobody can see the catalogue in one place or open a game without knowing its port and query string. The studio needs one entry point that shows each game, says Triptown is part of Triptych, and lets an adult play the demos.

That entry point is marketing for real-money gambling products, and the audits say what that means:

- The studio is directly liable for its own adverts in Nigeria (ARCON Act s.54; s.63 covers a lobby tile).
- UK CAP 16.3.12, AGCO 2.03 and Brazil 1.231 reach tiles and demos.
- Free play is advertising (hard rule 9).

So nobody may play a demo until they have confirmed they are 18 or over. That confirmation has to be enforced where the demos are served, not only hidden in the page.

## What Changes

- **New Next.js app `apps/site`** (`@triptown/site`), deployed to Vercel as its own project from this monorepo. It uses the App Router and TypeScript, has no Pixi and no round logic, and imports nothing from the game apps.
- **One deployment serves the site and every playable demo.** Before `next build`, the site copies each live game's `build:demo` output to `public/play/<slug>/`. The games already build with `base: './'`, so they run from a sub-path unchanged. This deployment is a demo environment, separate from any production game deployment.
- **The 18+ gate is enforced on the server.**
  - The home page asks "Are you 18 or over?" before it shows any game.
  - Tapping **YES, 18+** sets a session cookie through a server action.
  - Every request under `/play/` passes through a Next.js proxy (`proxy.ts`), including the game's HTML, scripts, atlases and audio. Without the cookie, the proxy redirects to the gate and serves nothing.
  - A direct or shared `/play/` link does not get around it. Tapping **NO** sets nothing.
- **One catalogue is the only source of what is shown.** Each game has one typed entry: slug, name, one-line pitch, status (`live` or `in-development`), logo words and tile theme, source app and demo query. Adding a game means adding one entry and, for a live game, a tile theme.
- **Black Glass look, chosen on the design canvas.**
  - Near-black glass background with faint scanlines.
  - A chrome TRIPTOWN wordmark with red and blue edge fringing.
  - A very slight VHS distortion in the letters: still, apart from a wobble of about a third of a second every 5 seconds, and fully still under reduced motion.
  - "Triptown, proudly powered by Triptych", linking to https://triptych-studio.com/.
  - Each game row shows a logo tile in that game's own look: its HUD logo sticker (Lilita One, thick ink outline, the game's colours) on its backdrop. Screenshots were tried first and replaced at the user's request, 17 Sep 2026.
  - Design: https://claude.ai/artifact/7BBzisnr9oLV3LLqhBDgyG (board "5 · Black Glass").
- **Adult-facing, B2B, and no promotional claims.**
  - The site is framed for operators and partners.
  - Demos run on play money and show their DEMO label.
  - Each game opens exactly as its demo build boots, in its own look and default market, with no profile or skin override. Logo tiles use each game's own look too. (User decision, 17 Sep 2026: "I want the game as I have it"; this replaced an earlier adult-skin rule. The minors-appeal risk it carries is recorded in the compliance note.)
  - The copy makes no win promises, no skill claims, no multiplier boasts and no RTP figure.
  - The build checks all of this.
- **Out of scope:**
  - real-money play, operator login, a wallet, analytics, localisation and a custom domain;
  - any change to a game, a shared package, the maths or the API;
  - the minors-appeal questions about the games' own art and Whack Crash's "before it dives" intro copy. They belong to the games, not the site.

## Capabilities

### New Capabilities
- `games-showcase-site`: the studio's catalogue site. It covers:
  - catalogue contents;
  - the server-enforced 18+ gate on every demo file;
  - play-money demos served from the site;
  - the Triptych attribution;
  - games opened as built, and logo tiles in each game's look;
  - banned promotional copy;
  - the logo's motion limits;
  - phone and keyboard use.

### Modified Capabilities
None. The games, `round-engine`, `provably-fair` and `whack-game-client` are used as they are; their demo builds already take `?profile=` and `?skin=`.

## Impact

- **New:** `apps/site/**` (Next.js app, catalogue, proxy, gate action, styles, logo tiles, scripts, `vercel.json`); `docs/compliance/games-showcase-site-<date>.md`.
- **Touched, minimally:**
  - `turbo.json`: a `build:demo` task, and the site's build depending on it;
  - `pnpm-lock.yaml`: `next`, `react` and `react-dom`;
  - `.gitignore`: `apps/site/public/play/` and `.next/`;
  - `eslint.config.js`, only if the Next app needs its own override;
  - `AGENTS.md`: layout and commands.
- **Reads, never edits:** the `apps/whack`, `apps/gate` and `apps/cable-car` demo builds.
- **No change** to `packages/*`, `apps/api`, any config id, report or profile.
