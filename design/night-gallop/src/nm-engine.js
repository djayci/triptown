  // ---- Night Meet: two slips per race, one debit, one round (overrides the single-bet loop above) ----

  componentDidMount() {
    const c = this.cfg();
    this.g = {
      round: 0, phase: 'bet', pt: 0, t: 0, mult: 1, k: 0, speed: 260, hs: 260, gait: 0,
      scroll: 0, parts: [], flash: 0, net: 0, clock: 1394, hudT: 1, hx: 350,
      prevCrash: !!c.startAfterCrash, raceNo: 27, frozen: false, slips: null,
    };
    this.loadRound();
    if (c.pin) this.applyPin(true);
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

  renderVals() {
    const s = this.state || {};
    const card = { top: 'BET ₦500', sub: 'Next race in 5s', bg: 'rgba(255,178,62,.12)', fg: '#ffcf85', border: 'rgba(255,178,62,.45)', stake: '₦500', auto: 'Off', stakeOpacity: 1 };
    return Object.assign({
      mult: 'x1.00', multOpacity: 0.55, raceLabel: 'RACE 27', clock: '00:23:14', net: '₦0',
      a: card, b: card, showChip: false, chip: '', chipBg: 'rgba(6,8,16,.7)', chipFg: '#e9ecf5',
      showBanner: false, banner: '', bannerSub: '', bannerBg: 'rgba(8,10,18,.9)', bannerFg: '#e9ecf5',
      totalStake: '₦1,500',
    }, s);
  }

  loadRound() {
    const c = this.cfg();
    const r = c.rounds[this.g.round % c.rounds.length];
    this.g.slips = r.slips.map((s) => ({ stake: s.stake, auto: s.auto || null, manual: s.manual || null, at: null }));
    this.g.crashAt = r.crash || 999;
  }

  applyPin(first) {
    const p = this.cfg().pin;
    const g = this.g;
    g.phase = p.phase;
    g.mult = p.mult || 1;
    g.k = p.phase === 'bet' ? 0 : Math.min(1, Math.log(g.mult) / Math.log(5));
    g.slips = p.slips.map((s) => ({ stake: s.stake, auto: s.auto || null, manual: null, at: s.at || null }));
    g.prevCrash = !!p.afterCrash;
    g.pt = 0;
    if (p.phase === 'collect') g.flash = first ? 0 : 1;
    if (p.phase === 'run') { g.speed = g.hs = 700 + 1500 * g.k; }
    if (p.phase === 'crash' || p.phase === 'collect') { g.speed = g.hs = 700 + 1500 * g.k; }
  }

  totals() {
    const g = this.g;
    let staked = 0, returned = 0, open = 0;
    for (const s of g.slips) {
      staked += s.stake;
      if (s.at) returned += Math.round(s.stake * s.at);
      else open++;
    }
    return { staked, returned, open };
  }

  tick(dt) {
    const c = this.cfg();
    const g = this.g;
    const BET = 5, RES = 3.4;
    g.t += dt; g.pt += dt; g.clock += dt;
    g.flash = Math.max(0, g.flash - dt * 2.2);
    if (c.pin) {
      if (c.pin.loop && g.pt >= c.pin.loop) this.applyPin(false);
    } else if (g.phase === 'bet') {
      g.mult = 1;
      if (g.pt >= BET) {
        g.phase = 'run'; g.pt = 0; g.raceNo++;
        g.net -= this.totals().staked;
      }
    } else if (g.phase === 'run') {
      g.mult = Math.exp(0.2 * g.pt);
      if (g.mult >= g.crashAt) {
        g.mult = g.crashAt;
        g.phase = 'crash'; g.pt = 0; g.prevCrash = true;
      } else {
        const before = this.totals();
        for (const s of g.slips) {
          if (s.at) continue;
          const target = s.auto || s.manual;
          if (target && g.mult >= target) s.at = Math.round(target * 100) / 100;
        }
        const after = this.totals();
        if (after.returned !== before.returned) {
          g.net += after.returned - before.returned;
          // Win effects wait for the race to settle, never on a single slip's collect (rule 11, RTS 14F).
          if (after.open === 0) {
            g.phase = 'collect'; g.pt = 0;
            if (after.returned > after.staked) g.flash = this.props.reducedMotion ? 0.3 : 1;
          }
        }
      }
    } else if (g.pt >= RES) {
      g.phase = 'bet'; g.pt = 0; g.round++;
      if (g.round % c.rounds.length === 0) g.net = 0;
      this.loadRound();
    }
    if (!c.pin) {
      if (g.phase === 'run') g.k = Math.min(1, Math.log(g.mult) / Math.log(5));
      if (g.phase === 'bet') g.k = 0;
    }
    g.frozen = g.phase === 'collect' && g.pt < 0.5;
    let camT = 260, rate = 2.5;
    if (g.phase === 'run') { camT = 700 + 1500 * g.k; rate = 3; }
    else if (g.phase === 'crash') { camT = 0; rate = 1.3; }
    else if (g.phase === 'collect') { rate = 1.2; }
    if (g.frozen) { g.speed = 0; g.hs = 0; }
    else { g.speed += (camT - g.speed) * Math.min(1, dt * rate); g.hs = g.speed; }
    if (!g.frozen) {
      g.gait += dt * (g.hs > 40 ? 1.0 + g.hs / 1100 : g.hs / 40);
      g.scroll += g.speed * dt;
    }
    g.hudT += dt;
    if (g.hudT > 0.08) { g.hudT = 0; this.pushHud(); }
  }

  slipCard(s, i) {
    const g = this.g;
    const on = { bg: '#ffb23e', fg: '#140d02', border: '#ffb23e' };
    const idle = { bg: 'rgba(255,178,62,.1)', fg: '#ffcf85', border: 'rgba(255,178,62,.45)' };
    const done = { bg: 'rgba(233,236,245,.08)', fg: '#e9ecf5', border: 'rgba(233,236,245,.35)' };
    const dead = { bg: 'rgba(233,236,245,.04)', fg: 'rgba(233,236,245,.45)', border: 'rgba(233,236,245,.15)' };
    const base = {
      stake: this.naira(s.stake),
      auto: s.auto ? 'x' + s.auto.toFixed(2) : 'Off',
      stakeOpacity: g.phase === 'bet' ? 1 : 0.4,
    };
    if (g.phase === 'bet') {
      const secs = Math.max(1, Math.ceil(5 - g.pt));
      return Object.assign(base, idle, { top: 'BET ' + this.naira(s.stake), sub: 'Next race in ' + secs + 's' });
    }
    if (s.at) return Object.assign(base, done, { top: 'COLLECTED', sub: this.naira(s.stake * s.at) + ' at x' + s.at.toFixed(2) });
    if (g.phase === 'run') return Object.assign(base, on, { top: 'COLLECT', sub: this.naira(s.stake * g.mult) });
    if (g.phase === 'crash') return Object.assign(base, dead, { top: 'LOST', sub: 'Stake ' + this.naira(s.stake) });
    return Object.assign(base, done, { top: 'SETTLED', sub: '' });
  }

  pushHud() {
    const g = this.g;
    const n = {};
    const T = this.totals();
    n.mult = 'x' + g.mult.toFixed(2);
    n.multOpacity = g.phase === 'bet' ? 0.55 : g.phase === 'crash' ? 0 : 1;
    n.raceLabel = 'RACE ' + g.raceNo;
    const total = Math.floor(g.clock);
    n.clock = String(Math.floor(total / 3600)).padStart(2, '0') + ':' + String(Math.floor(total / 60) % 60).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
    n.net = (g.net > 0 ? '+' : g.net < 0 ? '−' : '') + this.naira(g.net);
    n.totalStake = this.naira(T.staked);
    n.a = this.slipCard(g.slips[0], 0);
    n.b = this.slipCard(g.slips[1], 1);
    n.showChip = g.phase === 'run' && T.returned > 0;
    if (T.returned > T.staked) {
      n.chip = 'Race in profit · collected ' + this.naira(T.returned) + ' of ' + this.naira(T.staked) + ' staked';
      n.chipBg = 'rgba(6,8,16,.78)'; n.chipFg = '#ffcf85';
    } else {
      n.chip = 'Collected ' + this.naira(T.returned) + ' of ' + this.naira(T.staked) + ' staked';
      n.chipBg = 'rgba(6,8,16,.78)'; n.chipFg = '#e9ecf5';
    }
    n.showBanner = g.phase === 'crash' || g.phase === 'collect';
    n.banner = ''; n.bannerSub = ''; n.bannerBg = 'rgba(8,10,18,.92)'; n.bannerFg = '#e9ecf5';
    if (n.showBanner) {
      const netRace = T.returned - T.staked;
      const netTxt = (netRace > 0 ? '+' : netRace < 0 ? '−' : '') + this.naira(netRace);
      if (T.returned > T.staked) {
        n.banner = 'WIN ' + this.naira(T.returned);
        n.bannerSub = 'Net ' + netTxt + ' this race';
        n.bannerBg = '#ffb23e'; n.bannerFg = '#140d02';
      } else if (T.returned > 0) {
        n.banner = 'RETURNED ' + this.naira(T.returned);
        n.bannerSub = 'Net ' + netTxt + ' this race · lights out';
      } else {
        n.banner = 'LIGHTS OUT';
        n.bannerSub = 'Stakes ' + this.naira(T.staked) + ' lost this race';
      }
    }
    const key = JSON.stringify(n);
    if (key !== this.hudKey) { this.hudKey = key; this.setState(n); }
  }
