import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const dir = new URL('.', import.meta.url).pathname;
const src = (f) => readFileSync(dir + 'src/' + f, 'utf8');
const engine = src('engine.js') + '\n' + src('nm-engine.js');
const scene = src('nm-scene.js');

const DISPLAY = "'DotGothic16','Courier New',monospace";
const UI = "'Saira Semi Condensed','Arial Narrow',sans-serif";

const icon = {
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.01"></path></svg>',
  minus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"></path></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"></path><path d="M12 6v12"></path></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>',
};

const R = [
  { slips: [{ stake: 500, auto: 1.5 }, { stake: 1000, manual: 3.2 }] },
  { slips: [{ stake: 500, auto: 1.5 }, { stake: 1000, manual: 4 }], crash: 1.95 },
  { slips: [{ stake: 500, auto: 2 }, { stake: 1000, manual: 5 }], crash: 1.35 },
];

const boards = [
  { file: 'Main.dc.html', title: 'Night Meet · live loop', cfg: { rounds: R } },
  { file: 'BetGap.dc.html', title: 'Betting gap · power returns', cfg: { rounds: R, pin: { phase: 'bet', afterCrash: true, loop: 5, slips: [{ stake: 500, auto: 1.5 }, { stake: 1000 }] } } },
  { file: 'SlipCollected.dc.html', title: 'Slip A auto-collected', cfg: { rounds: R, pin: { phase: 'run', mult: 1.92, slips: [{ stake: 500, auto: 1.5, at: 1.5 }, { stake: 1000 }] } } },
  { file: 'InProfit.dc.html', title: 'High multiplier · race in profit', cfg: { rounds: R, pin: { phase: 'run', mult: 4.6, slips: [{ stake: 1000, auto: 1.8, at: 1.8 }, { stake: 500 }] } } },
  { file: 'Win.dc.html', title: 'Total win', cfg: { rounds: R, pin: { phase: 'collect', mult: 3.2, loop: 3.4, slips: [{ stake: 500, auto: 1.5, at: 1.5 }, { stake: 1000, at: 3.2 }] } } },
  { file: 'Returned.dc.html', title: 'Returned · no celebration', cfg: { rounds: R, pin: { phase: 'crash', mult: 1.95, loop: 3.4, slips: [{ stake: 500, auto: 1.5, at: 1.5 }, { stake: 1000 }] } } },
  { file: 'LightsOut.dc.html', title: 'Lights out', cfg: { rounds: R, pin: { phase: 'crash', mult: 1.35, loop: 3.4, slips: [{ stake: 500, auto: 2 }, { stake: 1000 }] } } },
  { file: 'Rules.dc.html', title: 'Rules before any bet', rules: true, cfg: { rounds: R, pin: { phase: 'bet', loop: 5, slips: [{ stake: 500, auto: 1.5 }, { stake: 1000 }] } } },
];

const card = (id, name) => `
      <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <span style="font-size:12px;font-weight:700;letter-spacing:.14em;color:#ffcf85">${name}</span>
          <span style="font-size:11px;font-weight:600;padding:2px 7px;border:1px solid rgba(233,236,245,.3);border-radius:2px">AUTO {{${id}.auto}}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;opacity:{{${id}.stakeOpacity}}">
          <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(233,236,245,.4);border-radius:2px">${icon.minus}</div>
          <span style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums">{{${id}.stake}}</span>
          <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(233,236,245,.4);border-radius:2px">${icon.plus}</div>
        </div>
        <div style="height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:{{${id}.bg}};color:{{${id}.fg}};border:1.5px solid {{${id}.border}};border-radius:2px">
          <span style="font-family:${DISPLAY};font-size:20px;line-height:1">{{${id}.top}}</span>
          <span style="font-size:12px;font-weight:600;font-variant-numeric:tabular-nums">{{${id}.sub}}</span>
        </div>
      </div>`;

const rulesSheet = `
  <div style="position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(2,3,8,.72)"></div>
  <div style="position:absolute;left:10px;right:10px;top:60px;bottom:10px;display:flex;flex-direction:column;background:#0b0f1c;color:#e9ecf5;border:1px solid rgba(255,178,62,.35);border-radius:2px;overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 6px 6px 16px;border-bottom:1px solid rgba(233,236,245,.12)">
      <span style="font-family:${DISPLAY};font-size:22px;color:#ffb23e">HOW NIGHT MEET WORKS</span>
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${icon.close}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;padding:14px 16px 20px;font-size:13.5px;line-height:1.42;overflow:hidden">
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="font-weight:700;letter-spacing:.08em;color:#ffcf85">THE RACE</span>
        <span>Place one or two slips before the race starts. The multiplier then rises from x1.00. Tap COLLECT on a slip to get its stake times the multiplier at the moment our server receives your tap.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="font-weight:700;letter-spacing:.08em;color:#ffcf85">LIGHTS OUT</span>
        <span>At a random moment the lights go out and the race ends. Slips not collected by then are lost. That moment is fixed by the server before the race starts. Nothing you tap or see changes it: the horse, crowd and lights are decoration.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="font-weight:700;letter-spacing:.08em;color:#ffcf85">TWO SLIPS, ONE RACE</span>
        <span>Both slips are one game with one total stake. Each slip can have its own auto collect. A race counts as a win only when it returns more than your total stake.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="font-weight:700;letter-spacing:.08em;color:#ffcf85">RETURN TO PLAYER</span>
        <span>97% over the long run, whichever way you play. Measured over [N] million simulated races. At the minimum stake it is [X]%.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="font-weight:700;letter-spacing:.08em;color:#ffcf85">LIMITS</span>
        <span>Minimum stake per slip [MIN STAKE]. Maximum win per race [MAX WIN]. A race lasts at most 60 seconds. Next race starts at least 5 seconds after the last. No autoplay.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="font-weight:700;letter-spacing:.08em;color:#ffcf85">CONNECTION AND ROUNDING</span>
        <span>Taps are judged when they reach the server, with no allowance for delay. If you disconnect, open slips are [DISCONNECT POLICY]. Each collect is worked out exactly and the race total is rounded once, half up.</span>
      </div>
    </div>
  </div>`;

function page(b) {
  const cfgJson = JSON.stringify(b.cfg);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Saira+Semi+Condensed:wght@500;600;700&display=swap">
  <style>
    body { margin: 0; background: #04060d; }
    a { color: #ffb23e; } a:hover { color: #ffcf85; }
  </style>
</helmet>
<div style="position:relative;width:390px;height:844px;overflow:hidden;background:#04060d;font-family:${UI};color:#e9ecf5">
  <canvas id="scene" width="780" height="1688" style="position:absolute;left:0;top:0;width:390px;height:844px;display:block"></canvas>
  <div style="position:absolute;left:0;right:0;top:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 6px;background:rgba(6,8,16,.72);font-size:12px">
    <div style="display:flex;align-items:center;gap:2px">
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${icon.info}</div>
      <span style="font-weight:600">Rules</span>
    </div>
    <div style="display:flex;align-items:center;gap:16px">
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2">
        <span style="font-size:10px;letter-spacing:.12em;opacity:.7">SESSION</span>
        <span style="font-weight:600;font-variant-numeric:tabular-nums">{{clock}}</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2">
        <span style="font-size:10px;letter-spacing:.12em;opacity:.7">NET</span>
        <span style="font-weight:600;font-variant-numeric:tabular-nums">{{net}}</span>
      </div>
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;top:70px;display:flex;flex-direction:column;align-items:center;gap:4px">
    <span style="font-size:11px;font-weight:700;letter-spacing:.2em;color:#ffcf85;opacity:.9">NIGHT MEET · {{raceLabel}} · STAKE {{totalStake}}</span>
    <span style="font-family:${DISPLAY};font-size:88px;line-height:1;color:#ffb23e;text-shadow:0 0 18px rgba(255,178,62,.75), 0 0 2px #ffe2b0;font-variant-numeric:tabular-nums;opacity:{{multOpacity}}">{{mult}}</span>
  </div>
  <sc-if value="{{showChip}}" hint-placeholder-val="{{ false }}">
    <div style="position:absolute;left:0;right:0;top:184px;display:flex;justify-content:center">
      <span style="padding:6px 12px;font-size:13px;font-weight:600;background:{{chipBg}};color:{{chipFg}};border-radius:2px">{{chip}}</span>
    </div>
  </sc-if>
  <sc-if value="{{showBanner}}" hint-placeholder-val="{{ false }}">
    <div style="position:absolute;left:28px;right:28px;top:236px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 14px;background:{{bannerBg}};color:{{bannerFg}};border-radius:2px">
      <span style="font-family:${DISPLAY};font-size:38px;line-height:1">{{banner}}</span>
      <span style="font-size:14px;font-weight:600">{{bannerSub}}</span>
    </div>
  </sc-if>
  <div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:8px;padding:12px 12px 14px;background:rgba(6,8,16,.92);border-top:1px solid rgba(255,178,62,.25)">
    <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px">${card('a', 'SLIP A')}${card('b', 'SLIP B')}
    </div>
    <span style="font-size:11px;text-align:center;opacity:.7">18+ · RTP 97% · Result fixed when the race starts</span>
  </div>${b.rules ? rulesSheet : ''}
</div>
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":390,"height":844},"reducedMotion":{"editor":"boolean","default":false}}'>
class Component extends DCLogic {
  cfg() {
    return ${cfgJson};
  }

${scene}
${engine}
}
</script>
</body>
</html>
`;
}

for (const b of boards) writeFileSync(dir + b.file, page(b));

// Directions page: the original five sketches, Main renamed to Harmattan.
const old = JSON.parse(readFileSync(dir + 'canvas.json', 'utf8'));
const dirBoards = old.artboards.map((a) => ({ ...a, file: a.file === 'Main.dc.html' ? 'Harmattan.dc.html' : a.file, page: 'directions' }));
const dirNotes = old.annotations.map((n) => ({ ...n, page: 'directions' }));

const nmNotes = [
  'Plays the full cycle on repeat. Race 1: Slip A auto-collects at x1.50, Slip B collected at x3.20, total beats the stake: WIN. Race 2: A collects, lights out before B: RETURNED, no celebration. Race 3: lights out before either: LIGHTS OUT.',
  'The 5 s gap between races is the power coming back: dark, the generator coughs twice, lamps warm up from orange to white. Bets are placed here only; nothing can be added once the race runs.',
  'Slip A hit its auto collect. Its card turns neutral (no flash, no sound): the ₦750 collected is still below the ₦1,500 total stake.',
  'Slip A (₦1,000) collected ₦1,800, so the race is already in profit and the chip says so in text. Still no flash or sound: effects wait until the race settles, never on a single slip (AGENTS rule 11). Slip B still runs.',
  'All slips collected and the total beats the stake. Freeze-frame, floodlight flash, amber banner with the total and net.',
  'Lights out with ₦750 back on ₦1,500 staked. No win banner, no flash; the net loss is shown plainly.',
  'Power cut: an instant clunk, two flickers, darkness. The flicker only starts when the crash event arrives; lights never wobble during a race. No crash point is shown here.',
  'Rules sheet opened from the top bar, available before any bet. Bracketed values come from config and the jurisdiction profile. Full copy scrolls; the rest covers provably fair, recall and session tools.',
];

const nmLayout = boards.map((b, i) => ({
  file: b.file, title: b.title, page: 'night-meet',
  x: (i % 4) * 480, y: Math.floor(i / 4) * 1260, w: 390, h: 844,
}));

const canvas = {
  pages: [
    { id: 'night-meet', name: 'Night Meet' },
    { id: 'directions', name: 'Directions' },
  ],
  artboards: [...nmLayout, ...dirBoards],
  annotations: [
    {
      id: 'nm-brief', page: 'night-meet', x: 0, y: -230, w: 1830,
      text: 'NIGHT MEET: two slips per race. One race, one total stake debited before the start, one round id. Each slip has its own stake and auto collect; any slip still open at lights out is lost.\nWin effects only when the race total beats the total stake. Both slips are placed in the 5 s gap; no auto-bet, no repeat-bet, no fake live-bets feed. Every collect is recorded for recall.\nLocal cues: humid haze, a flyover with bus lights, and the power-cut crash with the generator bringing the lights back. Horse is still a placeholder.',
    },
    ...nmNotes.map((text, i) => ({ id: 'nm-note-' + (i + 1), page: 'night-meet', x: (i % 4) * 480, y: Math.floor(i / 4) * 1260 + 880, w: 390, text })),
    ...dirNotes,
  ],
  launch: { view: 'canvas', page: 'night-meet' },
};
writeFileSync(dir + 'canvas.json', JSON.stringify(canvas, null, 2));
console.log('night meet boards', boards.length, 'directions', dirBoards.length);
