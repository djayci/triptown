  cfg() {
    return {
      horseX: 330,
      hud: {
        accent: '#22d3ee', onAccent: '#021018', idleBg: 'rgba(34,211,238,.1)', idleFg: '#a5f3fc', lossBg: 'rgba(2,6,12,.92)', lossFg: '#e0f2fe',
        ladder: { done: { bg: 'rgba(34,211,238,.18)', fg: '#67e8f9', border: '#22d3ee' }, next: { bg: '#f472b6', fg: '#1a0410', border: '#f472b6' }, todo: { bg: 'rgba(255,255,255,.03)', fg: '#a5b4fc', border: 'rgba(165,180,252,.3)' } },
      },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1180;
    ctx.fillStyle = '#020409'; ctx.fillRect(-40, -40, W + 80, H + 80);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const y = 260 + i * 36;
      const len = 80 + Math.min(1, S.speed / 1000) * 460;
      const span = W + len;
      const x = ((this.rnd(i * 9.1) * span - S.scroll * 1.3 * (1 + this.rnd(i) * 0.6)) % span + span) % span - len;
      ctx.globalAlpha = 0.25 + 0.4 * this.rnd(i * 4);
      ctx.fillStyle = i % 3 ? '#22d3ee' : '#f472b6'; ctx.fillRect(x, y, len, 3);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05070f'; ctx.fillRect(-40, G, W + 80, H);
    ctx.strokeStyle = 'rgba(34,211,238,.35)'; ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 40, G); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); }
    this.eachFence(S, (x, i) => {
      const done = i < S.fence;
      const color = i === 10 ? '#f472b6' : done ? '#22d3ee' : '#e0e7ff';
      const shake = i === S.fence && S.result === 'refuse' ? Math.sin(S.t * 60) * 8 * S.shake : 0;
      ctx.save(); ctx.translate(x + shake, 0);
      ctx.shadowColor = color; ctx.shadowBlur = 30;
      ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round';
      const h = i === 10 ? 520 : 150;
      ctx.beginPath(); ctx.moveTo(-70, G); ctx.lineTo(-70, G - h); ctx.moveTo(70, G); ctx.lineTo(70, G - h); ctx.moveTo(-80, G - h + 10); ctx.lineTo(80, G - h + 10); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color; ctx.font = '800 26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(i === 10 ? 'FINISH' : 'x' + (0.97 / Math.pow(0.8, i + 1)).toFixed(2), 0, G - h - 24);
      ctx.restore();
    });
    ctx.globalCompositeOperation = 'lighter';
    const hv = this.jumpingHorse(ctx, S, { body: '#101a33', far: '#0a1124', mane: '#0a1124', rim: '#67e8f9', silk1: '#f472b6', silk2: '#22d3ee', cap: '#22d3ee', skin: '#2b1a12', breeches: '#e0f2fe', boot: '#02030a' }, G, 2.4);
    this.kick(S, hv, G, 90, { n: S.reduced ? 1 : 3, color: this.rnd(Math.floor(S.t * 20)) > 0.5 ? '#22d3ee' : '#f472b6', alpha: 0.9, r: 5, grow: 4, life: 0.6, spread: 60, lift: 60, vx: -300, world: 1 });
    if (S.punch > 0.95) this.emit(S.hx + 40, G - 10, S.reduced ? 4 : 20, { color: '#f472b6', alpha: 0.9, r: 6, life: 0.6, spread: 700, lift: 300, world: 0.4 });
    this.drawParts(ctx, S);
    ctx.globalCompositeOperation = 'source-over';
  }
