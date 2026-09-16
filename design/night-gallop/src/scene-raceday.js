  cfg() {
    return {
      horseX: 380,
      driftOnCrash: true,
      crashCamRate: 0.45,
      rounds: [{ collectAt: 6.2 }, { crashAt: 3.9 }],
      hud: {
        btnBg: '#f3a712', btnFg: '#0d2a20', btnIdleBg: 'rgba(255,255,255,.14)', btnIdleFg: '#e6f0ea',
        winBg: '#f3a712', winFg: '#0d2a20', lossBg: 'rgba(13,42,32,.92)', lossFg: '#ffffff',
      },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1226, k = S.k;
    let gr = ctx.createLinearGradient(0, 0, 0, 820);
    gr.addColorStop(0, '#7fbfe4'); gr.addColorStop(1, '#dcefee');
    ctx.fillStyle = gr; ctx.fillRect(-20, -20, W + 40, 860);
    this.tile(S, 0.04, 400, (x, i) => {
      ctx.fillStyle = '#86a88c';
      ctx.beginPath(); ctx.arc(x + 100, 840, 90 + this.rnd(i) * 60, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 280, 850, 70 + this.rnd(i * 2) * 50, Math.PI, 0); ctx.fill();
    });
    // grandstand packed with a race-day crowd
    const palette = ['#e4572e', '#f3a712', '#29335c', '#669bbc', '#a8c686', '#ffffff', '#7b2d26', '#0f7173', '#d81e5b'];
    this.tile(S, 0.18, 980, (x, i) => {
      ctx.fillStyle = '#cfc8b8'; ctx.fillRect(x, 640, 760, 250);
      ctx.fillStyle = '#efeadf';
      ctx.beginPath(); ctx.moveTo(x - 30, 640); ctx.lineTo(x + 790, 612); ctx.lineTo(x + 790, 640); ctx.lineTo(x - 30, 664); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, 664, 760, 26);
      for (let c = 0; c < 6; c++) { ctx.fillStyle = '#b5ad9b'; ctx.fillRect(x + 20 + c * 148, 664, 10, 226); }
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 44; col++) {
          const idx = i * 1000 + row * 50 + col;
          const px = x + 12 + col * 17 + (row % 2) * 8;
          const jump = Math.max(0, Math.sin(S.t * 8 + idx * 0.7)) * 6 * k * this.rnd(idx);
          const py = 700 + row * 26 - jump;
          ctx.fillStyle = palette[Math.floor(this.rnd(idx) * palette.length)];
          ctx.fillRect(px, py + 6, 12, 14);
          ctx.fillStyle = this.rnd(idx * 1.3) > 0.5 ? '#4a2a1a' : '#6b3f2a';
          ctx.beginPath(); ctx.arc(px + 6, py + 2, 5.5, 0, 6.28); ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 20, 690); ctx.quadraticCurveTo(x + 380, 740, x + 780, 690); ctx.stroke();
      for (let f = 0; f < 16; f++) {
        const fx = x + f * 50;
        ctx.fillStyle = palette[f % palette.length];
        const fy = 690 + Math.sin((f / 15) * Math.PI) * 25;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 22, fy); ctx.lineTo(fx + 11, fy + 22); ctx.fill();
      }
    });
    // far rail
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-20, 900, W + 40, 10);
    this.tile(S, 0.35, 120, (x) => { ctx.fillRect(x, 900, 7, 48); });
    // turf with moving mowing stripes
    ctx.fillStyle = '#4f9a3e'; ctx.fillRect(-20, 948, W + 40, H);
    this.tile(S, 1, 180, (x, i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath(); ctx.moveTo(x, 948); ctx.lineTo(x + 90, 948); ctx.lineTo(x + 30, H); ctx.lineTo(x - 60, H); ctx.fill();
      }
    });
    ctx.fillStyle = 'rgba(30,70,20,.18)';
    this.tile(S, 1, 90, (x, i) => { ctx.fillRect(x, 980 + this.rnd(i) * 650, (30 + this.rnd(i * 3) * 90) * (1 + 3 * k), 3); });
    ctx.fillStyle = 'rgba(20,50,15,.28)';
    ctx.beginPath(); ctx.ellipse(S.hx, G + 6, 170, 16, 0, 0, 6.28); ctx.fill();
    const hv = this.horse(ctx, S, {
      body: '#6e3b1d', far: '#552c14', mane: '#1f110a', hoof: '#2a1a10',
      silk1: '#0d6b4f', silk2: '#f3a712', cap: '#f3a712', skin: '#4e3020', breeches: '#ffffff',
    }, G, 2.15);
    this.kick(S, hv, G, 26 + 60 * k, {
      n: S.reduced ? 1 : 3, color: '#4a3524', alpha: 0.95, r: 5, life: 0.8, spread: 240,
      lift: 480 + 400 * k, vx: -100, grav: 1600, world: 0.6, square: true,
    });
    this.kick(S, hv, G, 14 + 30 * k, { n: 2, color: '#3e7f31', alpha: 0.9, r: 4, life: 0.7, spread: 200, lift: 420, grav: 1600, world: 0.6, square: true });
    this.drawParts(ctx, S);
    // near rail rushing past in the foreground
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-20, 1296, W + 40, 14);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-20, 1270, W + 40, 16);
    this.tile(S, 1.7, 170, (x) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 1270, 14 + 26 * k, 90);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + 14 + 26 * k, 1286, 6, 74);
    });
  }
