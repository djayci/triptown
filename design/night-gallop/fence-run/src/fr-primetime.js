  cfg() {
    return {
      horseX: 330,
      hud: {
        accent: '#e11d48', onAccent: '#ffffff', idleBg: 'rgba(255,255,255,.1)', idleFg: '#f1f5f9', lossBg: 'rgba(8,12,24,.92)', lossFg: '#f1f5f9',
        ladder: { done: { bg: 'rgba(225,29,72,.9)', fg: '#ffffff', border: '#e11d48' }, next: { bg: '#ffffff', fg: '#030712', border: '#ffffff' }, todo: { bg: 'rgba(3,7,18,.6)', fg: '#cbd5e1', border: 'rgba(255,255,255,.25)' } },
      },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1180;
    let gr = ctx.createLinearGradient(0, 0, 0, 1000);
    gr.addColorStop(0, '#030712'); gr.addColorStop(1, '#172036');
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, H + 80);
    this.tile(S, 0.12, 260, (x, i) => {
      const r = 60 + this.rnd(i) * 70, y = 470 + this.rnd(i * 3) * 220;
      const b = ctx.createRadialGradient(x, y, 4, x, y, r);
      b.addColorStop(0, 'rgba(255,250,235,.55)'); b.addColorStop(0.5, 'rgba(255,240,210,.18)'); b.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = b; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    ctx.fillStyle = '#1c2438'; ctx.fillRect(-40, 860, W + 80, 150);
    this.tile(S, 0.6, 18, (x, i) => {
      ctx.fillStyle = ['#e11d48', '#f8fafc', '#fbbf24', '#38bdf8', '#334155'][Math.floor(this.rnd(i) * 5)];
      ctx.globalAlpha = 0.35; ctx.fillRect(x, 880 + this.rnd(i * 4) * 100, 14, 9);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(-40, 1006, W + 80, 8);
    gr = ctx.createLinearGradient(0, 1014, 0, H);
    gr.addColorStop(0, '#2f5d34'); gr.addColorStop(1, '#0d1f10');
    ctx.fillStyle = gr; ctx.fillRect(-40, 1014, W + 80, H);
    const pool = ctx.createRadialGradient(S.hx, G, 20, S.hx, G, 520);
    pool.addColorStop(0, 'rgba(255,240,210,.28)'); pool.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = pool; ctx.fillRect(-40, 700, W + 80, 1000);
    this.speedLines(ctx, S, '#cfe8c9', 26, 1030, 1600, 150);
    this.eachFence(S, (x, i) => {
      if (i === 10) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 8, 700, 16, 500);
        ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.arc(x, 700, 44, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = '900 italic 30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FIN', x, 712);
        return;
      }
      const shake = i === S.fence && S.result === 'refuse' ? Math.sin(S.t * 60) * 8 * S.shake : 0;
      ctx.save(); ctx.translate(x + shake, 0);
      ctx.fillStyle = '#123d1c'; ctx.beginPath(); ctx.moveTo(-70, G + 6); ctx.lineTo(-54, G - 150); ctx.lineTo(54, G - 150); ctx.lineTo(70, G + 6); ctx.fill();
      ctx.fillStyle = '#1f5a2b';
      for (let b = 0; b < 12; b++) { ctx.fillRect(-56 + b * 10, G - 175 + this.rnd(b + i) * 20, 5, 40); }
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(-80, G - 60, 160, 12);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 italic 26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('x' + (0.97 / Math.pow(0.8, i + 1)).toFixed(2), 0, G - 200);
      ctx.restore();
    });
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(S.hx, G + 8, 190 - S.jumpY * 0.3, 16, 0, 0, 6.28); ctx.fill();
    const hv = this.jumpingHorse(ctx, S, { body: '#1b1210', far: '#120b09', mane: '#070404', rim: '#fff4e0', silk1: '#e11d48', silk2: '#f8fafc', cap: '#f8fafc', skin: '#3e271b', breeches: '#f1f5f9' }, G, 2.4);
    this.kick(S, hv, G, 60, { n: S.reduced ? 1 : 3, color: '#2a3a20', alpha: 0.95, r: 6, life: 0.7, spread: 300, lift: 650, vx: -200, grav: 1700, world: 0.7, square: true });
    if (S.punch > 0.95) this.emit(S.hx + 60, G - 6, S.reduced ? 4 : 18, { color: '#335c2a', alpha: 0.95, r: 7, life: 0.8, spread: 520, lift: 500, grav: 1500, world: 0.5, square: true });
    this.drawParts(ctx, S);
    this.tile(S, 2.6, 700, (x) => {
      const w = 26 + Math.min(1, S.speed / 1000) * 130;
      const pg = ctx.createLinearGradient(x - w, 0, x + w, 0);
      pg.addColorStop(0, 'rgba(255,255,255,0)'); pg.addColorStop(0.5, 'rgba(255,255,255,.8)'); pg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = pg; ctx.fillRect(x - w, 1230, w * 2, 460);
    });
  }
