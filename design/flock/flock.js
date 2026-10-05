  // ---- Flock --------------------------------------------------------------
  // No cattle. The ram starts almost alone; rams catch up from behind and fall in
  // beside him as the value climbs, until the flock runs to the horizon. The size of
  // the flock is drawn from the value on screen, which follows elapsed time — it
  // knows nothing about the crash. At the wolf the flock scatters; no ram is taken.

  WORDS() {
    return { verb: 'PEN THEM', done: 'PENNED', over: 'RUN OVER', lost: 'The flock scattered', split: 'FLOCK SPLITS  x0.5' };
  }

  HERO_X() { return 330; }
  HERO_Y() { return 1200; }

  // How many rams run with him at a value. Nobody at x1.00, a handful by x1.5,
  // a crowd by x3, the field full somewhere past x20.
  flockCount(v) {
    return Math.floor(24 * Math.pow(Math.max(0, Math.log(v)), 1.6));
  }

  SLOTS() {
    if (this._slots) return this._slots;
    const HX = this.HERO_X(), HY = this.HERO_Y();
    const rows = [
      [578, 0.2, 30], [592, 0.23, 34], [606, 0.26, 38], [624, 0.3, 42], [642, 0.34, 48],
      [666, 0.39, 55], [694, 0.45, 62], [728, 0.51, 70], [766, 0.58, 80], [812, 0.66, 90],
      [862, 0.74, 102], [924, 0.83, 114], [990, 0.92, 128], [1090, 1.0, 150], [1200, 1.1, 180],
      [1370, 1.34, 230],
    ];
    const far = this.FAR_TONE(), near = this.NEAR_TONE();
    const slots = [];
    rows.forEach(([y, s, gap], ri) => {
      for (let x = -30 + this.rnd(ri * 3.3) * gap; x < 820; x += gap) {
        const seed = ri * 97.1 + x * 1.37;
        const sx = x + (this.rnd(seed) - 0.5) * gap * 0.5;
        const sy = y + (this.rnd(seed * 1.3) - 0.5) * gap * 0.16;
        // Keep a clear lane round him, so the flock never hides the ram you are.
        if (y >= 1090 && Math.abs(sx - HX) < (y > 1200 ? 300 : 210)) continue;
        const d = Math.min(1, (y - 578) / (1370 - 578));
        const v = this.rnd(seed * 4.1);
        slots.push({
          x: sx, y: sy, s: s * (0.9 + this.rnd(seed * 2.1) * 0.2), ph: this.rnd(seed * 3.7),
          tone: this.mixTone(far, near, Math.min(1, d + (v - 0.5) * 0.25)),
          // Join order: closest to him first, then outward to the horizon.
          order: Math.abs(sx - HX) / 700 + Math.abs(sy - HY) / 600 + this.rnd(seed * 5.3) * 0.35,
        });
      }
    });
    slots.sort((a, b) => a.order - b.order);
    this._slots = slots;
    return slots;
  }

  FAR_TONE() {
    return {
      fleece: '#353747', dark: '#262836', head: '#1e1f2a', horn: '#55504e', hornDark: '#2e2c2c',
      rim: 'rgb(255,186,110)', rimA: 0.4, leg: '#14141c', farLeg: '#0e0e14',
    };
  }

  NEAR_TONE() {
    return {
      fleece: '#5e5344', dark: '#41382e', head: '#2f2822', horn: '#7e6e54', hornDark: '#4a3e30',
      rim: 'rgb(255,170,96)', rimA: 0.7, leg: '#1a140f', farLeg: '#110d09',
    };
  }

  mixTone(a, b, t) {
    const o = {};
    Object.keys(a).forEach((k) => {
      o[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * t : this.mix(a[k], b[k], t);
    });
    return o;
  }

  startState() {
    const c = this.cfg();
    const g = {
      round: 0, phase: 'bet', pt: 0, t: 0, mult: 1, mods: 1, k: 0,
      ramSpeed: 0, cam: 0, rgait: 0, rx: this.HERO_X(), ry: this.HERO_Y(),
      flash: 0, stumble: 0, net: 0, clock: 892, cash: 0, dark: 0, wolfT: 0,
      fired: [], cue: '', cueT: 0, parts: [],
      flock: this.SLOTS().map(() => ({ st: 'out', t: 0 })),
    };
    this.g = g;
    if (c.noBet) this.begin(c.rounds[0].from || 0);
    return g;
  }

  begin(from) {
    const g = this.g;
    g.phase = 'run'; g.pt = from; g.mods = 1; g.fired = []; g.dark = 0; g.wolfT = 0;
    g.net -= this.STAKE();
    g.mult = this.valueAt(from);
    g.k = this.paceK(from);
    g.ramSpeed = from > 0 ? this.ramTarget(g.k) : g.ramSpeed;
    // A loop that starts mid-round starts with the flock already gathered.
    const want = this.flockCount(g.mult);
    g.flock.forEach((f, i) => { if (i < want) { f.st = 'in'; f.t = -99; } else { f.st = 'out'; } });
  }

  tick(dt) {
    const g = this.g;
    const c = this.cfg();
    const r = this.round();
    const S = this.STAKE();
    g.t += dt; g.pt += dt; g.clock += dt;
    g.flash = Math.max(0, g.flash - dt * 2.2);
    g.stumble = Math.max(0, g.stumble - dt * 1.6);
    g.cueT = Math.max(0, g.cueT - dt);

    if (g.phase === 'bet') {
      g.mult = 1; g.mods = 1; g.k = 0; g.dark = 0;
      if (g.pt >= this.BET_GAP()) {
        if (c.holdBet) g.pt = 0;
        else this.begin(r.from || 0);
      }
    } else if (g.phase === 'run') {
      (r.setbacks || []).forEach((at, i) => {
        if (g.pt >= at && !g.fired.includes('s' + i)) {
          g.fired.push('s' + i); g.mods *= 0.5;
          g.stumble = 0.6; g.cue = this.WORDS().split; g.cueT = 1.6;
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

    // He and the flock run as one; the camera runs with them.
    const ramT = g.phase === 'run' ? this.ramTarget(g.k) : 0;
    const rate = g.phase === 'crash' ? 6 : g.phase === 'collect' ? 1.4 : 2.2;
    g.ramSpeed += (ramT - g.ramSpeed) * Math.min(1, dt * rate);
    g.cam += g.ramSpeed * dt;
    g.rgait += dt * (g.ramSpeed < 20 ? 0 : 0.9 + g.ramSpeed / 430);
    g.rx = this.HERO_X(); g.ry = this.HERO_Y();
    this.updateFlock(dt);

    if (g.phase === 'crash') {
      g.wolfT += dt;
      g.dark = Math.min(1, Math.max(0, g.wolfT - 0.6) * 1.0);
    }
    if (g.phase === 'run' && g.ramSpeed > 200 && Math.random() < dt * (6 + 30 * g.k)) {
      this.emit(g.rx - 60, g.ry - 6, 1, { vx: -40, spread: 50, lift: 30 + 40 * g.k, life: 0.9, r: 18 + 16 * g.k, grow: 34, color: 'rgba(214,180,138,1)', alpha: 0.16 });
    }
    this.pushHud();
  }

  updateFlock(dt) {
    const g = this.g;
    const want = g.phase === 'run' || g.phase === 'collect' ? this.flockCount(g.mult) : 0;
    let joins = Math.max(1, Math.ceil(dt * 30));
    g.flock.forEach((f, i) => {
      if (f.st === 'out' && i < want && joins > 0) { f.st = 'in'; f.t = g.t; joins--; }
      else if (f.st === 'in' && i >= want) { f.st = g.phase === 'crash' ? 'flee' : 'leave'; f.t = g.t; }
      else if ((f.st === 'leave' || f.st === 'flee') && g.t - f.t > 1.6) f.st = 'out';
    });
  }

  paint(ctx, dt) {
    const g = this.g;
    const W = 780, H = 1688;
    const reduced = this.reduced();
    const S = { W, H, GND: this.HORIZON(), t: g.t, dt, phase: g.phase, k: g.k, speed: g.ramSpeed, scroll: g.cam, reduced };
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    this.sky(ctx, S);
    this.ground(ctx, S);
    if (!reduced) this.streaks(ctx, S);
    [[600, 0.22], [680, 0.3], [800, 0.36], [960, 0.4]].forEach(([y, s], i) => this.haze(ctx, S, y, 140 * s, 0.24 - i * 0.04));

    const slots = this.SLOTS();
    const list = [];
    g.flock.forEach((f, i) => { if (f.st !== 'out') list.push({ y: slots[i].y, i }); });
    list.push({ y: this.HERO_Y(), hero: true });
    if (g.phase === 'crash') list.push({ y: this.HERO_Y() + 4, wolf: true });
    list.sort((a, b) => a.y - b.y);
    const run = Math.min(1, g.ramSpeed / 1100);
    list.forEach((it) => {
      if (it.hero) {
        this.drawParts(ctx, S);
        this.drawRam(ctx, g.rx, g.ry, 1.1, this.ramPose());
      } else if (it.wolf) {
        this.drawWolfAt(ctx, this.wolfX(), this.HERO_Y() + 4, 1.2);
      } else {
        this.drawFlockRam(ctx, slots[it.i], g.flock[it.i], run, reduced);
      }
    });
    if (g.phase === 'crash') this.crashSweep(ctx, S);
    if (g.flash > 0) {
      ctx.fillStyle = 'rgba(255,236,206,' + (g.flash * 0.5).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  drawFlockRam(ctx, sl, f, run, reduced) {
    const g = this.g;
    const ease = (p) => 1 - Math.pow(1 - p, 3);
    let x = sl.x + Math.sin(g.t * 0.8 + sl.ph * 6.28) * 10 * sl.s;
    let y = sl.y;
    let alpha = 1, flip = false, r = run, ph = g.rgait + sl.ph, bob;
    const age = g.t - f.t;
    if (f.st === 'in' && age < 1) {
      // Catching up from behind: in from the left, running harder than the flock.
      const p = Math.min(1, age);
      if (reduced) alpha = p;
      else { x = -160 * sl.s - 60 + (x + 160 * sl.s + 60) * ease(p); r = Math.max(run, 1 - p); ph = g.t * 3.4 + sl.ph; }
    } else if (f.st === 'leave' || f.st === 'flee') {
      const q = age;
      alpha = Math.max(0, 1 - q / 1.6);
      if (!reduced) {
        if (g.ramSpeed < 150) {
          // Stopped or bolting: they turn and go back the way they came, facing where they go.
          flip = true; r = 0.9; ph = g.t * 3.2 + sl.ph;
          const v = f.st === 'flee' ? 420 + sl.ph * 360 : 160;
          x -= q * v * (0.5 + sl.s * 0.5);
          if (f.st === 'flee') y += (sl.y < this.HERO_Y() ? -1 : 1) * q * 30 * sl.s;
        } else {
          // Split off mid-run: still running forward, veering out of the flock and falling behind.
          x -= q * q * 120 * (0.5 + sl.s * 0.5);
          y += (sl.y < this.HERO_Y() ? -1 : 1) * q * 26 * sl.s;
        }
      }
    }
    if (x < -260 || alpha <= 0) return;
    bob = r < 0.02 ? Math.sin(g.t * 2 + sl.ph * 6) * 1 : -Math.abs(Math.sin(ph * 6.2832)) * (3 + 9 * r);
    this.drawRam(ctx, x, y, sl.s, { run: r, ph, bob, tilt: 0.06 * r, headDrop: 8 * r, tone: sl.tone, alpha, flip });
  }
