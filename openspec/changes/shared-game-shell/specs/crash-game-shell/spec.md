## Purpose

Defines what every Triptown crash game receives from the shared client without implementing it: the screen and its viewport rules, the compliance behaviours that must hold for all games, the single message catalogue, the single bootstrap, and the shared asset pipeline. It exists so that a new game is a skin over a certified engine rather than a second implementation of the same screen.

## ADDED Requirements

### Requirement: One screen for every game

Every game's screen SHALL be supplied by the shared client. A game SHALL supply only a scene, its words, and optional scene cues; it SHALL NOT implement the wordmark, balance, session clock, net position, history strip, multiplier, payout, result card, stake row, control column, demo badge or action button, and SHALL NOT implement its own viewport fitting or layout.

The shared screen SHALL offer more than one viewport presentation, and each game SHALL declare which it uses:

- a **fixed-frame** portrait presentation, scaled to fit the viewport and centred;
- an **elastic** portrait presentation, which fills the viewport width and absorbs the remaining height, so that a change in browser chrome height does not leave empty margins down both sides;
- a **desktop** presentation, which places the stake controls beside a larger stage.

A game's declared presentation SHALL be the only thing that determines which it gets. Moving a game onto the shared screen SHALL NOT change which presentation it shows, and SHALL NOT change what that presentation looks like.

#### Scenario: A game supplies a scene and words only

- **WHEN** a game's view class is inspected
- **THEN** it contains no layout arithmetic, no viewport fitting and no compliance decision, and every element outside its own scene is positioned by the shared screen

#### Scenario: Elastic portrait fills the width

- **WHEN** a game that declares the elastic presentation is loaded at 390×844 and at 390×720
- **THEN** the screen content spans the full viewport width in both cases, with no empty side margins, and no element is clipped

#### Scenario: Desktop presentation

- **WHEN** a game that declares the desktop presentation is loaded at 1440×900
- **THEN** the stake controls are shown beside a larger stage, and every control reachable in portrait is reachable here

#### Scenario: A game that declares neither is unaffected

- **WHEN** a game that declares only the fixed-frame portrait presentation is loaded at any viewport
- **THEN** it is scaled to fit and centred exactly as before, and gains no desktop or elastic behaviour

#### Scenario: A shared fix reaches every game

- **WHEN** a behaviour owned by the shared screen is changed
- **THEN** the change takes effect in every registered game without editing that game, and no game carries its own copy of that behaviour

### Requirement: The scene never learns the outcome

A game's scene SHALL receive only values that are already disclosed to the player: the current multiplier, and the published intensity readout where the game displays one. It SHALL NOT receive the crash time, the time remaining, or any future setback or boost, in any response, event or call.

Where a scene is driven by the intensity readout, that readout SHALL be the same value the player can see on screen, and SHALL be passed as a named, disclosed input rather than derived inside the scene from round timing.

#### Scenario: No undisclosed value reaches the scene

- **WHEN** the shared screen updates a game's scene during a running round
- **THEN** the scene is given the multiplier and, where the game shows one, the intensity readout, and nothing about the crash time or any future modifier

#### Scenario: A scene driven by intensity shows only what the player sees

- **WHEN** a game's scene changes speed or mood with intensity
- **THEN** the value driving it is the same intensity the player can read on screen, so the scene discloses nothing the screen does not

#### Scenario: The crash arrives without warning

- **WHEN** a round crashes
- **THEN** nothing in the scene changed before the crash in a way that depended on when the crash would happen

### Requirement: Compliance behaviours hold for every game

The shared client SHALL own every presentation and timing rule, so that a game implementing none of them still satisfies them. It SHALL be the single place that decides whether a round is celebrated, and every celebratory effect SHALL route through that decision and register on a counter or flag the automated presentation check can read.

A return at or below the stake SHALL never be celebrated. It SHALL state the amount returned and the net result, and where the net is a loss it SHALL be shown as a negative amount.

Where a market requires them, the shared client SHALL show the withholding-tax notice on a settled winning round, reflect whether audio is available, and show the live win chance for a deferred reveal. These SHALL be shown in every game that runs on the shared screen, without that game implementing them.

#### Scenario: A below-stake return states a negative net

- **WHEN** a round settles with a payout below the stake in any game
- **THEN** the result line states the amount returned and the net as a negative amount, with no celebratory sound, confetti or screen shake

#### Scenario: Celebration decisions are readable by the check

- **WHEN** the automated presentation check drives a round that returns at or below the stake
- **THEN** it observes zero win cues, zero confetti and zero screen shakes, in every active profile of every game

#### Scenario: A market disclosure reaches every game

- **WHEN** a profile that requires the withholding-tax notice is loaded
- **THEN** the notice appears on a settled winning round in every game, not only in the games whose view happened to implement it

#### Scenario: Audio availability is reflected

- **WHEN** the browser blocks audio
- **THEN** every game's sound control shows that audio is unavailable rather than offering a control that does nothing

### Requirement: The shared client names the model, never a game

No string, label or column heading in the shared client SHALL use one game's vocabulary. Setbacks and boosts SHALL be named by the model wherever they are shown to a player, including the round-history detail and the provably-fair verification table. Every player-readable string in the shared client SHALL come from the message catalogue so it can be translated per market and reviewed as a whole.

#### Scenario: Round history names the model

- **WHEN** a player opens the round history in a game that is not Whack Crash
- **THEN** the setback and boost rows are labelled by the model's words, and no other game's vocabulary appears

#### Scenario: Verification table names the model

- **WHEN** a player opens the provably-fair panel in any game
- **THEN** the verification table's column headings use the model's words

#### Scenario: No string bypasses the catalogue

- **WHEN** the shared client's player-readable strings are enumerated
- **THEN** every one of them resolves through the message catalogue, and none is written inline

### Requirement: One message catalogue with per-game overrides

The shared client SHALL provide a default message catalogue covering every key it looks up, and a single message lookup used by all games. A game SHALL supply only the keys whose wording is its own, and SHALL inherit the rest.

The lookup SHALL behave identically for every game. A missing key SHALL be visible rather than silent. A missing parameter SHALL be handled the same way in every game.

#### Scenario: A game inherits the shared wording

- **WHEN** a game supplies no value for a key the shared client looks up
- **THEN** the shared default is shown, and the key does not appear on screen

#### Scenario: A game overrides its own words

- **WHEN** a game supplies its own value for a key
- **THEN** that value is shown in that game, and no other game's wording changes

#### Scenario: Missing parameters behave identically

- **WHEN** the same message is rendered with a missing parameter in two different games
- **THEN** both games produce the same output

#### Scenario: Regulated wording cannot drift between games

- **WHEN** a rules, result or disclosure message is changed in the shared catalogue
- **THEN** every game that has not deliberately overridden that key shows the new wording

### Requirement: The market's skin reaches every surface

When a profile selects a skin, that skin SHALL apply to every surface the player sees, including the dialogs for rules and help, round history, provably-fair verification, and the operator reality-check pause. No surface SHALL be fixed to one skin's colours or display face.

#### Scenario: Adult skin reaches the dialogs

- **WHEN** a profile with the adult skin is loaded and the player opens the rules, history, fairness or reality-check dialog
- **THEN** that dialog is drawn in the adult palette and display face, not the bright one

#### Scenario: Skin classification is unaffected

- **WHEN** a game recolours its own scene
- **THEN** the profile's skin name is unchanged, so asset selection and any audit keyed on the skin still hold

### Requirement: One bootstrap for every game

The shared client SHALL provide the game boot sequence: translator installation, fonts, atlas and audio loading, round-service selection, panel construction and the player-protection prompts. A game SHALL supply only its own configuration.

The mock round service SHALL be reachable only behind the demo flag through a dynamic import, in one shared place rather than once per game. The player-protection prompts for an operator pause, a game close, an operator message and an idle prompt SHALL come from the message catalogue.

#### Scenario: The mock cannot reach a production build

- **WHEN** a production build of any game is created
- **THEN** the build fails if a mock marker is present in the bundle, and the check is the same check for every game

#### Scenario: Player-protection prompts are translatable

- **WHEN** the player-protection prompts are enumerated for translation
- **THEN** every one of them is a catalogue key, in every game

#### Scenario: A game's boot is its configuration only

- **WHEN** a game's entry point is inspected
- **THEN** it contains its own view, words, sounds and market defaults, and no copy of the boot sequence

### Requirement: Shared asset and build pipeline

Each game SHALL own its own sounds, its own shapes and its own atlas. The pipeline that produces them — the sprite rasteriser and atlas packer, the audio encoder and manifest writer, the signal-generation primitives and the shared interface sprites — SHALL exist once and be used by every game.

Every game's production build SHALL run the same build gates and SHALL emit a signed release manifest. Every game SHALL load its atlas with a build identifier so that a new build cannot serve a stale atlas.

#### Scenario: A game owns its sounds and shapes

- **WHEN** a game's audio or art source is inspected
- **THEN** it contains that game's own sounds and shapes only, and shares no sample or figure with another game

#### Scenario: The pipeline exists once

- **WHEN** the atlas packer, the audio encoder or the signal primitives are changed
- **THEN** every game picks up the change without editing that game, and no game carries a copy

#### Scenario: Every build emits a manifest

- **WHEN** a production build of any game completes
- **THEN** a signed release manifest is written, so the build identity shown on the rules screen can be checked against it

#### Scenario: A new build cannot serve a stale atlas

- **WHEN** a game is redeployed with changed art
- **THEN** the atlas request carries the new build identifier and the previous atlas is not served from cache
