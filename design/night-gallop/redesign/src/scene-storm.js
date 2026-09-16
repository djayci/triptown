  cfg() {
    return {
      horseX: 360, crashStops: true,
      rounds: [{ collectAt: 5.1 }, { crashAt: 3.0 }, { crashAt: 4.4 }],
      hud: { accent: '#facc15', onAccent: '#111302', idleBg: 'rgba(250,204,21,.1)', idleFg: '#fef08a', lossBg: 'rgba(6,9,14,.92)', lossFg: '#e2e8f0' },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1230, k = S.k, L = S.light;
    let gr = ctx.createLinearGradient(0, 0, 0, 1100);
    gr.addColorStop(0, '#0b1220'); gr.addColorStop(1, '#27313f');
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, H + 80);
    // Lightning only when the value passes x2, x5 and x10 (a punch), so it follows the value, never the crash.
    if (S.punch > 0.6 && L > 0.5) {
      ctx.fillStyle = 'rgba(220,235,255,' + (S.punch - 0.6) * 1.6 + ')'; ctx.fillRect(-40, -40, W + 80, H + 80);
      ctx.strokeStyle = 'rgba(240,248,255,.9)'; ctx.lineWidth = 4; ctx.beginPath();
      let x = 150 + this.rnd(Math.floor(S.t)) * 480, y = 0; ctx.moveTo(x, y);
      while (y < 700) { x += (this.rnd(y + S.t) - 0.5) * 90; y += 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // floodlight towers in rain haze
    this.tile(S, 0.2, 360, (x) => {
      ctx.fillStyle = '#1a2230'; ctx.fillRect(x + 40, 330, 12, 720);
      ctx.fillStyle = L > 0.5 ? '#fffbe6' : '#3b4252'; ctx.fillRect(x, 300, 92, 34);
      const hg = ctx.createRadialGradient(x + 46, 316, 6, x + 46, 316, 220);
      hg.addColorStop(0, 'rgba(255,250,220,' + (0.6 * L) + ')'); hg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = hg; ctx.fillRect(x - 180, 100, 460, 440);
    });
    ctx.fillStyle = '#141b26'; ctx.fillRect(-40, 960, W + 80, 110);
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(-40, 1066, W + 80, 9);
    this.tile(S, 1, 100, (x) => { ctx.fillRect(x, 1066, 7, 55); });
    // wet track with light reflections
    gr = ctx.createLinearGradient(0, 1120, 0, H);
    gr.addColorStop(0, '#3a3530'); gr.addColorStop(1, '#0d0f12');
    ctx.fillStyle = gr; ctx.fillRect(-40, 1121, W + 80, H);
    this.tile(S, 0.2, 360, (x) => {
      const rg = ctx.createLinearGradient(0, 1130, 0, 1600);
      rg.addColorStop(0, 'rgba(255,250,220,' + (0.25 * L) + ')'); rg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = rg; ctx.fillRect(x + 20, 1130, 50, 470);
    });
    this.speedLines(ctx, S, '#cbd5e1', 20, 1140, 1640, 170);
    const hv = this.horse(ctx, S, { body: '#10151c', far: '#0a0e13', mane: '#05070a', rim: '#e2e8f0', silk1: '#facc15', silk2: '#111302', cap: '#111302', skin: '#3e271b', breeches: '#e2e8f0' }, G, 2.5);
    this.kick(S, hv, G, 50 + 100 * k, { n: S.reduced ? 1 : 4, color: '#c7d2de', alpha: 0.8, r: 4, life: 0.7, spread: 320, lift: 700 + 500 * k, vx: -160, grav: 1700, world: 0.6 });
    this.drawParts(ctx, S);
    // rain: slant and speed grow with the value
    const drops = S.reduced ? 40 : 120 + Math.floor(160 * k);
    ctx.strokeStyle = 'rgba(200,215,235,.35)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const sp = 1600 + 1200 * k;
      const y = ((this.rnd(i) * H + S.t * sp) % (H + 200)) - 100;
      const x = ((this.rnd(i * 3) * (W + 400) - S.scroll * 0.9 - y * (0.2 + 0.5 * k)) % (W + 400) + (W + 400)) % (W + 400) - 200;
      ctx.moveTo(x, y); ctx.lineTo(x - 18 - 50 * k, y + 40);
    }
    ctx.stroke();
    if (L < 1) { ctx.fillStyle = 'rgba(0,0,3,' + (0.94 * (1 - L)) + ')'; ctx.fillRect(-40, -40, W + 80, H + 80); }
  }
