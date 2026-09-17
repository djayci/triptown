## Purpose

Defines the Triptown studio site: the single entry point that shows each game in the catalogue and, only after the visitor confirms they are 18 or over, opens a play-money demo. As marketing for real-money gambling products, it must stay adult-facing, B2B and free of promotional gambling claims.

## Requirements

### Requirement: One catalogue drives the site
The site SHALL render its games from a single catalogue. Each entry MUST have:
- a unique slug;
- a display name;
- a one-line description;
- a status of `live` or `in-development`;
- the two words of the game's logo, and for a live game its tile theme;
- the demo query the game opens with.

No game SHALL appear on the site except through a catalogue entry, and adding a game SHALL NOT require editing any shared package.

#### Scenario: Games rendered from the catalogue
- **WHEN** the catalogue holds Whack Crash and Gate Rush as `live` and The Cable Car as `in-development`
- **THEN** the confirmed site shows those three rows in catalogue order, each with its name, description and logo tile (or a no-signal placeholder for The Cable Car)

#### Scenario: Duplicate slug
- **WHEN** two catalogue entries share a slug
- **THEN** the site build fails and names the duplicate slug

### Requirement: No play without the 18+ confirmation
The site SHALL ask the visitor whether they are 18 or over before any game can be opened and before it serves any demo. Until the visitor confirms, the games SHALL be shown greyed out and inert: no Play link, no link under `/play/`, nothing clickable or focusable in the row. It SHALL grant access only when the visitor explicitly confirms. The server MUST refuse every request under `/play/` from a visitor who has not confirmed in the current browser session, redirecting to the gate without serving any of the demo's files. This covers:
- the demo page;
- its scripts;
- its images, atlases and audio.

A visitor who declines, ignores the question or arrives by a direct link MUST NOT be able to load a demo. The confirmation SHALL last for the browser session only.

#### Scenario: First visit
- **WHEN** a visitor opens the site with no confirmation
- **THEN** the page shows the studio name, the B2B statement and the 18+ question, and the game rows greyed out with "Confirm 18+ to play" in place of a Play link, and contains no link under `/play/`

#### Scenario: Clicking a greyed-out game
- **WHEN** a visitor who has not confirmed clicks a greyed-out game row
- **THEN** nothing happens and no demo is requested

#### Scenario: Visitor confirms
- **WHEN** the visitor taps "YES, 18+"
- **THEN** the game rows are shown in full colour with their Play links, and following a Play link loads the demo

#### Scenario: Visitor declines
- **WHEN** the visitor taps "NO"
- **THEN** the site shows a short exit message, grants no access, keeps the games greyed out, and the page contains no link under `/play/`

#### Scenario: Direct link without confirmation
- **WHEN** a browser with no confirmation requests `/play/gate/index.html` or any file under `/play/gate/`
- **THEN** the server responds with a redirect to the gate, the response carries none of the file's content, and after confirming the visitor is returned to the demo they asked for

#### Scenario: New browser session
- **WHEN** a visitor who confirmed closes the browser and opens a `/play/` link later
- **THEN** they are sent to the gate again

### Requirement: Every live game is playable from the site
For each `live` entry, a confirmed visitor SHALL find a Play link that opens that game's demo build, served by the same deployment under `/play/<slug>/` with the entry's demo query. The demo MUST reach its betting screen with no further setup. An `in-development` entry MUST NOT offer a play link, and its files MUST NOT be deployed.

#### Scenario: Play a live game
- **WHEN** a confirmed visitor selects Play demo on the Gate Rush row
- **THEN** Gate Rush loads from `/play/gate/` with the catalogue's demo query and reaches its betting screen with the DEMO label visible

#### Scenario: Game still in development
- **WHEN** The Cable Car is `in-development`
- **THEN** its row reads "Coming soon" with no link, and no file exists under `/play/cable-car/`

#### Scenario: Demo build missing
- **WHEN** a `live` entry names a game whose demo build output does not exist at site build time
- **THEN** the site build fails and names the game

### Requirement: Demos are play money only
Every demo served by the site SHALL be that game's demo build, running on play money with its DEMO label. It MUST never reach a real wallet or the production API. Next to the games, the site MUST state that demos use play money, involve no real-money wagering and need no account.

#### Scenario: Demo bundle has no production service
- **WHEN** a confirmed visitor plays any demo
- **THEN** the game makes no request to any origin other than the site's own

#### Scenario: Play-money statement visible
- **WHEN** a confirmed visitor views the game list at 390x844 or 1440x900
- **THEN** the play-money statement is visible above the first game row

### Requirement: Triptych attribution
The site SHALL state that Triptown is powered by Triptych, both in the hero under the wordmark and in the footer, and each statement SHALL link to https://triptych-studio.com/.

#### Scenario: Attribution links
- **WHEN** a visitor views the home page before or after confirming
- **THEN** the hero reads "Triptown, proudly powered by Triptych" and the footer reads "Proudly powered by Triptych", and both "Triptych" links point to https://triptych-studio.com/

### Requirement: Games open as built
Each Play link SHALL open the game's demo exactly as that demo build boots on its own, in its own look and default market, with no profile or skin override added by the site. Each live game's tile SHALL show its logo in the game's own look: its HUD logo words, lettering, outline and colours, on a backdrop from its own scene. A tile MUST NOT show a multiplier, an amount or a result. The site's own visual design (outside the game previews) MUST NOT use cartoon mascots, children, cute animals or runner-game looks.

#### Scenario: Default look
- **WHEN** a confirmed visitor opens Whack Crash or Gate Rush from the site
- **THEN** the game boots in the same look and market as opening its demo build directly with no query string

#### Scenario: Tile matches the game
- **WHEN** a confirmed visitor views the Whack Crash and Gate Rush rows
- **THEN** each shows its logo sticker as the game's HUD draws it (words, Lilita One lettering, ink outline, sticker and word colours) on its own backdrop, and neither shows a number or a result

### Requirement: No promotional gambling claims
Site copy SHALL describe what each game is and how it plays. It MUST NOT:
- promise or suggest winnings;
- present gambling as a way to make money;
- claim that skill or timing affects the outcome;
- advertise a maximum multiplier or payout;
- state an RTP figure.

#### Scenario: Copy check
- **WHEN** the site build runs over the catalogue and page copy
- **THEN** it fails on banned wording, including:
  - win promises, "easy money" and "guaranteed";
  - skill, reflex or timing claims;
  - a multiplier boast such as "up to x1000";
  - any RTP percentage.

### Requirement: The wordmark barely moves
The hero wordmark SHALL stay still except for a brief VHS-style distortion inside the letters. The distortion lasts no more than 400 ms, repeats no more often than every 4 seconds, and offsets thin horizontal slices by no more than 8 px. The wordmark MUST NOT translate, scale, fade in or show a reflection. Under `prefers-reduced-motion: reduce` it MUST be fully still.

#### Scenario: Normal motion
- **WHEN** the home page is open for 20 seconds with default motion settings
- **THEN** the wordmark's position and size never change, and the distortion appears at most 5 times, each time for under 400 ms

#### Scenario: Reduced motion
- **WHEN** the visitor's system requests reduced motion
- **THEN** no animation runs on the wordmark

### Requirement: Accessible and light on phones
The site SHALL be usable at 390x844 and 1440x900 with no horizontal scroll, and SHALL be operable by keyboard. Every logo tile SHALL carry an accessible name, and every Play link SHALL have a descriptive accessible name. The home page MUST NOT load any file under `/play/` until a game is opened.

#### Scenario: Keyboard confirm and play
- **WHEN** a keyboard user tabs to "YES, 18+", presses Enter, then tabs on
- **THEN** focus reaches each Play link in catalogue order with a visible focus ring, and Enter opens that demo

#### Scenario: No game code on the home page
- **WHEN** a confirmed visitor's home page finishes loading
- **THEN** no request has been made for any file under `/play/`
