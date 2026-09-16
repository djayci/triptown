  cfg() {
    return {
      horseX: 350, crashStops: true,
      rounds: [{ collectAt: 4.6 }, { crashAt: 2.7 }, { collectAt: 6.2 }],
      hud: { accent: '#e11d48', onAccent: '#ffffff', idleBg: 'rgba(255,255,255,.1)', idleFg: '#f1f5f9', lossBg: 'rgba(8,12,24,.92)', lossFg: '#f1f5f9' },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1250, k = S.k, L = S.light;
    let gr = ctx.createLinearGradient(0, 0, 0, 1000);
    gr.addColorStop(0, '#030712'); gr.addColorStop(1, '#172036');
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, H + 80);
    // out-of-focus floodlights (bokeh)
    this.tile(S, 0.12, 260, (x, i) => {
      const r = 60 + this.rnd(i) * 70, y = 420 + this.rnd(i * 3) * 260;
      const b = ctx.createRadialGradient(x, y, 4, x, y, r);
      b.addColorStop(0, 'rgba(255,250,235,' + (0.55 * L) + ')'); b.addColorStop(0.5, 'rgba(255,240,210,' + (0.18 * L) + ')'); b.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = b; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    // blurred crowd smear
    ctx.fillStyle = '#1c2438'; ctx.fillRect(-40, 900, W + 80, 170);
    this.tile(S, 0.7, 18, (x, i) => {
      ctx.fillStyle = ['#e11d48', '#f8fafc', '#fbbf24', '#38bdf8', '#334155'][Math.floor(this.rnd(i) * 5)];
      ctx.globalAlpha = 0.35 + 0.25 * this.rnd(i * 2);
      ctx.fillRect(x, 930 + this.rnd(i * 4) * 110, 14 + 40 * k, 9);
    });
    ctx.globalAlpha = 1;
    // track
    gr = ctx.createLinearGradient(0, 1070, 0, H);
    gr.addColorStop(0, '#5b3b28'); gr.addColorStop(1, '#1a100b');
    ctx.fillStyle = gr; ctx.fillRect(-40, 1070, W + 80, H);
    const pool = ctx.createRadialGradient(S.hx, G, 20, S.hx, G, 560);
    pool.addColorStop(0, 'rgba(255,236,200,' + (0.35 * L) + ')'); pool.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = pool; ctx.fillRect(-40, 800, W + 80, 900);
    this.speedLines(ctx, S, '#f6d7b0', 26, 1090, 1650, 160);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(S.hx, G + 8, 210, 18, 0, 0, 6.28); ctx.fill();
    const hv = this.horse(ctx, S, { body: '#1b1210', far: '#120b09', mane: '#070404', rim: '#fff4e0', silk1: '#e11d48', silk2: '#f8fafc', cap: '#f8fafc', skin: '#3e271b', breeches: '#f1f5f9' }, G, 2.7);
    this.kick(S, hv, G, 40 + 80 * k, { n: S.reduced ? 1 : 3, color: '#3a2618', alpha: 0.95, r: 6, life: 0.8, spread: 300, lift: 650 + 500 * k, vx: -200, grav: 1700, world: 0.7, square: true });
    this.drawParts(ctx, S);
    // foreground rail posts whipping past, motion-blurred
    this.tile(S, 3.2, 520, (x) => {
      const w = 26 + 140 * k;
      const pg = ctx.createLinearGradient(x - w, 0, x + w, 0);
      pg.addColorStop(0, 'rgba(255,255,255,0)'); pg.addColorStop(0.5, 'rgba(255,255,255,' + (0.85 * L) + ')'); pg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = pg; ctx.fillRect(x - w, 1180, w * 2, 520);
    });
    ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * L) + ')'; ctx.fillRect(-40, 1175, W + 80, 14);
    if (L < 1) { ctx.fillStyle = 'rgba(0,0,4,' + (0.94 * (1 - L)) + ')'; ctx.fillRect(-40, -40, W + 80, H + 80); }
  }
