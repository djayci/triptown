  // ---- Round engine -------------------------------------------------------
  // Shared by all five concept artboards. The only difference between them is
  // cfg().mode and its round script, so the canvas compares mechanics, not art.

  BET_GAP() { return 5; }      // UK RTS: 5 s minimum between round starts
  RESULT_HOLD() { return 3.4; }
  GATE_WAIT() { return 1.6; }  // deferred reveal: fixed from the press, every outcome
  STAKE() { return 1; }
  RTP() { return 0.97; }

  // Slow-pace growth, the shape of whack-crash/v3: r0 0.06, rmax 0.475, ramp 24 s.
  logGrowth(t) {
    const r0 = 0.06, rmax = 0.475, ramp = 24;
    if (t <= 0) return 0;
    if (t <= ramp) return r0 * t + ((rmax - r0) * t * t) / (2 * ramp);
    return r0 * ramp + ((rmax - r0) * ramp) / 2 + rmax * (t - ramp);
  }

  startState() {
    const c = this.cfg();
    return {
      round: 0, phase: 'bet', pt: 0, t: 0, mult: 1, k: 0, mods: 1,
      speed: 150, scroll: 0, gait: 0, parts: [], flash: 0, shove: 0, lift: 0,
      net: 0, clock: 892, cash: 0, dust: 0, dark: 0,
      fired: [], collected: [], cue: '', cueT: 0, gateOpen: false, pressedAt: 0,
      mode: c.mode,
    };
  }

  round() {
    const R = this.cfg().rounds;
    return R[this.g.round % R.length];
  }

  // Value on screen: growth, times every setback and boost that has landed.
  valueAt(pt) {
    return Math.exp(this.logGrowth(pt)) * this.g.mods;
  }

  tick(dt) {
    const g = this.g;
    const r = this.round();
    g.t += dt;
    g.pt += dt;
    g.clock += dt;
    g.flash = Math.max(0, g.flash - dt * 2.2);
    g.shove *= Math.max(0, 1 - dt * 3.4);
    g.lift = Math.max(0, g.lift - dt * 1.6);
    g.cueT = Math.max(0, g.cueT - dt);

    if (g.phase === 'bet') {
      g.mult = 1; g.mods = 1; g.fired = []; g.collected = []; g.dark = 0; g.cue = '';
      if (g.pt >= this.BET_GAP()) { g.phase = 'run'; g.pt = 0; g.net -= this.STAKE(); }
    } else if (g.phase === 'run') {
      // Modifiers land on their scripted times. Independent of the crash by construction.
      (r.setbacks || []).forEach((at, i) => {
        if (g.pt >= at && !g.fired.includes('s' + i)) {
          g.fired.push('s' + i); g.mods *= 0.5;
          g.shove = this.reduced() ? 6 : 26;
          g.cue = 'SHOULDERED  x0.5'; g.cueT = 1.5;
        }
      });
      (r.boosts || []).forEach((at, i) => {
        if (g.pt >= at && !g.fired.includes('b' + i)) {
          g.fired.push('b' + i); g.mods *= 1.05;
          g.lift = 1; g.cue = 'STRAY JOINS  +5%'; g.cueT = 1.3;
        }
      });
      g.mult = this.valueAt(g.pt);

      // Partial collects (two pens): each part settles on its own, one round.
      (r.partCollects || []).forEach((at, i) => {
        if (at != null && g.pt >= at && !g.collected.some((p) => p.i === i)) {
          const share = this.STAKE() / 2;
          const ret = Math.round(share * g.mult * 100) / 100;
          g.collected.push({ i, mult: g.mult, ret });
          g.net += ret;
          g.cue = (i === 0 ? 'PEN A' : 'PEN B') + '  x' + g.mult.toFixed(2);
          g.cueT = 1.4;
          // No celebration here: AGENTS rule 13 waits for the round total.
        }
      });

      if (g.collected.length === 2) {
        // Both pens in: the round is over on the total, not on either pen.
        g.cash = g.collected.reduce((s, p) => s + p.ret, 0);
        g.phase = 'collect'; g.pt = 0;
        g.flash = g.cash > this.STAKE() && !this.reduced() ? 1 : 0;
      } else if (r.pressAt != null && g.pt >= r.pressAt) {
        g.phase = 'wait'; g.pressedAt = g.pt; g.pt = 0;
        g.gateOpen = !!r.gateOpen;
      } else if (r.collectAt != null && g.pt >= r.collectAt) {
        this.settle(g.mult);
      } else if (r.crashAt != null && g.pt >= r.crashAt) {
        this.bust();
      }
    } else if (g.phase === 'wait') {
      // Identical wait for every outcome, measured from the press. Never from the scene.
      g.mult = this.valueAt(g.pressedAt);
      if (g.pt >= this.GATE_WAIT()) {
        if (g.gateOpen) this.settle(this.valueAt(g.pressedAt));
        else this.bust();
      }
    } else if (g.pt >= this.RESULT_HOLD()) {
      g.phase = 'bet'; g.pt = 0; g.round++;
      if (g.round % this.cfg().rounds.length === 0) g.net = 0;
    }

    if (g.phase === 'crash') g.dark = Math.min(1, g.dark + dt * 1.8);
    g.k = g.phase === 'run' || g.phase === 'wait' ? Math.min(1, Math.log(Math.max(1, g.mult)) / Math.log(6)) : 0;

    // Camera: the mob moves, the player never steers it.
    const target = g.phase === 'run' ? 320 + 760 * g.k : g.phase === 'wait' ? 300 : g.phase === 'crash' ? 70 : 150;
    g.speed += (target - g.speed) * Math.min(1, dt * 2.2);
    g.scroll += g.speed * dt;
    g.gait += dt * (0.7 + g.speed / 700);
    g.dust += dt * (0.4 + g.k);
    this.pushHud();
  }

  settle(mult) {
    const g = this.g;
    const parts = this.g.collected;
    const open = parts.length ? this.STAKE() / 2 : this.STAKE();
    const ret = Math.round(open * mult * 100) / 100;
    g.cash = ret + parts.reduce((s, p) => s + p.ret, 0);
    g.net += ret;
    g.phase = 'collect'; g.pt = 0;
    // One celebrate decision, on the round total only.
    g.flash = g.cash > this.STAKE() && !this.reduced() ? 1 : 0;
  }

  bust() {
    const g = this.g;
    g.cash = g.collected.reduce((s, p) => s + p.ret, 0);
    g.phase = 'crash'; g.pt = 0;
    g.dust = 0;
  }

  money(v) {
    return '$' + Math.abs(v).toFixed(2);
  }

  // ---- HUD ----------------------------------------------------------------

  pushHud() {
    const g = this.g;
    const c = this.cfg();
    const H = c.hud;
    const S = this.STAKE();
    const n = {};

    n.mult = 'x' + (g.phase === 'crash' ? '—' : g.mult.toFixed(2));
    n.multOpacity = g.phase === 'bet' ? 0.5 : 1;
    n.multColor = g.lift > 0.2 ? H.liftFg : g.shove > 2 ? H.shoveFg : H.multFg;
    n.label = c.name + ' · STAKE ' + this.money(S);
    const total = Math.floor(g.clock);
    n.clock = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
      .map((v) => String(v).padStart(2, '0')).join(':');
    n.net = (g.net > 0.004 ? '+' : g.net < -0.004 ? '−' : '') + this.money(g.net);
    n.stakeOpacity = g.phase === 'bet' ? 1 : 0.4;

    // Deferred reveal owes the player the live chance, floored, and keeps it on screen
    // after the press, restated in a tense that stays true (AGENTS compliance rule 8a).
    n.showChance = c.mode === 'deferred';
    const chanceAt = g.phase === 'run' ? g.mult : g.phase === 'bet' ? 1 : this.valueAt(g.pressedAt);
    n.chance = Math.floor((this.RTP() / Math.max(1, chanceAt)) * 100) + '%';
    n.chanceLabel = g.phase === 'run' ? 'CHANCE THE GATE IS OPEN'
      : g.phase === 'wait' ? 'CHANCE THE GATE WAS OPEN'
      : g.phase === 'bet' ? 'CHANCE AT x1.00'
      : 'CHANCE AT THE PRESS';

    n.cue = g.cueT > 0 ? g.cue : '';
    n.showParts = c.mode === 'parts';
    n.partA = this.partLine(0);
    n.partB = this.partLine(1);

    n.showBanner = g.phase === 'collect' || g.phase === 'crash';
    n.bannerBg = H.lossBg; n.bannerFg = H.lossFg; n.banner = ''; n.bannerSub = '';
    const secs = Math.max(1, Math.ceil(this.BET_GAP() - g.pt));

    if (g.phase === 'bet') {
      n.btnTop = 'BET ' + this.money(S);
      n.btnSub = 'Next drive in ' + secs + 's';
      n.btnBg = H.btnIdleBg; n.btnFg = H.btnIdleFg;
    } else if (g.phase === 'run') {
      n.btnTop = c.mode === 'parts' ? 'PEN A / PEN B' : c.verb;
      n.btnSub = c.mode === 'parts'
        ? this.money((S / 2) * g.mult) + ' each'
        : this.money((g.collected.length ? S / 2 : S) * g.mult);
      n.btnBg = H.btnBg; n.btnFg = H.btnFg;
    } else if (g.phase === 'wait') {
      n.btnTop = 'MAKING FOR THE GATE';
      n.btnSub = 'Pressed at x' + this.valueAt(g.pressedAt).toFixed(2);
      n.btnBg = H.btnIdleBg; n.btnFg = H.btnIdleFg;
    } else if (g.phase === 'crash') {
      n.btnTop = 'DRIVE OVER';
      n.btnSub = 'Next drive soon';
      n.btnBg = H.btnIdleBg; n.btnFg = H.btnIdleFg;
      n.showBanner = true;
      n.banner = c.mode === 'deferred' ? 'GATE SHUT' : 'CUT OFF';
      n.bannerSub = g.cash > 0
        ? 'Returned ' + this.money(g.cash) + ' · net −' + this.money(S - g.cash) + ' this drive'
        : 'Stake ' + this.money(S) + ' lost this drive';
      // A partial return that lost on the round is still a loss, shown as one.
      if (g.cash > 0) { n.bannerBg = H.lossBg; n.bannerFg = H.lossFg; }
    } else {
      n.btnTop = 'PENNED';
      n.btnSub = this.money(g.cash);
      n.btnBg = H.btnIdleBg; n.btnFg = H.btnIdleFg;
      const beats = g.cash > S + 0.0001;
      n.banner = (beats ? 'WIN ' : 'RETURNED ') + this.money(g.cash);
      n.bannerSub = beats
        ? 'Net +' + this.money(g.cash - S) + ' this drive'
        : 'Net ' + (g.cash < S ? '−' : '') + this.money(g.cash - S) + ' this drive';
      if (beats) { n.bannerBg = H.winBg; n.bannerFg = H.winFg; }
      if (c.mode === 'deferred') n.banner = 'GATE OPEN · ' + this.money(g.cash);
    }
    this.pushVals(n);
  }

  partLine(i) {
    const g = this.g;
    const done = g.collected.find((p) => p.i === i);
    const name = i === 0 ? 'A' : 'B';
    if (done) return name + '  x' + done.mult.toFixed(2) + '  ' + this.money(done.ret);
    if (g.phase === 'crash') return name + '  lost';
    if (g.phase === 'collect') return name + '  x' + g.mult.toFixed(2) + '  ' + this.money(this.STAKE() / 2 * g.mult);
    return name + '  open  ' + this.money((this.STAKE() / 2) * g.mult);
  }

  // ---- Scene --------------------------------------------------------------
  // Eye level, inside the mob, looking forward over their backs. No predator is
  // ever drawn: it cannot be shown before the crash (that is advance warning of
  // the crash time) and must not be shown at it (animal-harm imagery). The
  // hazard is the mob turning and the gate.
  //
  // Depth rows, back to front. Each row's scroll factor is its scale, so the
  // near animals sweep past and the far ones crawl. Density and dust follow
  // elapsed time only — nothing in the scene knows the crash time.

  HORIZON() { return 548; }

  ROWS() {
    return [
      { s: 0.17, y: 566, sp: 86, jx: 30, jy: 10 },
      { s: 0.24, y: 596, sp: 108, jx: 36, jy: 14 },
      { s: 0.34, y: 638, sp: 140, jx: 46, jy: 18 },
      { s: 0.47, y: 700, sp: 180, jx: 58, jy: 24 },
      { s: 0.63, y: 788, sp: 232, jx: 72, jy: 30 },
      { s: 0.86, y: 916, sp: 300, jx: 92, jy: 38 },
      { s: 1.0, y: 1086, sp: 368, jx: 112, jy: 44 },
      { s: 1.28, y: 1304, sp: 452, jx: 138, jy: 52 },
      { s: 1.6, y: 1580, sp: 560, jx: 170, jy: 58 },
    ];
  }

  paint(ctx, dt) {
    const g = this.g;
    const W = 780, H = 1688;
    const reduced = this.reduced();
    const S = {
      W, H, GND: this.HORIZON(), t: g.t, dt, phase: g.phase, pt: g.pt, k: g.k, mult: g.mult,
      speed: g.speed, scroll: g.scroll, gait: g.gait, reduced, dark: g.dark, lift: g.lift,
    };
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (!reduced && (g.k > 0.5 || g.shove > 1)) {
      const a = Math.max(0, (g.k - 0.5) * 7);
      ctx.translate((Math.random() - 0.5) * a - g.shove, (Math.random() - 0.5) * a);
    }
    this.sky(ctx, S);
    this.ground(ctx, S);
    const rows = this.ROWS();
    const P = this.cfg().pal;
    rows.forEach((row, i) => {
      const d = i / (rows.length - 1);
      // Air between the rows: the far mob sits behind more dust than the near one.
      if (i > 0 && i < 7) this.haze(ctx, S, row.y - 40 * row.s, 120 * row.s, 0.3 - d * 0.24);
      this.mobRow(ctx, S, row, i, this.mix(P.farBody, P.nearBody, d), this.mix(P.farRim, P.nearRim, d));
    });
    this.drawParts(ctx, S);
    if (g.phase === 'crash') this.crashSweep(ctx, S);
    if (g.flash > 0) {
      ctx.fillStyle = 'rgba(255,236,206,' + (g.flash * 0.65).toFixed(3) + ')';
      ctx.fillRect(-40, -40, W + 80, H + 80);
    }
    ctx.restore();
  }

  mix(a, b, t) {
    const pa = this.hex(a), pb = this.hex(b);
    return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')';
  }

  hex(h) {
    if (h.startsWith('rgba') || h.startsWith('rgb')) {
      return h.replace(/[^0-9.,]/g, '').split(',').slice(0, 3).map(Number);
    }
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  }

  sky(ctx, S) {
    const P = this.cfg().pal;
    const HOR = S.GND;
    const gr = ctx.createLinearGradient(0, -40, 0, HOR);
    gr.addColorStop(0, P.sky0); gr.addColorStop(0.55, P.sky1); gr.addColorStop(1, P.sky2);
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, S.W + 80, HOR + 40);
    // The sun sits still. Nothing in the sky tracks the round.
    const sx = 272, sy = HOR - 54;
    const rg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 400);
    rg.addColorStop(0, P.sun); rg.addColorStop(0.12, P.sunGlow); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(-40, sy - 400, S.W + 80, 440);
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(sx, sy, 38, 0, 6.2832); ctx.fill();
    // Far ridge and a windbreak on the skyline, parallax only.
    this.tile(S, 0.04, 940, (x, i) => {
      ctx.fillStyle = P.ridge;
      ctx.beginPath();
      ctx.moveTo(x - 30, HOR - 44);
      for (let j = 0; j <= 10; j++) ctx.lineTo(x + j * 96, HOR - 52 - this.rnd(i * 11 + j) * 54);
      ctx.lineTo(x + 980, HOR); ctx.lineTo(x - 30, HOR);
      ctx.fill();
    });
    this.tile(S, 0.1, 360, (x, i) => {
      for (let j = 0; j < 2; j++) {
        const tx = x + 70 + j * 170 + this.rnd(i * 5 + j) * 60;
        const h = 58 + this.rnd(i + j * 3) * 44;
        ctx.fillStyle = P.tree;
        ctx.beginPath(); ctx.ellipse(tx, HOR - h, 30, 21, 0, 0, 6.2832); ctx.fill();
        ctx.fillRect(tx - 3.5, HOR - h, 7, h);
      }
    });
    // Stock fence along the skyline. The field has an edge; nothing on it counts down.
    ctx.strokeStyle = P.fence; ctx.lineWidth = 2.5;
    this.tile(S, 0.22, 132, (x) => {
      ctx.beginPath(); ctx.moveTo(x, HOR - 42); ctx.lineTo(x, HOR + 2); ctx.stroke();
    });
    ctx.globalAlpha = 0.6;
    [14, 28].forEach((d) => {
      ctx.beginPath(); ctx.moveTo(-40, HOR - d - 10); ctx.lineTo(S.W + 40, HOR - d - 10); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  ground(ctx, S) {
    const P = this.cfg().pal;
    const gr = ctx.createLinearGradient(0, S.GND - 10, 0, S.H);
    gr.addColorStop(0, P.dirt0); gr.addColorStop(0.5, P.dirtMid); gr.addColorStop(1, P.dirt1);
    ctx.fillStyle = gr; ctx.fillRect(-40, S.GND - 10, S.W + 80, S.H - S.GND + 60);
    // Churned ground. Only visible in the gaps, which is the point.
    this.tile(S, 1.1, 150, (x, i) => {
      const y = S.GND + 90 + this.rnd(i) * 1000;
      const s = 0.3 + (y - S.GND) / 900;
      ctx.fillStyle = this.rnd(i * 3) > 0.5 ? P.dirtMark : P.dirtMark2;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(x + this.rnd(i * 7) * 90, y, 40 * s, 9 * s, 0, 0, 6.2832);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  haze(ctx, S, y, h, alpha) {
    const P = this.cfg().pal;
    ctx.globalAlpha = Math.max(0, alpha) * (0.6 + S.k * 0.5);
    const gr = ctx.createLinearGradient(0, y - h, 0, y + h);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, P.dust); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(-40, y - h, S.W + 80, h * 2);
    ctx.globalAlpha = 1;
  }

  /**
   * Cattle, in two silhouettes. A rear view alone is ambiguous — the cues that
   * say "cattle" are the long barrel, the dip in the topline, the head carried
   * low, ears out, the tail tuft and the pied markings, and most of those only
   * read in profile. So the mob mixes them: profile and three-quarter animals
   * carry the recognition, rear views pack the gaps and make it a crowd.
   *
   * No faces, no eyes, no mascot — CAP under-18 guidance §20 and the Night Meet
   * art fix. These are stock, drawn the way stock looks at dusk.
   */
  beast(ctx, x, y, s, C, ph, S, variant, dir) {
    const bob = Math.sin((S.gait + ph) * 6.2832) * 6 * s;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s * (variant === 'side' ? dir : 1), s);
    if (variant === 'side') this.beastSide(ctx, C, ph, S);
    else this.beastRear(ctx, C, ph, S);
    ctx.restore();
  }

  /** A leg with a real hock: thigh, cannon, hoof. Swing comes from the gait. */
  leg(ctx, hx, hy, len, ph, S, w, shade, back) {
    const run = Math.min(1, S.speed / 900);
    const th = (S.gait + ph) * 6.2832;
    const swing = Math.sin(th) * (0.12 + 0.3 * run);
    const bend = Math.max(0, Math.cos(th)) * (back ? 0.5 : 0.34) * (0.3 + 0.7 * run);
    const kx = hx + Math.sin(swing) * len * 0.55;
    const ky = hy + Math.cos(swing) * len * 0.55;
    const a2 = swing - bend * (back ? 1 : -1);
    const fx = kx + Math.sin(a2) * len * 0.45;
    const fy = ky + Math.cos(a2) * len * 0.45;
    ctx.strokeStyle = shade; ctx.lineCap = 'round';
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = w * 0.62;
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.lineWidth = w * 0.8;
    ctx.beginPath(); ctx.moveTo(fx, fy - 2); ctx.lineTo(fx, fy + 3); ctx.stroke();
  }

  /**
   * Profile. Body units: nose at about x 150, tail at x -110, ground at y 0,
   * topline near y -150. A beef animal: deep barrel, high rump, short neck,
   * head carried at chest height.
   */
  beastSide(ctx, C, ph, S) {
    const tw = Math.sin((S.gait + ph) * 3.1) * 8;
    // far legs first, in the shaded tone
    this.leg(ctx, -58, -104, 100, ph + 0.5, S, 14, C.far, true);
    this.leg(ctx, 56, -106, 102, ph + 0.12, S, 13, C.far, false);

    // tail: off the pin bone, hanging to a tuft. The clearest cattle cue there is.
    ctx.strokeStyle = C.body; ctx.lineCap = 'round'; ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-86, -150);
    ctx.quadraticCurveTo(-98 + tw, -96, -94 + tw * 1.4, -44);
    ctx.stroke();
    ctx.fillStyle = C.body;
    ctx.beginPath(); ctx.ellipse(-94 + tw * 1.4, -34, 9, 15, tw * 0.02, 0, 6.2832); ctx.fill();

    // barrel, with the belly dropped and the topline dipping behind the withers
    ctx.fillStyle = C.body;
    ctx.beginPath();
    ctx.moveTo(-84, -150);                              // pin bone
    ctx.bezierCurveTo(-70, -164, -30, -162, 4, -158);   // loin, dipping
    ctx.bezierCurveTo(30, -156, 52, -164, 70, -170);    // withers rising
    ctx.bezierCurveTo(94, -174, 100, -144, 96, -116);   // shoulder, deep
    ctx.bezierCurveTo(93, -92, 78, -70, 44, -66);       // brisket, dropped
    ctx.bezierCurveTo(6, -60, -36, -66, -60, -80);      // belly
    ctx.bezierCurveTo(-80, -92, -92, -120, -84, -150);  // round of the rump
    ctx.closePath(); ctx.fill();
    // hip and rump mass
    ctx.beginPath(); ctx.ellipse(-62, -132, 34, 32, 0, 0, 6.2832); ctx.fill();

    // pied marking: a patch of lighter hide, kept inside the silhouette
    if (C.pied) {
      ctx.fillStyle = C.light;
      ctx.beginPath(); ctx.ellipse(-22, -132, 22, 14, -0.18, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, -116, 13, 9, 0.22, 0, 6.2832); ctx.fill();
    }

    // neck and head, carried low, muzzle blunt, no eye
    ctx.fillStyle = C.body;
    // neck: short and thick, running down and forward off the withers
    ctx.beginPath();
    ctx.moveTo(74, -170);
    ctx.quadraticCurveTo(116, -166, 140, -138);
    ctx.lineTo(150, -112);
    ctx.quadraticCurveTo(122, -92, 96, -108);
    ctx.quadraticCurveTo(80, -136, 74, -170);
    ctx.closePath(); ctx.fill();
    // dewlap, the fold of chest hanging under the neck
    ctx.beginPath();
    ctx.moveTo(96, -112);
    ctx.quadraticCurveTo(124, -98, 140, -104);
    ctx.quadraticCurveTo(126, -78, 96, -84);
    ctx.closePath(); ctx.fill();
    // head: a blunt wedge clear of the body, muzzle down
    ctx.beginPath();
    ctx.moveTo(134, -144);
    ctx.quadraticCurveTo(170, -146, 186, -124);
    ctx.quadraticCurveTo(194, -108, 176, -102);
    ctx.quadraticCurveTo(148, -98, 134, -112);
    ctx.closePath(); ctx.fill();
    // ears, out clear of the head
    ctx.beginPath(); ctx.ellipse(140, -150, 17, 8.5, -0.42, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(150, -140, 14, 7, -0.1, 0, 6.2832); ctx.fill();
    if (C.horns) {
      ctx.strokeStyle = C.body; ctx.lineWidth = 7.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(150, -154); ctx.quadraticCurveTo(170, -174, 190, -164); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(142, -156); ctx.quadraticCurveTo(152, -180, 172, -184); ctx.stroke();
    }

    // near legs, in the body tone so they read in front
    this.leg(ctx, -54, -104, 100, ph, S, 15, C.body, true);
    this.leg(ctx, 60, -106, 102, ph + 0.62, S, 14, C.body, false);

    // Rim light from the low sun: the topline and the rump only.
    ctx.strokeStyle = C.rim; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.globalAlpha = C.rimA;
    ctx.beginPath();
    ctx.moveTo(-84, -151);
    ctx.bezierCurveTo(-70, -165, -30, -163, 4, -159);
    ctx.bezierCurveTo(30, -157, 52, -165, 72, -171);
    ctx.stroke();
    ctx.globalAlpha = C.rimA * 0.8;
    ctx.beginPath(); ctx.moveTo(-92, -140); ctx.quadraticCurveTo(-96, -116, -84, -100); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Rear. Hip points, the tail hanging in the notch, the back running away. */
  beastRear(ctx, C, ph, S) {
    const tw = Math.sin((S.gait + ph) * 3.1) * 6;
    this.leg(ctx, -30, -92, 92, ph, S, 13, C.far, true);
    this.leg(ctx, 30, -92, 92, ph + 0.5, S, 13, C.far, true);

    // the back running away from the camera: wide at the rump, narrow at the head
    ctx.fillStyle = C.body;
    ctx.beginPath();
    ctx.moveTo(-50, -118);
    ctx.quadraticCurveTo(-40, -186, -24, -196);
    ctx.lineTo(24, -196);
    ctx.quadraticCurveTo(40, -186, 50, -118);
    ctx.closePath(); ctx.fill();
    // rump: flat across the hip points, round into the thighs
    ctx.beginPath();
    ctx.moveTo(-52, -130);
    ctx.quadraticCurveTo(-58, -74, -36, -62);
    ctx.quadraticCurveTo(0, -52, 36, -62);
    ctx.quadraticCurveTo(58, -74, 52, -130);
    ctx.quadraticCurveTo(26, -146, 0, -144);
    ctx.quadraticCurveTo(-26, -146, -52, -130);
    ctx.closePath(); ctx.fill();

    if (C.pied) {
      ctx.fillStyle = C.light;
      ctx.beginPath(); ctx.ellipse(-20, -112, 13, 16, 0.1, 0, 6.2832); ctx.fill();
    }

    // tail in the notch between the pin bones
    ctx.strokeStyle = C.body; ctx.lineCap = 'round'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, -140); ctx.quadraticCurveTo(tw, -96, tw * 1.5, -52); ctx.stroke();
    ctx.fillStyle = C.body;
    ctx.beginPath(); ctx.ellipse(tw * 1.5, -42, 8, 13, 0, 0, 6.2832); ctx.fill();

    // head below the topline, turned a little, with both ears out
    const turn = (ph - 0.5) * 26;
    ctx.beginPath(); ctx.ellipse(turn, -197, 18, 15, 0, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(turn - 24, -201, 12, 6.5, 0.3, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(turn + 24, -201, 12, 6.5, -0.3, 0, 6.2832); ctx.fill();
    if (C.horns) {
      ctx.strokeStyle = C.body; ctx.lineWidth = 6.5;
      ctx.beginPath(); ctx.moveTo(turn - 12, -208); ctx.quadraticCurveTo(turn - 34, -223, turn - 42, -209); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(turn + 12, -208); ctx.quadraticCurveTo(turn + 34, -223, turn + 42, -209); ctx.stroke();
    }

    this.leg(ctx, -28, -92, 92, ph + 0.28, S, 14, C.body, true);
    this.leg(ctx, 28, -92, 92, ph + 0.78, S, 14, C.body, true);

    // Rim light: the sunward hip and the line of the back.
    ctx.strokeStyle = C.rim; ctx.lineCap = 'round';
    ctx.globalAlpha = C.rimA;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-52, -131); ctx.quadraticCurveTo(-26, -147, 0, -145);
    ctx.stroke();
    ctx.globalAlpha = C.rimA * 0.75;
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-48, -130); ctx.quadraticCurveTo(-38, -186, -24, -195); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  mobRow(ctx, S, row, i, shade, rim) {
    // Two passes offset by half a space: the mob overlaps instead of lining up.
    for (let pass = 0; pass < 2; pass++) {
      this.tile(S, row.s * 0.75, row.sp, (x, n) => {
        const seed = n * 7.3 + i * 31.7 + pass * 101.3;
        const jx = (this.rnd(seed) - 0.5) * row.jx * 2 + pass * row.sp * 0.5;
        const jy = (this.rnd(seed * 1.7) - 0.5) * row.jy * 2;
        const sc = row.s * (0.86 + this.rnd(seed * 2.3) * 0.28);
        const v = this.rnd(seed * 5.9);
        const ph = this.rnd(seed * 3.1);
        // A few head of lighter hide, a few nearly black: the mob stops tiling.
        const body = v > 0.84 ? this.mix(shade, '#8a6f52', 0.22) : v < 0.2 ? this.mix(shade, '#000000', 0.32) : shade;
        const C = {
          body,
          far: this.mix(body, '#000000', 0.3),
          light: this.mix(body, '#c9ae86', 0.28),
          rim,
          rimA: 0.2 + ph * 0.42,
          pied: this.rnd(seed * 8.1) > 0.58,
          horns: this.rnd(seed * 9.7) > 0.38,
        };
        // Profile animals carry the recognition, so the near rows get more of
        // them; the far rows pack with rear views and read as a mass.
        const wantSide = this.rnd(seed * 4.7) < 0.3 + row.s * 0.34;
        const dir = this.rnd(seed * 6.3) > 0.72 ? -1 : 1;
        this.beast(ctx, x + jx, row.y + jy, sc, C, ph, S, wantSide ? 'side' : 'rear', dir);
      });
    }
  }

  crashSweep(ctx, S) {
    const P = this.cfg().pal;
    const p = Math.min(1, S.pt / 0.9);
    ctx.globalAlpha = Math.min(0.94, p * 1.15);
    const gr = ctx.createLinearGradient(0, S.H - 1400 * p, 0, S.H);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.4, P.crash0); gr.addColorStop(1, P.crash1);
    ctx.fillStyle = gr;
    ctx.fillRect(-40, S.H - 1500 * p, S.W + 80, 1560 * p);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(8,8,12,' + (S.dark * 0.5).toFixed(3) + ')';
    ctx.fillRect(-40, -40, S.W + 80, S.H + 80);
  }

  // ---- helpers ------------------------------------------------------------

  rnd(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  tile(S, f, sp, fn) {
    const off = S.scroll * f;
    const base = Math.floor(off / sp);
    const shift = off - base * sp;
    const count = Math.ceil(S.W / sp) + 3;
    for (let i = -2; i < count; i++) fn(i * sp - shift, base + i);
  }

  emit(x, y, n, o) {
    const P = this.g.parts;
    const cap = this.reduced() ? 60 : 180;
    for (let i = 0; i < n; i++) {
      if (P.length > cap) P.shift();
      P.push({
        x, y, vx: (o.vx || 0) + (Math.random() - 0.5) * (o.spread || 60),
        vy: -(Math.random() * (o.lift || 40)), life: 0,
        max: (o.life || 1) * (0.6 + Math.random() * 0.8),
        r: (o.r || 10) * (0.5 + Math.random()), grow: o.grow || 0,
        color: o.color, alpha: o.alpha == null ? 0.4 : o.alpha, world: o.world == null ? 1 : o.world,
      });
    }
  }

  drawParts(ctx, S) {
    const P = this.g.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      if (S.dt > 0) {
        p.life += S.dt;
        p.x += (p.vx - S.speed * p.world) * S.dt;
        p.y += p.vy * S.dt;
      }
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.alpha * (1 - p.life / p.max));
      ctx.fillStyle = p.color;
      const rr = p.r + p.grow * p.life;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
