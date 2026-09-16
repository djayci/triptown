# Game fact sheet: {{game}} ({{date}}, commit {{sha}})

Every line needs evidence: `file:line`, or a command and its output. Write "unknown" rather than guessing.

## Identity
- Game type (crash, mines, slot, …) and theme:
- Round model (solo, shared):
- Spec change:

## Math
- RTP, and how it is proven (report path):
- Growth / payout formula:
- Crash or outcome sampling:
- Modifiers (setbacks, bonuses). Can the value fall? Can a return be below stake?
- Max win / max multiplier / caps / forced endings:
- Minimum cash-out:
- Rounding:
- Round duration distribution (median, p10, p90) and instant-end probability:

## RNG
- Entropy source and seeding:
- Derivation and streams:
- Mapping to outcomes:
- Crypto implementation (platform or custom):
- Float determinism of settlement maths:
- Seed storage, encryption, rotation:
- Player-influenced inputs (client seed):

## Settlement
- Time authority / latency handling:
- Disconnect behaviour:
- System failure / refunds:
- Idempotency, locking scope (session or player):
- Kill switch:

## Player experience
- Bet limits:
- Replay flow and input guards (ms):
- Autoplay / auto cash-out / auto-rebet:
- Win presentation (effects, sounds, labels), and whether it differs when return ≤ stake:
- Skill-like framing (copy, interactive decorations, reflex cues):
- Intensity features (speed-up, music, shake):
- Rules/help screen:
- RTP / max win display:
- History / recall:
- Clock, net position, reality check, RG links:
- Languages:
- Accessibility (colour-only coding, sound default, reduced motion):

## Art, audio and marketing
- Style (cartoon, mascots, palette) and where it appears (game, tiles, demo):
- Audio sources and licences:

## Platform
- Hosting provider and regions:
- Data stores and retention:
- Logs / audit trail:
- Software integrity checks:
- Environments and change control:
- Operator bridge (messages, target origin):
- Demo/mock exclusion from production:
