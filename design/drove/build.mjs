// Builds the Drove concept canvas: one artboard per phase-1 concept, plus canvas.json.
// Run: node design/drove/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { CONCEPTS, PAL, HUD, SHELL } from './src/concepts.mjs';

const dir = new URL('.', import.meta.url).pathname;
const world = readFileSync(dir + 'src/world.js', 'utf8');

const icon = {
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.01"></path></svg>',
  minus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"></path></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"></path><path d="M12 6v12"></path></svg>',
};

const DEFAULTS = {
  mult: 'x1.00', multOpacity: 0.5, multColor: HUD.multFg, label: 'DROVE · STAKE $1.00',
  clock: '00:14:52', net: '$0.00', stakeOpacity: 1,
  btnTop: 'BET $1.00', btnSub: 'Next drive in 5s', btnBg: HUD.btnIdleBg, btnFg: HUD.btnIdleFg,
  showBanner: false, banner: '', bannerSub: '', bannerBg: HUD.lossBg, bannerFg: HUD.lossFg,
  cue: '', showChance: false, chance: '—', chanceLabel: 'CHANCE THE GATE IS OPEN',
  showParts: false, partA: 'A  open  $0.50', partB: 'B  open  $0.50',
};

/** Lifecycle + value plumbing for the design-canvas runtime. */
const dcAdapter = `
  componentDidMount() {
    this.g = this.startState();
    this.last = 0;
    this.hudKey = '';
    const step = (now) => {
      this.raf = requestAnimationFrame(step);
      if (!this.cv || !this.cv.isConnected) this.cv = document.getElementById('scene');
      if (!this.cv) return;
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
      this.last = now;
      this.tick(dt);
      this.paint(this.cv.getContext('2d'), dt);
    };
    this.raf = requestAnimationFrame(step);
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.raf);
  }

  reduced() {
    return !!this.props.reducedMotion;
  }

  pushVals(n) {
    const key = JSON.stringify(n);
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.setState(n);
  }

  renderVals() {
    return Object.assign(${JSON.stringify(DEFAULTS)}, this.state || {});
  }
`;

function cfgMethod(c) {
  const cfg = {
    name: c.name, mode: c.mode, verb: c.verb, rounds: c.rounds, pal: PAL, hud: HUD,
  };
  return `  cfg() {\n    return ${JSON.stringify(cfg, null, 4).replace(/\n/g, '\n    ')};\n  }\n`;
}

function page(c) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${SHELL.fonts}&display=swap">
  <style>
    body { margin: 0; background: ${SHELL.bg}; }
    a { color: ${SHELL.link}; } a:hover { color: #efe6d4; }
  </style>
</helmet>
<div style="position:relative;width:390px;height:844px;overflow:hidden;background:${SHELL.bg};font-family:${SHELL.ui};color:#efe6d4">
  <canvas id="scene" width="780" height="1688" style="position:absolute;left:0;top:0;width:390px;height:844px;display:block"></canvas>

  <!-- Rules before any bet, session clock and net position: on screen in every state. -->
  <div style="position:absolute;left:0;right:0;top:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 6px;background:rgba(10,12,20,.62);font-size:12px">
    <div style="display:flex;align-items:center;gap:2px">
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${icon.info}</div>
      <span style="font-weight:600">Rules</span>
    </div>
    <div style="display:flex;align-items:center;gap:16px">
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2">
        <span style="font-size:10px;letter-spacing:.12em;opacity:.65">SESSION</span>
        <span style="font-weight:600;font-variant-numeric:tabular-nums">{{clock}}</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2">
        <span style="font-size:10px;letter-spacing:.12em;opacity:.65">NET</span>
        <span style="font-weight:600;font-variant-numeric:tabular-nums">{{net}}</span>
      </div>
    </div>
  </div>

  <!-- The multiplier is the hero number. A themed count may sit beside it, never instead of it. -->
  <div style="position:absolute;left:0;right:0;top:72px;display:flex;flex-direction:column;align-items:center;gap:2px">
    <span style="font-size:11px;font-weight:700;letter-spacing:.2em;opacity:.8">{{label}}</span>
    <span style="font-family:${SHELL.display};font-size:96px;line-height:.98;color:{{multColor}};text-shadow:0 3px 22px rgba(0,0,0,.5);font-variant-numeric:tabular-nums;opacity:{{multOpacity}}">{{mult}}</span>
    <sc-if value="{{showChance}}" hint-placeholder-val="{{ false }}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:4px;padding:5px 12px;border:1.5px solid rgba(239,230,212,.35)">
        <span style="font-size:9px;font-weight:600;letter-spacing:.14em;opacity:.7">{{chanceLabel}}</span>
        <span style="font-family:${SHELL.display};font-size:26px;line-height:1">{{chance}}</span>
      </div>
    </sc-if>
  </div>

  <!-- Modifier and part cues. Decoration only: nothing here is tappable. -->
  <sc-if value="{{cue}}" hint-placeholder-val="{{ '' }}">
    <div style="position:absolute;left:0;right:0;top:252px;display:flex;justify-content:center">
      <span style="padding:6px 14px;background:rgba(10,12,20,.82);font-family:${SHELL.display};font-size:20px;letter-spacing:.06em">{{cue}}</span>
    </div>
  </sc-if>

  <sc-if value="{{showBanner}}" hint-placeholder-val="{{ false }}">
    <div style="position:absolute;left:26px;right:26px;top:312px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:18px 14px;background:{{bannerBg}};color:{{bannerFg}}">
      <span style="font-family:${SHELL.display};font-size:42px;line-height:1;text-align:center">{{banner}}</span>
      <span style="font-size:14px;font-weight:600;text-align:center">{{bannerSub}}</span>
    </div>
  </sc-if>

  <div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:11px;padding:26px 16px 18px;background:linear-gradient(180deg, rgba(10,12,20,0) 0%, rgba(10,12,20,.88) 22%, rgba(10,12,20,.96) 100%)">
    <sc-if value="{{showParts}}" hint-placeholder-val="{{ false }}">
      <div style="display:flex;gap:8px;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums">
        <span style="flex:1;padding:6px 10px;background:rgba(239,230,212,.1)">{{partA}}</span>
        <span style="flex:1;padding:6px 10px;background:rgba(239,230,212,.1)">{{partB}}</span>
      </div>
    </sc-if>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="display:flex;align-items:center;gap:6px;opacity:{{stakeOpacity}}">
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1.5px solid currentColor">${icon.minus}</div>
        <div style="display:flex;flex-direction:column;align-items:center;min-width:72px;line-height:1.15">
          <span style="font-size:10px;letter-spacing:.12em;opacity:.65">STAKE</span>
          <span style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums">$1.00</span>
        </div>
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1.5px solid currentColor">${icon.plus}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.15">
        <span style="font-size:10px;letter-spacing:.12em;opacity:.65">AUTO COLLECT</span>
        <span style="font-size:15px;font-weight:600">Off</span>
      </div>
    </div>
    <div style="height:66px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:{{btnBg}};color:{{btnFg}}">
      <span style="font-family:${SHELL.display};font-size:27px;line-height:1;letter-spacing:.03em">{{btnTop}}</span>
      <span style="font-size:13px;font-weight:600;font-variant-numeric:tabular-nums">{{btnSub}}</span>
    </div>
    <span style="font-size:10.5px;text-align:center;opacity:.68;line-height:1.35">${SHELL.footer}</span>
  </div>
</div>
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":390,"height":844},"reducedMotion":{"editor":"boolean","default":false}}'>
class Component extends DCLogic {
${cfgMethod(c)}
${dcAdapter}
${world}
}
</script>
</body>
</html>
`;
}

mkdirSync(dir + 'directions', { recursive: true });
for (const c of CONCEPTS) writeFileSync(dir + 'directions/' + c.file, page(c));

const canvas = {
  artboards: CONCEPTS.map((c, i) => ({
    file: 'directions/' + c.file,
    x: i * 480, y: 0, w: 390, h: 844,
    title: c.title,
    is_interactive: false,
  })),
  annotations: [
    {
      id: 'brief', x: 0, y: -290, w: 1400,
      text:
        'DROVE — phase-1 concepts for game #4. Five mechanics, one art direction, held constant on purpose: ' +
        'the comparison is the axis that changes the round, not the paint. Each artboard plays live — a 5 s ' +
        'betting gap, the drive building with the value, then a collect or a cut-off — and loops three scripted rounds.\n\n' +
        'The seed was "you are a sheep in a flock and a wolf takes it all". The mechanic survived intact; the fiction did not. ' +
        'Sheep are the worked example in the CAP under-18 guidance ("‘cuddly’ or ‘cute’ animals", and "characters with ' +
        'similarities to soft toys in particular should be avoided"), the wolf-and-sheep story is in the same high-risk list ' +
        'under "Common fairy tales, like Little Red Ridinghood", and CAP §13/§14 reach the game’s own theme, not only its ads. ' +
        'So the flock became a cattle drive at dusk, drawn at eye level from inside the mob.\n\n' +
        'No predator is ever drawn. It cannot appear before the crash — that is advance warning of T — and must not be shown ' +
        'at the crash either, which is the horse-fall beat the earlier audits already banned. The hazard is the mob turning and the gate.\n\n' +
        'Rules held in every scene: value rises from x1.00 and the multiplier is the hero number; one stake, one collect verb, ' +
        'nothing else is tappable and the mob never reacts to a tap; no other animal is ever shown being taken (that is a near-miss); ' +
        'crowd density and dust follow elapsed time only, never the crash time; a win banner only when the round total beats the stake, ' +
        'otherwise RETURNED with the net; session clock, net position and a rules entry on screen in every state.\n\n' +
        'The animals are rough placeholders — silhouettes, backs and horns, no faces and no mascot. Production art would be ' +
        'pre-rendered sprite sheets sized for low-end Android. Toggle "reducedMotion" on an artboard for the calm version. ' +
        'Stake, balances and net are sample data.',
    },
    ...CONCEPTS.map((c, i) => ({ id: 'note-' + (i + 1), x: i * 480, y: 900, w: 390, text: c.note })),
    {
      id: 'engines', x: 0, y: 1180, w: 1400,
      text:
        'Certification cost, left to right: ' +
        CONCEPTS.map((c) => c.name + ' — ' + c.engineId).join('  ·  ') +
        '.\nFour of the five are skins on already-certified ids: registerGame(<game>, \'whack-crash\') and nothing in core or ' +
        'fairness changes. Two Pens is the exception and the only one that needs fresh simulate reports.',
    },
  ],
  launch: { view: 'canvas' },
};
writeFileSync(dir + 'canvas.json', JSON.stringify(canvas, null, 2));
console.log('built', CONCEPTS.length, 'artboards');
