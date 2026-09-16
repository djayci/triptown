  cfg() {
    return {
      horseX: 330,
      hud: {
        accent: '#15803d', onAccent: '#ffffff', idleBg: 'rgba(255,255,255,.18)', idleFg: '#ffffff', lossBg: 'rgba(15,23,42,.9)', lossFg: '#f8fafc',
        ladder: { done: { bg: '#15803d', fg: '#ffffff', border: '#15803d' }, next: { bg: '#facc15', fg: '#14230f', border: '#facc15' }, todo: { bg: 'rgba(255,255,255,.75)', fg: '#14230f', border: 'rgba(20,35,15,.2)' } },
      },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1200;
    let gr = ctx.createLinearGradient(0, 0, 0, 800);
    gr.addColorStop(0, '#5aa9e6'); gr.addColorStop(1, '#d6ecf5');
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, H + 80);
    this.tile(S, 0.03, 400, (x, i) => {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.ellipse(x + 120, 260 + this.rnd(i) * 120, 110, 30, 0, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 180, 240 + this.rnd(i) * 120, 70, 34, 0, 0, 6.28); ctx.fill();
    });
    this.tile(S, 0.08, 500, (x, i) => {
      ctx.fillStyle = '#7fa37b'; ctx.beginPath(); ctx.ellipse(x + 250, 820, 320 + this.rnd(i) * 80, 120, 0, Math.PI, 0); ctx.fill();
    });
    this.tile(S, 0.3, 900, (x, i) => {
      ctx.fillStyle = '#e7e2d6'; ctx.fillRect(x, 700, 620, 150);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(x - 20, 680, 660, 24);
      for (let rr = 0; rr < 4; rr++) for (let cc = 0; cc < 60; cc++) {
        ctx.fillStyle = ['#1d4ed8', '#f8fafc', '#dc2626', '#facc15', '#15803d', '#0f172a', '#f472b6'][Math.floor(this.rnd(i * 97 + rr * 61 + cc) * 7)];
        ctx.fillRect(x + 8 + cc * 10, 718 + rr * 30, 7, 18);
      }
    });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-40, 880, W + 80, 10);
    this.tile(S, 0.45, 110, (x) => { ctx.fillRect(x, 880, 8, 50); });
    gr = ctx.createLinearGradient(0, 930, 0, H);
    gr.addColorStop(0, '#4ea048'); gr.addColorStop(1, '#2d6b2a');
    ctx.fillStyle = gr; ctx.fillRect(-40, 930, W + 80, H);
    this.tile(S, 1, 180, (x, i) => { if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x, 930, 90, H); } });
    this.speedLines(ctx, S, '#ffffff', 18, 950, 1600, 140);
    this.eachFence(S, (x, i) => {
      if (i === 10) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 10, 640, 20, 580);
        ctx.fillStyle = '#b91c1c'; ctx.fillRect(x - 70, 640, 140, 60);
        ctx.fillStyle = '#ffffff'; ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FINISH', x, 682);
        return;
      }
      const shake = i === S.fence && S.result === 'refuse' ? Math.sin(S.t * 60) * 8 * S.shake : 0;
      ctx.save(); ctx.translate(x + shake, 0);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-90, G - 140, 14, 146); ctx.fillRect(76, G - 140, 14, 146);
      for (let b = 0; b < 3; b++) { ctx.fillStyle = b % 2 ? '#15803d' : '#f8fafc'; ctx.fillRect(-90, G - 130 + b * 34, 180, 18); }
      ctx.fillStyle = '#14230f'; ctx.font = '800 26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('x' + (0.97 / Math.pow(0.8, i + 1)).toFixed(2), 0, G - 170);
      ctx.restore();
    });
    ctx.fillStyle = 'rgba(20,50,20,.35)';
    ctx.beginPath(); ctx.ellipse(S.hx, G + 8, 190 - S.jumpY * 0.3, 16, 0, 0, 6.28); ctx.fill();
    const hv = this.jumpingHorse(ctx, S, { body: '#7a4520', far: '#5c3215', mane: '#2a160a', rim: null, silk1: '#15803d', silk2: '#facc15', cap: '#facc15', skin: '#4e3020', breeches: '#ffffff' }, G, 2.3);
    this.kick(S, hv, G, 60, { n: S.reduced ? 1 : 3, color: '#3f7a2e', alpha: 0.95, r: 5, life: 0.7, spread: 280, lift: 600, vx: -200, grav: 1700, world: 0.7, square: true });
    if (S.punch > 0.95) this.emit(S.hx + 60, G - 6, S.reduced ? 4 : 16, { color: '#5a3d22', alpha: 0.9, r: 7, life: 0.8, spread: 500, lift: 480, grav: 1500, world: 0.5, square: true });
    this.drawParts(ctx, S);
  }
