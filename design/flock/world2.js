  // ---- Round engine -------------------------------------------------------
  // Each artboard supplies cfg(): a round script, and whether it skips the bet
  // gap so it can loop one moment of the round.

  BET_GAP() { return 5; }      // UK RTS: 5 s minimum between round starts
  RESULT_HOLD() { return 3.4; }
  STAKE() { return 1; }

  // Slow-pace growth, the shape of whack-crash/v3: r0 0.06, rmax 0.475, ramp 24 s.
  logGrowth(t) {
    const r0 = 0.06, rmax = 0.475, ramp = 24;
    if (t <= 0) return 0;
    if (t <= ramp) return r0 * t + ((rmax - r0) * t * t) / (2 * ramp);
    return r0 * ramp + ((rmax - r0) * ramp) / 2 + rmax * (t - ramp);
  }

  // Pace follows elapsed time only — never the value after a setback, never the crash time.
  paceK(pt) {
    return Math.min(1, this.logGrowth(pt) / Math.log(6));
  }
  ramTarget(k) { return 340 + 1100 * k; }
  // The drove keeps one steady pace in every phase. Only the ram speeds up, so the
  // value climbing reads as him running harder through a herd that never changes.
  HERD_SPEED() { return 300; }

  startState() {
    const c = this.cfg();
    const g = {
      round: 0, phase: 'bet', pt: 0, t: 0, mult: 1, mods: 1, k: 0,
      ramSpeed: 0, herdSpeed: 300, cam: 0, herd: 0, gait: 0, rgait: 0,
      rx: 180, ry: 1200, flash: 0, stumble: 0, net: 0, clock: 892, cash: 0,
      dark: 0, wolfT: 0, fired: [], cue: '', cueT: 0, parts: [],
    };
    this.g = g;
    if (c.noBet) this.begin(c.rounds[0].from || 0);
    return g;
  }

  round() {
    const R = this.cfg().rounds;
    return R[this.g.round % R.length];
  }

  valueAt(pt) {
    return Math.exp(this.logGrowth(pt)) * this.g.mods;
  }

  begin(from) {
    const g = this.g;
    g.phase = 'run'; g.pt = from; g.mods = 1; g.fired = []; g.dark = 0; g.wolfT = 0;
    g.net -= this.STAKE();
    g.mult = this.valueAt(from);
    g.k = this.paceK(from);
    if (from > 0) {
      g.ramSpeed = this.ramTarget(g.k);
      g.rx = 250 + 150 * g.k; g.ry = 1200;
    }
  }

  tick(dt) {
    const g = this.g;
    const c = this.cfg();
    const r = this.round();
    const S = this.STAKE();
    g.t += dt; g.pt += dt; g.clock += dt;
    g.flash = Math.max(0, g.flash - dt * 2.2);
    g.stumble = Math.max(0, g.stumble - dt * 1.3);
    g.cueT = Math.max(0, g.cueT - dt);

    if (g.phase === 'bet') {
      g.mult = 1; g.mods = 1; g.k = 0; g.dark = 0;
      if (g.pt >= this.BET_GAP()) {
        if (c.holdBet) g.pt = 0;
        else this.begin(r.from || 0);
      }
    } else if (g.phase === 'run') {
      // Setbacks land on their scripted times, independent of the crash by construction.
      (r.setbacks || []).forEach((at, i) => {
        if (g.pt >= at && !g.fired.includes('s' + i)) {
          g.fired.push('s' + i); g.mods *= 0.5;
          g.stumble = 1; g.cue = this.WORDS().split; g.cueT = 1.6;
        }
      });
      g.mult = this.valueAt(g.pt);
      g.k = this.paceK(g.pt);
      if (r.collectAt != null && g.pt >= r.collectAt) this.settle(g.mult);
      else if (r.crashAt != null && g.pt >= r.crashAt) this.bust();
      else if (r.to != null && g.pt >= r.to) { g.net += S; this.begin(r.from || 0); }
    } else if (g.pt >= this.RESULT_HOLD()) {
      g.round++;
      if (c.noBet) { g.net = 0; this.begin(this.round().from || 0); }
      else {
        g.phase = 'bet'; g.pt = 0;
        if (g.round % c.rounds.length === 0) g.net = 0;
      }
    }

    // The ram sets the camera; the drove runs at its own pace. When he is faster the
    // cattle slide back past him; when he stops they stream on ahead.
    const ramT = g.phase === 'run' ? this.ramTarget(g.k) : 0;
    const rate = g.phase === 'crash' ? 6 : g.phase === 'collect' ? 1.4 : 2.2;
    g.ramSpeed += (ramT - g.ramSpeed) * Math.min(1, dt * rate);
    g.herdSpeed = this.HERD_SPEED();
    g.cam += g.ramSpeed * dt;
    g.herd += g.herdSpeed * dt;
    g.gait += dt * (0.35 + g.herdSpeed / 330);
    g.rgait += dt * (g.ramSpeed < 20 ? 0 : 0.9 + g.ramSpeed / 430);

    // Where he is on screen: forward as he speeds up, down and out of the herd on a collect.
    const tx = g.phase === 'bet' ? 180 : g.phase === 'collect' ? 210 : g.phase === 'crash' ? g.rx : 250 + 150 * g.k - 110 * g.stumble;
    const ty = g.phase === 'collect' ? 1262 : 1200;
    g.rx += (tx - g.rx) * Math.min(1, dt * (g.stumble > 0.5 ? 8 : 2));
    g.ry += (ty - g.ry) * Math.min(1, dt * 1.6);

    if (g.phase === 'crash') {
      g.wolfT += dt;
      g.dark = Math.min(1, Math.max(0, g.wolfT - 0.5) * 1.1);
    }
    if (g.phase === 'run' && g.ramSpeed > 200) {
      const n = Math.random() < dt * (6 + 30 * g.k) ? 1 : 0;
      if (n) this.emit(g.rx - 60, g.ry - 6, 1, { vx: -40, spread: 50, lift: 30 + 40 * g.k, life: 0.9, r: 18 + 16 * g.k, grow: 34, color: 'rgba(214,180,138,1)', alpha: 0.16 });
    }
    this.pushHud();
  }

  settle(mult) {
    const g = this.g;
    g.cash = Math.round(this.STAKE() * mult * 100) / 100;
    g.net += g.cash;
    g.phase = 'collect'; g.pt = 0;
    // One celebrate decision, on the round total only.
    g.flash = g.cash > this.STAKE() && !this.reduced() ? 1 : 0;
  }

  bust() {
    const g = this.g;
    g.cash = 0;
    g.phase = 'crash'; g.pt = 0; g.wolfT = 0;
  }

  WORDS() {
    return { verb: 'BREAK OUT', done: 'BROKE OUT', over: 'RUN OVER', lost: 'The run is over', split: 'SHOULDERED  x0.5' };
  }

  money(v) {
    return '$' + Math.abs(v).toFixed(2);
  }

  // ---- HUD ----------------------------------------------------------------

  pushHud() {
    const g = this.g;
    const S = this.STAKE();
    const n = {};
    n.mult = 'x' + (g.phase === 'crash' ? '—' : g.mult.toFixed(2));
    n.multOpacity = g.phase === 'bet' ? 0.5 : 1;
    n.multColor = g.stumble > 0.3 ? '#ff8f6b' : '#f4ead6';
    const total = Math.floor(g.clock);
    n.clock = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
      .map((v) => String(v).padStart(2, '0')).join(':');
    n.net = (g.net > 0.004 ? '+' : g.net < -0.004 ? '−' : '') + this.money(g.net);
    n.stakeOpacity = g.phase === 'bet' ? 1 : 0.4;
    n.cue = g.cueT > 0 ? g.cue : '';
    n.showBanner = g.phase === 'collect' || g.phase === 'crash';
    n.bannerBg = 'rgba(10,12,20,.9)'; n.bannerFg = '#efe6d4'; n.banner = ''; n.bannerSub = '';
    const idle = ['rgba(239,230,212,.13)', '#efe6d4'];
    if (g.phase === 'bet') {
      n.btnTop = 'BET ' + this.money(S);
      n.btnSub = 'Next run in ' + Math.max(1, Math.ceil(this.BET_GAP() - g.pt)) + 's';
      [n.btnBg, n.btnFg] = idle;
    } else if (g.phase === 'run') {
      n.btnTop = this.WORDS().verb;
      n.btnSub = this.money(S * g.mult);
      n.btnBg = '#e8762b'; n.btnFg = '#1a1208';
    } else if (g.phase === 'crash') {
      n.btnTop = this.WORDS().over; n.btnSub = 'Next run soon';
      [n.btnBg, n.btnFg] = idle;
      n.banner = 'WOLF';
      n.bannerSub = this.WORDS().lost + ' · stake ' + this.money(S) + ' lost';
    } else {
      n.btnTop = this.WORDS().done; n.btnSub = this.money(g.cash);
      [n.btnBg, n.btnFg] = idle;
      const beats = g.cash > S + 0.0001;
      n.banner = (beats ? 'WIN ' : 'RETURNED ') + this.money(g.cash);
      n.bannerSub = 'Net ' + (beats ? '+' : g.cash < S ? '−' : '') + this.money(g.cash - S) + ' this run';
      if (beats) { n.bannerBg = '#e8762b'; n.bannerFg = '#1a1208'; }
    }
    this.pushVals(n);
  }

  // ---- Scene --------------------------------------------------------------
  // Eye level in the drove, the ram running through it. The wolf exists only
  // in the crash phase: nothing before the crash knows it is coming.

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
      W, H, GND: this.HORIZON(), t: g.t, dt, phase: g.phase, k: g.k,
      speed: g.ramSpeed, scroll: g.cam, mob: g.cam - g.herd, gait: g.gait,
      cattleRun: Math.min(1, g.herdSpeed / 900), reduced,
    };
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    this.sky(ctx, S);
    this.ground(ctx, S);
    if (!reduced) this.streaks(ctx, S);
    const rows = this.ROWS();
    const P = this.PAL();
    const wolfX = this.wolfX();
    // Near rows thin out where the ram and the wolf stand, so neither is hidden.
    const clear = g.phase === 'crash' ? [g.rx, wolfX] : [g.rx];
    rows.forEach((row, i) => {
      const d = i / (rows.length - 1);
      if (i > 0 && i < 7) this.haze(ctx, S, row.y - 40 * row.s, 120 * row.s, 0.3 - d * 0.24);
      this.mobRow(ctx, S, row, i, this.mix(P.farBody, P.nearBody, d), this.mix(P.farRim, P.nearRim, d), i >= 7 ? clear : null);
      if (i === 6) {
        this.drawParts(ctx, S);
        this.drawRam(ctx, g.rx, g.ry, 1.1, this.ramPose());
        if (g.phase === 'crash') this.drawWolfAt(ctx, wolfX, 1204, 1.2);
      }
    });
    if (g.phase === 'crash') this.crashSweep(ctx, S);
    if (g.flash > 0) {
      ctx.fillStyle = 'rgba(255,236,206,' + (g.flash * 0.5).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  PAL() {
    return {
      sky0: '#141c33', sky1: '#3b3550', sky2: '#8a4a2c',
      sun: '#ffd79a', sunGlow: 'rgba(255,176,92,.5)',
      ridge: '#1b2036', tree: '#161a2c', fence: 'rgba(236,222,196,.3)',
      dirt0: '#6b4a30', dirtMid: '#432d1d', dirt1: '#1b1109',
      dirtMark: '#7a5739', dirtMark2: '#35230f', dust: 'rgba(214,180,138,.45)',
      farBody: '#1c2135', farRim: 'rgba(255,186,110,.45)',
      nearBody: '#101320', nearRim: 'rgba(255,164,86,.68)',
      crash0: 'rgba(40,30,24,.8)', crash1: 'rgba(10,8,8,.94)',
    };
  }

  ramPose() {
    const g = this.g;
    const run = Math.min(1, g.ramSpeed / 1100);
    const braking = g.phase === 'crash' ? Math.min(1, g.wolfT * 4) : 0;
    return {
      run, ph: g.rgait,
      bob: g.ramSpeed < 20 ? Math.sin(g.t * 2.2) * 1.2 : -Math.abs(Math.sin(g.rgait * 6.2832)) * (3 + 9 * run),
      tilt: -0.24 * g.stumble - 0.18 * braking + 0.06 * run,
      headDrop: 8 * run - 12 * braking,
    };
  }

  // The wolf steps in from ahead of him and stops short. It never closes the gap.
  wolfX() {
    const g = this.g;
    const stop = Math.min(700, g.rx + 340);
    if (this.reduced()) return stop;
    const p = Math.min(1, g.wolfT / 0.45);
    return 900 + (stop - 900) * (1 - Math.pow(1 - p, 3));
  }

  drawWolfAt(ctx, x, y, s) {
    const g = this.g;
    ctx.save();
    ctx.globalAlpha = this.reduced() ? Math.min(1, g.wolfT * 3) : 1;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(x, y + 1, 84 * s, 7 * s, 0, 0, 6.2832); ctx.fill();
    ctx.translate(x, y); ctx.scale(-s, s);
    this.wolfBody(ctx, g.t, Math.min(1, g.wolfT / 0.45));
    ctx.restore();
  }

  p2(d) {
    this._p = this._p || {};
    return this._p[d] || (this._p[d] = new Path2D(d));
  }

  /** A leg with a hock, frozen or swinging by gait phase. */
  legAt(ctx, hx, hy, len, ph, run, w, col, back) {
    const th = ph * 6.2832;
    const swing = Math.sin(th) * (0.08 + 0.5 * run);
    const bend = Math.max(0, Math.cos(th)) * (back ? 0.6 : 0.42) * (0.2 + 0.8 * run);
    const kx = hx + Math.sin(swing) * len * 0.55, ky = hy + Math.cos(swing) * len * 0.55;
    const a2 = swing - bend * (back ? 1 : -1);
    const fx = kx + Math.sin(a2) * len * 0.45, fy = ky + Math.cos(a2) * len * 0.45;
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  }

  /**
   * The ram: the player. A grown male — full curl of horn, long Roman nose,
   * matted working fleece. Silhouette and rim light only: no eye, no face.
   */
  HERO_TONE() {
    return {
      fleece: '#8c7a5e', dark: '#5e5040', head: '#4d4134', horn: '#b49c74', hornDark: '#6e5c43',
      rim: 'rgb(255,196,120)', rimA: 1, leg: '#2a2219', farLeg: '#1a140e',
    };
  }

  drawRam(ctx, x, y, s, o) {
    const T = o.tone || this.HERO_TONE();
    const { fleece, dark, rim, horn, hornDark, head } = T;
    const A = o.alpha == null ? 1 : o.alpha;
    ctx.save();
    ctx.globalAlpha = A;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(x, y + 1, 56 * s, 6 * s, 0, 0, 6.2832); ctx.fill();
    ctx.translate(x, y + o.bob * s); ctx.scale(o.flip ? -s : s, s);
    ctx.translate(0, -60); ctx.rotate(o.tilt); ctx.translate(0, 60);
    this.legAt(ctx, -46, -58, 60, o.ph + 0.5, o.run, 7, T.farLeg, true);
    this.legAt(ctx, 46, -58, 60, o.ph + 0.1, o.run, 7, T.farLeg, false);
    ctx.strokeStyle = dark; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.stroke(this.p2('M-72 -98Q-88 -90 -86 -72'));
    ctx.fillStyle = fleece;
    ctx.fill(this.p2('M-70 -60C-84 -80 -80 -102 -66 -112C-58 -120 -46 -117 -40 -124C-30 -129 -22 -121 -12 -126C0 -131 10 -123 20 -127C34 -131 44 -121 54 -122C66 -121 70 -112 76 -104C86 -92 84 -76 78 -66C70 -54 52 -50 30 -52C10 -48 -16 -48 -36 -52C-52 -50 -64 -52 -70 -60Z'));
    ctx.fillStyle = dark;
    ctx.fill(this.p2('M-62 -58L-57 -46L-50 -54L-43 -41L-35 -53L-24 -43L-15 -52L-5 -40L4 -51L13 -43L23 -52L33 -42L43 -53L53 -47L62 -58Z'));
    ctx.globalAlpha = A * 0.55; ctx.lineWidth = 2.6;
    ctx.stroke(this.p2('M-44 -108l-3 11M-20 -112l-2 11M6 -114l-1 11M30 -110l2 11M52 -104l3 10M-56 -88l-3 10M-30 -90l-2 10M-4 -92l0 10M22 -88l2 10M46 -82l3 9M-40 -70l-2 8M-12 -70l0 8M16 -68l2 8'));
    ctx.globalAlpha = A;
    // Rim light on the fleece topline. It stops at the withers, short of the neck.
    ctx.strokeStyle = rim; ctx.lineWidth = 3.5; ctx.globalAlpha = A * 0.85 * T.rimA;
    ctx.stroke(this.p2('M-66 -112C-58 -120 -46 -117 -40 -124C-30 -129 -22 -121 -12 -126C0 -131 10 -123 20 -127C34 -131 44 -121 54 -122'));
    ctx.lineWidth = 2.5; ctx.globalAlpha = A * 0.5 * T.rimA;
    ctx.stroke(this.p2('M-70 -62C-84 -80 -80 -102 -66 -112'));
    ctx.globalAlpha = A;

    ctx.save();
    ctx.translate(0, o.headDrop); ctx.translate(70, -100); ctx.rotate(o.headDrop * 0.016); ctx.translate(-70, 100);
    ctx.fillStyle = fleece;
    ctx.fill(this.p2('M56 -118C74 -126 92 -118 100 -102L106 -88C94 -78 76 -80 68 -92Z'));
    ctx.fillStyle = head;
    ctx.fill(this.p2('M84 -112C96 -124 112 -122 120 -112C128 -102 137 -90 141 -79C145 -70 140 -63 131 -64C119 -66 106 -74 96 -84C88 -92 82 -100 84 -112Z'));
    // Rim down the face, on the head's own edge.
    ctx.strokeStyle = rim; ctx.lineWidth = 2.4; ctx.globalAlpha = A * 0.75 * T.rimA;
    ctx.stroke(this.p2('M108 -120C114 -118 118 -115 120 -112C128 -102 137 -90 141 -79'));
    ctx.globalAlpha = A;
    // The horn: one curl back and down round the ear, ridged. Drawn last so nothing crosses it.
    const curl = this.p2('M98 -120C84 -136 60 -124 62 -102C64 -84 84 -78 94 -90C102 -100 94 -110 84 -104');
    ctx.lineCap = 'round';
    ctx.strokeStyle = hornDark; ctx.lineWidth = 13; ctx.stroke(curl);
    ctx.strokeStyle = horn; ctx.lineWidth = 8; ctx.stroke(curl);
    ctx.strokeStyle = hornDark; ctx.lineWidth = 2;
    ctx.stroke(this.p2('M88 -129l-1 5M77 -129l1 5M67 -121l4 3M64 -107l5 0M69 -93l3 -3'));
    ctx.restore();

    this.legAt(ctx, -52, -58, 60, o.ph, o.run, 8, T.leg, true);
    this.legAt(ctx, 54, -58, 60, o.ph + 0.6, o.run, 8, T.leg, false);
    ctx.restore();
  }

  /** The wolf, facing right in its own units. Lean, grown, head low, hackles up. */
  wolfBody(ctx, t, settle) {
    const B = '#07080e';
    const sway = Math.sin(t * 1.6) * 0.05;
    const breathe = Math.sin(t * 2.4) * 1.2;
    const stride = (1 - settle) * Math.sin(t * 18) * 0.5;
    this.legAt(ctx, -64, -64, 66, 0.25 + stride, 0.2, 8, '#000', true);
    this.legAt(ctx, 54, -60, 62, 0.6 - stride, 0.2, 8, '#000', false);
    ctx.save();
    ctx.translate(-80, -76); ctx.rotate(sway); ctx.translate(80, 76);
    ctx.fillStyle = B;
    ctx.fill(this.p2('M-80 -76C-104 -70 -118 -50 -126 -24C-114 -28 -100 -42 -84 -58Z'));
    ctx.restore();
    ctx.save(); ctx.translate(0, breathe * 0.4);
    ctx.fillStyle = B;
    ctx.fill(this.p2('M-80 -80C-60 -94 -10 -92 20 -96C44 -104 66 -104 78 -94C88 -80 84 -62 70 -56C50 -50 20 -56 -10 -58C-40 -58 -64 -56 -78 -62C-88 -68 -90 -74 -80 -80Z'));
    ctx.fill(this.p2('M24 -96L32 -110L38 -100L46 -114L52 -102L60 -112L66 -100L74 -104L80 -92Z'));
    ctx.fill(this.p2('M66 -102C84 -106 100 -100 108 -92C114 -88 120 -86 124 -84L142 -76C147 -74 146 -67 140 -66L118 -63C106 -61 94 -64 84 -70C76 -76 68 -86 66 -102Z'));
    ctx.fill(this.p2('M94 -94L101 -118L110 -91ZM84 -98L87 -120L97 -96Z'));
    // Cold rim, so it reads against the dust without a face or eyes.
    ctx.strokeStyle = 'rgb(170,190,230)'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.6;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(this.p2('M-80 -81C-60 -95 -10 -93 20 -97C30 -104 44 -112 60 -112C70 -106 78 -100 84 -92C92 -102 104 -96 112 -89L142 -76'));
    ctx.globalAlpha = 1;
    ctx.restore();
    this.legAt(ctx, -52, -62, 64, 0.75 - stride, 0.2, 8, B, true);
    this.legAt(ctx, 68, -60, 62, 0.1 + stride, 0.2, 8, B, false);
  }

  mix(a, b, t) {
    const pa = this.hex(a), pb = this.hex(b);
    return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')';
  }

  hex(h) {
    if (h.startsWith('rgb')) return h.replace(/[^0-9.,]/g, '').split(',').slice(0, 3).map(Number);
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  }

  sky(ctx, S) {
    const P = this.PAL();
    const HOR = S.GND;
    const gr = ctx.createLinearGradient(0, -40, 0, HOR);
    gr.addColorStop(0, P.sky0); gr.addColorStop(0.55, P.sky1); gr.addColorStop(1, P.sky2);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, S.W, HOR + 2);
    const sx = 272, sy = HOR - 54;
    const rg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 400);
    rg.addColorStop(0, P.sun); rg.addColorStop(0.12, P.sunGlow); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, sy - 400, S.W, 440);
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(sx, sy, 38, 0, 6.2832); ctx.fill();
    this.tile(S.scroll, S.W, 0.04, 940, (x, i) => {
      ctx.fillStyle = P.ridge;
      ctx.beginPath();
      ctx.moveTo(x - 30, HOR - 44);
      for (let j = 0; j <= 10; j++) ctx.lineTo(x + j * 96, HOR - 52 - this.rnd(i * 11 + j) * 54);
      ctx.lineTo(x + 980, HOR); ctx.lineTo(x - 30, HOR);
      ctx.fill();
    });
    this.tile(S.scroll, S.W, 0.1, 360, (x, i) => {
      for (let j = 0; j < 2; j++) {
        const tx = x + 70 + j * 170 + this.rnd(i * 5 + j) * 60;
        const h = 58 + this.rnd(i + j * 3) * 44;
        ctx.fillStyle = P.tree;
        ctx.beginPath(); ctx.ellipse(tx, HOR - h, 30, 21, 0, 0, 6.2832); ctx.fill();
        ctx.fillRect(tx - 3.5, HOR - h, 7, h);
      }
    });
    ctx.strokeStyle = P.fence; ctx.lineWidth = 2.5;
    this.tile(S.scroll, S.W, 0.22, 132, (x) => {
      ctx.beginPath(); ctx.moveTo(x, HOR - 42); ctx.lineTo(x, HOR + 2); ctx.stroke();
    });
    ctx.globalAlpha = 0.6;
    [14, 28].forEach((d) => {
      ctx.beginPath(); ctx.moveTo(0, HOR - d - 10); ctx.lineTo(S.W, HOR - d - 10); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  ground(ctx, S) {
    const P = this.PAL();
    const gr = ctx.createLinearGradient(0, S.GND - 10, 0, S.H);
    gr.addColorStop(0, P.dirt0); gr.addColorStop(0.5, P.dirtMid); gr.addColorStop(1, P.dirt1);
    ctx.fillStyle = gr; ctx.fillRect(0, S.GND - 10, S.W, S.H - S.GND + 10);
    this.tile(S.scroll, S.W, 1.1, 150, (x, i) => {
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

  // Speed lines on the ground, by pace. They follow elapsed time like the rest.
  streaks(ctx, S) {
    if (S.k < 0.15 || S.phase !== 'run') return;
    ctx.strokeStyle = 'rgb(236,214,180)'; ctx.lineCap = 'round';
    this.tile(S.scroll, S.W, 1.6, 70, (x, i) => {
      const y = S.GND + 60 + this.rnd(i * 4.1) * 700;
      const len = 40 + this.rnd(i * 5.3) * 200 * S.k;
      ctx.globalAlpha = (0.08 + this.rnd(i * 9) * 0.2) * Math.min(1, (S.k - 0.15) * 2.5);
      ctx.lineWidth = 1.5 + this.rnd(i) * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  haze(ctx, S, y, h, alpha) {
    ctx.globalAlpha = Math.max(0, alpha) * (0.6 + S.k * 0.5);
    const gr = ctx.createLinearGradient(0, y - h, 0, y + h);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, this.PAL().dust); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, y - h, S.W, h * 2);
    ctx.globalAlpha = 1;
  }

  /** Cattle in profile, all heading right with the drove; no faces, no eyes, no mascot. */
  beast(ctx, x, y, s, C, ph, S) {
    const bob = Math.sin((S.gait + ph) * 6.2832) * 6 * s * (0.3 + S.cattleRun);
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);
    this.beastSide(ctx, C, ph, S);
    ctx.restore();
  }

  cowLeg(ctx, hx, hy, len, ph, S, w, shade, back) {
    this.legAt(ctx, hx, hy, len, S.gait + ph, S.cattleRun, w, shade, back);
  }

  beastSide(ctx, C, ph, S) {
    const tw = Math.sin((S.gait + ph) * 3.1) * 8;
    this.cowLeg(ctx, -58, -104, 100, ph + 0.5, S, 14, C.far, true);
    this.cowLeg(ctx, 56, -106, 102, ph + 0.12, S, 13, C.far, false);
    ctx.strokeStyle = C.body; ctx.lineCap = 'round'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-86, -150); ctx.quadraticCurveTo(-98 + tw, -96, -94 + tw * 1.4, -44); ctx.stroke();
    ctx.fillStyle = C.body;
    ctx.beginPath(); ctx.ellipse(-94 + tw * 1.4, -34, 9, 15, tw * 0.02, 0, 6.2832); ctx.fill();
    ctx.fill(this.p2('M-84 -150C-70 -164 -30 -162 4 -158C30 -156 52 -164 70 -170C94 -174 100 -144 96 -116C93 -92 78 -70 44 -66C6 -60 -36 -66 -60 -80C-80 -92 -92 -120 -84 -150Z'));
    ctx.beginPath(); ctx.ellipse(-62, -132, 34, 32, 0, 0, 6.2832); ctx.fill();
    if (C.pied) {
      ctx.fillStyle = C.light;
      ctx.beginPath(); ctx.ellipse(-22, -132, 22, 14, -0.18, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, -116, 13, 9, 0.22, 0, 6.2832); ctx.fill();
    }
    ctx.fillStyle = C.body;
    ctx.fill(this.p2('M74 -170Q116 -166 140 -138L150 -112Q122 -92 96 -108Q80 -136 74 -170Z'));
    ctx.fill(this.p2('M96 -112Q124 -98 140 -104Q126 -78 96 -84Z'));
    ctx.fill(this.p2('M134 -144Q170 -146 186 -124Q194 -108 176 -102Q148 -98 134 -112Z'));
    ctx.beginPath(); ctx.ellipse(140, -150, 17, 8.5, -0.42, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(150, -140, 14, 7, -0.1, 0, 6.2832); ctx.fill();
    if (C.horns) {
      ctx.strokeStyle = C.body; ctx.lineWidth = 7.5;
      ctx.stroke(this.p2('M150 -154Q170 -174 190 -164M142 -156Q152 -180 172 -184'));
    }
    this.cowLeg(ctx, -54, -104, 100, ph, S, 15, C.body, true);
    this.cowLeg(ctx, 60, -106, 102, ph + 0.62, S, 14, C.body, false);
    ctx.strokeStyle = C.rim; ctx.lineWidth = 3.2; ctx.globalAlpha = C.rimA;
    ctx.stroke(this.p2('M-84 -151C-70 -165 -30 -163 4 -159C30 -157 52 -165 72 -171'));
    ctx.globalAlpha = 1;
  }

  mobRow(ctx, S, row, i, shade, rim, clear) {
    for (let pass = 0; pass < 2; pass++) {
      this.tile(S.mob, S.W, row.s * 0.75, row.sp, (x, n) => {
        const seed = n * 7.3 + i * 31.7 + pass * 101.3;
        const bx = x + (this.rnd(seed) - 0.5) * row.jx * 2 + pass * row.sp * 0.5;
        const jy = (this.rnd(seed * 1.7) - 0.5) * row.jy * 2;
        let a = 1;
        // The two foreground rows go see-through where they would hide the ram or the wolf.
        if (clear) clear.forEach((cx) => { a = Math.min(a, 0.1 + Math.min(1, Math.max(0, (Math.abs(bx + 40 * row.s - cx) - 150) / 180)) * 0.9); });
        const sc = row.s * (0.86 + this.rnd(seed * 2.3) * 0.28);
        const v = this.rnd(seed * 5.9);
        const ph = this.rnd(seed * 3.1);
        const body = v > 0.84 ? this.mix(shade, '#8a6f52', 0.22) : v < 0.2 ? this.mix(shade, '#000000', 0.32) : shade;
        const C = {
          body, far: this.mix(body, '#000000', 0.3), light: this.mix(body, '#c9ae86', 0.28), rim,
          rimA: 0.2 + ph * 0.42, pied: this.rnd(seed * 8.1) > 0.58, horns: this.rnd(seed * 9.7) > 0.38,
        };
        ctx.globalAlpha = a;
        // Every animal in profile, heading the way the drove is going.
        this.beast(ctx, bx, row.y + jy, sc, C, ph, S);
        ctx.globalAlpha = 1;
      });
    }
  }

  crashSweep(ctx, S) {
    const P = this.PAL();
    const d = this.g.dark;
    if (d <= 0) return;
    ctx.globalAlpha = Math.min(0.85, d);
    const gr = ctx.createLinearGradient(0, S.H - 900 * d, 0, S.H);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, P.crash0); gr.addColorStop(1, P.crash1);
    ctx.fillStyle = gr;
    ctx.fillRect(0, S.H - 900 * d, S.W, 900 * d);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(8,8,12,' + (d * 0.3).toFixed(3) + ')';
    ctx.fillRect(0, 0, S.W, S.H);
  }

  // ---- helpers ------------------------------------------------------------

  rnd(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  tile(scroll, W, f, sp, fn) {
    const off = scroll * f;
    const base = Math.floor(off / sp);
    const shift = off - base * sp;
    const count = Math.ceil(W / sp) + 3;
    for (let i = -2; i < count; i++) fn(i * sp - shift, base + i);
  }

  emit(x, y, n, o) {
    const P = this.g.parts;
    const cap = this.reduced() ? 30 : 90;
    for (let i = 0; i < n; i++) {
      if (P.length > cap) P.shift();
      P.push({
        x, y, vx: (o.vx || 0) + (Math.random() - 0.5) * (o.spread || 60),
        vy: -(Math.random() * (o.lift || 40)), life: 0,
        max: (o.life || 1) * (0.6 + Math.random() * 0.8),
        r: (o.r || 10) * (0.5 + Math.random()), grow: o.grow || 0,
        color: o.color, alpha: o.alpha == null ? 0.4 : o.alpha,
      });
    }
  }

  drawParts(ctx, S) {
    const P = this.g.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      if (S.dt > 0) {
        p.life += S.dt;
        p.x += (p.vx - S.speed) * S.dt;
        p.y += p.vy * S.dt;
      }
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.alpha * (1 - p.life / p.max));
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + p.grow * p.life, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
