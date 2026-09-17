## Purpose

Defines the Triptown studio site: the single entry point that shows each game in the catalogue and opens a playable, play-money demo. As marketing for real-money gambling products, it must stay adult-facing, B2B and free of child-appealing or promotional gambling content.

## ADDED Requirements

### Requirement: One catalogue drives the site
The site SHALL render its games from a single catalogue. Each entry MUST give a unique slug, a display name, a one-line description, a status of `live` or `in-development`, a tile image and the demo query the game opens with. No game SHALL appear on the site except through a catalogue entry, and adding a game SHALL NOT require editing any shared package.

#### Scenario: Games rendered from the catalogue
- **WHEN** the catalogue holds Whack Crash and Gate Rush as `live`
- **THEN** the site shows exactly those two game cards, in catalogue order, each with its name, description and tile

#### Scenario: Duplicate slug
- **WHEN** two catalogue entries share a slug
- **THEN** the site build fails and names the duplicate slug

### Requirement: Every live game is playable from the site
For each `live` entry, the site SHALL offer a play link that opens that game's demo build, served by the same deployment under `/play/<slug>/` with the entry's demo query. The demo MUST boot and show its round screen with no further setup. An `in-development` entry MUST NOT offer a play link.

#### Scenario: Play a live game
- **WHEN** a visitor selects Play on the Gate Rush card
- **THEN** the browser opens `/play/gate/` with the catalogue's demo query and the game reaches its betting screen with the DEMO label visible

#### Scenario: Game still in development
- **WHEN** The Cable Car is listed as `in-development`
- **THEN** its card, if shown, reads as coming soon and contains no link to a demo

#### Scenario: Demo build missing
- **WHEN** a `live` entry names a game whose demo build output does not exist at site build time
- **THEN** the site build fails and names the game

### Requirement: Demos are play money only
Every demo reached from the site SHALL run on the demo round service with play money, show its DEMO label, and never connect to a real wallet or the production API. The site MUST state, next to the games, that demos use play money, involve no real-money wagering and need no account.

#### Scenario: Demo bundle has no production service
- **WHEN** the deployed site serves `/play/<slug>/`
- **THEN** the served game is its `build:demo` output, not its production build, and it makes no request to the production API

#### Scenario: Play-money statement visible
- **WHEN** a visitor views the game list at 390x844 or 1440x900
- **THEN** the play-money statement is visible without scrolling past any game card

### Requirement: Adults only, before any game is shown
The site SHALL ask the visitor to confirm they are 18 or over before it shows any game tile, description or play link, and SHALL say the site is intended for operators and industry partners. A visitor who declines MUST NOT be shown the games. The confirmation MAY be remembered for the visitor where browser storage is available, and the site MUST still work, asking again, where storage is blocked.

#### Scenario: First visit
- **WHEN** a visitor opens the site for the first time
- **THEN** only the studio name, the 18+ confirmation and the B2B statement are visible, and no tile or play link is present in the page

#### Scenario: Visitor declines
- **WHEN** a visitor answers that they are under 18
- **THEN** the site shows a short exit message, and the page contains no game tile and no link under `/play/`

#### Scenario: Storage blocked
- **WHEN** browser storage throws on read or write
- **THEN** the site asks for confirmation on each visit and otherwise works

### Requirement: No child-appealing art
Every tile, screenshot and default demo query on the site SHALL use the game's adult skin. The site's own visual design MUST NOT use cartoon mascots, children, cute animals or runner-game looks.

#### Scenario: Default demo skin
- **WHEN** a visitor opens any game from the site
- **THEN** the game boots on its adult skin

#### Scenario: Candy query rejected
- **WHEN** a catalogue entry's demo query selects the candy skin, or selects a profile whose skin is candy without overriding it to adult
- **THEN** the site build fails and names the entry

### Requirement: No promotional gambling claims
Site copy SHALL describe what each game is and how it plays. It MUST NOT promise or suggest winnings, present gambling as a way to make money, claim that skill or timing affects the outcome, advertise a maximum multiplier or payout, or state an RTP figure. RTP, caps and rules are shown inside each game's rules screen, measured for its market.

#### Scenario: Copy check
- **WHEN** the site build runs over the catalogue and page copy
- **THEN** it fails on banned wording, including win promises, "easy money", "guaranteed", skill or reflex claims, a multiplier boast such as "up to x1000", and any RTP percentage

### Requirement: Accessible and light on phones
The site SHALL be usable at 390x844 and 1440x900 with no horizontal scroll, operable by keyboard, with every tile carrying alternative text and every play link a descriptive accessible name. It SHALL respect `prefers-reduced-motion` and MUST NOT load a game's bundle until that game is opened.

#### Scenario: Keyboard play
- **WHEN** a keyboard user tabs through the confirmed site
- **THEN** focus reaches each Play link in catalogue order with a visible focus ring, and Enter opens that demo

#### Scenario: No game code on the landing page
- **WHEN** the site's landing page finishes loading
- **THEN** no request has been made for any file under `/play/`
