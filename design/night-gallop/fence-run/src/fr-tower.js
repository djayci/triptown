  cfg() {
    return {
      horseX: 300, tower: true,
      hud: {
        accent: '#a3e635', onAccent: '#0b1203', idleBg: 'rgba(163,230,53,.12)', idleFg: '#d9f99d', lossBg: 'rgba(10,12,8,.94)', lossFg: '#ecfccb',
        ladder: { done: { bg: 'rgba(163,230,53,.18)', fg: '#a3e635', border: 'rgba(163,230,53,.5)' }, next: { bg: '#a3e635', fg: '#0b1203', border: '#a3e635' }, todo: { bg: 'rgba(255,255,255,.04)', fg: 'rgba(236,252,203,.7)', border: 'rgba(255,255,255,.14)' } },
      },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, G = 860;
    let gr = ctx.createLinearGradient(0, 0, 0, 1000);
    gr.addColorStop(0, '#0b0f0a'); gr.addColorStop(1, '#1d2a14');
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, S.H + 80);
    this.tile(S, 0.2, 240, (x, i) => {
      ctx.fillStyle = '#131b0e'; ctx.fillRect(x, 520 - this.rnd(i) * 160, 120, 400);
    });
    ctx.fillStyle = '#304a1d'; ctx.fillRect(-40, 700, W + 80, 1000);
    ctx.fillStyle = '#a3e635'; ctx.fillRect(-40, G + 6, W + 80, 4);
    this.speedLines(ctx, S, '#a3e635', 14, 560, 900, 120);
    this.eachFence(S, (x, i) => {
      if (i === 10) { ctx.fillStyle = '#a3e635'; ctx.fillRect(x - 6, 560, 12, 310); ctx.fillRect(x - 60, 560, 120, 36); return; }
      const shake = i === S.fence && S.result === 'refuse' ? Math.sin(S.t * 60) * 7 * S.shake : 0;
      ctx.save(); ctx.translate(x + shake, 0);
      ctx.strokeStyle = i < S.fence ? 'rgba(163,230,53,.45)' : '#ecfccb'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-60, G); ctx.lineTo(-60, G - 110); ctx.moveTo(60, G); ctx.lineTo(60, G - 110); ctx.moveTo(-70, G - 105); ctx.lineTo(70, G - 105); ctx.moveTo(-70, G - 60); ctx.lineTo(70, G - 60); ctx.stroke();
      ctx.restore();
    });
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(S.hx, G + 6, 140 - S.jumpY * 0.2, 12, 0, 0, 6.28); ctx.fill();
    const s2 = Object.assign({}, S, { jumpY: S.jumpY * 0.75 });
    const hv = this.jumpingHorse(ctx, s2, { body: '#4b3a2a', far: '#35291d', mane: '#1a130c', rim: '#d9f99d', silk1: '#a3e635', silk2: '#0b1203', cap: '#0b1203', skin: '#3e271b', breeches: '#ecfccb' }, G, 1.75);
    this.kick(S, hv, G, 60, { n: S.reduced ? 1 : 2, color: '#a3e635', alpha: 0.7, r: 4, life: 0.5, spread: 220, lift: 400, vx: -160, grav: 1500, world: 0.7, square: true });
    this.drawParts(ctx, S);
  }
