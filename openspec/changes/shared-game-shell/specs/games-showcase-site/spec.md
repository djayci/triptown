## MODIFIED Requirements

### Requirement: One catalogue drives the site
The site SHALL render its games from a single catalogue. Each entry MUST have:
- a unique slug;
- a display name;
- a one-line description;
- a status of `live` or `in-development`;
- the two words of the game's logo, and for a live game its tile colours;
- the demo query the game opens with.

A live entry's tile colours MUST be carried by the entry itself, not by a named style the site defines separately for each game. No game SHALL appear on the site except through a catalogue entry, and adding a game SHALL NOT require editing any shared package or any stylesheet.

#### Scenario: Games rendered from the catalogue
- **WHEN** the catalogue holds Whack Crash and Gate Rush as `live` and The Cable Car as `in-development`
- **THEN** the confirmed site shows those three rows in catalogue order, each with its name, description and logo tile (or a no-signal placeholder for The Cable Car)

#### Scenario: Duplicate slug
- **WHEN** two catalogue entries share a slug
- **THEN** the site build fails and names the duplicate slug

#### Scenario: Adding a game touches no stylesheet
- **WHEN** a new live game is added to the catalogue with its tile colours
- **THEN** its tile renders in those colours with no new style rule written for it

#### Scenario: Existing tiles are unchanged
- **WHEN** the tile colours are carried by the catalogue entry instead of a per-game style
- **THEN** every existing live game's tile renders exactly as it did before
