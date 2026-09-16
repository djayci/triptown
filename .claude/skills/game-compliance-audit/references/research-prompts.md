# Research agent prompts

Spawn these in parallel: one message, several Agent calls, `run_in_background: true`. Paste the filled fact sheet in place of `{{FACTS}}`, the target markets in place of `{{MARKETS}}`, and today's date in place of `{{DATE}}`.

Instructions every prompt must include:
> Use WebSearch and WebFetch. Prefer primary sources: standards, regulator sites, official gazettes. Cite a URL and section for every requirement. Tag each claim H (primary text read), M (regulator page or several reliable secondary sources) or L (thin sources). Never invent section numbers or legal citations; write "not verified" instead. Today is {{DATE}}. Flag anything changed in the last 24 months. Save any primary text you download to the scratchpad and list the file paths in your report. Output: for each requirement → the game's status (PASS / GAP / RISK / UNKNOWN) → the concrete change needed, then a ranked list of top gaps.

## 1. Test lab and RNG standards
Research what accredited labs certify against for this game: GLI-19 (current version), relevant GLI documents, how RNG certification is done (CSPRNG, seeding, mapping, statistical batteries, provably fair acceptance, custom crypto), math/PAR report expectations, game recall, interrupted games, software integrity and change control, RGS operations (time sync, logs, backups, ISO 27001, cloud). Include precedents: which similar games are certified, by which labs, for which markets. Game facts: {{FACTS}}

## 2. United Kingdom
Research the UK Gambling Commission requirements for this game as supplied by a B2B studio:
- licences (software, game host) and relevant LCCP conditions;
- every RTS that applies, and its current scope (slots-only vs all casino games);
- stake limits scope;
- losses shown as wins, speed and intensity rules;
- CAP/ASA appeal-to-children rulings;
- the supplier vs operator split of responsibilities;
- testing strategy and games register;
- enforcement cases against suppliers;
- classification as a game of chance.

Game facts: {{FACTS}}

## 3. Europe and offshore hubs
For {{MARKETS}} (default: Malta, Curaçao, Isle of Man, Gibraltar, Portugal, Spain, Germany, Netherlands, Sweden, Denmark, Italy), research:
- the supplier licence or registration needed, with cost and timeline;
- the legal status of this game type;
- game-specific technical rules;
- design limits (speed, autoplay, stakes, RTP display, minors);
- hosting and data location;
- GDPR implications.

Include a comparison table and a recommended first-licence path. Game facts: {{FACTS}}

## 4. Americas and Africa
For {{MARKETS}} (default: Brazil, Ontario, NJ/PA/MI, Colombia, Peru, Mexico, Argentina, Kenya, Nigeria, South Africa, Ghana, Uganda, Tanzania), research:
- supplier licensing;
- status of this game type;
- lab certification requirements and recognised labs;
- design rules;
- hosting and data location;
- taxes that affect product design;
- regulator actions against this game type.

Include a summary table and a recommended market order. Game facts: {{FACTS}}

## 5. Game-design risk review (reads the repo)
Read-only review of the codebase at `{{REPO_PATH}}`. Cross-reference regulator guidance, lab standards and gambling-harm research for:
- losses disguised as wins;
- near-miss effects;
- illusion of control and skill framing;
- speed and intensity;
- appeal to minors;
- autoplay vs auto cash-out and quick replay;
- rules and transparency;
- latency fairness;
- responsible-gambling hooks and the operator bridge;
- accessibility and dark patterns.

Give risk level, evidence (URLs plus file:line) and the change for each, as a per-jurisdiction config flag where possible. Split into "change now for every market" and "configurable per jurisdiction".

## 6. Watch-list refresh (quick depth)
For each item on the watch list in `jurisdictions.md`, find its current status with primary sources. Report `changed / unchanged / still unclear`, with URL, date and confidence.
