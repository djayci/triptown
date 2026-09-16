  cfg() {
    return {
      horseX: 370,
      rounds: [{ collectAt: 5.8 }, { crashAt: 5.1 }],
      hud: {
        btnBg: '#ff7a59', btnFg: '#1d1330', btnIdleBg: 'rgba(255,240,230,.14)', btnIdleFg: '#ffe6da',
        winBg: '#ff7a59', winFg: '#1d1330', lossBg: 'rgba(29,19,48,.86)', lossFg: '#ffe6da', crashWord: 'WASHED OUT',
      },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, HZ = 880, G = 1250, k = S.k;
    ctx.save();
    // drone banks gently as speed builds
    const bank = S.reduced ? 0 : 0.018 * k * Math.sin(S.t * 0.8);
    ctx.translate(W / 2, H / 2); ctx.rotate(bank); ctx.scale(1.05, 1.05); ctx.translate(-W / 2, -H / 2);
    let gr = ctx.createLinearGradient(0, 0, 0, HZ);
    gr.addColorStop(0, '#271f4a'); gr.addColorStop(0.45, '#7a3c68'); gr.addColorStop(0.8, '#e0676a'); gr.addColorStop(1, '#f7b36c');
    ctx.fillStyle = gr; ctx.fillRect(-60, -60, W + 120, HZ + 60);
    const sg = ctx.createRadialGradient(540, HZ, 10, 540, HZ, 420);
    sg.addColorStop(0, 'rgba(255,226,160,.9)'); sg.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = sg; ctx.fillRect(-60, 400, W + 120, 480);
    ctx.fillStyle = '#ffdc9c';
    ctx.beginPath(); ctx.arc(540, HZ, 110, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(255,190,170,.28)';
    this.tile(S, 0.02, 520, (x, i) => { ctx.fillRect(x, 560 + this.rnd(i) * 220, 260 + this.rnd(i * 2) * 200, 7); });
    // sea with sun glitter
    gr = ctx.createLinearGradient(0, HZ, 0, 1150);
    gr.addColorStop(0, '#62467a'); gr.addColorStop(1, '#c26f73');
    ctx.fillStyle = gr; ctx.fillRect(-60, HZ, W + 120, 280);
    this.tile(S, 0.12, 36, (x, i) => {
      const y = HZ + 10 + this.rnd(i) * 250;
      const near = Math.abs(x - 540) < 160 - (y - HZ) * 0.2 + (y - HZ) * 0.6;
      const tw = Math.sin(S.t * 6 + i * 1.7);
      if (near && tw > 0.2) {
        ctx.fillStyle = 'rgba(255,230,180,' + (0.3 + 0.5 * tw).toFixed(3) + ')';
        ctx.fillRect(x, y, 18 + (y - HZ) * 0.12, 3);
      }
    });
    // rolling foam lines
    for (let wv = 0; wv < 3; wv++) {
      const y0 = 1120 + wv * 34 + Math.sin(S.t * 0.9 + wv) * 10;
      ctx.strokeStyle = 'rgba(255,240,236,' + (0.7 - wv * 0.15) + ')';
      ctx.lineWidth = 6 - wv;
      ctx.beginPath();
      for (let x = -60; x <= W + 60; x += 20) {
        const y = y0 + Math.sin((x + S.scroll * 0.55) * 0.012 + wv * 2) * 7;
        if (x === -60) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // wet sand reflecting the sky
    gr = ctx.createLinearGradient(0, 1160, 0, H);
    gr.addColorStop(0, '#b2656c'); gr.addColorStop(0.5, '#6a3f50'); gr.addColorStop(1, '#2e1f33');
    ctx.fillStyle = gr; ctx.fillRect(-60, 1190, W + 120, H);
    const col = ctx.createLinearGradient(440, 0, 640, 0);
    col.addColorStop(0, 'rgba(255,210,150,0)'); col.addColorStop(0.5, 'rgba(255,210,150,.22)'); col.addColorStop(1, 'rgba(255,210,150,0)');
    ctx.fillStyle = col; ctx.fillRect(440, 1190, 200, H);
    ctx.fillStyle = 'rgba(255,220,200,.1)';
    this.tile(S, 1, 120, (x, i) => { ctx.fillRect(x, 1270 + this.rnd(i) * 400, (40 + this.rnd(i * 2) * 100) * (1 + 3 * k), 3); });
    const look = {
      body: '#1b1322', far: '#130d18', mane: '#0b070e', rim: '#ffc58f',
      silk1: '#ff7a59', silk2: '#ffe6da', cap: '#ffe6da', skin: '#3d2620', breeches: '#ffe6da',
    };
    this.horse(ctx, S, look, G, 2.15, { mirror: true, alpha: 0.2 });
    ctx.globalAlpha = 1;
    const hv = this.horse(ctx, S, look, G, 2.15);
    this.kick(S, hv, G, 34 + 80 * k, {
      n: S.reduced ? 2 : 4, color: '#fff1ea', alpha: 0.85, r: 4 + 3 * k, life: 0.8, spread: 300,
      lift: 520 + 500 * k, vx: -60, grav: 1400, world: 0.5,
    });
    this.kick(S, hv, G, 10 + 20 * k, { n: 1, color: '#ffd9cc', alpha: 0.28, r: 22, grow: 80, life: 1, spread: 90, lift: 60, world: 0.9 });
    this.drawParts(ctx, S);
    // foreground palms sweep past
    this.tile(S, 1.9, 1700, (x) => {
      ctx.strokeStyle = '#120c16'; ctx.lineWidth = 34; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 120, H + 40); ctx.quadraticCurveTo(x - 40, 1100, x + 90, 780); ctx.stroke();
      ctx.fillStyle = '#120c16';
      for (let f = 0; f < 7; f++) {
        const ang = -2.6 + f * 0.75 + Math.sin(S.t * 1.3 + f) * 0.05;
        ctx.save(); ctx.translate(x + 90, 780); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(130, -44, 270, 26); ctx.quadraticCurveTo(130, -8, 0, 12); ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();
    // crash: a wave of foam washes over the frame
    if (S.phase === 'crash') {
      const rise = Math.min(1, S.pt / 0.4);
      const fade = S.pt < 0.9 ? 1 : Math.max(0.25, 1 - (S.pt - 0.9) * 0.6);
      const top = H - rise * (H + 160);
      ctx.fillStyle = 'rgba(250,244,240,' + (0.95 * fade).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(-20, H + 20);
      for (let x = -20; x <= W + 20; x += 26) ctx.lineTo(x, top + Math.sin(x * 0.03 + S.t * 6) * 26);
      ctx.lineTo(W + 20, H + 20); ctx.closePath(); ctx.fill();
    }
  }
