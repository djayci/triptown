// Builds the Flock design boards from world2.js (shared dusk scene) + flock.js. Run: node design/flock/build.mjs design/flock/boards/canvas.json
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./', import.meta.url).pathname;
const P = dir + 'boards/';
// Drops a method (two-space indent, closing brace on its own line) from the shared world code.
const strip = (src, names) => names.reduce((t, n) => t.replace(new RegExp('\\n  ' + n + '\\([^)]*\\) \\{[^]*?\\n  \\}\\n'), '\n'), src);
const world = strip(readFileSync(dir + 'world2.js', 'utf8'),
  ['startState', 'begin', 'tick', 'paint', 'ROWS', 'beast', 'cowLeg', 'beastSide', 'mobRow', 'WORDS'])
  + readFileSync(dir + 'flock.js', 'utf8');

const DISPLAY = "'Anton','Arial Narrow',sans-serif";
const UI = "'Inter Tight','Helvetica Neue',Arial,sans-serif";
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&amp;family=Inter+Tight:wght@400;500;600;700&amp;display=swap">';
const icon = {
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.01"></path></svg>',
  minus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"></path></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"></path><path d="M12 6v12"></path></svg>',
};

const FRAMES = [
  { file: 'FlockLive.dc.html', title: 'Live · three rounds on a loop', name: 'Flock live round', cfg: { rounds: [{ collectAt: 11.5 }, { crashAt: 7.5 }, { collectAt: 4.0 }] } },
  { file: 'FlockBetting.dc.html', title: '1 · Betting: on his own', name: 'Flock betting', cfg: { holdBet: true, rounds: [{}] } },
  { file: 'FlockGathering.dc.html', title: '2 · The first rams join', name: 'Flock gathering', cfg: { noBet: true, rounds: [{ from: 0, to: 7.0 }] } },
  { file: 'FlockMassive.dc.html', title: '3 · A massive flock', name: 'Flock massive', cfg: { noBet: true, rounds: [{ from: 10.5, to: 15.5 }] } },
  { file: 'FlockSplit.dc.html', title: '4 · Flock splits (Scatter option)', name: 'Flock splits', cfg: { noBet: true, rounds: [{ from: 6.0, setbacks: [7.6], to: 10.0 }] } },
  { file: 'FlockPenned.dc.html', title: '5 · Penned', name: 'Flock penned', cfg: { noBet: true, rounds: [{ from: 8.0, collectAt: 9.8 }] } },
  { file: 'FlockWolf.dc.html', title: '6 · The wolf', name: 'Flock wolf', cfg: { noBet: true, rounds: [{ from: 7.0, crashAt: 9.0 }] } },
];

const DEFAULTS = {
  mult: 'x1.00', multOpacity: 0.5, multColor: '#f4ead6', clock: '00:14:52', net: '$0.00', stakeOpacity: 1,
  btnTop: 'BET $1.00', btnSub: 'Next run in 5s', btnBg: 'rgba(239,230,212,.13)', btnFg: '#efe6d4',
  showBanner: false, banner: '', bannerSub: '', bannerBg: 'rgba(10,12,20,.9)', bannerFg: '#efe6d4', cue: '',
};

const adapter = (paintCall) => `
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
      ${paintCall}
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

function phone(fr) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${fr.name}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${FONTS}
<style>
body{margin:0}
a{color:#e8762b}a:hover{color:#efe6d4}
</style>
</helmet>
<div style="position: relative; width: 390px; height: 844px; overflow: hidden; background: #141c33; font-family: ${UI}; color: #efe6d4">
<canvas id="scene" width="780" height="1688" style="position: absolute; left: 0; top: 0; width: 390px; height: 844px; display: block"></canvas>
<div style="position: absolute; left: 0; right: 0; top: 0; height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px 0 4px; background: rgba(10,12,20,.62); font-size: 12px; box-sizing: border-box">
<button type="button" style="height: 44px; display: flex; align-items: center; gap: 4px; padding: 0 8px; background: none; border: 0; color: inherit; font: inherit; font-weight: 600">${icon.info}<span>Rules</span></button>
<div style="display: flex; align-items: center; gap: 16px">
<div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2"><span style="font-size: 10px; letter-spacing: .12em; opacity: .7">SESSION</span><span style="font-weight: 600; font-variant-numeric: tabular-nums">{{clock}}</span></div>
<div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2"><span style="font-size: 10px; letter-spacing: .12em; opacity: .7">NET</span><span style="font-weight: 600; font-variant-numeric: tabular-nums">{{net}}</span></div>
</div>
</div>
<div style="position: absolute; left: 0; right: 0; top: 72px; display: flex; flex-direction: column; align-items: center; gap: 2px">
<span style="font-size: 11px; font-weight: 700; letter-spacing: .2em; opacity: .85">FLOCK · STAKE $1.00</span>
<span style="font-family: ${DISPLAY}; font-size: 96px; line-height: .98; color: {{multColor}}; text-shadow: 0 3px 22px rgba(0,0,0,.5); font-variant-numeric: tabular-nums; opacity: {{multOpacity}}">{{mult}}</span>
</div>
<sc-if value="{{cue}}" hint-placeholder-val="{{ '' }}">
<div style="position: absolute; left: 0; right: 0; top: 252px; display: flex; justify-content: center"><span style="padding: 6px 14px; background: rgba(10,12,20,.82); font-family: ${DISPLAY}; font-size: 20px; letter-spacing: .06em">{{cue}}</span></div>
</sc-if>
<sc-if value="{{showBanner}}" hint-placeholder-val="{{ false }}">
<div style="position: absolute; left: 26px; right: 26px; top: 312px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px 14px; background: {{bannerBg}}; color: {{bannerFg}}">
<span style="font-family: ${DISPLAY}; font-size: 42px; line-height: 1; text-align: center">{{banner}}</span>
<span style="font-size: 14px; font-weight: 600; text-align: center">{{bannerSub}}</span>
</div>
</sc-if>
<div style="position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 11px; padding: 26px 16px 18px; background: linear-gradient(180deg, rgba(10,12,20,0) 0%, rgba(10,12,20,.88) 22%, rgba(10,12,20,.96) 100%)">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
<div style="display: flex; align-items: center; gap: 6px; opacity: {{stakeOpacity}}">
<button type="button" aria-label="Lower stake" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: none; border: 1.5px solid currentColor; color: inherit; padding: 0">${icon.minus}</button>
<div style="display: flex; flex-direction: column; align-items: center; min-width: 72px; line-height: 1.15"><span style="font-size: 10px; letter-spacing: .12em; opacity: .7">STAKE</span><span style="font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums">$1.00</span></div>
<button type="button" aria-label="Raise stake" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: none; border: 1.5px solid currentColor; color: inherit; padding: 0">${icon.plus}</button>
</div>
<div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.15"><span style="font-size: 10px; letter-spacing: .12em; opacity: .7">AUTO COLLECT</span><span style="font-size: 15px; font-weight: 600">Off</span></div>
</div>
<button type="button" style="height: 66px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; background: {{btnBg}}; color: {{btnFg}}; border: 0; font: inherit">
<span style="font-family: ${DISPLAY}; font-size: 27px; line-height: 1; letter-spacing: .03em">{{btnTop}}</span>
<span style="font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums">{{btnSub}}</span>
</button>
<span style="font-size: 10.5px; text-align: center; opacity: .75; line-height: 1.35">18+ · RTP 97% · The outcome is fixed when the run starts · Tapping does nothing</span>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844},"reducedMotion":{"editor":"boolean","default":false}}'>
class Component extends DCLogic {
  cfg() {
    return ${JSON.stringify(fr.cfg)};
  }
${adapter('this.tick(dt);\n      this.paint(this.cv.getContext(\'2d\'), dt);')}
${world}
}
</script>
</body>
</html>
`;
}


// The flock's cast: him, a flock ram near and far, and the wolf.
const castPaint = `
  startState() {
    return { t: 0, parts: [] };
  }

  castPaint(ctx, dt) {
    const g = this.g;
    g.t += dt;
    const t = g.t;
    const W = 2600, H = 920, GY = 720;
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#141c33'); sky.addColorStop(0.6, '#3b3550'); sky.addColorStop(1, '#5c3a2e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GY);
    const dirt = ctx.createLinearGradient(0, GY, 0, H);
    dirt.addColorStop(0, '#6b4a30'); dirt.addColorStop(1, '#1b1109');
    ctx.fillStyle = dirt; ctx.fillRect(0, GY, W, H - GY);
    const still = this.reduced();
    const ph = (hz) => (still ? 0 : t * hz);
    const gal = (hz, amp) => -Math.abs(Math.sin(ph(hz) * 6.2832)) * amp;
    this.drawRam(ctx, 300, GY, 2.0, { run: 1, ph: ph(3.2), bob: gal(3.2, 12), tilt: 0.06, headDrop: 8 });
    this.drawRam(ctx, 860, GY, 2.0, { run: 1, ph: ph(3.2) + 0.3, bob: gal(3.2, 12), tilt: 0.06, headDrop: 8, tone: this.NEAR_TONE() });
    this.drawRam(ctx, 1380, GY, 2.0, { run: 1, ph: ph(3.2) + 0.6, bob: gal(3.2, 12), tilt: 0.06, headDrop: 8, tone: this.FAR_TONE() });
    ctx.save(); ctx.translate(2080, GY); ctx.scale(-2.0, 2.0); this.wolfBody(ctx, still ? 0 : t, 1); ctx.restore();
  }
`;

const castBoard = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Flock cast</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${FONTS}
<style>
body{margin:0}
</style>
</helmet>
<div style="position: relative; width: 1300px; height: 560px; background: #141c33; font-family: ${UI}; color: #efe6d4; overflow: hidden">
<canvas id="scene" width="2600" height="920" style="position: absolute; left: 0; top: 0; width: 1300px; height: 460px; display: block"></canvas>
<div style="position: absolute; left: 0; right: 0; top: 460px; height: 100px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); background: #0f1426">
<div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-family: ${DISPLAY}; font-size: 22px; letter-spacing: .04em">YOUR RAM</span><span style="font-size: 13px; opacity: .8; line-height: 1.35">Lightest fleece, strongest rim light. Always the one in the clear lane.</span></div>
<div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-family: ${DISPLAY}; font-size: 22px; letter-spacing: .04em">FLOCK · NEAR</span><span style="font-size: 13px; opacity: .8; line-height: 1.35">Darker fleece. The first to join, beside him.</span></div>
<div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-family: ${DISPLAY}; font-size: 22px; letter-spacing: .04em">FLOCK · FAR</span><span style="font-size: 13px; opacity: .8; line-height: 1.35">Dusk silhouettes. They fill out to the horizon late in the run.</span></div>
<div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-family: ${DISPLAY}; font-size: 22px; letter-spacing: .04em; color: #aabee6">WOLF</span><span style="font-size: 13px; opacity: .8; line-height: 1.35">Only at the crash. The flock scatters; it takes no one.</span></div>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1300,"height":560},"reducedMotion":{"editor":"boolean","default":false}}'>
class Component extends DCLogic {
${adapter("this.castPaint(this.cv.getContext('2d'), dt);")}
${strip(world, ['startState'])}
${castPaint}
}
</script>
</body>
</html>
`;

for (const fr of FRAMES) writeFileSync(P + fr.file, phone(fr));
writeFileSync(P + 'FlockCast.dc.html', castBoard);

// Index: the flock is a page of its own beside the cattle drive.
const idx = JSON.parse(readFileSync(process.argv[2], 'utf8'));
idx.pages = [{ id: 'flock', name: 'Flock — rams join' }, { id: 'drove', name: 'Drove — cattle' }];
for (const [k, b] of Object.entries(idx.boards)) if (!k.startsWith('Flock')) b.page = 'drove';
for (const n of Object.values(idx.notes)) if (!n.page) n.page = 'drove';
FRAMES.forEach((fr, i) => { idx.boards[fr.file] = { x: i * 470, y: 0, w: 390, h: 844, title: fr.title, page: 'flock' }; });
idx.boards['FlockCast.dc.html'] = { x: 0, y: 1620, w: 1300, h: 560, title: 'Cast · one scale', page: 'flock' };
idx.order = [...idx.order.filter((k) => !k.startsWith('Flock')), ...FRAMES.map((f) => f.file), 'FlockCast.dc.html'];
const ROW = FRAMES.length * 470 - 80;
const sticky = (x, color, text) => ({ x, y: 930, w: 420, maxH: 560, size: 24, page: 'flock', ...(color ? { color } : {}), text });
Object.assign(idx.notes, {
  'flock-title': { x: 0, y: -300, kind: 'title1', maxW: ROW, page: 'flock', text: 'Flock — rams join the run, the wolf scatters it' },
  'flock-what': sticky(0, null, 'WHAT IT IS\nNo cattle. Your ram starts almost alone. As the value climbs, rams catch up from behind and fall in beside him, a handful by x1.5, a crowd by x3, out to the horizon past x10.\nPEN THEM cashes out and the flock pulls up with him. The wolf ends it: the flock scatters.'),
  'flock-rule': sticky(470, 'blue', 'THE FLOCK IS THE MULTIPLIER, NOT A COUNTDOWN\nIts size is drawn from the value on screen, which follows elapsed time. Nothing in the scene knows when the wolf comes.\nThe wolf appears only at the crash. The flock turns and bolts away from it; no ram is ever taken (that would be a near-miss). The x number stays the hero, and no ram count replaces it.'),
  'flock-risk': sticky(940, 'orange', 'MINORS-APPEAL: HIGHER THAN ONE RAM\nA whole flock of sheep leans further into the CAP “cuddly animals” example than a single ram does. Held: rams only, all grown (curled horn, long nose, working fleece), no lambs, no eyes or faces, dusk silhouettes for the far flock.\nThe concept audit has to clear this before production art.'),
  'flock-mech': sticky(1410, null, 'MECHANICS: UNCHANGED\nStill whack-crash/v3-rising: no new maths, no new report.\nFrame 4 is the Scatter option: half the flock splits off and the value halves. Kept off in Brazil and Portugal.\nEverything runs as one: the flock keeps his pace, and the ground and hills set the speed.'),
  'flock-ok': sticky(1880, 'green', 'FOR YOUR OK\n1. Flock instead of cattle\n2. Words: PEN THEM · PENNED · WOLF · RUN OVER\n3. The split as the Scatter option\n4. Working name “Flock”\nNothing gets built until you approve these.'),
});
idx.launch = { view: 'canvas', page: 'flock' };
writeFileSync(P + 'canvas.json', JSON.stringify(idx, null, 2));
console.log('ok', idx.order.length);
