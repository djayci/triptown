  cfg() {
    return {
      horseX: 330,
      hud: {
        accent: '#facc15', onAccent: '#111302', idleBg: 'rgba(250,204,21,.1)', idleFg: '#fef08a', lossBg: 'rgba(6,9,14,.92)', lossFg: '#e2e8f0',
        ladder: { done: { bg: 'rgba(250,204,21,.85)', fg: '#111302', border: '#facc15' }, next: { bg: '#f8fafc', fg: '#111302', border: '#f8fafc' }, todo: { bg: 'rgba(6,9,14,.6)', fg: '#cbd5e1', border: 'rgba(226,232,240,.25)' } },
      },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1200;
    let gr = ctx.createLinearGradient(0, 0, 0, 1100);
    gr.addColorStop(0, '#0b1220'); gr.addColorStop(1, '#27313f');
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, H + 80);
    if (S.punch > 0.7) { ctx.fillStyle = 'rgba(220,235,255,' + (S.punch - 0.7) * 1.4 + ')'; ctx.fillRect(-40, -40, W + 80, H + 80); }
    this.tile(S, 0.2, 360, (x) => {
      ctx.fillStyle = '#1a2230'; ctx.fillRect(x + 40, 330, 12, 700);
      ctx.fillStyle = '#fffbe6'; ctx.fillRect(x, 300, 92, 34);
      const hg = ctx.createRadialGradient(x + 46, 316, 6, x + 46, 316, 220);
      hg.addColorStop(0, 'rgba(255,250,220,.6)'); hg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = hg; ctx.fillRect(x - 180, 100, 460, 440);
    });
    ctx.fillStyle = '#141b26'; ctx.fillRect(-40, 930, W + 80, 110);
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(-40, 1036, W + 80, 9);
    gr = ctx.createLinearGradient(0, 1045, 0, H);
    gr.addColorStop(0, '#4a3b2c'); gr.addColorStop(1, '#120d09');
    ctx.fillStyle = gr; ctx.fillRect(-40, 1045, W + 80, H);
    this.tile(S, 1, 140, (x, i) => { ctx.fillStyle = 'rgba(255,250,220,.08)'; ctx.fillRect(x, 1100 + this.rnd(i) * 500, 60 + this.rnd(i * 2) * 80, 5); });
    this.speedLines(ctx, S, '#cbd5e1', 18, 1060, 1600, 160);
    this.eachFence(S, (x, i) => {
      if (i === 10) { ctx.fillStyle = '#facc15'; ctx.fillRect(x - 9, 660, 18, 560); ctx.fillStyle = '#111302'; ctx.fillRect(x - 9, 660, 18, 60); return; }
      const shake = i === S.fence && S.result === 'refuse' ? Math.sin(S.t * 60) * 9 * S.shake : 0;
      ctx.save(); ctx.translate(x + shake, 0);
      ctx.fillStyle = '#1f2b1a'; ctx.beginPath(); ctx.ellipse(0, G - 70, 95, 90, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-95, G - 72, 190, 78);
      ctx.strokeStyle = '#34462a'; ctx.lineWidth = 4;
      for (let b = 0; b < 14; b++) { ctx.beginPath(); ctx.moveTo(-85 + b * 13, G); ctx.lineTo(-90 + b * 13 + this.rnd(b + i) * 20, G - 150 - this.rnd(b * 3 + i) * 30); ctx.stroke(); }
      ctx.fillStyle = '#facc15'; ctx.font = '800 30px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('x' + (0.97 / Math.pow(0.8, i + 1)).toFixed(2), 0, G - 205);
      ctx.restore();
    });
    const hv = this.jumpingHorse(ctx, S, { body: '#10151c', far: '#0a0e13', mane: '#05070a', rim: '#e2e8f0', silk1: '#facc15', silk2: '#111302', cap: '#111302', skin: '#3e271b', breeches: '#e2e8f0' }, G, 2.4);
    this.kick(S, hv, G, 80, { n: S.reduced ? 1 : 4, color: '#3b2a1b', alpha: 0.95, r: 7, life: 0.8, spread: 340, lift: 760, vx: -160, grav: 1800, world: 0.6, square: true });
    if (S.punch > 0.95) this.emit(S.hx + 60, G - 6, S.reduced ? 5 : 26, { color: '#4a3524', alpha: 0.95, r: 9, life: 0.9, spread: 640, lift: 620, grav: 1600, world: 0.5, square: true });
    this.drawParts(ctx, S);
    const drops = S.reduced ? 40 : 180;
    ctx.strokeStyle = 'rgba(200,215,235,.33)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const y = ((this.rnd(i) * H + S.t * 2100) % (H + 200)) - 100;
      const x = ((this.rnd(i * 3) * (W + 400) - S.scroll * 0.9 - y * 0.35) % (W + 400) + (W + 400)) % (W + 400) - 200;
      ctx.moveTo(x, y); ctx.lineTo(x - 30, y + 44);
    }
    ctx.stroke();
  }
