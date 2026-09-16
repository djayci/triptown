  componentDidMount() {
    const c = this.cfg();
    this.g = {
      round: 0, phase: 'bet', pt: 0, t: 0, mult: 1, k: 0, speed: 0, hs: 0, gait: 0, scroll: 0,
      parts: [], flash: 0, burst: 0, punch: 0, lastPunch: 1, net: 0, clock: 1394, hudT: 1,
      hx: c.horseX || 370, raceNo: 41, frozen: false, cash: 0, lightsT: 0,
    };
    this.last = 0;
    this.hudKey = '';
    const step = (now) => {
      this.raf = requestAnimationFrame(step);
      if (!this.cv || !this.cv.isConnected) this.cv = document.getElementById('scene');
      if (!this.cv) return;
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
      this.last = now;
      this.tick(dt);
      this.paint(this.cv.getContext('2d'));
    };
    this.raf = requestAnimationFrame(step);
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.raf);
  }

  // The certified rising curve (whack-crash/v1-rising): r0 0.12, rmax 0.95, ramp 12 s.
  curve(t) {
    const r0 = 0.12, rmax = 0.95, ramp = 12;
    const k = t <= ramp ? r0 * t + ((rmax - r0) * t * t) / (2 * ramp) : r0 * ramp + ((rmax - r0) * ramp) / 2 + rmax * (t - ramp);
    return Math.exp(k);
  }

  naira(v) {
    return '₦' + Math.round(Math.abs(v)).toLocaleString('en-NG');
  }

  tick(dt) {
    const c = this.cfg();
    const g = this.g;
    const R = c.rounds;
    const r = R[g.round % R.length];
    const STAKE = 500, GAP = 2.6, RES = 1.9;
    g.t += dt; g.pt += dt; g.clock += dt;
    g.flash = Math.max(0, g.flash - dt * 2.4);
    g.burst = Math.max(0, g.burst - dt * 1.6);
    g.punch = Math.max(0, g.punch - dt * 2.2);
    if (g.phase === 'bet') {
      g.mult = 1;
      if (g.pt >= GAP) { g.phase = 'run'; g.pt = 0; g.net -= STAKE; g.raceNo++; g.burst = 1; g.lastPunch = 1; }
    } else if (g.phase === 'run') {
      g.mult = this.curve(g.pt);
      for (const th of [2, 5, 10]) if (g.mult >= th && g.lastPunch < th) { g.lastPunch = th; g.punch = 1; }
      if (r.collectAt && g.pt >= r.collectAt) {
        g.phase = 'collect'; g.pt = 0; g.cash = Math.round(g.mult * 100) / 100;
        g.net += Math.round(STAKE * g.cash); g.flash = this.props.reducedMotion ? 0.3 : 1;
      } else if (r.crashAt && g.pt >= r.crashAt) {
        g.phase = 'crash'; g.pt = 0;
      }
    } else if (g.pt >= RES) {
      g.phase = 'bet'; g.pt = 0; g.round++;
      if (g.round % R.length === 0) g.net = 0;
    }
    if (g.phase === 'run') g.k = Math.min(1, Math.log(g.mult) / Math.log(4));
    if (g.phase === 'bet') g.k = 0;
    g.frozen = g.phase === 'collect' && g.pt < 0.35;
    let target = 520, rate = 3;
    if (g.phase === 'run') { target = 1100 + 2600 * g.k + 900 * g.burst; rate = 6; }
    else if (g.phase === 'crash') { target = c.crashStops ? 0 : 1100 + 2600 * g.k; rate = 1.6; }
    if (g.frozen) { g.speed = 0; }
    else {
      g.speed += (target - g.speed) * Math.min(1, dt * rate);
      g.gait += dt * (1.3 + g.speed / 1400);
      g.scroll += g.speed * dt;
    }
    g.hs = g.speed;
    g.hudT += dt;
    if (g.hudT > 0.05) { g.hudT = 0; this.pushHud(); }
  }

  pushHud() {
    const g = this.g;
    const H = this.cfg().hud;
    const STAKE = 500;
    const n = {};
    const shown = g.phase === 'collect' ? g.cash : g.mult;
    n.mult = shown.toFixed(2);
    n.multShow = g.phase !== 'crash';
    n.multOpacity = g.phase === 'bet' ? 0.5 : 1;
    n.multScale = (1 + 0.08 * g.punch + 0.04 * g.burst).toFixed(3);
    n.race = 'ROUND ' + g.raceNo;
    const s = Math.floor(g.clock);
    n.clock = String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    n.net = (g.net > 0 ? '+' : g.net < 0 ? '−' : '') + this.naira(g.net);
    n.showBanner = g.phase === 'crash' || g.phase === 'collect';
    n.bannerWin = false;
    if (g.phase === 'bet') {
      n.btnTop = 'BET ' + this.naira(STAKE);
      n.btnSub = 'Next round in ' + Math.max(1, Math.ceil(2.6 - g.pt)) + 's';
      n.btnBg = H.idleBg; n.btnFg = H.idleFg;
    } else if (g.phase === 'run') {
      n.btnTop = 'COLLECT ' + this.naira(STAKE * g.mult);
      n.btnSub = 'Stake ' + this.naira(STAKE);
      n.btnBg = H.accent; n.btnFg = H.onAccent;
    } else if (g.phase === 'crash') {
      n.btnTop = 'LIGHTS OUT';
      n.btnSub = 'Next round soon';
      n.btnBg = H.idleBg; n.btnFg = H.idleFg;
      n.banner = H.crashWord || 'LIGHTS OUT';
      n.bannerSub = 'Stake ' + this.naira(STAKE) + ' lost · Net −' + this.naira(STAKE);
    } else {
      const ret = Math.round(STAKE * g.cash);
      n.btnTop = 'COLLECTED';
      n.btnSub = this.naira(ret) + ' at x' + g.cash.toFixed(2);
      n.btnBg = H.idleBg; n.btnFg = H.idleFg;
      n.banner = 'WIN ' + this.naira(ret);
      n.bannerSub = 'Net +' + this.naira(ret - STAKE) + ' this round';
      n.bannerWin = true;
    }
    n.bannerBg = n.bannerWin ? H.accent : H.lossBg;
    n.bannerFg = n.bannerWin ? H.onAccent : H.lossFg;
    const key = JSON.stringify(n);
    if (key !== this.hudKey) { this.hudKey = key; this.setState(n); }
  }

  renderVals() {
    const H = this.cfg().hud;
    return Object.assign({
      mult: '1.00', multShow: true, multOpacity: 0.5, multScale: '1', race: 'ROUND 41', clock: '00:23:14', net: '₦0',
      btnTop: 'BET ₦500', btnSub: 'Next round in 3s', btnBg: H.idleBg, btnFg: H.idleFg,
      showBanner: false, banner: '', bannerSub: '', bannerBg: H.lossBg, bannerFg: H.lossFg,
    }, this.state || {});
  }

  // Lights: fully on while a round runs; they fail only after the crash and come back in the gap.
  lightLevel(S) {
    if (S.phase === 'crash') {
      const f = S.pt;
      if (f < 0.05) return 0.1;
      if (f < 0.1) return 0.85;
      if (f < 0.17) return 0.05;
      return 0.04;
    }
    return 1;
  }

  paint(ctx) {
    const g = this.g;
    const W = 780, H = 1688;
    const reduced = !!this.props.reducedMotion;
    const S = {
      W, H, t: g.t, dt: g.frozen ? 0 : Math.min(0.05, 1 / 60), phase: g.phase, pt: g.pt, mult: g.mult, k: g.k,
      speed: g.speed, hs: g.hs, scroll: g.scroll, gait: g.gait, hx: g.hx, reduced, frozen: g.frozen,
      burst: g.burst, punch: g.punch, flash: g.flash,
    };
    S.light = this.lightLevel(S);
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (!reduced && g.phase === 'run') {
      const a = g.k * 7 + g.burst * 10 + g.punch * 8;
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }
    // Zoom punches when the multiplier passes x2, x5, x10: tied to the value only.
    const z = 1 + 0.05 * g.k + 0.06 * g.punch;
    ctx.translate(W / 2, H * 0.55); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.55);
    this.drawScene(ctx, S);
    ctx.restore();
    if (g.flash > 0 && !this.cfg().ownFlash) {
      ctx.fillStyle = 'rgba(255,255,255,' + (g.flash * 0.75).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  speedLines(ctx, S, color, count, yMin, yMax, lenBase) {
    const n = Math.floor(count * (0.25 + S.k)) + (S.phase === 'run' ? Math.floor(S.burst * 12) : 0);
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const seed = i * 17.3;
      const y = yMin + this.rnd(seed) * (yMax - yMin);
      const len = lenBase * (0.5 + this.rnd(seed * 2)) * (0.6 + 1.6 * S.k);
      const x = ((this.rnd(seed * 3) * (S.W + len) - S.scroll * (1.6 + this.rnd(seed) * 1.4)) % (S.W + len) + (S.W + len)) % (S.W + len) - len;
      ctx.globalAlpha = 0.15 + 0.5 * this.rnd(seed * 5);
      ctx.fillRect(x, y, len, 2 + this.rnd(seed * 7) * 3);
    }
    ctx.globalAlpha = 1;
  }

