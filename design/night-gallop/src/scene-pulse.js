  cfg() {
    return {
      horseX: 360,
      ownFlash: true,
      rounds: [{ crashAt: 5.6 }, { collectAt: 4.6 }],
      hud: {
        btnBg: '#e8b23a', btnFg: '#1d2047', btnIdleBg: 'rgba(243,230,200,.12)', btnIdleFg: '#f3e6c8',
        winBg: '#e8b23a', winFg: '#1d2047', lossBg: 'rgba(29,32,71,.92)', lossFg: '#f3e6c8',
      },
    };
  }

  motif(ctx, type, x, y, sz, i, t) {
    const C = ['#e8b23a', '#d4572a', '#1f8a8a', '#f3e6c8'];
    const a = C[i % 4], b = C[(i + 2) % 4];
    if (type === 0) {
      for (let r = 3; r > 0; r--) { ctx.fillStyle = r % 2 ? a : b; ctx.beginPath(); ctx.arc(x, y, sz * r / 3, 0, 6.28); ctx.fill(); }
    } else if (type === 1) {
      ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(x, y - sz); ctx.lineTo(x + sz, y); ctx.lineTo(x, y + sz); ctx.lineTo(x - sz, y); ctx.fill();
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, y, sz * 0.35, 0, 6.28); ctx.fill();
    } else if (type === 2) {
      ctx.fillStyle = a; ctx.beginPath(); ctx.ellipse(x, y, sz * 0.45, sz, 0.6, 0, 6.28); ctx.fill();
      ctx.strokeStyle = b; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - sz * 0.5, y + sz * 0.7); ctx.lineTo(x + sz * 0.5, y - sz * 0.7); ctx.stroke();
    } else {
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(x, y, sz, Math.PI, 0); ctx.fill();
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, y, sz * 0.55, Math.PI, 0); ctx.fill();
    }
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1216, k = S.k;
    ctx.fillStyle = '#1d2047'; ctx.fillRect(-20, -20, W + 40, H + 40);
    // pattern bands, each at its own speed, all accelerating with the multiplier
    const bands = [
      { y: 60, h: 190, f: 0.12, type: 0, sz: 70 },
      { y: 300, h: 150, f: 0.3, type: 2, sz: 56 },
      { y: 500, h: 170, f: 0.55, type: 1, sz: 64 },
      { y: 1320, h: 200, f: 1.25, type: 3, sz: 80 },
      { y: 1560, h: 160, f: 1.6, type: 0, sz: 60 },
    ];
    for (let bi = 0; bi < bands.length; bi++) {
      const B = bands[bi];
      ctx.save();
      ctx.beginPath(); ctx.rect(-20, B.y, W + 40, B.h); ctx.clip();
      ctx.fillStyle = bi % 2 ? '#262a5c' : '#171a3d'; ctx.fillRect(-20, B.y, W + 40, B.h);
      this.tile(S, B.f, B.sz * 2.4, (x, i) => this.motif(ctx, B.type, x + B.sz, B.y + B.h / 2, B.sz, i + bi, S.t));
      ctx.restore();
      ctx.fillStyle = '#f3e6c8'; ctx.fillRect(-20, B.y - 5, W + 40, 5);
    }
    // speed lines in the horse zone
    this.tile(S, 2.4, 70, (x, i) => {
      const y = 720 + this.rnd(i) * 480;
      ctx.fillStyle = this.rnd(i * 5) > 0.5 ? 'rgba(243,230,200,.5)' : 'rgba(232,178,58,.45)';
      ctx.fillRect(x, y, (30 + this.rnd(i * 2) * 60) * (0.5 + 5 * k), 4 + this.rnd(i * 7) * 4);
    });
    ctx.fillStyle = '#f3e6c8'; ctx.fillRect(-20, G + 4, W + 40, 12);
    ctx.fillStyle = '#d4572a';
    this.tile(S, 1, 60, (x) => { ctx.beginPath(); ctx.moveTo(x, G + 16); ctx.lineTo(x + 30, G + 60); ctx.lineTo(x + 60, G + 16); ctx.fill(); });
    const hv = this.horse(ctx, S, {
      body: '#f3e6c8', far: '#d9c9a6', mane: '#1d2047', hoof: '#1d2047',
      silk1: '#d4572a', silk2: '#1f8a8a', cap: '#e8b23a', skin: '#5b3624', breeches: '#1d2047', boot: '#0e1030', rein: '#1d2047',
    }, G, 2.2);
    this.kick(S, hv, G, 20 + 60 * k, {
      n: S.reduced ? 1 : 2, color: this.rnd(Math.floor(S.t * 10)) > 0.5 ? '#e8b23a' : '#1f8a8a',
      alpha: 0.9, r: 7 + 6 * k, life: 0.9, spread: 160, lift: 200 + 200 * k, world: 0.8,
    });
    this.drawParts(ctx, S);
    // collect: colours invert for a beat
    if (S.flash > 0) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, S.flash * 1.2).toFixed(3) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.globalCompositeOperation = 'source-over';
    }
    // crash: the pattern drains to grey
    if (S.phase === 'crash') {
      const d = Math.min(1, S.pt / 0.25);
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = 'rgba(128,128,128,' + d.toFixed(3) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(20,20,30,' + (0.35 * d).toFixed(3) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }
