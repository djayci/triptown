import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url).pathname;
const src = (f) => readFileSync(dir + 'src/' + f, 'utf8');
const engine = src('engine3.js') + '\n' + src('helpers.js');

const info = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.01"></path></svg>';

const options = [
  {
    file: 'FencePrimeTime.dc.html', title: '1 · Prime Time Chase', scene: 'fr-primetime.js',
    fonts: 'family=Barlow+Condensed:ital,wght@1,700;1,800;1,900&family=Barlow:wght@500;600;700',
    display: "'Barlow Condensed','Arial Narrow',sans-serif", displayExtra: 'font-style:italic;font-weight:900;', ui: "'Barlow','Helvetica Neue',Arial,sans-serif",
    bg: '#030712', ink: '#f1f5f9', accent: '#e11d48', radius: '0px', panel: 'linear-gradient(180deg, rgba(3,7,18,0) 0%, rgba(3,7,18,.92) 22%)',
    top: 70, multSize: 108, multColor: '#ffffff', multShadow: '0 6px 0 #e11d48, 0 12px 40px rgba(225,29,72,.45)', align: 'center',
    note: '1 · PRIME TIME CHASE\nThe broadcast look you picked, now a steeplechase under floodlights. Brush fences with the value written above each one, a LIVE chyron, white rail posts whipping past. Each JUMP is a big arc with a zoom punch and a burst of turf on landing; a refusal shakes the fence while the horse plants its feet.\nLadder strip shows the next five values; the finish line is the top prize.',
  },
  {
    file: 'FenceDaylight.dc.html', title: '2 · Grand Chase Daylight', scene: 'fr-daylight.js',
    fonts: 'family=Big+Shoulders+Display:wght@800;900&family=Figtree:wght@500;600;700',
    display: "'Big Shoulders Display','Arial Narrow',sans-serif", displayExtra: 'font-weight:900;', ui: "'Figtree','Helvetica Neue',Arial,sans-serif",
    bg: '#5aa9e6', ink: '#ffffff', accent: '#15803d', radius: '8px', panel: 'linear-gradient(180deg, rgba(20,35,15,0) 0%, rgba(20,35,15,.88) 22%)',
    top: 70, multSize: 110, multColor: '#ffffff', multShadow: '0 4px 0 #14532d, 0 10px 30px rgba(0,0,0,.35)', align: 'center',
    note: '2 · GRAND CHASE DAYLIGHT\nA big race-day afternoon: blue sky, a packed colourful grandstand, green-and-white hurdles on striped turf. The most "real horse racing" of the five, bright and premium, and very readable on cheap phones in daylight.\nSame JUMP / COLLECT loop and ladder strip.',
  },
  {
    file: 'FenceTower.dc.html', title: '3 · Fence Tower', scene: 'fr-tower.js', tower: true,
    fonts: 'family=Archivo+Black&family=Archivo:wght@500;600;700',
    display: "'Archivo Black','Arial Black',sans-serif", displayExtra: '', ui: "'Archivo','Helvetica Neue',Arial,sans-serif",
    bg: '#0b0f0a', ink: '#ecfccb', accent: '#a3e635', radius: '10px', panel: '#0b0f0a',
    top: 64, multSize: 84, multColor: '#a3e635', multShadow: '0 0 30px rgba(163,230,53,.35)', align: 'center',
    note: '3 · FENCE TOWER\nGame-first layout like the step games players already know: the jump scene on top, a big vertical ladder of fence values underneath, climbing as you clear each one. Lime on near-black, chunky type.\nFastest to read the risk ("next fence x2.37, then x2.96") and the most obviously a casino step game, which helps classification.',
  },
  {
    file: 'FenceMud.dc.html', title: '4 · Mud & Rain', scene: 'fr-mud.js',
    fonts: 'family=Saira+Condensed:wght@600;700;800&family=Saira:wght@500;600;700',
    display: "'Saira Condensed','Arial Narrow',sans-serif", displayExtra: 'font-weight:800;', ui: "'Saira','Helvetica Neue',Arial,sans-serif",
    bg: '#0b1220', ink: '#e2e8f0', accent: '#facc15', radius: '2px', panel: 'linear-gradient(180deg, rgba(6,9,14,0) 0%, rgba(6,9,14,.92) 22%)',
    top: 66, multSize: 118, multColor: '#facc15', multShadow: '0 4px 30px rgba(0,0,0,.6)', align: 'flex-start',
    note: '4 · MUD & RAIN\nGritty night chase in the rain: big brush fences, mud thrown by the hooves, a mud explosion and a lightning flash on every clean landing. Left-aligned storm-yellow numerals.\nThe most physical and dramatic landings; rainy-season look.',
  },
  {
    file: 'FenceNeon.dc.html', title: '5 · Neon Gates', scene: 'fr-neon.js',
    fonts: 'family=Unbounded:wght@600;800;900&family=Manrope:wght@500;600;700',
    display: "'Unbounded','Arial Black',sans-serif", displayExtra: 'font-weight:900;', ui: "'Manrope','Helvetica Neue',Arial,sans-serif",
    bg: '#020409', ink: '#e0f2fe', accent: '#22d3ee', radius: '999px', panel: 'linear-gradient(180deg, rgba(2,4,9,0) 0%, rgba(2,4,9,.92) 22%)',
    top: 80, multSize: 80, multColor: '#ecfeff', multShadow: '0 0 18px rgba(34,211,238,.9), 0 0 60px rgba(244,114,182,.5)', align: 'center',
    note: '5 · NEON GATES\nStylised night circuit: fences are glowing gates that turn cyan once cleared, the finish is a tall pink gate, light tunnels stretch as the horse speeds up and a neon burst fires on each landing.\nLeast like real racing; most like a modern crash/step game.',
  },
];

const ladderRow = (o) => `
    <div style="display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));gap:6px">
      <sc-for list="{{ladder}}" as="step" hint-placeholder-count="5">
        <div style="display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;background:{{step.bg}};color:{{step.fg}};border:1.5px solid {{step.border}};border-radius:${o.radius === '999px' ? '12px' : o.radius}">
          <span style="font-size:10px;font-weight:700;letter-spacing:.08em;opacity:.8">{{step.label}}</span>
          <span style="font-size:14px;font-weight:700;font-variant-numeric:tabular-nums">{{step.value}}</span>
        </div>
      </sc-for>
    </div>`;

const ladderTower = (o) => `
    <div style="display:flex;flex-direction:column-reverse;gap:6px">
      <sc-for list="{{ladder}}" as="step" hint-placeholder-count="5">
        <div style="display:flex;align-items:center;justify-content:space-between;height:40px;padding:0 16px;background:{{step.bg}};color:{{step.fg}};border:1.5px solid {{step.border}};border-radius:${o.radius}">
          <span style="font-size:13px;font-weight:700;letter-spacing:.1em">{{step.label}}</span>
          <span style="font-family:${o.display};font-size:20px;font-variant-numeric:tabular-nums">{{step.value}}</span>
        </div>
      </sc-for>
    </div>`;

function page(o) {
  const btnRadius = o.radius;
  const buttons = `
    <div style="display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));gap:8px">
      <div style="grid-column:span 2;height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:1.5px solid ${o.ink};border-radius:${btnRadius};opacity:{{collectOpacity}}">
        <span style="font-family:${o.display};${o.displayExtra}font-size:19px;line-height:1">{{collectTop}}</span>
        <span style="font-size:12px;font-weight:700;font-variant-numeric:tabular-nums">{{collectSub}}</span>
      </div>
      <div style="grid-column:span 3;height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:{{jumpBg}};color:{{jumpFg}};border-radius:${btnRadius}">
        <span style="font-family:${o.display};${o.displayExtra}font-size:26px;line-height:1">{{jumpTop}}</span>
        <span style="font-size:12px;font-weight:700;opacity:.85;font-variant-numeric:tabular-nums">{{jumpSub}}</span>
      </div>
    </div>`;
  const panel = o.tower
    ? `
  <div style="position:absolute;left:0;right:0;bottom:0;top:470px;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:12px 16px 16px;background:${o.panel};border-top:1px solid rgba(163,230,53,.25)">
    <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;letter-spacing:.14em;opacity:.8"><span>{{fenceLabel}}</span><span>STAKE ₦500 · MEDIUM</span></div>${ladderTower(o)}${buttons}
    <span style="font-size:11px;text-align:center;opacity:.55">18+ · RTP 97% · Every fence is decided when the round starts</span>
  </div>`
    : `
  <div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:10px;padding:40px 16px 16px;background:${o.panel}">
    <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;letter-spacing:.14em;opacity:.8"><span>{{fenceLabel}}</span><span>STAKE ₦500 · MEDIUM</span></div>${ladderRow(o)}${buttons}
    <span style="font-size:11px;text-align:center;opacity:.55">18+ · RTP 97% · Every fence is decided when the round starts</span>
  </div>`;
  const chyron = o.file === 'FencePrimeTime.dc.html'
    ? `
  <div style="position:absolute;left:0;top:${o.top + o.multSize + 22}px;display:flex;align-items:stretch;height:28px;font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:800;font-size:16px;letter-spacing:.04em">
    <div style="display:flex;align-items:center;gap:6px;padding:0 12px;background:#e11d48;color:#ffffff"><div style="width:7px;height:7px;border-radius:999px;background:#ffffff"></div><span>LIVE</span></div>
    <div style="display:flex;align-items:center;padding:0 14px;background:rgba(255,255,255,.95);color:#030712">NIGHT GALLOP · {{race}} · {{nextLabel}}</div>
  </div>`
    : `
  <div style="position:absolute;left:${o.align === 'center' ? '0' : '24px'};right:0;top:${o.top + o.multSize + 18}px;display:flex;justify-content:${o.align};gap:12px;font-size:12px;font-weight:700;letter-spacing:.16em;opacity:.85"><span>NIGHT GALLOP · {{race}}</span><span style="color:${o.accent}">{{nextLabel}}</span></div>`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${o.fonts}&display=swap">
  <style>
    body { margin: 0; background: ${o.bg}; }
    a { color: ${o.accent}; } a:hover { color: ${o.ink}; }
  </style>
</helmet>
<div style="position:relative;width:390px;height:844px;overflow:hidden;background:${o.bg};font-family:${o.ui};color:${o.ink}">
  <canvas id="scene" width="780" height="1688" style="position:absolute;left:0;top:0;width:390px;height:844px;display:block"></canvas>
  <div style="position:absolute;left:0;right:0;top:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 4px;background:linear-gradient(180deg, rgba(0,0,0,.6), rgba(0,0,0,0));font-size:12px;color:#ffffff">
    <div style="display:flex;align-items:center;gap:2px"><div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${info}</div><span style="font-weight:600">Rules</span></div>
    <div style="display:flex;align-items:center;gap:18px">
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2"><span style="font-size:10px;letter-spacing:.12em;opacity:.7">SESSION</span><span style="font-weight:700;font-variant-numeric:tabular-nums">{{clock}}</span></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2"><span style="font-size:10px;letter-spacing:.12em;opacity:.7">NET</span><span style="font-weight:700;font-variant-numeric:tabular-nums">{{net}}</span></div>
    </div>
  </div>
  <div style="position:absolute;left:${o.align === 'center' ? '0' : '22px'};right:0;top:${o.top}px;display:flex;justify-content:${o.align}">
    <div style="display:flex;align-items:baseline;font-family:${o.display};${o.displayExtra}font-size:${o.multSize}px;line-height:1;color:${o.multColor};text-shadow:${o.multShadow};opacity:{{multOpacity}};transform:scale({{multScale}});font-variant-numeric:tabular-nums">
      <span style="font-size:${Math.round(o.multSize * 0.52)}px;margin-right:4px">x</span><span>{{mult}}</span>
    </div>
  </div>${chyron}
  <sc-if value="{{showBanner}}" hint-placeholder-val="{{ false }}">
    <div style="position:absolute;left:24px;right:24px;top:${o.tower ? 250 : 290}px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px;background:{{bannerBg}};color:{{bannerFg}};border-radius:${o.radius === '999px' ? '24px' : o.radius}">
      <span style="font-family:${o.display};${o.displayExtra}font-size:38px;line-height:1;text-align:center">{{banner}}</span>
      <span style="font-size:14px;font-weight:600;text-align:center">{{bannerSub}}</span>
    </div>
  </sc-if>${panel}
</div>
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":390,"height":844},"reducedMotion":{"editor":"boolean","default":false}}'>
class Component extends DCLogic {
${src(o.scene)}
${engine}
}
</script>
</body>
</html>
`;
}

for (const o of options) writeFileSync(dir + o.file, page(o));
writeFileSync(dir + 'options3.json', JSON.stringify(options.map((o, i) => ({ file: o.file, title: o.title, note: o.note, i })), null, 2));
console.log('built', options.length);
