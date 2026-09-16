import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url).pathname;
const src = (f) => readFileSync(dir + 'src/' + f, 'utf8');
const engine = src('engine.js');

const concepts = [
  {
    file: 'Harmattan.dc.html', scene: 'scene-harmattan.js', name: 'HARMATTAN DASH',
    fonts: 'family=Big+Shoulders+Display:wght@800;900&family=Archivo:wght@500;600;700',
    display: "'Big Shoulders Display','Arial Narrow',sans-serif", ui: "'Archivo','Helvetica Neue',Arial,sans-serif",
    bg: '#c9a47c', stripBg: 'rgba(246,231,208,.78)', stripFg: '#2a1a10', label: '#2a1a10',
    multColor: '#2a1a10', multShadow: '0 2px 0 rgba(255,244,226,.7)', multSize: 104, multWeight: 900,
    panelBg: 'rgba(42,26,16,.9)', panelFg: '#f6e7d0', btnRadius: '4px', link: '#e2601f',
  },
  {
    file: 'Floodlight.dc.html', scene: 'scene-floodlight.js', name: 'NIGHT MEET',
    fonts: 'family=DotGothic16&family=Saira+Semi+Condensed:wght@500;600;700',
    display: "'DotGothic16','Courier New',monospace", ui: "'Saira Semi Condensed','Arial Narrow',sans-serif",
    bg: '#04060d', stripBg: 'rgba(6,8,16,.72)', stripFg: '#e9ecf5', label: '#ffcf85',
    multColor: '#ffb23e', multShadow: '0 0 18px rgba(255,178,62,.75), 0 0 2px #ffe2b0', multSize: 88, multWeight: 400,
    panelBg: 'rgba(6,8,16,.9)', panelFg: '#e9ecf5', btnRadius: '2px', link: '#ffb23e',
  },
  {
    file: 'Surf.dc.html', scene: 'scene-surf.js', name: 'SURF GALLOP',
    fonts: 'family=Syne:wght@700;800&family=Outfit:wght@400;500;600',
    display: "'Syne','Trebuchet MS',sans-serif", ui: "'Outfit','Helvetica Neue',Arial,sans-serif",
    bg: '#271f4a', stripBg: 'rgba(29,19,48,.45)', stripFg: '#ffe6da', label: '#ffe6da',
    multColor: '#fff4ee', multShadow: '0 4px 24px rgba(60,20,60,.55)', multSize: 92, multWeight: 800,
    panelBg: 'linear-gradient(180deg, rgba(29,19,48,0) 0%, rgba(29,19,48,.86) 26%)', panelFg: '#ffe6da', btnRadius: '999px', link: '#ff7a59',
  },
  {
    file: 'RaceDay.dc.html', scene: 'scene-raceday.js', name: 'RACE DAY', broadcast: true,
    fonts: 'family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@500;600',
    display: "'Barlow Condensed','Arial Narrow',sans-serif", ui: "'Barlow','Helvetica Neue',Arial,sans-serif",
    bg: '#7fbfe4', stripBg: 'rgba(13,42,32,.88)', stripFg: '#ffffff', label: '#0d2a20',
    multColor: '#0d2a20', multShadow: '0 2px 0 rgba(255,255,255,.8)', multSize: 100, multWeight: 800,
    panelBg: '#0d2a20', panelFg: '#ffffff', btnRadius: '0px', link: '#f3a712',
  },
  {
    file: 'Pulse.dc.html', scene: 'scene-pulse.js', name: 'ANKARA PULSE',
    fonts: 'family=Archivo+Black&family=Hanken+Grotesk:wght@500;600;700',
    display: "'Archivo Black','Arial Black',sans-serif", ui: "'Hanken Grotesk','Helvetica Neue',Arial,sans-serif",
    bg: '#1d2047', stripBg: 'rgba(23,26,61,.9)', stripFg: '#f3e6c8', label: '#f3e6c8',
    multColor: '#f3e6c8', multShadow: '4px 4px 0 #d4572a', multSize: 84, multWeight: 400,
    panelBg: '#171a3d', panelFg: '#f3e6c8', btnRadius: '0px', link: '#e8b23a',
  },
];

const icon = {
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.01"></path></svg>',
  minus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"></path></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"></path><path d="M12 6v12"></path></svg>',
};

function page(c) {
  const broadcast = c.broadcast
    ? `
  <div style="position:absolute;left:14px;top:62px;display:flex;align-items:center;gap:6px;padding:4px 8px;background:#d7263d;color:#ffffff;font-family:${c.display};font-size:14px;font-weight:700;letter-spacing:.08em">
    <div style="width:7px;height:7px;border-radius:999px;background:#ffffff"></div>
    <span>LIVE</span>
  </div>
  <div style="position:absolute;left:0;right:0;top:622px;display:flex;align-items:stretch;height:34px;font-family:${c.display};font-weight:700;font-size:17px;letter-spacing:.02em">
    <div style="display:flex;align-items:center;padding:0 10px;background:#f3a712;color:#0d2a20">CALLER</div>
    <div style="display:flex;align-items:center;padding:0 12px;flex-grow:1;background:rgba(255,255,255,.94);color:#0d2a20">{{ticker}}</div>
  </div>`
    : '';
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${c.fonts}&display=swap">
  <style>
    body { margin: 0; background: ${c.bg}; }
    a { color: ${c.link}; } a:hover { color: ${c.panelFg}; }
  </style>
</helmet>
<div style="position:relative;width:390px;height:844px;overflow:hidden;background:${c.bg};font-family:${c.ui}">
  <canvas id="scene" width="780" height="1688" style="position:absolute;left:0;top:0;width:390px;height:844px;display:block"></canvas>
  <div style="position:absolute;left:0;right:0;top:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 6px;background:${c.stripBg};color:${c.stripFg};font-size:12px">
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
  </div>${broadcast}
  <div style="position:absolute;left:0;right:0;top:${c.broadcast ? 96 : 74}px;display:flex;flex-direction:column;align-items:center;gap:2px">
    <span style="font-size:11px;font-weight:700;letter-spacing:.22em;color:${c.label};opacity:.85">${c.name} · {{raceLabel}}</span>
    <span style="font-family:${c.display};font-weight:${c.multWeight};font-size:${c.multSize}px;line-height:1;color:${c.multColor};text-shadow:${c.multShadow};font-variant-numeric:tabular-nums;opacity:{{multOpacity}}">{{mult}}</span>
  </div>
  <sc-if value="{{showBanner}}" hint-placeholder-val="{{ false }}">
    <div style="position:absolute;left:28px;right:28px;top:262px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 14px;background:{{bannerBg}};color:{{bannerFg}};border-radius:${c.btnRadius === '999px' ? '22px' : c.btnRadius}">
      <span style="font-family:${c.display};font-weight:${c.multWeight};font-size:42px;line-height:1">{{banner}}</span>
      <span style="font-size:14px;font-weight:600">{{bannerSub}}</span>
    </div>
  </sc-if>
  <div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:12px;padding:${c.broadcast ? 14 : 30}px 16px 20px;background:${c.panelBg};color:${c.panelFg}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="display:flex;align-items:center;gap:6px;opacity:{{stakeOpacity}}">
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1.5px solid currentColor;border-radius:${c.btnRadius}">${icon.minus}</div>
        <div style="display:flex;flex-direction:column;align-items:center;min-width:72px;line-height:1.15">
          <span style="font-size:10px;letter-spacing:.12em;opacity:.7">STAKE</span>
          <span style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums">₦500</span>
        </div>
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1.5px solid currentColor;border-radius:${c.btnRadius}">${icon.plus}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.15">
        <span style="font-size:10px;letter-spacing:.12em;opacity:.7">AUTO COLLECT</span>
        <span style="font-size:15px;font-weight:600">Off</span>
      </div>
    </div>
    <div style="height:66px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:{{btnBg}};color:{{btnFg}};border-radius:${c.btnRadius}">
      <span style="font-family:${c.display};font-weight:${c.multWeight};font-size:26px;line-height:1;letter-spacing:.02em">{{btnTop}}</span>
      <span style="font-size:13px;font-weight:600;font-variant-numeric:tabular-nums">{{btnSub}}</span>
    </div>
    <span style="font-size:11px;text-align:center;opacity:.7">18+ · RTP 97% · Result fixed when the race starts</span>
  </div>
</div>
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":390,"height":844},"reducedMotion":{"editor":"boolean","default":false}}'>
class Component extends DCLogic {
${src(c.scene)}
${engine}
}
</script>
</body>
</html>
`;
}

for (const c of concepts) writeFileSync(dir + c.file, page(c));

const notes = [
  'HARMATTAN DASH  (lead)\nDry-season sand track, low sun through harmattan haze.\nBuilds: dust plumes, haze, crowd jumping, a white pole whipping past, camera shake at high x.\nCrash: a dust wall sweeps the frame, horse pulled up.\nWhy: the most recognisably West African light; dust hides the placeholder horse well.',
  'NIGHT MEET\nCity-edge dirt track under floodlights, skyline behind.\nBuilds: phone lights in the crowd multiply, light streaks, kickback of dirt.\nCrash: LIGHTS OUT (flicker, then dark). No animal involved at all.\nFeels closest to the crash games players already know. Risk: dark and generic if the city has no character.',
  'SURF GALLOP\nHorse and adult rider galloping the shoreline at dusk (beach riding is a real Accra/Lagos sight).\nBuilds: spray, drone banks, palms rushing past, sun glitter.\nCrash: a foam wave washes over the frame.\nNot a racetrack, so it stays clear of virtual-racing classification. Risk: less "racing".',
  'RACE DAY\nTurf club broadcast: packed, colourful grandstand, bunting, near rail rushing past, LIVE chip and a caller line.\nBuilds: crowd jumps, clods, rail blur. Caller lines follow the multiplier only, never hint at risk.\nCrash: the horse pulls up and the tracking camera carries on, leaving it behind.\nClosest to real racing. Risk: highest virtual-racing reading; one horse only, no field.',
  'ANKARA PULSE\nGraphic motion: wax-print-inspired pattern bands (original motifs) racing at different speeds.\nBuilds: bands and speed lines accelerate. Collect inverts colours; crash drains to grey.\nMost distinctive on a lobby tile. Risk: a stylised look is the one most likely to read as child-appealing (CAP "animated styles"), so it needs care.',
];

const canvas = {
  artboards: concepts.map((c, i) => ({
    file: c.file, x: i * 480, y: 0, w: 390, h: 844,
    title: ['Harmattan Dash', 'Night Meet', 'Surf Gallop', 'Race Day', 'Ankara Pulse'][i],
    is_interactive: false,
  })),
  annotations: [
    {
      id: 'brief', x: 0, y: -250, w: 1300,
      text: 'Horse crash for Nigeria and Ghana: five motion-first scenes. Each artboard plays live: 5 s betting gap, the race building with the multiplier, then a collect or a crash.\nRules held in every scene: one horse, no rivals and no finish line, multiplier only rises, crash is sudden with no slow-down first, no whip or tap-to-go-faster, adult rider, win banner only when the return beats the stake, session clock and net always visible.\nThe horse is a rough placeholder; production art would be pre-rendered 3D sprite sheets sized for low-end Android. Toggle "reducedMotion" on an artboard to see the calm version.',
    },
    ...notes.map((text, i) => ({ id: 'note-' + (i + 1), x: i * 480, y: 900, w: 390, text })),
  ],
  launch: { view: 'canvas' },
};
writeFileSync(dir + 'canvas.json', JSON.stringify(canvas, null, 2));
console.log('built', concepts.length);
