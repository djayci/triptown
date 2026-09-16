  lightsLevel(S) {
    if (S.phase === 'crash') {
      const f = S.pt;
      if (f < 0.07) return 1;
      if (f < 0.12) return 0.15;
      if (f < 0.18) return 0.8;
      return 0.04;
    }
    if (S.phase === 'bet' && S.prevCrash) {
      const f = S.pt;
      // generator coughs into life, then the lamps warm up
      if (f < 0.6) return 0.04;
      if (f < 0.68) return 0.5;
      if (f < 0.85) return 0.06;
      if (f < 0.95) return 0.65;
      if (f < 1.05) return 0.2;
      return Math.min(1, 0.35 + (f - 1.05) * 0.55);
    }
    return 1;
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1190, k = S.k;
    const L = this.lightsLevel(S);
    let gr = ctx.createLinearGradient(0, 0, 0, 1000);
    gr.addColorStop(0, '#04060d'); gr.addColorStop(0.7, '#0c1324'); gr.addColorStop(1, '#2b2233');
    ctx.fillStyle = gr; ctx.fillRect(-20, -20, W + 40, 1040);
    // city skyline, windows lit
    this.tile(S, 0.035, 780, (x, i) => {
      for (let b = 0; b < 9; b++) {
        const bw = 60 + this.rnd(i * 13 + b) * 60, bh = 90 + this.rnd(i * 7 + b * 5) * 280;
        const bx = x + b * 88;
        ctx.fillStyle = '#0a0f1d'; ctx.fillRect(bx, 1000 - bh, bw, bh);
        for (let wy = 1000 - bh + 14; wy < 990; wy += 22) {
          for (let wx = bx + 8; wx < bx + bw - 10; wx += 16) {
            if (this.rnd(wx * 0.37 + wy * 1.91 + i) > 0.72) {
              ctx.fillStyle = 'rgba(255,196,110,.55)'; ctx.fillRect(wx, wy, 7, 9);
            }
          }
        }
      }
    });
    const hg = ctx.createRadialGradient(390, 1010, 20, 390, 1010, 520);
    hg.addColorStop(0, 'rgba(255,150,70,.35)'); hg.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = hg; ctx.fillRect(-20, 500, W + 40, 600);
    // flyover behind the track: bus and car lights keep their own pace
    ctx.fillStyle = '#0b0f1a'; ctx.fillRect(-20, 918, W + 40, 22);
    this.tile(S, 0.1, 260, (x) => { ctx.fillRect(x + 120, 940, 18, 60); });
    for (let v = 0; v < 14; v++) {
      const dir = v % 2 ? 1 : -1;
      const vx = ((this.rnd(v) * 1400 + dir * S.t * (90 + this.rnd(v * 3) * 80) - S.scroll * 0.1) % 1400 + 1400) % 1400 - 300;
      if (dir > 0) {
        ctx.fillStyle = this.rnd(v * 7) > 0.45 ? 'rgba(255,205,40,.95)' : 'rgba(255,240,220,.9)';
        ctx.fillRect(vx, 922, this.rnd(v * 7) > 0.45 ? 30 : 18, 7);
      } else {
        ctx.fillStyle = 'rgba(255,60,50,.85)';
        ctx.fillRect(vx, 931, 14, 5);
      }
    }
    // floodlight towers
    this.tile(S, 0.22, 560, (x) => {
      ctx.fillStyle = '#10141f'; ctx.fillRect(x + 36, 470, 10, 560);
      ctx.fillStyle = L > 0.97 ? '#fffdf4' : L > 0.3 ? '#ffc98a' : '#3a3d48';
      ctx.fillRect(x, 440, 84, 36);
      if (L > 0.05) {
        const cg = ctx.createLinearGradient(0, 470, 0, 1250);
        cg.addColorStop(0, 'rgba(255,248,226,' + (0.2 * L).toFixed(3) + ')'); cg.addColorStop(1, 'rgba(255,248,226,0)');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.moveTo(x + 6, 474); ctx.lineTo(x + 78, 474); ctx.lineTo(x + 360, 1260); ctx.lineTo(x - 260, 1260); ctx.closePath(); ctx.fill();
        const glow = ctx.createRadialGradient(x + 42, 458, 4, x + 42, 458, 120);
        glow.addColorStop(0, 'rgba(255,252,240,' + (0.9 * L).toFixed(3) + ')'); glow.addColorStop(1, 'rgba(255,252,240,0)');
        ctx.fillStyle = glow; ctx.fillRect(x - 80, 340, 250, 240);
      }
    });
    // crowd with phone lights: more lights as the multiplier climbs
    ctx.fillStyle = '#121626'; ctx.fillRect(-20, 960, W + 40, 90);
    this.tile(S, 0.4, 22, (x, i) => {
      ctx.fillStyle = '#1b2034';
      ctx.beginPath(); ctx.arc(x + 11, 985 + this.rnd(i) * 30, 8, 0, 6.28); ctx.fill();
      if (this.rnd(i * 3.1) < 0.08 + 0.55 * k && L > 0.3) {
        const tw = 0.5 + 0.5 * Math.sin(S.t * (3 + this.rnd(i) * 4) + i);
        ctx.fillStyle = 'rgba(210,235,255,' + (0.35 + 0.6 * tw).toFixed(3) + ')';
        ctx.fillRect(x + 8, 970 + this.rnd(i * 2) * 40, 5, 8);
      }
    });
    ctx.fillStyle = '#f4f6fb'; ctx.fillRect(-20, 1046, W + 40, 7);
    this.tile(S, 0.95, 100, (x) => { ctx.fillRect(x, 1046, 6, 44); });
    // dirt track, lit pool
    gr = ctx.createLinearGradient(0, 1060, 0, H);
    gr.addColorStop(0, '#4a3326'); gr.addColorStop(1, '#161010');
    ctx.fillStyle = gr; ctx.fillRect(-20, 1088, W + 40, H);
    const pool = ctx.createRadialGradient(S.hx, G, 30, S.hx, G, 520);
    pool.addColorStop(0, 'rgba(255,236,200,.22)'); pool.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = pool; ctx.fillRect(-20, 900, W + 40, 700);
    ctx.fillStyle = 'rgba(255,230,190,.07)';
    this.tile(S, 1, 110, (x, i) => {
      ctx.fillRect(x, 1110 + this.rnd(i) * 560, (50 + this.rnd(i * 2) * 110) * (1 + 3 * k), 3);
    });
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(S.hx, G + 6, 170, 14, 0, 0, 6.28); ctx.fill();
    const hv = this.horse(ctx, S, {
      body: '#171010', far: '#0e0909', mane: '#050303', rim: '#dff1ff',
      silk1: '#ffb23e', silk2: '#16b8a6', cap: '#16b8a6', skin: '#3e271b', breeches: '#e9ecf5',
    }, G, 2.2);
    this.kick(S, hv, G, 30 + 70 * k, {
      n: S.reduced ? 1 : 3, color: '#2a1c14', alpha: 0.9, r: 5, life: 0.7, spread: 260,
      lift: 520 + 380 * k, vx: -120, grav: 1500, world: 0.6, square: true,
    });
    this.drawParts(ctx, S);
    // streaks of light as speed builds
    if (k > 0.2 && L > 0.5) {
      ctx.fillStyle = 'rgba(255,250,235,' + (0.12 * k).toFixed(3) + ')';
      this.tile(S, 2.2, 240, (x, i) => { ctx.fillRect(x, 300 + this.rnd(i) * 1100, 180 * k, 2); });
    }
    // humid haze hanging over the track
    const hz = ctx.createLinearGradient(0, 780, 0, 1150);
    hz.addColorStop(0, 'rgba(255,200,150,0)'); hz.addColorStop(0.5, 'rgba(255,200,150,.07)'); hz.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = hz; ctx.fillRect(-20, 780, W + 40, 370);
    if (L < 1) {
      ctx.fillStyle = 'rgba(0,0,4,' + (0.93 * (1 - L)).toFixed(3) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
      if (S.phase === 'crash' && S.pt > 0.4) {
        const em = ctx.createRadialGradient(390, 1020, 10, 390, 1020, 380);
        em.addColorStop(0, 'rgba(255,120,40,.18)'); em.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = em; ctx.fillRect(-20, 600, W + 40, 900);
      }
    }
  }
