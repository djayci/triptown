  cfg() {
    return {
      horseX: 390, crashStops: true, ownFlash: false,
      rounds: [{ crashAt: 4.1 }, { collectAt: 3.1 }, { collectAt: 5.8 }],
      hud: { accent: '#fb923c', onAccent: '#1a0a02', idleBg: 'rgba(251,146,60,.12)', idleFg: '#fed7aa', lossBg: 'rgba(10,6,4,.92)', lossFg: '#ffedd5' },
    };
  }

  horseFront(ctx, S, x, gy, s) {
    const TAU = Math.PI * 2, p = S.gait, run = Math.min(1, S.hs / 900);
    const bob = -Math.abs(Math.sin(TAU * p)) * 16 * run;
    ctx.save(); ctx.translate(x, gy); ctx.scale(s, s); ctx.translate(0, bob);
    const leg = (lx, ph, far) => {
      const th = TAU * (p + ph);
      const lift = Math.max(0, Math.cos(th)) * 30 * run;
      const len = 96 - lift;
      ctx.strokeStyle = far ? '#140c08' : '#241611'; ctx.lineCap = 'round';
      ctx.lineWidth = far ? 13 : 16;
      ctx.beginPath(); ctx.moveTo(lx, -80); ctx.lineTo(lx + (far ? 0 : lx * 0.06), -80 + len); ctx.stroke();
      ctx.fillStyle = '#0b0705'; ctx.beginPath(); ctx.ellipse(lx, -80 + len + 4, 9, 6, 0, 0, TAU); ctx.fill();
    };
    leg(-26, 0.1, true); leg(26, 0.55, true);
    ctx.fillStyle = '#241611';
    ctx.beginPath(); ctx.ellipse(0, -110, 52, 48, 0, 0, TAU); ctx.fill();
    leg(-20, 0.45, false); leg(20, 0.95, false);
    // jockey behind the neck
    const jb = -bob * 0.5;
    ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.ellipse(0, -205 + jb, 42, 26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0a02'; ctx.fillRect(-42, -210 + jb, 84, 7);
    ctx.fillStyle = '#3e271b'; ctx.beginPath(); ctx.arc(0, -240 + jb, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0a02'; ctx.beginPath(); ctx.arc(0, -244 + jb, 17, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,.8)'; ctx.fillRect(-11, -243 + jb, 22, 6);
    // neck and head, head bobbing forward
    const hb = Math.sin(TAU * p + 1) * 6 * run;
    ctx.fillStyle = '#35211a';
    ctx.beginPath(); ctx.ellipse(0, -160, 26, 44, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a2e1f';
    ctx.beginPath(); ctx.ellipse(0, -140 + hb, 21, 50, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0b0705'; ctx.beginPath(); ctx.arc(-17, -168 + hb, 3.5, 0, TAU); ctx.arc(17, -168 + hb, 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(-4, -180 + hb, 8, 58);
    ctx.strokeStyle = '#120806'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-30, -196 + jb); ctx.lineTo(-14, -128 + hb); ctx.moveTo(30, -196 + jb); ctx.lineTo(14, -128 + hb); ctx.stroke();
    ctx.fillStyle = '#4a2e1f';
    ctx.beginPath(); ctx.moveTo(-18, -188 + hb); ctx.lineTo(-24, -214 + hb); ctx.lineTo(-8, -194 + hb); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, -188 + hb); ctx.lineTo(24, -214 + hb); ctx.lineTo(8, -194 + hb); ctx.fill();
    ctx.fillStyle = '#0b0705'; ctx.beginPath(); ctx.arc(-8, -96 + hb, 4, 0, TAU); ctx.arc(8, -96 + hb, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fed7aa'; ctx.globalAlpha = 0.7; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -112, 52, 48, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, HZ = 760, k = S.k, L = S.light;
    let gr = ctx.createLinearGradient(0, 0, 0, HZ);
    gr.addColorStop(0, '#050304'); gr.addColorStop(1, '#2a160c');
    ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, H + 80);
    // floodlight glare at the vanishing point
    const gl = ctx.createRadialGradient(W / 2, HZ - 60, 10, W / 2, HZ - 60, 560);
    gl.addColorStop(0, 'rgba(255,220,170,' + (0.75 * L) + ')'); gl.addColorStop(0.25, 'rgba(255,170,90,' + (0.25 * L) + ')'); gl.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = gl; ctx.fillRect(-40, -40, W + 80, H);
    // track in perspective
    gr = ctx.createLinearGradient(0, HZ, 0, H);
    gr.addColorStop(0, '#6b4226'); gr.addColorStop(1, '#1a0d06');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(W / 2 - 40, HZ); ctx.lineTo(W / 2 + 40, HZ); ctx.lineTo(W + 420, H); ctx.lineTo(-420, H); ctx.closePath(); ctx.fill();
    // rail posts rushing toward the camera on both sides
    const period = 1;
    const phase = (S.scroll / 900) % period;
    for (let j = 0; j < 14; j++) {
      const d = ((j / 14 + phase) % 1);
      const z = Math.pow(d, 2.2);
      const y = HZ + z * (H - HZ) * 1.15;
      const spread = 60 + z * 900;
      const hgt = 8 + z * 260;
      ctx.globalAlpha = Math.min(1, d * 2) * L;
      ctx.fillStyle = '#f5ede0';
      ctx.fillRect(W / 2 - spread - 3 - z * 8, y - hgt, 6 + z * 26, hgt);
      ctx.fillRect(W / 2 + spread - 3, y - hgt, 6 + z * 26, hgt);
    }
    ctx.globalAlpha = 1;
    this.horseFront(ctx, S, W / 2, 1180, 2.3);
    // dirt thrown at the lens: flecks growing as they approach
    const count = S.reduced ? 10 : Math.floor(14 + 70 * k);
    for (let i = 0; i < count; i++) {
      const life = ((S.t * (0.9 + 1.4 * k) + this.rnd(i)) % 1);
      const ang = this.rnd(i * 7) * 6.28;
      const r = life * life * 700;
      const x = W / 2 + Math.cos(ang) * r * 0.9, y = 1120 + Math.sin(ang) * r * 0.6 - life * 120;
      ctx.globalAlpha = (1 - life) * 0.9 * (S.phase === 'run' ? 1 : 0.3);
      ctx.fillStyle = '#2a1508';
      const sz = 2 + life * life * 26;
      ctx.fillRect(x, y, sz, sz * 0.8);
    }
    ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1000);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (0.35 + 0.35 * k) + ')');
    ctx.fillStyle = vg; ctx.fillRect(-40, -40, W + 80, H + 80);
    if (L < 1) { ctx.fillStyle = 'rgba(0,0,0,' + (0.93 * (1 - L)) + ')'; ctx.fillRect(-40, -40, W + 80, H + 80); }
  }
