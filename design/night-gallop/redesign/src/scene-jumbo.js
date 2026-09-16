  cfg() {
    return {
      horseX: 340, crashStops: true, jumbo: true,
      rounds: [{ collectAt: 3.9 }, { crashAt: 5.2 }, { crashAt: 1.6 }],
      hud: { accent: '#fbbf24', onAccent: '#1c1204', idleBg: 'rgba(251,191,36,.12)', idleFg: '#fde68a', lossBg: 'rgba(12,10,6,.92)', lossFg: '#fef3c7', crashWord: 'LIGHTS OUT' },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1330, k = S.k, L = S.light;
    let gr = ctx.createLinearGradient(0, 0, 0, 1100);
    gr.addColorStop(0, '#07080c'); gr.addColorStop(1, '#1d1a14');
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, H + 80);
    // stadium tiers with flashbulbs popping (more as the value climbs)
    this.tile(S, 0.18, 30, (x, i) => {
      for (let row = 0; row < 9; row++) {
        const y = 760 + row * 34;
        ctx.fillStyle = row % 2 ? '#191712' : '#15130f'; ctx.fillRect(x, y, 30, 34);
        const idx = i * 13 + row;
        ctx.fillStyle = ['#3f3a2e', '#2a261e', '#4a4232'][Math.floor(this.rnd(idx) * 3)];
        ctx.beginPath(); ctx.arc(x + 15, y + 14, 8, 0, 6.28); ctx.fill();
        const pop = Math.sin(S.t * (5 + this.rnd(idx) * 9) + idx * 3) > 0.985 - 0.08 * k;
        if (pop && L > 0.5) {
          const b = ctx.createRadialGradient(x + 15, y + 12, 1, x + 15, y + 12, 26);
          b.addColorStop(0, 'rgba(255,255,255,.95)'); b.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = b; ctx.fillRect(x - 11, y - 14, 52, 52);
        }
      }
    });
    // giant screen frame (the multiplier itself is crisp HTML placed inside it)
    ctx.fillStyle = '#0b0a08'; ctx.fillRect(70, 150, 640, 470);
    ctx.strokeStyle = '#3f3a2e'; ctx.lineWidth = 16; ctx.strokeRect(70, 150, 640, 470);
    const sg = ctx.createRadialGradient(390, 380, 30, 390, 380, 520);
    sg.addColorStop(0, 'rgba(251,191,36,' + ((0.25 + 0.25 * k) * L) + ')'); sg.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = sg; ctx.fillRect(-40, -40, W + 80, 1000);
    ctx.fillStyle = '#26221a'; ctx.fillRect(380, 620, 20, 140);
    // rail + track
    ctx.fillStyle = '#f5f0e6'; ctx.fillRect(-40, 1066, W + 80, 10);
    this.tile(S, 1, 90, (x) => { ctx.fillRect(x, 1066, 7, 60); });
    gr = ctx.createLinearGradient(0, 1120, 0, H);
    gr.addColorStop(0, '#6b4a2e'); gr.addColorStop(1, '#221509');
    ctx.fillStyle = gr; ctx.fillRect(-40, 1126, W + 80, H);
    this.speedLines(ctx, S, '#e8c79a', 22, 1140, 1640, 150);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(S.hx, G + 6, 190, 16, 0, 0, 6.28); ctx.fill();
    const hv = this.horse(ctx, S, { body: '#5a3319', far: '#40220f', mane: '#1a0e06', rim: '#ffe6a8', silk1: '#fbbf24', silk2: '#1c1204', cap: '#1c1204', skin: '#4e3020', breeches: '#fef3c7' }, G, 2.4);
    this.kick(S, hv, G, 40 + 90 * k, { n: S.reduced ? 1 : 3, color: '#4a3220', alpha: 0.95, r: 6, life: 0.8, spread: 280, lift: 600 + 450 * k, vx: -180, grav: 1600, world: 0.7, square: true });
    this.drawParts(ctx, S);
    if (L < 1) { ctx.fillStyle = 'rgba(0,0,0,' + (0.9 * (1 - L)) + ')'; ctx.fillRect(-40, -40, W + 80, H + 80); }
  }
