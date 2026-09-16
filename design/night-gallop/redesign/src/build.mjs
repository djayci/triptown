import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url).pathname;
const src = (f) => readFileSync(dir + 'src/' + f, 'utf8');
const engine = src('engine2.js') + '\n' + src('helpers.js');

const icon = {
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.01"></path></svg>',
  minus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"></path></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"></path><path d="M12 6v12"></path></svg>',
};

const options = [
  {
    file: 'PrimeTime.dc.html', title: 'A · Prime Time', scene: 'scene-primetime.js',
    fonts: 'family=Barlow+Condensed:ital,wght@1,700;1,800;1,900&family=Barlow:wght@500;600;700',
    display: "'Barlow Condensed','Arial Narrow',sans-serif", ui: "'Barlow','Helvetica Neue',Arial,sans-serif",
    bg: '#030712', ink: '#f1f5f9', accent: '#e11d48', radius: '0px',
    mult: 'left:0;right:0;top:78px;display:flex;justify-content:center',
    multStyle: "font-size:120px;font-weight:900;font-style:italic;letter-spacing:-2px;color:#ffffff;text-shadow:0 6px 0 #e11d48, 0 12px 40px rgba(225,29,72,.45)",
    xStyle: 'font-size:64px;margin-right:4px',
    extra: `
  <div style="position:absolute;left:0;top:250px;display:flex;align-items:stretch;height:30px;font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:800;font-size:17px;letter-spacing:.04em">
    <div style="display:flex;align-items:center;gap:6px;padding:0 12px;background:#e11d48;color:#ffffff"><div style="width:7px;height:7px;border-radius:999px;background:#ffffff"></div><span>LIVE</span></div>
    <div style="display:flex;align-items:center;padding:0 14px;background:rgba(255,255,255,.95);color:#030712">NIGHT GALLOP · {{race}}</div>
  </div>`,
    note: 'A · PRIME TIME\nTV sports coverage: low tracking camera close to the horse, blurred stadium bokeh and crowd, white rail posts whipping past the lens, dirt thrown hard. Bold italic condensed numerals with a red drop, LIVE chyron.\nEnergy: burst at the start, zoom punches at x2/x5/x10, speed and shake climb with the value.\nFeels closest to "real racing on TV" while staying one runner.',
  },
  {
    file: 'Neon.dc.html', title: 'B · Neon Circuit', scene: 'scene-neon.js',
    fonts: 'family=Unbounded:wght@600;800;900&family=Manrope:wght@500;600;700',
    display: "'Unbounded','Arial Black',sans-serif", ui: "'Manrope','Helvetica Neue',Arial,sans-serif",
    bg: '#020409', ink: '#e0f2fe', accent: '#22d3ee', radius: '999px',
    mult: 'left:0;right:0;top:92px;display:flex;justify-content:center',
    multStyle: "font-size:86px;font-weight:900;letter-spacing:-3px;color:#ecfeff;text-shadow:0 0 18px rgba(34,211,238,.9), 0 0 60px rgba(244,114,182,.5)",
    xStyle: 'font-size:46px;margin-right:6px;color:#f472b6',
    extra: '',
    note: 'B · NEON CIRCUIT\nStylised night: black stage, the rail lights stretched into cyan and pink light tunnels, glowing hoof trails, a mirror reflection on a glossy track. Heavy rounded display type with neon glow, pill button.\nEnergy: light streaks lengthen and multiply with the value; the lights-out is a hard cut to black.\nMost "crash game" of the five; least like real racing, which helps the casino classification.',
  },
  {
    file: 'Jumbotron.dc.html', title: 'C · Jumbotron', scene: 'scene-jumbo.js',
    fonts: 'family=Anton&family=Inter+Tight:wght@500;600;700',
    display: "'Anton','Impact',sans-serif", ui: "'Inter Tight','Helvetica Neue',Arial,sans-serif",
    bg: '#07080c', ink: '#fef3c7', accent: '#fbbf24', radius: '4px',
    mult: 'left:35px;right:35px;top:88px;height:210px;display:flex;align-items:center;justify-content:center',
    multStyle: "font-size:132px;line-height:1;color:#fbbf24;text-shadow:0 0 30px rgba(251,191,36,.55)",
    xStyle: 'font-size:72px;margin-right:6px',
    extra: `
  <div style="position:absolute;left:35px;right:35px;top:82px;display:flex;justify-content:space-between;padding:0 14px;font-family:'Inter Tight',sans-serif;font-size:11px;font-weight:700;letter-spacing:.2em;color:rgba(254,243,199,.7)">
    <span>NIGHT GALLOP</span><span>{{race}}</span>
  </div>`,
    note: 'C · JUMBOTRON\nThe multiplier lives on the stadium\'s giant screen, above a packed stand where camera flashes pop more often as the value climbs. The horse runs underneath. Tall condensed Anton numerals, gold on black.\nEnergy: the screen glows hotter with the value; zoom punches at x2/x5/x10.\nThe most "event night" feeling; the number is part of the world instead of floating over it.',
  },
  {
    file: 'HeadOn.dc.html', title: 'D · Head-On', scene: 'scene-headon.js',
    fonts: 'family=Archivo+Black&family=Archivo:wght@500;600;700',
    display: "'Archivo Black','Arial Black',sans-serif", ui: "'Archivo','Helvetica Neue',Arial,sans-serif",
    bg: '#050304', ink: '#ffedd5', accent: '#fb923c', radius: '6px',
    mult: 'left:0;right:0;top:520px;display:flex;justify-content:center',
    multStyle: "font-size:104px;letter-spacing:-3px;color:#ffffff;text-shadow:0 4px 0 #9a3412, 0 0 50px rgba(251,146,60,.55)",
    xStyle: 'font-size:56px;margin-right:4px;color:#fb923c',
    extra: '',
    note: 'D · HEAD-ON\nThe camera runs backwards in front of the horse: it charges straight at you out of the floodlight glare, rail posts rush past both sides, dirt flies at the lens. The multiplier sits big and low, right under the horse. The distance never changes, so there is no finish to approach.\nEnergy: the most intense of the five; vignette tightens and dirt thickens with the value.',
  },
  {
    file: 'Storm.dc.html', title: 'E · Storm Night', scene: 'scene-storm.js',
    fonts: 'family=Saira+Condensed:wght@600;700;800&family=Saira:wght@500;600;700',
    display: "'Saira Condensed','Arial Narrow',sans-serif", ui: "'Saira','Helvetica Neue',Arial,sans-serif",
    bg: '#0b1220', ink: '#e2e8f0', accent: '#facc15', radius: '2px',
    mult: 'left:22px;right:0;top:70px;display:flex;justify-content:flex-start',
    multStyle: "font-size:124px;font-weight:800;line-height:1;letter-spacing:-2px;color:#facc15;text-shadow:0 4px 30px rgba(0,0,0,.6)",
    xStyle: 'font-size:62px;margin-right:2px',
    extra: `
  <div style="position:absolute;left:26px;top:208px;font-family:'Saira',sans-serif;font-size:12px;font-weight:700;letter-spacing:.22em;color:rgba(226,232,240,.75)">NIGHT GALLOP · {{race}}</div>`,
    note: 'E · STORM NIGHT\nHeavy rain under the floodlights, wet track reflecting the lamps, spray off the hooves. Rain gets faster and more slanted as the value climbs; lightning strikes only when the value passes x2, x5 and x10, so it can never read as a warning.\nLeft-aligned condensed numerals in storm yellow.\nMost cinematic; also the rainy-season look players will recognise.',
  },
];

function page(o) {
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
  <div style="position:absolute;left:0;right:0;top:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 4px;background:linear-gradient(180deg, rgba(0,0,0,.7), rgba(0,0,0,0));font-size:12px">
    <div style="display:flex;align-items:center;gap:2px">
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${icon.info}</div>
      <span style="font-weight:600">Rules</span>
    </div>
    <div style="display:flex;align-items:center;gap:18px">
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2"><span style="font-size:10px;letter-spacing:.12em;opacity:.7">SESSION</span><span style="font-weight:700;font-variant-numeric:tabular-nums">{{clock}}</span></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2"><span style="font-size:10px;letter-spacing:.12em;opacity:.7">NET</span><span style="font-weight:700;font-variant-numeric:tabular-nums">{{net}}</span></div>
    </div>
  </div>${o.extra}
  <sc-if value="{{multShow}}" hint-placeholder-val="{{ true }}">
    <div style="position:absolute;${o.mult}">
      <div style="display:flex;align-items:baseline;font-family:${o.display};${o.multStyle};opacity:{{multOpacity}};transform:scale({{multScale}});font-variant-numeric:tabular-nums">
        <span style="${o.xStyle}">x</span><span>{{mult}}</span>
      </div>
    </div>
  </sc-if>
  <sc-if value="{{showBanner}}" hint-placeholder-val="{{ false }}">
    <div style="position:absolute;left:24px;right:24px;top:300px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 16px;background:{{bannerBg}};color:{{bannerFg}};border-radius:${o.radius === '999px' ? '24px' : o.radius}">
      <span style="font-family:${o.display};font-size:44px;line-height:1;font-weight:900">{{banner}}</span>
      <span style="font-size:14px;font-weight:600">{{bannerSub}}</span>
    </div>
  </sc-if>
  <div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:12px;padding:34px 16px 18px;background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.85) 30%)">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,.35);border-radius:${o.radius}">${icon.minus}</div>
        <div style="display:flex;flex-direction:column;align-items:center;min-width:76px;line-height:1.15"><span style="font-size:10px;letter-spacing:.12em;opacity:.7">STAKE</span><span style="font-size:18px;font-weight:700">₦500</span></div>
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,.35);border-radius:${o.radius}">${icon.plus}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.15"><span style="font-size:10px;letter-spacing:.12em;opacity:.7">AUTO COLLECT</span><span style="font-size:15px;font-weight:700">Off</span></div>
    </div>
    <div style="height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:{{btnBg}};color:{{btnFg}};border-radius:${o.radius}">
      <span style="font-family:${o.display};font-size:24px;line-height:1;font-weight:900;font-variant-numeric:tabular-nums">{{btnTop}}</span>
      <span style="font-size:12px;font-weight:600;opacity:.85">{{btnSub}}</span>
    </div>
    <span style="font-size:11px;text-align:center;opacity:.6">18+ · RTP 97% · Result fixed when the round starts</span>
  </div>
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
writeFileSync(dir + 'options.json', JSON.stringify(options.map((o, i) => ({ file: o.file, title: o.title, note: o.note, i })), null, 2));
console.log('built', options.length);
