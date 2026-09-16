  componentDidMount() {
    const c = this.cfg();
    this.g = {
      round: 0, phase: 'bet', pt: 0, t: 0, mult: 1, k: 0, speed: 260, hs: 260, gait: 0,
      scroll: 0, parts: [], flash: 0, net: 0, clock: 754, hudT: 1, cash: 0,
      hx: c.horseX || 360, prevCrash: false, raceNo: 14, frozen: false,
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
      this.paint(this.cv.getContext('2d'), dt);
    };
    this.raf = requestAnimationFrame(step);
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.raf);
  }

  renderVals() {
    const s = this.state || {};
    const c = this.cfg();
    return Object.assign({
      mult: 'x1.00', multOpacity: 0.55, raceLabel: 'RACE 14 · STAKE ₦500',
      clock: '00:12:34', net: '₦0', stakeOpacity: 1,
      btnTop: 'BET ₦500', btnSub: 'Next race in 5s', btnBg: c.hud.btnIdleBg, btnFg: c.hud.btnIdleFg,
      showBanner: false, banner: '', bannerSub: '', bannerBg: c.hud.lossBg, bannerFg: c.hud.lossFg,
      ticker: 'Going: good · next race in 5s',
    }, s);
  }

  naira(v) {
    return '₦' + Math.round(Math.abs(v)).toLocaleString('en-NG');
  }

  tick(dt) {
    const c = this.cfg();
    const g = this.g;
    const R = c.rounds;
    const r = R[g.round % R.length];
    const STAKE = 500;
    const BET = 5;
    const RES = 3.2;
    g.t += dt;
    g.pt += dt;
    g.clock += dt;
    g.flash = Math.max(0, g.flash - dt * 2.2);
    if (g.phase === 'bet') {
      g.mult = 1;
      if (g.pt >= BET) {
        g.phase = 'run'; g.pt = 0; g.net -= STAKE; g.raceNo++;
      }
    } else if (g.phase === 'run') {
      g.mult = Math.exp(0.2 * g.pt);
      if (r.collectAt && g.pt >= r.collectAt) {
        g.phase = 'collect'; g.pt = 0;
        g.cash = Math.round(g.mult * 100) / 100;
        g.net += Math.round(STAKE * g.cash);
        g.flash = this.props.reducedMotion ? 0.3 : 1;
      } else if (r.crashAt && g.pt >= r.crashAt) {
        g.phase = 'crash'; g.pt = 0; g.cash = 0; g.prevCrash = true;
      }
    } else if (g.pt >= RES) {
      g.phase = 'bet'; g.pt = 0; g.round++;
      if (g.round % R.length === 0) g.net = 0;
      if (c.driftOnCrash && g.prevCrash) g.hx = -420;
    }
    if (g.phase === 'run') g.k = Math.min(1, Math.log(g.mult) / Math.log(5));
    if (g.phase === 'bet') g.k = 0;
    g.frozen = g.phase === 'collect' && g.pt < 0.5;

    let camT = 260, horseT = 260, camRate = 2.5, horseRate = 2.5;
    if (g.phase === 'run') { camT = horseT = 700 + 1500 * g.k; camRate = horseRate = 3; }
    else if (g.phase === 'crash') { camT = 0; horseT = 0; horseRate = 1.3; camRate = c.crashCamRate || 1.3; }
    else if (g.phase === 'collect') { camRate = horseRate = 1.2; }
    if (g.frozen) { g.speed = 0; g.hs = 0; }
    else {
      g.speed += (camT - g.speed) * Math.min(1, dt * camRate);
      g.hs += (horseT - g.hs) * Math.min(1, dt * horseRate);
    }
    if (g.phase === 'crash' && c.driftOnCrash) g.hx += (g.hs - g.speed) * dt * 0.7;
    else g.hx += ((c.horseX || 360) - g.hx) * Math.min(1, dt * 1.1);
    if (!g.frozen) {
      g.gait += dt * (g.hs > 40 ? 1.0 + g.hs / 1100 : g.hs / 40);
      g.scroll += g.speed * dt;
    }
    g.hudT += dt;
    if (g.hudT > 0.08) { g.hudT = 0; this.pushHud(); }
  }

  pushHud() {
    const c = this.cfg();
    const g = this.g;
    const H = c.hud;
    const STAKE = 500;
    const BET = 5;
    const n = {};
    const shown = g.phase === 'collect' ? g.cash : g.mult;
    n.mult = 'x' + shown.toFixed(2);
    n.multOpacity = g.phase === 'bet' ? 0.55 : g.phase === 'crash' ? 0 : 1;
    n.raceLabel = 'RACE ' + g.raceNo + ' · STAKE ' + this.naira(STAKE);
    const total = Math.floor(g.clock);
    const hh = Math.floor(total / 3600), mm = Math.floor(total / 60) % 60, ss = total % 60;
    n.clock = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    n.net = (g.net > 0 ? '+' : g.net < 0 ? '−' : '') + this.naira(g.net);
    n.stakeOpacity = g.phase === 'bet' ? 1 : 0.4;
    n.showBanner = false;
    n.banner = ''; n.bannerSub = ''; n.bannerBg = H.lossBg; n.bannerFg = H.lossFg;
    const secs = Math.max(1, Math.ceil(BET - g.pt));
    if (g.phase === 'bet') {
      n.btnTop = 'BET ' + this.naira(STAKE);
      n.btnSub = 'Next race in ' + secs + 's';
      n.btnBg = H.btnIdleBg; n.btnFg = H.btnIdleFg;
      n.ticker = 'Going: good · next race in ' + secs + 's';
    } else if (g.phase === 'run') {
      n.btnTop = 'COLLECT';
      n.btnSub = this.naira(STAKE * g.mult);
      n.btnBg = H.btnBg; n.btnFg = H.btnFg;
      const m = g.mult;
      n.ticker = m < 1.3 ? 'And she’s away, lovely start' : m < 1.8 ? 'Settling into a good rhythm' : m < 2.6 ? 'Picking up real pace now' : m < 3.5 ? 'Flying along down the far side!' : 'What a gallop this is!';
    } else if (g.phase === 'crash') {
      n.btnTop = 'RACE OVER';
      n.btnSub = 'Next race soon';
      n.btnBg = H.btnIdleBg; n.btnFg = H.btnIdleFg;
      n.showBanner = true;
      n.banner = H.crashWord || 'PULLED UP';
      n.bannerSub = 'Stake ' + this.naira(STAKE) + ' lost this race';
      n.ticker = 'Pulled up · race over';
    } else {
      const ret = Math.round(STAKE * g.cash);
      n.btnTop = 'COLLECTED';
      n.btnSub = this.naira(ret);
      n.btnBg = H.btnIdleBg; n.btnFg = H.btnIdleFg;
      n.showBanner = true;
      if (ret > STAKE) {
        n.banner = 'WIN ' + this.naira(ret);
        n.bannerSub = 'Net +' + this.naira(ret - STAKE) + ' this race';
        n.bannerBg = H.winBg; n.bannerFg = H.winFg;
      } else {
        n.banner = 'RETURNED ' + this.naira(ret);
        n.bannerSub = 'Net ' + (ret < STAKE ? '−' : '') + this.naira(ret - STAKE) + ' this race';
      }
      n.ticker = 'Collected at x' + g.cash.toFixed(2);
    }
    const key = JSON.stringify(n);
    if (key !== this.hudKey) { this.hudKey = key; this.setState(n); }
  }

  paint(ctx, dt) {
    const g = this.g;
    const W = 780, H = 1688;
    const reduced = !!this.props.reducedMotion;
    const S = {
      W, H, t: g.t, dt: g.frozen ? 0 : dt, phase: g.phase, pt: g.pt, mult: g.mult, k: g.k || 0,
      speed: g.speed, hs: g.hs, scroll: g.scroll, gait: g.gait, hx: g.hx, reduced, frozen: g.frozen,
      prevCrash: g.prevCrash, flash: g.flash,
    };
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (!reduced && g.phase === 'run' && S.k > 0.45) {
      const a = (S.k - 0.45) * 9;
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }
    this.drawScene(ctx, S);
    if (g.flash > 0 && !this.cfg().ownFlash) {
      ctx.fillStyle = 'rgba(255,255,255,' + (g.flash * 0.8).toFixed(3) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();
    if (g.phase === 'bet' && g.pt > 1.2) g.prevCrash = false;
  }

  rnd(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  tile(S, f, sp, fn) {
    const off = S.scroll * f;
    const base = Math.floor(off / sp);
    const shift = off - base * sp;
    const count = Math.ceil(S.W / sp) + 2;
    for (let i = -1; i < count; i++) fn(i * sp - shift, base + i);
  }

  emit(x, y, n, o) {
    const P = this.g.parts;
    const cap = this.props.reducedMotion ? 120 : 320;
    for (let i = 0; i < n; i++) {
      if (P.length > cap) P.shift();
      P.push({
        x: x + (Math.random() - 0.5) * (o.jx || 20), y,
        vx: (o.vx || 0) + (Math.random() - 0.5) * (o.spread || 80),
        vy: (o.vy || 0) - Math.random() * (o.lift || 80),
        life: 0, max: (o.life || 1) * (0.6 + Math.random() * 0.8),
        r: (o.r || 10) * (0.5 + Math.random()), grow: o.grow || 0, grav: o.grav || 0,
        color: o.color, alpha: o.alpha == null ? 0.6 : o.alpha, world: o.world == null ? 1 : o.world,
        sq: !!o.square,
      });
    }
  }

  drawParts(ctx, S) {
    const P = this.g.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      if (S.dt > 0) {
        p.life += S.dt;
        p.vy += p.grav * S.dt;
        p.x += (p.vx - S.speed * p.world) * S.dt;
        p.y += p.vy * S.dt;
      }
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.alpha * (1 - p.life / p.max));
      ctx.fillStyle = p.color;
      const rr = p.r + p.grow * p.life;
      if (p.sq) { ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // Placeholder gallop: production art is pre-rendered 3D sprite sheets.
  horse(ctx, S, L, G, s, opt) {
    opt = opt || {};
    const TAU = Math.PI * 2;
    const p = S.gait;
    const run = Math.min(1, S.hs / 520);
    const bob = -Math.abs(Math.sin(TAU * p)) * 7 * run;
    const pitch = Math.sin(TAU * p + 0.8) * 0.045 * run;
    const upright = S.phase === 'run' ? 0 : S.phase === 'crash' ? 1 - Math.min(1, S.hs / 700) : S.phase === 'collect' ? 0.55 : 0.35;
    const hooves = [];
    ctx.save();
    ctx.translate(S.hx, G);
    if (opt.mirror) { ctx.scale(s, -s); ctx.globalAlpha = opt.alpha; }
    else ctx.scale(s, s);
    ctx.translate(0, bob);
    ctx.rotate(pitch);
    const amp = 0.18 + 0.5 * run;
    const leg = (hx, hy, ph, front, near) => {
      const th = TAU * (p + ph);
      const a = amp * Math.sin(th);
      const fold = Math.max(0, Math.cos(th)) * (front ? 1.5 : 1.0) * (0.3 + 0.7 * run);
      const kx = hx + Math.sin(a) * 36, ky = hy + Math.cos(a) * 36;
      const a2 = a - fold;
      const fx = kx + Math.sin(a2) * 40, fy = ky + Math.cos(a2) * 40;
      ctx.strokeStyle = near ? L.body : (L.far || L.body);
      ctx.lineCap = 'round';
      ctx.lineWidth = near ? (front ? 12 : 15) : (front ? 10 : 13);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.lineWidth = near ? 7 : 6;
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = L.hoof || L.body;
      ctx.beginPath(); ctx.arc(fx, fy + 1, 5, 0, TAU); ctx.fill();
      hooves.push([S.hx + s * fx, G + s * (fy + bob)]);
    };
    leg(-38, -74, 0.0, false, false);
    leg(40, -74, 0.44, true, false);
    // tail
    const tw = Math.sin(TAU * p) * 8 * run;
    ctx.strokeStyle = L.mane || L.body;
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-60, -98); ctx.quadraticCurveTo(-98, -104 + tw, -128, -72 - run * 22 + tw); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-62, -94); ctx.quadraticCurveTo(-104, -94 + tw, -136, -58 - run * 16 + tw * 1.4); ctx.stroke();
    // body
    ctx.fillStyle = L.body;
    ctx.beginPath(); ctx.ellipse(0, -88, 60, 22, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-36, -92, 31, 27, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(38, -90, 29, 26, 0, 0, TAU); ctx.fill();
    // neck + head
    const r1 = -0.95 + 0.4 * run + Math.sin(TAU * p + 1.6) * 0.09 * run;
    const r2 = 0.95 - 0.25 * run;
    ctx.save();
    ctx.translate(46, -98);
    ctx.rotate(r1);
    ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(62, -10); ctx.lineTo(66, 10); ctx.lineTo(-4, 24); ctx.closePath(); ctx.fill();
    if (L.mane) {
      ctx.strokeStyle = L.mane; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-6, -18); ctx.quadraticCurveTo(30, -20 - 5 * run, 60, -12); ctx.stroke();
    }
    ctx.translate(62, 0);
    ctx.rotate(r2);
    ctx.beginPath(); ctx.ellipse(20, 0, 27, 11, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(42, 2, 9, 9, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, -24); ctx.lineTo(11, -9); ctx.closePath(); ctx.fill();
    ctx.restore();
    // mouth point in body frame, for the reins
    const c1 = Math.cos(r1), s1 = Math.sin(r1);
    const hx0 = 46 + 62 * c1, hy0 = -98 + 62 * s1;
    const c2 = Math.cos(r1 + r2), s2 = Math.sin(r1 + r2);
    const mouth = [hx0 + 40 * c2 - 3 * s2, hy0 + 40 * s2 + 3 * c2];
    if (L.rim && !opt.mirror) {
      ctx.strokeStyle = L.rim; ctx.lineWidth = 3; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.ellipse(0, -90, 60, 22, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-36, -94, 31, 27, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // jockey (adult proportions: small head, long torso, clear riding kit)
    const jb = -bob * 0.6;
    const hip = [4, -118 + jb];
    const sh = [40 - 22 * upright, -130 - 26 * upright + jb];
    const head = [sh[0] + 12 - 6 * upright, sh[1] - 11 - 3 * upright];
    const knee = [26, -106 + jb * 0.5];
    const foot = [16, -92];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = L.breeches || '#f1ede4'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.stroke();
    ctx.strokeStyle = L.boot || '#141414'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(knee[0], knee[1]); ctx.lineTo(foot[0], foot[1]); ctx.stroke();
    ctx.strokeStyle = L.silk1; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(sh[0], sh[1]); ctx.stroke();
    ctx.strokeStyle = L.silk2; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(hip[0] + 4, hip[1] - 2); ctx.lineTo(sh[0] + 2, sh[1] - 1); ctx.stroke();
    const pump = Math.sin(TAU * p) * 5 * run;
    const elbow = [sh[0] + 10, sh[1] + 16];
    const hand = [sh[0] + 28 + pump, sh[1] + 12 - pump * 0.3];
    ctx.strokeStyle = L.silk2; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    ctx.strokeStyle = L.rein || 'rgba(20,14,10,.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(mouth[0], mouth[1]); ctx.stroke();
    ctx.fillStyle = L.skin || '#5a3a26';
    ctx.beginPath(); ctx.arc(head[0], head[1], 8.5, 0, TAU); ctx.fill();
    ctx.fillStyle = L.cap;
    ctx.beginPath(); ctx.arc(head[0], head[1] - 1, 9.5, Math.PI, TAU); ctx.fill();
    ctx.fillRect(head[0], head[1] - 2, 13, 3);
    ctx.fillStyle = 'rgba(20,20,24,.85)';
    ctx.fillRect(head[0] + 2, head[1] + 1, 7, 3);
    leg(-38, -74, 0.1, false, true);
    leg(40, -74, 0.56, true, true);
    ctx.restore();
    return hooves;
  }

  kick(S, hooves, G, rate, o) {
    if (S.dt <= 0 || S.hs < 150) return;
    for (let i = 0; i < hooves.length; i++) {
      const h = hooves[i];
      if (h[1] > G - 12 && Math.random() < rate * S.dt) this.emit(h[0], G - 4, o.n || 1, o);
    }
  }
