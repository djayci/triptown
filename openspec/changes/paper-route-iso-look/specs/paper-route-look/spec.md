## Purpose

How the Paper Route scene is framed and drawn: the camera and its projection, the street laid out for that view, the courier and the adult read, the light HUD's visual system, and the morning light treatment. Behavioural rules stay in `paper-route-client`; this capability governs only what the player sees.

## ADDED Requirements

### Requirement: Angled overhead street view

The game SHALL present the round from a camera above and to one side of the street, using an orthographic projection with no perspective convergence, at a fixed angle for the whole round.

The courier SHALL travel along a diagonal that rises across the frame, with the street continuing off both the near and far ends of the view. The camera SHALL follow the courier along the street without rotating, tilting or zooming during a round, and SHALL keep the courier in the upper half of the playable area so the HUD never covers them.

The player SHALL NOT be able to move, rotate or zoom the camera.

#### Scenario: Projection has no perspective

- **WHEN** two houses of identical size stand at the near and far ends of the visible street
- **THEN** both render at the same on-screen size, and their parallel edges stay parallel

#### Scenario: Camera stays put during a round

- **WHEN** the multiplier climbs from 1.00 to 20.00 during a round
- **THEN** the camera angle, the projection scale and the courier's position on screen stay unchanged, and only the street moves past

#### Scenario: Courier is never hidden by the HUD

- **WHEN** the game is shown at 360×640 and at 390×844
- **THEN** the courier and the papers on the bike are fully visible above the HUD panel in both

### Requirement: Suburban street built for the overhead view

The street SHALL be built from repeating chunks recycled by distance, and SHALL contain, on both sides of the road: kerbs, pavements, front gardens and boundary planting. The far side SHALL carry the houses: detached homes at irregular spacing with roofs, chimneys, windows, front doors, porches, garden paths and driveways.

The scene SHALL include ordinary street furniture and parked vehicles.

Nothing in the street SHALL be a target, a scoring object or an obstacle in the courier's path: objects that suggest steering, aiming or collision MUST NOT sit on the courier's line of travel, and there SHALL be no letterboxes, bins, hoops or markers to aim at.

House spacing SHALL vary, so no fixed interval or repeating pattern is visible along the street.

#### Scenario: Both sides of the street are dressed

- **WHEN** any frame of a running round is inspected
- **THEN** the road, both kerbs, both pavements, gardens on both sides and houses on the far side are all present

#### Scenario: Nothing sits in the courier's path

- **WHEN** the scene objects within one chunk are listed with their positions
- **THEN** no object overlaps the courier's travel lane, and no object is a target, a collectable or a scoring marker

#### Scenario: Spacing does not repeat

- **WHEN** the gaps between consecutive houses over 20 chunks are measured
- **THEN** the gaps vary and no fixed interval repeats

### Requirement: Adult courier on a delivery bicycle

The courier SHALL read unambiguously as an adult at the size they appear on a phone:

- adult body proportions and build, never child-like proportions;
- work clothing: a helmet and a high-visibility vest or jacket;
- a utility delivery bicycle with an upright riding position and a rear cargo crate carrying the papers.

The bicycle MUST NOT be styled as a child's or stunt bike, and the courier MUST NOT perform tricks, stunts or slapstick. The game MUST NOT include children or characters who seem under 25, animals, mascots, toy-like props or candy colours, in the game, its lobby tiles, its thumbnails or its demo builds.

The number of paper rolls visible in the crate SHALL equal the number of unthrown papers.

#### Scenario: Art review passes

- **WHEN** the release art checklist is run against the in-game scene and the lobby tile
- **THEN** every item passes: adult proportions, helmet and high-visibility clothing, utility bicycle with cargo crate, no animals or mascots, no toy-like or candy styling, no stunts

#### Scenario: Crate shows the papers left

- **WHEN** 5 papers are unthrown, then 3, then none
- **THEN** the crate shows 5, then 3, then no rolls

### Requirement: First-light setting

The scene SHALL be lit as early morning: a low sun, long shadows, warm light with cooler shade, and haze toward the far end of the street. Some house windows SHALL be lit.

The lighting SHALL NOT change with the multiplier in a way that reads as progress or as a reward, and SHALL NOT be used to signal what is about to happen in the round.

#### Scenario: Morning look holds through the round

- **WHEN** a round runs from 1.00 to its maximum multiplier
- **THEN** the sun angle, shadow length and colour grade stay within the morning range for the whole round

#### Scenario: Light reveals nothing

- **WHEN** a setback or a crash is 2 seconds away
- **THEN** the lighting, haze and shadows look the same as in a round where nothing is about to happen

### Requirement: Light HUD visual system

The HUD SHALL use a light visual system over the scene: near-white translucent panels with soft shadows, dark ink text, and a single warm accent colour used for the primary action and for win copy only.

Type SHALL be a display face for labels and headings and a monospaced face for money, multipliers and clock values, so digits align and do not shift as they change.

The HUD SHALL keep the controls, information and order already required of it, and every control SHALL stay at least 44 px tall with legible contrast against the panel.

#### Scenario: Money does not jitter

- **WHEN** a value counts up from 1.00 to 12.00 while riding
- **THEN** the digits keep a fixed width and the surrounding layout does not move

#### Scenario: Accent is reserved

- **WHEN** a round ends at or below the stake
- **THEN** the accent colour appears only on the primary action, and never on the result copy or amounts

#### Scenario: Readable over the scene

- **WHEN** the HUD is measured over the brightest and the darkest parts of the scene
- **THEN** text and panel contrast meet the project's accessibility floor in both

### Requirement: Depth treatment keeps the play area sharp

The frame SHALL use a shallow depth-of-field treatment: the top and bottom bands of the frame are softened while the band containing the courier and the nearby porches stays sharp.

The treatment SHALL be disabled when the player or the system asks for reduced motion or reduced effects, and SHALL be dropped first when the render quality tier steps down.

#### Scenario: Courier band stays sharp

- **WHEN** a running round is inspected
- **THEN** the courier, the bike and the papers are rendered sharp, while the far end of the street and the near foreground are softened

#### Scenario: Reduced effects

- **WHEN** the player turns on reduced effects
- **THEN** the softening is removed and the whole frame renders sharp, with no other change to what is shown
