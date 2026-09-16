  cfg() {
    return {
      horseX: 360,
      rounds: [{ collectAt: 6.9 }, { crashAt: 4.3 }],
      hud: {
        btnBg: '#e2601f', btnFg: '#fff6e8', btnIdleBg: 'rgba(255,246,232,.14)', btnIdleFg: '#f6e7d0',
        winBg: '#e2601f', winFg: '#fff6e8', lossBg: 'rgba(42,26,16,.86)', lossFg: '#f6e7d0',
      },
    };
  }

  drawScene(ctx, S) {
    const W = S.W, H = S.H, G = 1216, k = S.k;
    let gr = ctx.createLinearGradient(0, 0, 0, 1050);
    gr.addColorStop(0, '#c9a47c'); gr.addColorStop(0.5, '#e6caa2'); gr.addColorStop(1, '#e6b47e');
    ctx.fillStyle = gr; ctx.fillRect(-20, -20, W + 40, 1070);
    // sun through the haze
    const rg = ctx.createRadialGradient(560, 690, 8, 560, 690, 460);
    rg.addColorStop(0, 'rgba(255,250,236,1)'); rg.addColorStop(0.17, 'rgba(255,244,222,.9)');
    rg.addColorStop(0.19, 'rgba(255,236,204,.4)'); rg.addColorStop(1, 'rgba(255,236,204,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 200, W, 1000);
    // far grandstand + neem trees
    this.tile(S, 0.05, 700, (x, i) => {
      ctx.fillStyle = 'rgba(146,104,70,.38)';
      ctx.fillRect(x + 40, 900, 320, 110);
      ctx.beginPath(); ctx.moveTo(x + 20, 905); ctx.lineTo(x + 380, 870); ctx.lineTo(x + 380, 885); ctx.lineTo(x + 20, 920); ctx.fill();
      for (let j = 0; j < 4; j++) {
        const tx = x + 440 + j * 60 + this.rnd(i * 7 + j) * 30, ty = 930 - this.rnd(i + j * 3) * 50;
        ctx.fillStyle = 'rgba(128,96,64,.34)';
        ctx.beginPath(); ctx.arc(tx, ty, 44 + this.rnd(i * 3 + j) * 26, 0, 6.28); ctx.fill();
        ctx.fillRect(tx - 4, ty, 8, 1010 - ty);
      }
    });
    // crowd band on the far side
    ctx.fillStyle = '#b07d52'; ctx.fillRect(-20, 990, W + 40, 60);
    this.tile(S, 0.32, 26, (x, i) => {
      const hue = ['#7b3f24', '#e9d5b5', '#35507a', '#c2562a', '#f0b64a', '#2d2a26'][Math.floor(this.rnd(i) * 6)];
      const jump = Math.max(0, Math.sin(S.t * 9 + i)) * 5 * k;
      ctx.fillStyle = hue; ctx.fillRect(x, 1006 - jump, 14, 20);
      ctx.fillStyle = '#4a2c1a'; ctx.beginPath(); ctx.arc(x + 7, 1000 - jump, 6, 0, 6.28); ctx.fill();
    });
    // far rail
    ctx.fillStyle = '#fbf3e6'; ctx.fillRect(-20, 1046, W + 40, 8);
    this.tile(S, 0.9, 96, (x) => { ctx.fillRect(x, 1046, 6, 42); });
    // sand track
    gr = ctx.createLinearGradient(0, 1060, 0, H);
    gr.addColorStop(0, '#d7a372'); gr.addColorStop(1, '#9a5a34');
    ctx.fillStyle = gr; ctx.fillRect(-20, 1088, W + 40, H);
    ctx.fillStyle = 'rgba(110,62,32,.22)';
    this.tile(S, 1, 130, (x, i) => {
      const y = 1110 + this.rnd(i) * 560;
      const len = (40 + this.rnd(i * 2) * 120) * (1 + 2.5 * k);
      ctx.fillRect(x, y, len, 3 + this.rnd(i * 5) * 3);
    });
    // shadow + dust behind
    ctx.fillStyle = 'rgba(80,42,20,.28)';
    ctx.beginPath(); ctx.ellipse(S.hx, G + 6, 170, 16, 0, 0, 6.28); ctx.fill();
    const hv = this.horse(ctx, S, {
      body: '#2b1a12', far: '#1e120c', mane: '#150c07', rim: '#ffcf9a',
      silk1: '#e2601f', silk2: '#f6e7d0', cap: '#1d2b53', skin: '#4a2e1e',
    }, G, 2.2);
    this.kick(S, hv, G, 26 + 70 * k, {
      n: S.reduced ? 1 : 2, color: '#e3bf8e', alpha: 0.55, r: 16 + 14 * k, grow: 70 + 90 * k,
      life: 1.1 + 0.8 * k, spread: 120, lift: 90 + 120 * k, vx: -80, world: 0.85,
    });
    this.drawParts(ctx, S);
    // haze thickens with the multiplier only
    ctx.fillStyle = 'rgba(238,208,166,' + (0.08 + 0.22 * k).toFixed(3) + ')';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    // foreground pole whipping past
    if (k > 0.12) {
      this.tile(S, 2.6, 1500, (x) => {
        const pg = ctx.createLinearGradient(x - 60, 0, x + 110, 0);
        pg.addColorStop(0, 'rgba(250,244,232,0)'); pg.addColorStop(0.5, 'rgba(250,244,232,' + (0.55 * k).toFixed(3) + ')'); pg.addColorStop(1, 'rgba(250,244,232,0)');
        ctx.fillStyle = pg; ctx.fillRect(x - 60, 0, 170, H);
      });
    }
    // crash: a harmattan dust wall sweeps the frame
    if (S.phase === 'crash') {
      const sweep = Math.min(1, S.pt / 0.35);
      const edge = W + 200 - sweep * (W + 600);
      const a = S.pt < 0.6 ? 0.94 : Math.max(0.35, 0.94 - (S.pt - 0.6) * 0.5);
      const dg = ctx.createLinearGradient(edge - 200, 0, edge + 200, 0);
      dg.addColorStop(0, 'rgba(226,190,142,0)'); dg.addColorStop(1, 'rgba(226,190,142,' + a + ')');
      ctx.fillStyle = dg; ctx.fillRect(edge - 200, -20, 400, H + 40);
      ctx.fillStyle = 'rgba(226,190,142,' + a + ')';
      ctx.fillRect(edge + 190, -20, W + 400, H + 40);
    }
  }
