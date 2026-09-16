  // ---- Fence Run: a step game. Each JUMP is one decision; every fence's result is fixed at round start. ----

  componentDidMount() {
    const c = this.cfg();
    this.M = [];
    for (let i = 1; i <= 10; i++) this.M.push(0.97 / Math.pow(0.8, i));
    this.g = {
      round: 0, phase: 'bet', pt: 0, t: 0, fence: 0, wx: -900, from: -900, speed: 0, gait: 0, parts: [], flash: 0, punch: 0,
      net: 0, clock: 1394, hudT: 1, raceNo: 41, result: null, jumpY: 0, jumpRot: 0, shake: 0, frozen: false,
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

  naira(v) {
    return '₦' + Math.round(Math.abs(v)).toLocaleString('en-NG');
  }

  get SPACING() { return 1000; }

  fenceX(i) { return 900 + i * this.SPACING; }

  tick(dt) {
    const c = this.cfg();
    const g = this.g;
    const R = [{ jumps: 4, end: 'collect' }, { jumps: 2, end: 'refuse' }, { jumps: 10, end: 'finish' }];
    const r = R[g.round % R.length];
    const STAKE = 500, GAP = 2.2, APPROACH = 0.7, JUMP = 0.72, DECIDE = r.end === 'finish' ? 0.35 : 0.85, RES = 2.3;
    g.t += dt; g.pt += dt; g.clock += dt;
    g.flash = Math.max(0, g.flash - dt * 2.4);
    g.punch = Math.max(0, g.punch - dt * 2.5);
    g.shake = Math.max(0, g.shake - dt * 3);
    const targetX = (i) => this.fenceX(i) - 330;
    let speed = 0;
    if (g.phase === 'bet') {
      speed = 180;
      g.wx += speed * dt;
      if (g.pt >= GAP) { g.phase = 'approach'; g.pt = 0; g.net -= STAKE; g.raceNo++; g.fence = 0; g.from = g.wx; }
    } else if (g.phase === 'approach') {
      const from = g.fence === 0 ? g.from : this.fenceX(g.fence - 1) + 330;
      const to = targetX(g.fence);
      const u = Math.min(1, g.pt / APPROACH);
      g.wx = from + (to - from) * u;
      speed = (to - from) / APPROACH;
      if (u >= 1) {
        const refuse = r.end === 'refuse' && g.fence === r.jumps;
        g.phase = refuse ? 'refuse' : 'jump'; g.pt = 0;
        if (refuse) g.shake = 1;
      }
    } else if (g.phase === 'jump') {
      const u = Math.min(1, g.pt / JUMP);
      g.wx = targetX(g.fence) + 660 * u;
      speed = 660 / JUMP;
      g.jumpY = Math.sin(Math.PI * u) * 230;
      g.jumpRot = Math.sin(Math.PI * 2 * u) * -0.12;
      if (u >= 1) {
        g.jumpY = 0; g.jumpRot = 0; g.fence++; g.punch = 1; g.pt = 0;
        if (g.fence >= 10) { g.phase = 'finishRun'; }
        else if (r.end === 'collect' && g.fence === r.jumps) { g.phase = 'decide'; g.collectAfter = true; }
        else { g.phase = 'decide'; g.collectAfter = false; }
      }
    } else if (g.phase === 'decide') {
      speed = 0;
      if (g.pt >= DECIDE) {
        g.pt = 0;
        if (g.collectAfter) { g.phase = 'result'; g.result = 'collect'; g.flash = this.props.reducedMotion ? 0.3 : 1; g.net += Math.round(STAKE * this.M[g.fence - 1]); }
        else g.phase = 'approach';
      }
    } else if (g.phase === 'refuse') {
      speed = Math.max(0, 300 * (1 - g.pt * 2));
      g.wx += speed * dt;
      if (g.pt >= 0.9) { g.phase = 'result'; g.result = 'refuse'; g.pt = 0; }
    } else if (g.phase === 'finishRun') {
      speed = 900;
      g.wx += speed * dt;
      if (g.pt >= 0.9) { g.phase = 'result'; g.result = 'finish'; g.pt = 0; g.flash = this.props.reducedMotion ? 0.3 : 1; g.net += Math.round(STAKE * this.M[9]); }
    } else if (g.phase === 'result') {
      speed = g.result === 'refuse' ? 0 : 160;
      g.wx += speed * dt;
      if (g.pt >= RES) { g.phase = 'bet'; g.pt = 0; g.round++; g.result = null; g.fence = 0; g.wx = -900; if (g.round % 3 === 0) g.net = 0; }
    }
    g.speed += (speed - g.speed) * Math.min(1, dt * 10);
    const running = g.phase === 'approach' || g.phase === 'jump' || g.phase === 'finishRun';
    g.gait += dt * (g.phase === 'jump' ? 0 : running ? 2.4 : g.speed > 30 ? 1.2 : 0.2);
    g.hudT += dt;
    if (g.hudT > 0.05) { g.hudT = 0; this.pushHud(); }
  }

  pushHud() {
    const g = this.g;
    const H = this.cfg().hud;
    const STAKE = 500;
    const n = {};
    const cleared = g.fence;
    const cur = cleared > 0 ? this.M[cleared - 1] : 1;
    const next = cleared < 10 ? this.M[cleared] : null;
    n.mult = cur.toFixed(2);
    n.multDim = g.phase === 'bet';
    n.multOpacity = g.phase === 'bet' ? 0.5 : 1;
    n.multScale = (1 + 0.1 * g.punch).toFixed(3);
    n.fenceLabel = g.phase === 'bet' ? '10 FENCES · MEDIUM' : g.fence >= 10 ? 'FINISH LINE' : 'FENCE ' + Math.min(10, cleared + 1) + ' OF 10';
    n.nextLabel = next ? 'NEXT x' + next.toFixed(2) : 'FINISH x' + this.M[9].toFixed(2);
    n.race = 'ROUND ' + g.raceNo;
    const s = Math.floor(g.clock);
    n.clock = String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    n.net = (g.net > 0 ? '+' : g.net < 0 ? '−' : '') + this.naira(g.net);
    const start = Math.max(0, Math.min(5, cleared - 1));
    n.ladder = [];
    for (let i = start; i < start + 5; i++) {
      const state = i < cleared ? 'done' : i === cleared ? 'next' : 'todo';
      const sty = H.ladder[state];
      n.ladder.push({ label: i === 9 ? 'FINISH' : 'F' + (i + 1), value: 'x' + this.M[i].toFixed(2), bg: sty.bg, fg: sty.fg, border: sty.border });
    }
    const deciding = g.phase === 'decide' || (g.phase === 'bet');
    n.showBanner = g.phase === 'result';
    n.bannerWin = g.result === 'collect' || g.result === 'finish';
    if (g.phase === 'bet') {
      n.jumpTop = 'BET ' + this.naira(STAKE); n.jumpSub = 'Round starts in ' + Math.max(1, Math.ceil(2.2 - g.pt)) + 's';
      n.jumpBg = H.idleBg; n.jumpFg = H.idleFg;
      n.collectTop = 'COLLECT'; n.collectSub = '—'; n.collectOpacity = 0.35;
    } else if (g.phase === 'result') {
      n.jumpTop = 'BET ' + this.naira(STAKE); n.jumpSub = 'Next round soon'; n.jumpBg = H.idleBg; n.jumpFg = H.idleFg;
      n.collectTop = 'COLLECT'; n.collectSub = '—'; n.collectOpacity = 0.35;
    } else {
      const canDecide = g.phase === 'decide';
      n.jumpTop = next ? 'JUMP' : 'FINISH'; n.jumpSub = next ? 'to x' + next.toFixed(2) : '';
      n.jumpBg = canDecide ? H.accent : H.idleBg; n.jumpFg = canDecide ? H.onAccent : H.idleFg;
      n.collectTop = 'COLLECT'; n.collectSub = cleared > 0 ? this.naira(STAKE * cur) : '—';
      n.collectOpacity = canDecide && cleared > 0 ? 1 : 0.35;
    }
    if (g.result === 'refuse') {
      n.banner = 'REFUSED'; n.bannerSub = 'Fence ' + (g.fence + 1) + ' · Stake ' + this.naira(STAKE) + ' lost';
    } else if (g.result === 'finish') {
      n.banner = 'FINISH · WIN ' + this.naira(STAKE * this.M[9]); n.bannerSub = 'Top prize x' + this.M[9].toFixed(2) + ' · Net +' + this.naira(STAKE * this.M[9] - STAKE);
    } else if (g.result === 'collect') {
      n.banner = 'WIN ' + this.naira(STAKE * cur); n.bannerSub = 'Collected at fence ' + cleared + ' · Net +' + this.naira(STAKE * cur - STAKE);
    }
    n.bannerBg = n.bannerWin ? H.accent : H.lossBg;
    n.bannerFg = n.bannerWin ? H.onAccent : H.lossFg;
    void deciding;
    const key = JSON.stringify(n);
    if (key !== this.hudKey) { this.hudKey = key; this.setState(n); }
  }

  renderVals() {
    const H = this.cfg().hud;
    const ladder = [1, 2, 3, 4, 5].map((i) => ({ label: 'F' + i, value: 'x' + (0.97 / Math.pow(0.8, i)).toFixed(2), bg: H.ladder.todo.bg, fg: H.ladder.todo.fg, border: H.ladder.todo.border }));
    return Object.assign({
      mult: '1.00', multOpacity: 0.5, multScale: '1', fenceLabel: '10 FENCES · MEDIUM', nextLabel: 'NEXT x1.21', race: 'ROUND 41',
      clock: '00:23:14', net: '₦0', ladder,
      jumpTop: 'BET ₦500', jumpSub: 'Round starts in 2s', jumpBg: H.idleBg, jumpFg: H.idleFg,
      collectTop: 'COLLECT', collectSub: '—', collectOpacity: 0.35,
      showBanner: false, banner: '', bannerSub: '', bannerBg: H.lossBg, bannerFg: H.lossFg,
    }, this.state || {});
  }

  paint(ctx) {
    const g = this.g;
    const c = this.cfg();
    const W = 780, H = 1688;
    const reduced = !!this.props.reducedMotion;
    const running = g.phase === 'approach' || g.phase === 'jump' || g.phase === 'finishRun';
    const k = Math.min(1, g.fence / 10);
    const S = {
      W, H, t: g.t, dt: 1 / 60, phase: running ? 'run' : g.phase === 'refuse' || g.result === 'refuse' ? 'crash' : 'bet',
      pt: g.pt, k, speed: g.speed, hs: running ? 900 : g.speed * 2, scroll: g.wx, gait: g.gait, hx: c.horseX || 330,
      reduced, frozen: false, punch: g.punch, flash: g.flash, fence: g.fence, jumpY: g.jumpY, jumpRot: g.jumpRot,
      jumping: g.phase === 'jump', result: g.result, shake: g.shake, gamePhase: g.phase,
    };
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (!reduced && (g.punch > 0 || g.shake > 0)) {
      const a = g.punch * 10 + g.shake * 14;
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }
    const z = 1 + 0.05 * g.punch;
    ctx.translate(W / 2, H * 0.6); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.6);
    this.drawScene(ctx, S);
    ctx.restore();
    if (g.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (g.flash * 0.7).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Fences visible on screen: world x -> screen x. */
  eachFence(S, fn) {
    for (let i = 0; i < 10; i++) {
      const sx = S.hx + (this.fenceX(i) - S.scroll);
      if (sx > -300 && sx < S.W + 300) fn(sx, i);
    }
    const fx = S.hx + (this.fenceX(9) + 1100 - S.scroll);
    if (fx > -300 && fx < S.W + 300) fn(fx, 10);
  }

  /** The horse with the jump arc and tilt applied. */
  jumpingHorse(ctx, S, look, G, scale) {
    ctx.save();
    const cx = S.hx, cy = G - 100 * scale;
    ctx.translate(0, -S.jumpY);
    ctx.translate(cx, cy); ctx.rotate(S.jumpRot); ctx.translate(-cx, -cy);
    const s2 = Object.assign({}, S, S.jumping ? { gait: 0.3, hs: 900 } : {});
    const hv = this.horse(ctx, s2, look, G, scale);
    ctx.restore();
    return S.jumping ? [] : hv;
  }

  speedLines(ctx, S, color, count, yMin, yMax, lenBase) {
    const n = Math.floor(count * Math.min(1, S.speed / 1000));
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const seed = i * 17.3;
      const y = yMin + this.rnd(seed) * (yMax - yMin);
      const len = lenBase * (0.5 + this.rnd(seed * 2));
      const span = S.W + len;
      const x = ((this.rnd(seed * 3) * span - S.scroll * (1.6 + this.rnd(seed) * 1.2)) % span + span) % span - len;
      ctx.globalAlpha = 0.15 + 0.45 * this.rnd(seed * 5);
      ctx.fillRect(x, y, len, 2 + this.rnd(seed * 7) * 3);
    }
    ctx.globalAlpha = 1;
  }

