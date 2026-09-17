## Context

See proposal.md for why. What exists today:

- **Game apps.** Each game is its own Vite app with `base: './'` and a `build:demo` script (`--mode demo --outDir dist-demo`). `apps/whack` and `apps/gate` both work. `apps/cable-car` has the script but is still being built (`the-cable-car` groups 1–4 are open).
- **Demo query strings.** Demo builds choose market and look from the query string, and each app does it differently:
  - `apps/whack/src/services.ts`: `?profile=` picks a template, and the skin follows that profile. With no query the mock's default profile runs, on the Candy look.
  - `apps/gate/src/services.ts`: defaults to `ng-draft` (Gate Rush) on the Candy Paddock look; `?skin=adult` would switch it.
  - `apps/cable-car/src/services.ts`: `?profile=`, with `allowOverride` and `playerRegion` so the draft profiles run.
- **DEMO label.** Every demo already draws one (`label.demo` in each message catalogue).
- **Tooling.**
  - The repo uses pnpm workspaces, turbo, TypeScript ~6.0, ESLint 10 flat config and Node 22.
  - `tsx` is already used by `apps/api` for Node scripts.
  - `scripts/shot.mjs` drives headless Chrome through `playwright-core`.
  - Today every deployed app is Vite or Hono; nothing uses Next.js yet.
- **Design.** Black Glass, on the canvas https://claude.ai/artifact/7BBzisnr9oLV3LLqhBDgyG, board "5 · Black Glass". Its previews were captured on 17 Sep 2026 from the running demos: Whack Crash at 1280×720, clip 694×390 at (453, 302); Gate Rush at 430×932, clip 330×186 at (100, 538); both with no query. The first captures used the adult skin; on 17 Sep 2026 the user asked for the games as built ("I don't want the adult skin or even regulated UK in here"), and they were recaptured.

## Goals / Non-Goals

**Goals:**
- One Vercel URL that shows every game and plays the live ones, on a phone.
- No byte of a demo reaches a visitor who has not tapped "YES, 18+", enforced by the server.
- The compliance rules for the site hold because the build and tests enforce them.
- A new game costs one catalogue entry and one preview.

**Non-Goals:**
- Changing any game's demo behaviour to suit the site. A game that needs a new query parameter changes through its own OpenSpec change.
- Embedding games in the site page (an iframe lobby). That is `apps/sandbox`'s job.
- Age *verification*. The gate is an honest self-declaration, as suits a B2B showcase running play money without accounts.

## Decisions

### D1. `apps/site` is a Next.js 16 App Router app
It uses `next`, `react` and `react-dom` 19, and TypeScript, with `app/layout.tsx`, `app/page.tsx`, `app/actions.ts`, `proxy.ts`, `src/catalogue.ts`, `src/copy.ts` and `app/globals.css`. The home page is a server component that reads the gate cookie and renders either the gate or the catalogue. Before confirmation the rows render greyed out and inert (user request, 17 Sep 2026: "grey them out and make them not clickable instead of hiding them"). The HTML sent to an unconfirmed visitor has no Play link and no `/play/` URL at all, so the greying is presentation only: there is no hidden link for CSS to disable, and the proxy refuses `/play/` regardless.
*Why Next.js:* the user deploys to Vercel. The gate also needs something server-side that runs before static files, and Next's proxy gives that without a separate function.
*Alternative:* a static Vite page with a client-side gate, rejected because a direct `/play/` link would bypass it. That bypass was an accepted risk in the first draft, and the user has now ruled it out.

### D2. The 18+ gate: server action, session cookie, proxy on `/play/`
- **YES, 18+** is a `<form action={confirmAge}>` button, so it works before hydration and with the keyboard.
  - The server action sets `tt_age=1` as a *session* cookie: no `Max-Age`, with `HttpOnly`, `Secure`, `SameSite=Lax` and `Path=/`.
  - It then redirects to a validated `next` path, or to `/#games`.
- **NO** is a second form action that sets nothing and redirects to `/?declined=1`, which renders the exit message.
- **`proxy.ts`** uses `matcher: ['/play/:path*']`.
  - If the cookie is missing, it returns `NextResponse.redirect(new URL('/?next=' + encodeURIComponent(pathname + search), req.url), 307)`.
  - If the cookie is present, it returns `NextResponse.next()`.
  - The matcher covers every file of every demo (HTML, JS, atlases, audio, `audio.json`), so a copied asset URL is gated too.
- **`next` is accepted only if** it starts with `/play/` and contains no `//`, `\` or scheme. That stops an open redirect.

*Alternatives:*
- a `localStorage` flag, rejected because the server cannot see it;
- a signed or long-lived cookie, rejected because the gate declares age rather than proving it, and a session-only lifetime is the stricter reading of "unless the user taps 18+";
- checking only the HTML page, rejected because the game's JS and assets would still be fetchable.

### D3. Demos are copied into `public/play/<slug>/` before `next build`
- `scripts/assemble-demos.ts` runs with `tsx` as the `prebuild` step. It clears `public/play/` and copies `apps/<app>/dist-demo/` to `public/play/<slug>/` for each `live` entry only, so an `in-development` game ships nothing.
- `public/play/` is gitignored.
- Turbo gains a `build:demo` task (outputs `dist-demo/**`). `@triptown/site#build` depends on `@triptown/whack#build:demo` and `@triptown/gate#build:demo`, and gains `@triptown/cable-car#build:demo` when The Cable Car goes live.
- The game apps are not package dependencies of the site.

*Alternatives:*
- a separate Vercel project per demo, rejected because the gate cookie would not cross origins and nothing would stop a stale demo;
- rewriting to an external demo origin, rejected for the same cookie reason.

### D4. Play links point at `index.html` explicitly
Next.js normalises trailing slashes, and the games load assets relative to their page (`base: './'`). `/play/gate/` could therefore resolve `./assets/…` against `/play/`. `playUrl(entry)` returns `/play/<slug>/index.html?<demoQuery>`, which fixes the base URL whatever the trailing-slash setting. A `next.config.ts` redirect also sends `/play/:slug` and `/play/:slug/` to `/play/:slug/index.html`, so a hand-typed URL works. Next runs `next.config` redirects before the proxy (bundled docs, proxy execution order), so the redirect itself reveals nothing, and the `index.html` it points at is gated like any other file. Files in `public/` are served after the proxy.

### D5. The catalogue is a typed array; all page copy lives in `src/copy.ts`
```ts
type Entry = {
  slug: string;
  app: string;                              // folder under apps/ whose dist-demo is copied
  name: string;
  pitch: string;
  status: 'live' | 'in-development';
  preview?: string;                         // file under public/previews/
  previewAlt?: string;
  accent: string;                           // the row's spine colour
  demoQuery: Record<string, string>;
};
```
The initial entries:
- **Whack Crash:** `app: 'whack'`, `demoQuery: {}`, accent red.
- **Gate Rush:** `app: 'gate'`, `demoQuery: {}`, accent blue.

An empty query is the point: the site shows each game as its demo build boots. `demoQuery` stays in the type for a future game whose demo needs a parameter just to run.
- **The Cable Car:** `app: 'cable-car'`, `status: 'in-development'`, no preview; the row reads "NO SIGNAL" and "COMING SOON".

Every other visible string lives in `src/copy.ts`, so the copy check can read all of it: the hero line, the Triptych line, the B2B and play-money statements, the gate question, the exit message and the footer. The catalogue names games, which is fine for an app; only shared packages must stay game-neutral.

### D6. Build checks: one `tsx` script, run at `prebuild`
`scripts/check-site.ts` runs after assembly and fails the build on any of:
- a duplicate slug;
- a `live` entry with no `public/play/<slug>/index.html` or no tile theme;
- a banned-wording match in the catalogue or `src/copy.ts`;
- a play-money statement missing from `copy.ts`;
- a Triptych link that is not `https://triptych-studio.com/`.

The rules are exported functions with a Vitest fixture test, one failing case per rule. An adult-skin rule existed in the first implementation and was removed with the user's decision to show the games as built.

### D7. Logo tiles, drawn in each game's look
The first version captured screenshots of each demo's betting screen. The user replaced them on 17 Sep 2026 ("instead of a snapshot of the game, create the logos as per the game themes and look and feel"). Each live entry now carries `logo: [first, second]` (the game's HUD logo words) and a `tile` theme, and `LogoTile` draws them in HTML and CSS:
- **The sticker:** the shared `Logo` from `crash-client/src/ui/hud.ts`, reproduced. It has a pink (`#ff3d8b`) rounded sticker with a thick ink (`#1d1424`) border and drop shadow, tilted −3°, set in Lilita One (`next/font`). The first word is cream (`#fff4d6`) and the second the game's `sun` token.
- **`whack-candy`:** the candy palette's yellow sunburst (`#ffd43b` / `#ffc414`) with the green hill. The second word is yellow.
- **`gate-paddock`:** Candy Paddock (`apps/gate` `STAGE_PALETTES.candy`, `CANDY_PADDOCK`): a sunburst sky over the cream rail and striped turf (`#6fd14a` / `#4fbf3a`). The second word is deep purple (`#6d28d9`).

Sizes use container query units, so the tile scales from the 300 px desktop column to full width on a phone. There are no characters, multipliers or amounts on a tile. Nothing is captured or committed as an image, so a tile cannot go stale against a stale image cache (the reason the screenshots appeared not to update). A new live game adds a theme class; the build fails a live entry with none.

### D8. Visual system: Black Glass, reproduced from the canvas
- **Fonts:** `next/font/google` for Michroma (wordmark and game names) and Chivo Mono 300/500 (text). They are self-hosted at build time, so there are no runtime font requests.
- **Tokens in `globals.css`:**
  - ground `#07080a`, panel `#0d0f12`;
  - line `#2a2f35`, text `#e8ecef`, muted `#aab3bb` / `#8d98a2` / `#6f7a84`;
  - fringe red `#e5383b` and blue `#3abef9`.
- **Scanlines:** a fixed `repeating-linear-gradient` overlay at 2.5% white.
- **Wordmark:** a chrome gradient clipped to the text, with a red/blue `drop-shadow` fringe.
- **VHS distortion:** two `aria-hidden` copies clipped to thin bands (`clip-path: inset(34% 0 56% 0)` and `inset(66% 0 26% 0)`). They are invisible except for about 330 ms in each 5 s cycle (8 s until the user asked for it "a bit more frequent", 17 Sep 2026), when they shift ±7 px and the fringe widens. The page keeps no reflection, mist, sheen or fade-in: the user rejected them on 17 Sep 2026. `prefers-reduced-motion: reduce` turns all of it off.
- **Game rows:** a 20 px accent spine, a 300 px 16:9 preview, then name and pitch, then a fixed 240 px Play column. Fixed column widths keep the dividers aligned across rows, which the user asked for. On phones the row stacks: preview on top, Play full width.
- **Header:** navigation only, no small logo, because the doubled wordmark was rejected.
- **Phone (≤820 px), its own composition** (user, 17 Sep 2026: "the mobile view looks truly amateur"):
  - **Header:** a compact bar with an "18+ · FOR OPERATORS" chip.
  - **Hero:** the wordmark edge to edge, with the tagline left-aligned tight beneath it and no dead space.
  - **Games:** a horizontal shelf of cards, 84% wide with the next one peeking in, with a "SWIPE →" cue. It uses `scroll-snap-type: x mandatory`, `scroll-snap-align: start` and `scroll-snap-stop: always`, so a flick lands one card at a time.
  - **18+ question:** a frosted glass sheet pinned to the bottom of the screen, so it never pushes the games out of view.
- **Motion (user request, 17 Sep 2026: "animate things… smooth, add some finesse").** All of it is in `globals.css` under `prefers-reduced-motion: no-preference`, eased with a long ease-out, and none of it touches the wordmark, which keeps only its VHS wobble (spec: The wordmark barely moves):
  - **Entrance:** tagline, Triptych line, gate bar, list header and rows rise out of a soft blur, staggered; the rule line draws out from the centre.
  - **Links:** underlines draw in.
  - **Gate buttons:** a glow on YES; a press scale on both.
  - **Hovering a greyed-out game** lifts it slightly and lights the 18+ bar it is waiting on (CSS `:has`).
  - **Live rows:** on hover, the border brightens and an accent line draws along the bottom; the sticker lifts and tilts with a spring; the Play column fills with a light panel as its arrow nudges forward. Each tile's sunburst turns slowly (90 s a turn, 30 s on hover), through an animated `@property` angle.
  - **Right after YES** (`?unlocked=1`, set by `confirmAge`, so it plays once and not on later visits), each row fades smoothly from greyscale into colour, staggered. The flicker first built here was replaced at the user's request. Locked and live rows differ only in `filter` and `opacity`, which also transition, so the change fades even when Next swaps the classes in place after the server action.

### D9. Deployment on Vercel
- The Vercel project has Root Directory `apps/site`, framework Next.js, and "Include source files outside of the Root Directory" enabled.
- `apps/site/vercel.json` sets `installCommand: "pnpm install --frozen-lockfile"` and `buildCommand: "cd ../.. && pnpm turbo run build --filter=@triptown/site"`, so the game demo builds run first.
- `next.config.ts` adds `X-Robots-Tag: noindex, nofollow` on every route. The site is shared by direct link with operators and partners until an ARCON vetting route is chosen (`docs/compliance/games-showcase-site-2026-09-17.md` F2).
- Linking the project is a manual step that the user performs.

### D10. Tooling fit
- `apps/site` gets its own `tsconfig.json`, which extends the repo base where compatible and adds the Next plugin, `jsx: preserve` and the `next-env.d.ts` include.
- Lint runs through the repo's ESLint flat config with `@next/eslint-plugin-next` added for `apps/site/**` only. It does not use `next lint`, which Next 16 removed.
- Tests are Vitest, colocated. The proxy and the `next` validation are pure functions tested directly. The end-to-end gate checks use `playwright-core`, like the existing checks.

## Risks / Trade-offs

- [**Next 16 may not accept TypeScript ~6.0 or the repo's ESLint 10 setup.**] → Task 2.1 proves `typecheck` and `lint` first. If they fail, the site pins its own `typescript` devDependency, and that is recorded in the task.
- [**On Vercel, public files might be served before the proxy runs.**] → Vercel runs Next's proxy before the static and CDN layer, but that is a platform behaviour, not a guarantee in our code. Task 6.2 checks it on the real preview deployment with `curl`, for both an HTML file and a hashed asset, with and without the cookie, before the change is done.
- [**Every demo asset request now invokes the proxy.**] → Proxy work is a cookie read with no I/O. Browser caching still applies once a visitor has confirmed. The demos have a small number of files.
- [**The cookie can be set by hand.**] → Accepted. This is a self-declaration gate for a play-money B2B showcase, and the compliance note in 1.1 records it.
- [**The previews and demos show the Candy looks (cartoon moles with blush and a crown; a bright paddock), which the CAP under-18 guidance treats as high-risk on a tile, and `AGENTS.md` rules 6 and 12 bar in marketing.**] → The user's decision (17 Sep 2026). Mitigated, not removed, by the 18+ gate, the B2B framing and noindex; recorded in the compliance note as a blocker for any public placement or promotion. Whack Crash's "before it dives" intro copy is a separate game-side issue.
- [**The site build runs every live game's demo build.**] → Turbo caches `build:demo`.

## Migration Plan

This is additive. Create the Vercel project for `apps/site`, deploy a preview, run the 6.2 checks, then promote. Rollback is removing the Vercel project. No existing deployment changes.
