import { Container, Graphics, type Ticker } from 'pixi.js';
import { prefersReducedMotion } from './motion';

interface Piece {
  g: Graphics;
  vx: number;
  vy: number;
  spin: number;
  life: number;
}

export interface ConfettiOptions {
  x: number;
  y: number;
  count?: number;
  colors?: number[];
  speed?: number;
  outline?: number;
}

/**
 * Lightweight confetti emitter drawn with Graphics (no extra plugin).
 * Does nothing when reduced motion is on.
 */
export class Confetti extends Container {
  private pieces: Piece[] = [];
  private readonly tick = (t: Ticker) => this.update(t.deltaMS / 1000);

  constructor(private readonly ticker: Ticker) {
    super();
    this.eventMode = 'none';
    ticker.add(this.tick);
  }

  /** Returns the number of pieces spawned (0 under reduced motion). */
  burst(opts: ConfettiOptions): number {
    if (prefersReducedMotion()) return 0;
    const colors = opts.colors ?? [0xff3d8b, 0x3ec6ff, 0x7ed957, 0xfff4d6, 0x8b5cf6, 0xffe14d];
    const count = opts.count ?? 60;
    const speed = opts.speed ?? 900;
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const color = colors[i % colors.length]!;
      if (i % 3 === 0) g.circle(0, 0, 6).fill(color).stroke({ width: 2.5, color: opts.outline ?? 0x1d1424 });
      else g.roundRect(-5, -9, 10, 18, 3).fill(color).stroke({ width: 2.5, color: opts.outline ?? 0x1d1424 });
      g.position.set(opts.x, opts.y);
      g.rotation = Math.random() * Math.PI;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const v = speed * (0.45 + Math.random() * 0.55);
      this.pieces.push({ g, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, spin: (Math.random() - 0.5) * 12, life: 2.2 + Math.random() });
      this.addChild(g);
    }
    return count;
  }

  get active(): number {
    return this.pieces.length;
  }

  private update(dt: number) {
    if (!this.pieces.length) return;
    const gravity = 1400;
    this.pieces = this.pieces.filter((p) => {
      p.vy += gravity * dt;
      p.vx *= 0.985;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.rotation += p.spin * dt;
      p.life -= dt;
      if (p.life < 0.4) p.g.alpha = Math.max(0, p.life / 0.4);
      if (p.life > 0) return true;
      p.g.destroy();
      return false;
    });
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.ticker.remove(this.tick);
    super.destroy(options);
  }
}
