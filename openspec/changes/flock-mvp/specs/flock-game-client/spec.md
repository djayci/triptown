## Purpose

How Flock presents a crash round. It covers what each state shows, how the gathering flock and the pace show the multiplier without revealing the outcome, how the pen and the wolf are shown so neither reads as a near miss or as harm, and what the player hears and can reach before betting. The maths is the shared engine's; this capability covers only what the player sees, hears and can do.

## ADDED Requirements

### Requirement: Flock plays a certified engine's configuration
Flock SHALL be registered against the Whack Crash engine and SHALL resolve its round configuration through the same profile machinery as any other game. It MUST NOT introduce a configuration id of its own. It MUST NOT start a round on a configuration that has no committed passing RTP report. It MUST NOT offer deferred reveal.

#### Scenario: Same configuration as the engine
- **WHEN** Flock and Whack Crash are bound to the same jurisdiction profile
- **THEN** both resolve the same configuration id

#### Scenario: No configuration without a report
- **WHEN** a profile would resolve Flock to a configuration with no passing RTP report
- **THEN** the game refuses to start a round under that profile

#### Scenario: Deferred reveal is not available
- **WHEN** a profile sets `crashReveal: 'onCollect'` and binds to Flock
- **THEN** Flock rounds play live, with the crash shown when it happens

### Requirement: The multiplier and the money are the primary values
Throughout a running round the client SHALL display, as its two most prominent values:
- the current multiplier;
- the return the player would receive on cashing out, in the session's currency.

No themed element SHALL be styled as a money value or replace the multiplier. No count of rams SHALL be displayed.

#### Scenario: Running round
- **WHEN** a round is running at x1.42 on a 1.00 stake
- **THEN** the screen shows x1.42 and 1.42 in the session currency as its two largest values, and no ram count

### Requirement: The flock and the pace never know the crash
The number of rams running with the player's ram SHALL be a non-decreasing pure function of the multiplier on screen:
- none at x1.00;
- at least one before x1.50;
- the field full at high values.

Rams SHALL join in a fixed order, nearest the player's ram first and out towards the horizon last. The running pace, dust, speed lines and music intensity SHALL depend only on the multiplier or the round's elapsed time. Nothing seen or heard SHALL depend on the crash time, the time remaining or any future setback. Nothing SHALL change to signal that the round is about to end.

#### Scenario: Same multiplier, different crash times
- **WHEN** two rounds reach x4.00 and one crashes a tick later while the other continues
- **THEN** both show the same flock, the same pace and the same music intensity at x4.00

#### Scenario: Alone at the start
- **WHEN** a round starts at x1.00
- **THEN** the player's ram is the only ram on screen

#### Scenario: Effects off or reduced motion
- **WHEN** the profile sets `intensityEffects` off, or the player's system requests reduced motion
- **THEN** the flock still shows the multiplier. With reduced motion, rams fade in and out instead of running in or bolting, nothing shakes and no particles play.

### Requirement: The player's ram is always identifiable
The player's ram SHALL be drawn distinctly from the flock, with a lighter fleece and a stronger rim light, and SHALL keep a clear lane at a fixed place on screen. No ram of the flock SHALL be drawn over him.

#### Scenario: Largest flock
- **WHEN** the flock is at its largest
- **THEN** the player's ram is fully visible in his lane and no other ram overlaps him

### Requirement: Pen and wolf never read as a near miss or as harm
Pressing CASH OUT SHALL lock the displayed value immediately and send exactly one cash-out, however many times the control is pressed. The flock SHALL pull up only after the server confirms the cash-out.

The wolf SHALL appear only when the crash event arrives and SHALL never be drawn, hinted at or heard before it. When it appears:
- it SHALL stop short of every ram, and no ram SHALL be shown caught, hurt or taken;
- the flock SHALL turn and bolt, each ram facing the direction it moves;
- no copy SHALL describe how close the round came.

#### Scenario: Cash-out confirmed
- **WHEN** the player presses CASH OUT at x3.80 and the server settles the cash-out
- **THEN** the flock pulls up and the result shows the settled return, and the button reads CASHED OUT

#### Scenario: Press loses the tie
- **WHEN** the player presses CASH OUT and the server reports the crash first
- **THEN** no pull-up starts, the wolf appears ahead of the flock, the flock bolts, and the result shows the stake lost

#### Scenario: No wolf before the crash
- **WHEN** a round is one tick before its crash time
- **THEN** no wolf, wolf sound or wolf-related cue is present

### Requirement: A setback shows as the flock splitting
Under a profile with setbacks on, a setback SHALL be shown as part of the flock splitting off. They peel away from the run while still facing their direction of travel, until the flock matches the halved value. A split SHALL NOT show harm or a predator. Under a profile with setbacks off, no split SHALL ever be shown.

#### Scenario: Setback at x3.00
- **WHEN** a setback lands on a profile with setbacks on and the value falls from x3.00 to x1.50
- **THEN** the flock shrinks to the size shown at x1.50, the departing rams run off while facing the way they go, and a split cue names the x0.5

#### Scenario: Brazil or Portugal profile
- **WHEN** the profile sets `setbacksMode` off
- **THEN** no round ever shows a split

### Requirement: Results are shown without celebrating a loss
When a round settles, the client SHALL show the amount returned and the net result. Win effects SHALL play only when the return is strictly greater than the stake:
- celebration animation;
- win sound;
- a gain-styled label;
- shake.

A return equal to or below the stake SHALL be presented neutrally.

#### Scenario: A win
- **WHEN** a round returns 2.41 on a 1.00 stake
- **THEN** the result celebrates and shows a net gain of 1.41

#### Scenario: Returned at the stake after a split
- **WHEN** a round returns exactly 1.00 on a 1.00 stake
- **THEN** no win effect or win sound plays, and the result shows RETURNED with a net of 0.00

#### Scenario: A crash
- **WHEN** a round crashes on a 1.00 stake
- **THEN** no win effect plays and the result shows a net loss of 1.00

### Requirement: Adult art and plain copy
Every ram SHALL read as a grown male animal:
- a curled horn;
- a long nose;
- a working fleece;
- no lamb, no eyes, no face and no mascot treatment.

The art SHALL be life-like, not cartoon: realistic proportions, a muted palette and no exaggerated features. The wolf SHALL be a lean adult silhouette, shown only after the crash. No state SHALL show:
- blood, a bite, a chase that closes in, or a fallen animal;
- rams butting, clashing or fighting each other;
- sacrifice, slaughter or religious-festival cues.

Player-facing copy SHALL NOT use:
- skill, speed or near-miss language, including "faster", "hurry", "close call", "almost" or "nearly";
- toughness, courage or rite-of-passage framing, such as "brave", "fearless", "tough" or "bold";
- any word suggesting a ram was caught, killed or eaten.

#### Scenario: Copy check
- **WHEN** the message catalogue is scanned by the copy check
- **THEN** it contains none of the banned words, and the check fails on a fixture that does

#### Scenario: A split under setbacks
- **WHEN** half the flock splits off on a setback
- **THEN** the departing rams run off without touching another ram, and no ram butts, clashes or squares up to another

#### Scenario: The wolf appears
- **WHEN** the wolf appears at a crash
- **THEN** the player's ram pulls up and the flock bolts; no ram stands its ground or faces the wolf down

### Requirement: Flock has its own audio
Flock SHALL ship its own sound effects and music, created for this game:
- hoof rhythm and music whose intensity follows the multiplier or elapsed time;
- a ram-joining cue;
- a pen sound;
- a wolf and scatter sound;
- a win sound.

None of these files or their synthesis code SHALL be shared with another game. Audio SHALL fit the 1.5 MB budget, with every source recorded. The win sound SHALL play only when the win effects may play. No sound SHALL depend on anything but the multiplier, elapsed time and the events already shown on screen.

#### Scenario: Budget and sources
- **WHEN** the production build runs
- **THEN** the audio budget check passes and every audio file is listed in Flock's sources file

#### Scenario: No shared audio
- **WHEN** Flock's audio is built
- **THEN** no file outside Flock's own app is created or modified

### Requirement: Rules before any bet
The rules SHALL be reachable before any bet and SHALL state:
- the RTP band from the committed report at the market's stake;
- that the outcome of every round is fixed when it starts;
- that the flock, the wolf and the scenery are decoration, and pressing does nothing but cash out;
- the maximum win, rounding and the disconnect policy;
- under a setbacks profile, what a split does to the value.

#### Scenario: Rules before betting
- **WHEN** the player opens the rules before placing a bet
- **THEN** the rules show the RTP band for the resolved configuration and the decoration statement, and no bet is placed
