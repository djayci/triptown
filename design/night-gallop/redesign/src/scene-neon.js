  cfg() {
    return {
      horseX: 360, crashStops: true,
      rounds: [{ crashAt: 3.4 }, { collectAt: 5.4 }, { collectAt: 2.4 }],
      hud: { accent: '#22d3ee', onAccent: '#021018', idleBg: 'rgba(34,211,238,.1)', idleFg: '#a5f3fc', lossBg: 'rgba(2,6,12,.92)', lossFg: '#e0f2fe' },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1180, k = S.k, L = S.light;
    ctx.fillStyle = '#020409'; ctx.fillRect(-40, -40, W + 80, H + 80);
    // light tunnel: rail lights stretched into streaks, top and bottom
    const lines = (y0, y1, color, f, count) => {
      for (let i = 0; i < count; i++) {
        const y = y0 + (y1 - y0) * (i / count);
        const len = 80 + 520 * k;
        const x = ((this.rnd(i * 9.1) * (W + len) - S.scroll * f * (1 + this.rnd(i) * 0.6)) % (W + len) + (W + len)) % (W + len) - len;
        ctx.globalAlpha = (0.35 + 0.5 * this.rnd(i * 4)) * L;
        ctx.fillStyle = color; ctx.fillRect(x, y, len, 3);
      }
      ctx.globalAlpha = 1;
    };
    ctx.globalCompositeOperation = 'lighter';
    lines(260, 760, '#22d3ee', 1.2, 24);
    lines(820, 1060, '#f472b6', 1.8, 14);
    // horizon glow
    const hz = ctx.createLinearGradient(0, 1000, 0, 1200);
    hz.addColorStop(0, 'rgba(244,114,182,0)'); hz.addColorStop(1, 'rgba(244,114,182,' + (0.3 * L) + ')');
    ctx.fillStyle = hz; ctx.fillRect(-40, 1000, W + 80, 200);
    ctx.globalCompositeOperation = 'source-over';
    // glossy ground with perspective lines rushing
    ctx.fillStyle = '#05070f'; ctx.fillRect(-40, G, W + 80, H);
    ctx.strokeStyle = 'rgba(34,211,238,' + (0.35 * L) + ')'; ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 40, G); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); }
    const off = (S.scroll * 0.6) % 90;
    for (let j = 0; j < 10; j++) {
      const d = (j * 90 + 90 - off) / 900;
      const y = G + Math.pow(d, 1.8) * (H - G) * 1.4;
      ctx.globalAlpha = Math.min(1, d * 1.5) * 0.4 * L;
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(-40, y, W + 80, 2);
    }
    ctx.globalAlpha = 1;
    // hoof light trails
    ctx.globalCompositeOperation = 'lighter';
    const hv = this.horse(ctx, S, { body: '#101a33', far: '#0a1124', mane: '#0a1124', rim: '#67e8f9', silk1: '#f472b6', silk2: '#22d3ee', cap: '#22d3ee', skin: '#2b1a12', breeches: '#e0f2fe', boot: '#02030a' }, G, 2.4);
    this.kick(S, hv, G, 60 + 120 * k, { n: S.reduced ? 1 : 3, color: this.rnd(Math.floor(S.t * 20)) > 0.5 ? '#22d3ee' : '#f472b6', alpha: 0.9, r: 5, grow: 4, life: 0.5 + 0.4 * k, spread: 60, lift: 60, vx: -300, world: 1 });
    this.drawParts(ctx, S);
    ctx.globalCompositeOperation = 'source-over';
    // reflection
    ctx.save();
    this.horse(ctx, S, { body: '#22d3ee', far: '#0e7490', mane: '#0e7490', rim: null, silk1: '#f472b6', silk2: '#22d3ee', cap: '#22d3ee', skin: '#22d3ee', breeches: '#22d3ee', boot: '#22d3ee' }, G, 2.4, { mirror: true, alpha: 0.1 * L });
    ctx.restore();
    if (L < 1) { ctx.fillStyle = 'rgba(0,0,2,' + (0.95 * (1 - L)) + ')'; ctx.fillRect(-40, -40, W + 80, H + 80); }
  }
