  rnd(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  tile(S, f, sp, fn) {
    const off = S.scroll * f;
    const base = Math.floor(off / sp);
    const shift = off - base * sp;
    const count = Math.ceil(S.W / sp) + 2;
    for (let i = -1; i < count; i++) fn(i * sp - shift, base + i);
  }

  emit(x, y, n, o) {
    const P = this.g.parts;
    const cap = this.props.reducedMotion ? 120 : 320;
    for (let i = 0; i < n; i++) {
      if (P.length > cap) P.shift();
      P.push({
        x: x + (Math.random() - 0.5) * (o.jx || 20), y,
        vx: (o.vx || 0) + (Math.random() - 0.5) * (o.spread || 80),
        vy: (o.vy || 0) - Math.random() * (o.lift || 80),
        life: 0, max: (o.life || 1) * (0.6 + Math.random() * 0.8),
        r: (o.r || 10) * (0.5 + Math.random()), grow: o.grow || 0, grav: o.grav || 0,
        color: o.color, alpha: o.alpha == null ? 0.6 : o.alpha, world: o.world == null ? 1 : o.world,
        sq: !!o.square,
      });
    }
  }

  drawParts(ctx, S) {
    const P = this.g.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      if (S.dt > 0) {
        p.life += S.dt;
        p.vy += p.grav * S.dt;
        p.x += (p.vx - S.speed * p.world) * S.dt;
        p.y += p.vy * S.dt;
      }
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.alpha * (1 - p.life / p.max));
      ctx.fillStyle = p.color;
      const rr = p.r + p.grow * p.life;
      if (p.sq) { ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // Placeholder gallop: production art is pre-rendered 3D sprite sheets.
  horse(ctx, S, L, G, s, opt) {
    opt = opt || {};
    const TAU = Math.PI * 2;
    const p = S.gait;
    const run = Math.min(1, S.hs / 520);
    const bob = -Math.abs(Math.sin(TAU * p)) * 7 * run;
    const pitch = Math.sin(TAU * p + 0.8) * 0.045 * run;
    const upright = S.phase === 'run' ? 0 : S.phase === 'crash' ? 1 - Math.min(1, S.hs / 700) : S.phase === 'collect' ? 0.55 : 0.35;
    const hooves = [];
    ctx.save();
    ctx.translate(S.hx, G);
    if (opt.mirror) { ctx.scale(s, -s); ctx.globalAlpha = opt.alpha; }
    else ctx.scale(s, s);
    ctx.translate(0, bob);
    ctx.rotate(pitch);
    const amp = 0.18 + 0.5 * run;
    const leg = (hx, hy, ph, front, near) => {
      const th = TAU * (p + ph);
      const a = amp * Math.sin(th);
      const fold = Math.max(0, Math.cos(th)) * (front ? 1.5 : 1.0) * (0.3 + 0.7 * run);
      const kx = hx + Math.sin(a) * 36, ky = hy + Math.cos(a) * 36;
      const a2 = a - fold;
      const fx = kx + Math.sin(a2) * 40, fy = ky + Math.cos(a2) * 40;
      ctx.strokeStyle = near ? L.body : (L.far || L.body);
      ctx.lineCap = 'round';
      ctx.lineWidth = near ? (front ? 12 : 15) : (front ? 10 : 13);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.lineWidth = near ? 7 : 6;
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = L.hoof || L.body;
      ctx.beginPath(); ctx.arc(fx, fy + 1, 5, 0, TAU); ctx.fill();
      hooves.push([S.hx + s * fx, G + s * (fy + bob)]);
    };
    leg(-38, -74, 0.0, false, false);
    leg(40, -74, 0.44, true, false);
    // tail
    const tw = Math.sin(TAU * p) * 8 * run;
    ctx.strokeStyle = L.mane || L.body;
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-60, -98); ctx.quadraticCurveTo(-98, -104 + tw, -128, -72 - run * 22 + tw); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-62, -94); ctx.quadraticCurveTo(-104, -94 + tw, -136, -58 - run * 16 + tw * 1.4); ctx.stroke();
    // body
    ctx.fillStyle = L.body;
    ctx.beginPath(); ctx.ellipse(0, -88, 60, 22, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-36, -92, 31, 27, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(38, -90, 29, 26, 0, 0, TAU); ctx.fill();
    // neck + head
    const r1 = -0.95 + 0.4 * run + Math.sin(TAU * p + 1.6) * 0.09 * run;
    const r2 = 0.95 - 0.25 * run;
    ctx.save();
    ctx.translate(46, -98);
    ctx.rotate(r1);
    ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(62, -10); ctx.lineTo(66, 10); ctx.lineTo(-4, 24); ctx.closePath(); ctx.fill();
    if (L.mane) {
      ctx.strokeStyle = L.mane; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-6, -18); ctx.quadraticCurveTo(30, -20 - 5 * run, 60, -12); ctx.stroke();
    }
    ctx.translate(62, 0);
    ctx.rotate(r2);
    ctx.beginPath(); ctx.ellipse(20, 0, 27, 11, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(42, 2, 9, 9, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, -24); ctx.lineTo(11, -9); ctx.closePath(); ctx.fill();
    ctx.restore();
    // mouth point in body frame, for the reins
    const c1 = Math.cos(r1), s1 = Math.sin(r1);
    const hx0 = 46 + 62 * c1, hy0 = -98 + 62 * s1;
    const c2 = Math.cos(r1 + r2), s2 = Math.sin(r1 + r2);
    const mouth = [hx0 + 40 * c2 - 3 * s2, hy0 + 40 * s2 + 3 * c2];
    if (L.rim && !opt.mirror) {
      ctx.strokeStyle = L.rim; ctx.lineWidth = 3; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.ellipse(0, -90, 60, 22, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-36, -94, 31, 27, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // jockey (adult proportions: small head, long torso, clear riding kit)
    const jb = -bob * 0.6;
    const hip = [4, -118 + jb];
    const sh = [40 - 22 * upright, -130 - 26 * upright + jb];
    const head = [sh[0] + 12 - 6 * upright, sh[1] - 11 - 3 * upright];
    const knee = [26, -106 + jb * 0.5];
    const foot = [16, -92];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = L.breeches || '#f1ede4'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.stroke();
    ctx.strokeStyle = L.boot || '#141414'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(knee[0], knee[1]); ctx.lineTo(foot[0], foot[1]); ctx.stroke();
    ctx.strokeStyle = L.silk1; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(sh[0], sh[1]); ctx.stroke();
    ctx.strokeStyle = L.silk2; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(hip[0] + 4, hip[1] - 2); ctx.lineTo(sh[0] + 2, sh[1] - 1); ctx.stroke();
    const pump = Math.sin(TAU * p) * 5 * run;
    const elbow = [sh[0] + 10, sh[1] + 16];
    const hand = [sh[0] + 28 + pump, sh[1] + 12 - pump * 0.3];
    ctx.strokeStyle = L.silk2; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    ctx.strokeStyle = L.rein || 'rgba(20,14,10,.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(mouth[0], mouth[1]); ctx.stroke();
    ctx.fillStyle = L.skin || '#5a3a26';
    ctx.beginPath(); ctx.arc(head[0], head[1], 8.5, 0, TAU); ctx.fill();
    ctx.fillStyle = L.cap;
    ctx.beginPath(); ctx.arc(head[0], head[1] - 1, 9.5, Math.PI, TAU); ctx.fill();
    ctx.fillRect(head[0], head[1] - 2, 13, 3);
    ctx.fillStyle = 'rgba(20,20,24,.85)';
    ctx.fillRect(head[0] + 2, head[1] + 1, 7, 3);
    leg(-38, -74, 0.1, false, true);
    leg(40, -74, 0.56, true, true);
    ctx.restore();
    return hooves;
  }

  kick(S, hooves, G, rate, o) {
    if (S.dt <= 0 || S.hs < 150) return;
    for (let i = 0; i < hooves.length; i++) {
      const h = hooves[i];
      if (h[1] > G - 12 && Math.random() < rate * S.dt) this.emit(h[0], G - 4, o.n || 1, o);
    }
  }
