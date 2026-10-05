// Builds the shareable concept canvas: five live phone frames on one board.
// Source of truth is src/world.js + src/concepts.mjs, the same pair the
// design-canvas artboards are generated from.
// Run: node design/drove/build-canvas.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { CONCEPTS, PAL, HUD, SHELL } from './src/concepts.mjs';

const dir = new URL('.', import.meta.url).pathname;
const world = readFileSync(dir + 'src/world.js', 'utf8');

const SPEC = {
  DROVE: {
    axis: 'Pacing',
    status: 'Recommended',
    tone: 'go',
    line: 'Rising only, slow pace. The value is attached to how deep you still are in a mob you cannot steer; the only move is to leave.',
    rows: [
      ['Engine', 'whack-crash/v3-rising'],
      ['New maths', 'None — report committed'],
      ['Markets', 'All, incl. BR + PT'],
      ['Cost', 'One skin app'],
    ],
  },
  SCATTER: {
    axis: 'Setbacks',
    status: 'Runner-up',
    tone: 'warn',
    line: 'The mob shoulders you back and the value halves. The game becomes the recovery.',
    rows: [
      ['Engine', 'whack-crash/v3'],
      ['New maths', 'None — report committed'],
      ['Markets', 'All except BR + PT'],
      ['Blocker', 'BR 1.207 item 14(d) · PT R1/R22'],
    ],
  },
  'NIGHT FOLD': {
    axis: 'Deferred reveal',
    status: 'Duplicates Gate Rush',
    tone: 'stop',
    line: 'The cut-off is already decided and hidden. You learn at the break, with the live chance on screen throughout.',
    rows: [
      ['Engine', "v3-rising + crashReveal 'onCollect'"],
      ['New maths', 'None — reuses gate-odds-mvp'],
      ['Markets', 'NG + GH only'],
      ['Gate', 'Lagos lab + GCG letter'],
    ],
  },
  'TWO PENS': {
    axis: 'Split stake',
    status: 'Most expensive',
    tone: 'warn',
    line: 'One stake, one debit, one round id, two pens collected separately. The only new money path here.',
    rows: [
      ['Engine', 'new id, stakeParts: 2'],
      ['New maths', 'Yes — 10M-round report per id'],
      ['Markets', 'All except PT'],
      ['Also', 'GLI-19 §4.4.2 per-part displays'],
    ],
  },
  STRAYS: {
    axis: 'Boosts',
    status: 'Config, not a game',
    tone: 'warn',
    line: 'Strays fold in and lift the value 5%. The crash hazard already pays for the lift.',
    rows: [
      ['Engine', 'whack-crash/v4-rising'],
      ['New maths', 'None — report committed'],
      ['Markets', 'Unregulated now'],
      ['Gate', 'Lab acceptance of boosted ids'],
    ],
  },
};

const frame = (c, i) => `
      <article class="col" id="col-${i}">
        <header class="col-head">
          <p class="axis">${SPEC[c.name].axis}</p>
          <h2>${c.name}</h2>
          <p class="status ${SPEC[c.name].tone}">${SPEC[c.name].status}</p>
        </header>

        <div class="frame" data-concept="${i}">
          <canvas class="scene" width="780" height="1688" aria-hidden="true"></canvas>
          <div class="hud">
            <div class="strip">
              <span class="rules">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.01"></path></svg>
                Rules
              </span>
              <span class="readouts">
                <span class="readout"><i>SESSION</i><b data-k="clock">00:14:52</b></span>
                <span class="readout"><i>NET</i><b data-k="net">$0.00</b></span>
              </span>
            </div>

            <div class="value">
              <span class="vlabel" data-k="label">${c.name} · STAKE $1.00</span>
              <span class="mult" data-k="mult">x1.00</span>
              <span class="chance" data-k="chanceWrap" hidden>
                <i data-k="chanceLabel">CHANCE THE GATE IS OPEN</i>
                <b data-k="chance">97%</b>
              </span>
            </div>

            <div class="cue" data-k="cueWrap" hidden><span data-k="cue"></span></div>

            <div class="banner" data-k="bannerWrap" hidden>
              <span class="btext" data-k="banner"></span>
              <span class="bsub" data-k="bannerSub"></span>
            </div>

            <div class="panel">
              <div class="parts" data-k="partsWrap" hidden>
                <span data-k="partA"></span><span data-k="partB"></span>
              </div>
              <div class="betrow" data-k="betrow">
                <span class="stepper">
                  <span class="step">−</span>
                  <span class="stake"><i>STAKE</i><b>$1.00</b></span>
                  <span class="step">+</span>
                </span>
                <span class="auto"><i>AUTO COLLECT</i><b>Off</b></span>
              </div>
              <div class="btn" data-k="btn">
                <span class="btop" data-k="btnTop">BET $1.00</span>
                <span class="bsubtle" data-k="btnSub">Next drive in 5s</span>
              </div>
              <p class="foot">${SHELL.footer}</p>
            </div>
          </div>
        </div>

        <p class="line">${SPEC[c.name].line}</p>
        <dl class="spec">
          ${SPEC[c.name].rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n          ')}
        </dl>
        <p class="note">${c.note.split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim()}</p>
      </article>`;

const page = `<title>Drove Concept Canvas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
  :root {
    --ground: #e6e0d2;
    --board: #f3efe5;
    --ink: #191510;
    --dim: #5f5648;
    --rule: rgba(25, 21, 16, 0.14);
    --accent: #b84c15;
    --go: #2f6b3a;
    --warn: #8a5a12;
    --stop: #8c3a2c;
    --chip: rgba(25, 21, 16, 0.06);
    --display: 'Anton', 'Arial Narrow', sans-serif;
    --ui: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
    --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      --ground: #13110d;
      --board: #1c1915;
      --ink: #ece4d6;
      --dim: #9a8e7c;
      --rule: rgba(236, 228, 214, 0.14);
      --accent: #e8762b;
      --go: #83c08e;
      --warn: #e0ad5a;
      --stop: #e98a74;
      --chip: rgba(236, 228, 214, 0.08);
    }
  }
  :root[data-theme='dark'] {
    --ground: #13110d;
    --board: #1c1915;
    --ink: #ece4d6;
    --dim: #9a8e7c;
    --rule: rgba(236, 228, 214, 0.14);
    --accent: #e8762b;
    --go: #83c08e;
    --warn: #e0ad5a;
    --stop: #e98a74;
    --chip: rgba(236, 228, 214, 0.08);
  }

  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: var(--ui);
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { padding: 0 20px; max-width: 1560px; margin: 0 auto; }

  /* ---- masthead ---- */
  .top {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 18px;
    padding-block: 34px 14px;
  }
  .top h1 {
    font-family: var(--display); font-weight: 400; font-size: clamp(38px, 7vw, 66px);
    letter-spacing: 0.012em; line-height: 0.96; margin: 0; text-wrap: balance;
  }
  .kicker {
    font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--dim); margin: 0;
  }
  .top .kicker { flex-basis: 100%; }
  .sub { margin: 0; color: var(--dim); max-width: 62ch; }

  .controls { display: flex; gap: 8px; margin-left: auto; }
  button.ctl {
    font: inherit; font-size: 13px; font-weight: 600; color: var(--ink);
    background: var(--board); border: 1px solid var(--rule); border-radius: 2px;
    padding: 7px 13px; cursor: pointer;
  }
  button.ctl[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: #fff; }
  button.ctl:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* ---- brief ---- */
  .brief {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 0;
    border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule);
    margin-block: 18px 30px;
  }
  .brief section { padding: 20px 26px 22px 0; }
  .brief section + section { border-top: 1px solid var(--rule); }
  @media (min-width: 620px) {
    .brief section + section { border-top: 0; border-left: 1px solid var(--rule); padding-left: 26px; }
  }
  .brief h3 {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--accent); margin: 0 0 9px;
  }
  .brief p { margin: 0 0 9px; font-size: 14px; }
  .brief p:last-child { margin-bottom: 0; }
  .brief ul { margin: 0; padding-left: 17px; font-size: 14px; }
  .brief li { margin-bottom: 5px; }
  .brief li::marker { color: var(--accent); }
  .q { color: var(--dim); font-style: italic; }

  /* ---- the strip ---- */
  .strip-wrap {
    overflow-x: auto; overflow-y: hidden; scroll-snap-type: x proximity;
    padding: 0 0 16px; scroll-padding-inline: 20px;
  }
  .strip-inner { display: flex; gap: 26px; width: max-content; padding: 0 20px 6px; }
  .col { width: clamp(278px, 80vw, 318px); scroll-snap-align: start; }

  .col-head { margin-bottom: 11px; }
  .axis {
    font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--dim); margin: 0;
  }
  .col-head h2 {
    font-family: var(--display); font-weight: 400; font-size: 31px; letter-spacing: 0.02em;
    line-height: 1.05; margin: 2px 0 5px;
  }
  .status {
    display: inline-block; margin: 0; font-size: 11.5px; font-weight: 600;
    letter-spacing: 0.04em; padding: 2px 8px; background: var(--chip); border-radius: 2px;
  }
  .status.go { color: var(--go); } .status.warn { color: var(--warn); } .status.stop { color: var(--stop); }

  .line { font-size: 14px; margin: 13px 0 0; }
  .spec { margin: 12px 0 0; border-top: 1px solid var(--rule); }
  .spec > div {
    display: grid; grid-template-columns: 82px 1fr; gap: 10px;
    padding: 6px 0; border-bottom: 1px solid var(--rule);
  }
  .spec dt {
    font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--dim); padding-top: 2px;
  }
  .spec dd { margin: 0; font-family: var(--mono); font-size: 12px; line-height: 1.45; }
  .note { font-size: 13.5px; color: var(--dim); margin: 13px 0 0; }

  /* ---- phone frame: 390x844 design px, scaled by container width ---- */
  .frame {
    position: relative; container-type: inline-size;
    aspect-ratio: 390 / 844; width: 100%;
    background: ${SHELL.bg}; overflow: hidden;
    border: 1px solid var(--rule);
    box-shadow: 0 18px 40px -26px rgba(0, 0, 0, 0.75);
    --px: 0.25641cqw;
    font-family: ${SHELL.ui}; color: #efe6d4;
  }
  .scene { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .hud { position: absolute; inset: 0; }

  .strip {
    position: absolute; left: 0; right: 0; top: 0;
    height: calc(52 * var(--px));
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 calc(10 * var(--px)) 0 calc(11 * var(--px));
    background: rgba(10, 12, 20, 0.62); font-size: calc(12 * var(--px));
  }
  .rules { display: flex; align-items: center; gap: calc(5 * var(--px)); font-weight: 600; }
  .readouts { display: flex; gap: calc(16 * var(--px)); }
  .readout { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2; }
  .readout i { font-style: normal; font-size: calc(10 * var(--px)); letter-spacing: 0.12em; opacity: 0.65; }
  .readout b { font-weight: 600; font-variant-numeric: tabular-nums; }

  .value {
    position: absolute; left: 0; right: 0; top: calc(72 * var(--px));
    display: flex; flex-direction: column; align-items: center; gap: calc(2 * var(--px));
  }
  .vlabel { font-size: calc(11 * var(--px)); font-weight: 700; letter-spacing: 0.2em; opacity: 0.8; }
  .mult {
    font-family: ${SHELL.display}; font-size: calc(96 * var(--px)); line-height: 0.98;
    font-variant-numeric: tabular-nums; text-shadow: 0 calc(3 * var(--px)) calc(22 * var(--px)) rgba(0, 0, 0, 0.5);
  }
  .chance {
    display: flex; flex-direction: column; align-items: center;
    margin-top: calc(4 * var(--px)); padding: calc(5 * var(--px)) calc(12 * var(--px));
    border: calc(1.5 * var(--px)) solid rgba(239, 230, 212, 0.35);
  }
  .chance i { font-style: normal; font-size: calc(9 * var(--px)); font-weight: 600; letter-spacing: 0.14em; opacity: 0.72; }
  .chance b { font-family: ${SHELL.display}; font-weight: 400; font-size: calc(26 * var(--px)); line-height: 1.05; }

  .cue { position: absolute; left: 0; right: 0; top: calc(252 * var(--px)); display: flex; justify-content: center; }
  .cue span {
    padding: calc(6 * var(--px)) calc(14 * var(--px)); background: rgba(10, 12, 20, 0.82);
    font-family: ${SHELL.display}; font-size: calc(20 * var(--px)); letter-spacing: 0.06em;
  }

  .banner {
    position: absolute; left: calc(26 * var(--px)); right: calc(26 * var(--px)); top: calc(312 * var(--px));
    display: flex; flex-direction: column; align-items: center; gap: calc(4 * var(--px));
    padding: calc(18 * var(--px)) calc(14 * var(--px)); text-align: center;
  }
  .btext { font-family: ${SHELL.display}; font-size: calc(42 * var(--px)); line-height: 1; }
  .bsub { font-size: calc(14 * var(--px)); font-weight: 600; }

  .panel {
    position: absolute; left: 0; right: 0; bottom: 0;
    display: flex; flex-direction: column; gap: calc(11 * var(--px));
    padding: calc(26 * var(--px)) calc(16 * var(--px)) calc(18 * var(--px));
    background: linear-gradient(180deg, rgba(10, 12, 20, 0) 0%, rgba(10, 12, 20, 0.88) 22%, rgba(10, 12, 20, 0.96) 100%);
  }
  .parts { display: flex; gap: calc(8 * var(--px)); font-size: calc(12 * var(--px)); font-weight: 600; font-variant-numeric: tabular-nums; }
  .parts span { flex: 1; padding: calc(6 * var(--px)) calc(10 * var(--px)); background: rgba(239, 230, 212, 0.1); }
  .betrow { display: flex; align-items: center; justify-content: space-between; gap: calc(12 * var(--px)); }
  .stepper { display: flex; align-items: center; gap: calc(6 * var(--px)); }
  .step {
    width: calc(40 * var(--px)); height: calc(40 * var(--px));
    display: flex; align-items: center; justify-content: center;
    border: calc(1.5 * var(--px)) solid currentColor; font-size: calc(18 * var(--px));
  }
  .stake, .auto { display: flex; flex-direction: column; line-height: 1.15; }
  .stake { align-items: center; min-width: calc(72 * var(--px)); }
  .auto { align-items: flex-end; }
  .stake i, .auto i { font-style: normal; font-size: calc(10 * var(--px)); letter-spacing: 0.12em; opacity: 0.65; }
  .stake b { font-size: calc(18 * var(--px)); font-variant-numeric: tabular-nums; }
  .auto b { font-size: calc(15 * var(--px)); font-weight: 600; }
  .btn {
    height: calc(66 * var(--px));
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .btop { font-family: ${SHELL.display}; font-size: calc(27 * var(--px)); line-height: 1; letter-spacing: 0.03em; }
  .bsubtle { font-size: calc(13 * var(--px)); font-weight: 600; font-variant-numeric: tabular-nums; }
  .foot { margin: 0; font-size: calc(10.5 * var(--px)); text-align: center; opacity: 0.68; line-height: 1.35; }

  /* ---- closing ---- */
  .end { border-top: 1px solid var(--rule); margin-top: 26px; padding-block: 22px 44px; }
  .end h3 {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--accent); margin: 0 0 9px;
  }
  .end p { margin: 0 0 9px; max-width: 76ch; font-size: 14px; }
  .end p:last-child { margin-bottom: 0; color: var(--dim); }
  .hint { font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); margin: 0 0 9px; }

  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <div class="top">
    <p class="kicker">Triptown Games · game #4 · phase 1 · 4 Oct 2026</p>
    <h1>Drove</h1>
    <p class="sub">Five mechanics, one art direction. The look is held constant on purpose: what differs between these frames is the axis that changes the round.</p>
    <div class="controls">
      <button class="ctl" id="calm" type="button" aria-pressed="false">Calm motion</button>
      <button class="ctl" id="play" type="button" aria-pressed="true">Pause</button>
    </div>
  </div>

  <div class="brief">
    <section>
      <h3>The seed, and what happened to it</h3>
      <p class="q">“You are a sheep in the middle of a ton of other sheep, and the longer you go the higher the multiplier, but if you find a wolf you lose it all.”</p>
      <p>The mechanic survived intact — it is a crash round, which the certified engine already plays. The fiction did not.</p>
    </section>
    <section>
      <h3>Why the sheep and the wolf went</h3>
      <p>Sheep are the worked example in the CAP under-18 guidance: “‘cuddly’ or ‘cute’ animals”, and “characters with similarities to soft toys in particular should be avoided”. The wolf-and-sheep story sits in the same high-risk list under “common fairy tales, like Little Red Ridinghood”. CAP §13 and §14 reach the game’s own theme, not only its adverts — so no art direction answers this.</p>
      <p>The wolf also cannot be drawn. Before the crash it would be advance warning of the crash time; at the crash it is the animal-harm beat the earlier audits already banned. A hazard that may not be shown either side of the moment is a word, not a hazard.</p>
    </section>
    <section>
      <h3>What it became</h3>
      <p>A cattle drive at dusk, at eye level from inside the mob. Backs, rumps and horns, no faces and no mascot. The crowd is the point: the value is attached to how deep you still are in something you cannot steer, so the only move is to leave.</p>
      <p>That is also the most honest crash fantasy available — there is nothing on screen to mistake for skill.</p>
    </section>
    <section>
      <h3>Held in every frame</h3>
      <ul>
        <li>The multiplier is the hero number; a themed count may sit beside it, never instead.</li>
        <li>One collect verb. Nothing else is tappable, and the mob never reacts to a tap.</li>
        <li>No animal is ever shown being taken — that is a near-miss.</li>
        <li>Crowd density and dust follow elapsed time only, never the crash time.</li>
        <li>A win banner only when the round total beats the stake; otherwise RETURNED, with the net.</li>
        <li>Session clock, net position and a rules entry on screen in every state.</li>
      </ul>
    </section>
  </div>

  <p class="hint">Five concepts · scroll sideways →</p>
</div>

<div class="wrap strip-wrap">
  <div class="strip-inner">
${CONCEPTS.map(frame).join('\n')}
  </div>
</div>

<div class="wrap">
  <div class="end">
    <h3>Where this goes next</h3>
    <p><strong>Pick one and it goes to phase 2 (explore), then the concept-stage compliance audit before any production art.</strong> Four of the five are skins on already-certified ids — <code>registerGame(&lt;game&gt;, 'whack-crash')</code>, with nothing in <code>core</code> or <code>fairness</code> changing. Two Pens is the exception and the only one needing fresh <code>simulate</code> reports.</p>
    <p>My call is Drove, because it needs no new maths and is the only one of the five that can ship into Brazil and Portugal as well as Nigeria and Ghana. Scatter wins instead the moment those two markets come off the list — the falling value is the most distinctive thing here.</p>
    <p>Each frame plays three scripted rounds on a loop: a 5 s betting gap, the drive building, then a collect or a cut-off. Scatter’s third round and Two Pens’ second are the compliance artboards — both return at or below the stake, and no win cue fires on either. The animals are placeholders; production art would be pre-rendered sprite sheets sized for low-end Android. Stake, balances and net are sample data. Research, not legal advice.</p>
  </div>
</div>

<script>
const PAL = ${JSON.stringify(PAL)};
const HUD = ${JSON.stringify(HUD)};
const CFGS = ${JSON.stringify(CONCEPTS.map((c) => ({ name: c.name, mode: c.mode, verb: c.verb, rounds: c.rounds })))};

let CALM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let RUNNING = true;

class Frame {
  constructor(root, cfg) {
    this.root = root;
    this._cfg = Object.assign({ pal: PAL, hud: HUD }, cfg);
    this.ctx = root.querySelector('.scene').getContext('2d');
    this.el = {};
    root.querySelectorAll('[data-k]').forEach((n) => { this.el[n.dataset.k] = n; });
    this.g = this.startState();
    this.visible = false;
    this.prev = {};
  }

  cfg() { return this._cfg; }
  reduced() { return CALM; }

  pushVals(n) {
    const e = this.el;
    const set = (k, v) => { if (this.prev[k] !== v) { this.prev[k] = v; e[k] && (e[k].textContent = v); } };
    set('clock', n.clock); set('net', n.net); set('label', n.label);
    set('mult', n.mult); set('btnTop', n.btnTop); set('btnSub', n.btnSub);
    set('banner', n.banner); set('bannerSub', n.bannerSub); set('cue', n.cue);
    set('chance', n.chance); set('chanceLabel', n.chanceLabel);
    set('partA', n.partA); set('partB', n.partB);
    if (this.prev._mc !== n.multColor) { this.prev._mc = n.multColor; e.mult.style.color = n.multColor; }
    if (this.prev._mo !== n.multOpacity) { this.prev._mo = n.multOpacity; e.mult.style.opacity = n.multOpacity; }
    if (this.prev._so !== n.stakeOpacity) { this.prev._so = n.stakeOpacity; e.betrow.style.opacity = n.stakeOpacity; }
    e.cueWrap.hidden = !n.cue;
    e.chanceWrap.hidden = !n.showChance;
    e.partsWrap.hidden = !n.showParts;
    e.bannerWrap.hidden = !n.showBanner;
    if (n.showBanner) {
      e.bannerWrap.style.background = n.bannerBg;
      e.bannerWrap.style.color = n.bannerFg;
    }
    e.btn.style.background = n.btnBg;
    e.btn.style.color = n.btnFg;
  }

${world}
}

const frames = [...document.querySelectorAll('.frame')].map(
  (el) => new Frame(el, CFGS[Number(el.dataset.concept)]),
);

// Only the frames on screen animate: five canvases at once is more than a phone owes us.
const io = new IntersectionObserver(
  (entries) => entries.forEach((en) => { en.target._frame.visible = en.isIntersecting; }),
  { rootMargin: '80px' },
);
frames.forEach((f) => { f.root._frame = f; io.observe(f.root); });

let last = 0;
function step(now) {
  requestAnimationFrame(step);
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;
  if (!RUNNING) return;
  for (const f of frames) {
    if (!f.visible) continue;
    f.tick(dt);
    f.paint(f.ctx, dt);
  }
}
requestAnimationFrame(step);

const calmBtn = document.getElementById('calm');
const playBtn = document.getElementById('play');
calmBtn.setAttribute('aria-pressed', String(CALM));
calmBtn.addEventListener('click', () => {
  CALM = !CALM;
  calmBtn.setAttribute('aria-pressed', String(CALM));
});
playBtn.addEventListener('click', () => {
  RUNNING = !RUNNING;
  playBtn.setAttribute('aria-pressed', String(RUNNING));
  playBtn.textContent = RUNNING ? 'Pause' : 'Play';
});
</script>
`;

writeFileSync(dir + 'canvas-preview.html', page);
console.log('built canvas-preview.html');
