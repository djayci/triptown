// The five phase-1 concepts. One art direction, five mechanics: the canvas
// compares the axis that changes the round, not the paint.

export const PAL = {
  sky0: '#141c33', sky1: '#3b3550', sky2: '#8a4a2c',
  sun: '#ffd79a', sunGlow: 'rgba(255,176,92,.5)',
  ridge: '#1b2036', tree: '#161a2c', fence: 'rgba(236,222,196,.3)',
  dirt0: '#6b4a30', dirtMid: '#432d1d', dirt1: '#1b1109',
  dirtMark: '#7a5739', dirtMark2: '#35230f',
  dust: 'rgba(214,180,138,.45)',
  farBody: '#1c2135', farRim: 'rgba(255,186,110,.45)',
  midBody: '#171a2b', midRim: 'rgba(255,170,96,.55)',
  nearBody: '#101320', nearRim: 'rgba(255,164,86,.68)',
  frontBody: '#0b0d16', frontRim: 'rgba(255,150,80,.5)',
  crash0: 'rgba(86,66,50,.92)', crash1: 'rgba(18,14,12,.98)',
};

export const HUD = {
  btnBg: '#e8762b', btnFg: '#1a1208',
  btnIdleBg: 'rgba(239,230,212,.13)', btnIdleFg: '#efe6d4',
  winBg: '#e8762b', winFg: '#1a1208',
  lossBg: 'rgba(10,12,20,.9)', lossFg: '#efe6d4',
  multFg: '#f4ead6', shoveFg: '#ff8f6b', liftFg: '#a8d9a0',
};

export const SHELL = {
  bg: '#141c33',
  fonts: 'family=Anton&family=Inter+Tight:wght@400;500;600;700',
  display: "'Anton','Arial Narrow',sans-serif",
  ui: "'Inter Tight','Helvetica Neue',Arial,sans-serif",
  link: '#e8762b',
  footer: '18+ · RTP 97% · The outcome is fixed when the drive starts · Tapping does nothing',
};

export const CONCEPTS = [
  {
    file: 'Drove.dc.html',
    title: 'Drove — rising only',
    name: 'DROVE',
    mode: 'rising',
    verb: 'PEN IT',
    engineId: 'whack-crash/v3-rising',
    rounds: [
      { collectAt: 9.2 },
      { crashAt: 5.4 },
      { collectAt: 2.6 },
    ],
    note:
      'DROVE  (recommended)\n' +
      'Rising only, slow pace. The engine is whack-crash/v3-rising, untouched:\n' +
      'no new maths, no new config id, the committed 10M-round report already covers it.\n' +
      'Reaches every market in the set, Brazil and Portugal included.\n' +
      'The value is attached to how deep you still are in a mob you cannot steer,\n' +
      'which is the most honest crash fantasy on this canvas: there is nothing to do but leave.',
  },
  {
    file: 'Scatter.dc.html',
    title: 'Scatter — setbacks',
    name: 'SCATTER',
    mode: 'setback',
    verb: 'PEN IT',
    engineId: 'whack-crash/v3',
    rounds: [
      { setbacks: [3.0], collectAt: 8.0 },
      { setbacks: [2.2, 4.6], crashAt: 7.0 },
      { setbacks: [1.6], collectAt: 6.13 },
    ],
    note:
      'SCATTER  (runner-up)\n' +
      'The mob shoulders you back and the value halves. Config whack-crash/v3, also committed.\n' +
      'Dead in Brazil (1.207 Annex I item 14(d)) and Portugal (R1/R22): a falling value fits\n' +
      'none of the permitted round endings there. Everywhere else it is a profile flag away.\n' +
      'Round 3 is the compliance artboard: the value recovers to exactly x1.00 and the collect\n' +
      'returns the stake. RETURNED, net 0.00, and not one win cue fires.',
  },
  {
    file: 'NightFold.dc.html',
    title: 'Night Fold — deferred reveal',
    name: 'NIGHT FOLD',
    mode: 'deferred',
    verb: 'BREAK FOR IT',
    engineId: 'whack-crash/v3-rising + crashReveal: onCollect',
    rounds: [
      { pressAt: 7.2, gateOpen: true },
      { pressAt: 4.4, gateOpen: false },
      { pressAt: 10.5, gateOpen: true },
    ],
    note:
      'NIGHT FOLD\n' +
      'The cut-off is already decided and you cannot see it. You learn at the break.\n' +
      'Reuses gate-odds-mvp whole: the live chance (RTP ÷ value, floored) stays on screen\n' +
      'and is restated in the past tense after the press, and the wait is a fixed 1.6 s\n' +
      'from the press for every outcome — never tied to anything drawn on screen.\n' +
      'Nigeria and Ghana only, pending the lab letter. My reservation: that is Gate Rush’s\n' +
      'one differentiator and the same two markets, so it ships a second skin of the same bet.',
  },
  {
    file: 'TwoPens.dc.html',
    title: 'Two Pens — split stake',
    name: 'TWO PENS',
    mode: 'parts',
    verb: 'PEN',
    engineId: 'new config id, stakeParts: 2',
    rounds: [
      { partCollects: [3.2, null], collectAt: 7.4 },
      { partCollects: [2.0, null], crashAt: 5.0 },
      { partCollects: [4.0, 8.6] },
    ],
    note:
      'TWO PENS\n' +
      'One stake, one debit, one round id, two pens collected separately.\n' +
      'The only concept here with a new money path, and the only expensive one: the\n' +
      'paper-route/* split ids are retired, so this needs new ids and a committed 10M-round\n' +
      'report each, plus GLI-19 §4.4.2 per-part displays. No partial cash-out in Portugal.\n' +
      'Round 2 is the artboard people forget: pen A comes in at x1.17 and the drive is then\n' +
      'cut off. The round returned 0.58 on a 1.00 stake, so it is shown as a loss. Celebration\n' +
      'is decided on the round total, never on a pen.',
  },
  {
    file: 'Strays.dc.html',
    title: 'Strays — boosts',
    name: 'STRAYS',
    mode: 'boost',
    verb: 'PEN IT',
    engineId: 'whack-crash/v4-rising',
    rounds: [
      { boosts: [1.6, 3.4, 5.2], collectAt: 7.0 },
      { boosts: [2.2, 4.0], crashAt: 6.2 },
      { boosts: [1.2], collectAt: 3.4 },
    ],
    note:
      'STRAYS\n' +
      'Strays fold into the mob and lift the value 5% each. The boosted ids (v2/v4) exist\n' +
      'with committed reports, and the crash hazard already pays for the lift, so the maths\n' +
      'is settled. What is not settled is acceptance: a boosted id needs its own lab sign-off\n' +
      'before any regulated market uses it. Unregulated now, regulated after the letter.\n' +
      'Strictly this is a config family rather than a game, so it can also ride on any of\n' +
      'the other four as a profile flag.',
  },
];
