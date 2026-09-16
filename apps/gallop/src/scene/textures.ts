// Static art for the Prime Time Chase scene, drawn once into canvases and uploaded as textures so each
// frame only moves sprites. Coordinates are design px (390 x 844 portrait); canvases are drawn at 2x.
import { Texture } from 'pixi.js';

export const RES = 2;

/** Deterministic pseudo-random in [0, 1) so tiles look the same every load. */
export const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * RES);
  canvas.height = Math.ceil(height * RES);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.scale(RES, RES);
  draw(ctx);
  return Texture.from(canvas);
}

export const TILE = { bokeh: 260, crowd: 216, rail: 48, posts: 700, fence: 150 } as const;

export interface ChaseTextures {
  sky: Texture;
  bokeh: Texture;
  crowd: Texture;
  rail: Texture;
  turf: Texture;
  glow: Texture;
  post: Texture;
  dot: Texture;
}

export function createChaseTextures(): ChaseTextures {
  const sky = canvasTexture(4, 510, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 510);
    g.addColorStop(0, '#030712');
    g.addColorStop(1, '#172036');
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 510);
  });

  // Out-of-focus floodlights: soft discs, wrapped across the tile edge for seamless tiling.
  const bokeh = canvasTexture(TILE.bokeh, 260, (c) => {
    for (let i = 0; i < 3; i++) {
      const r = 30 + rnd(i) * 35;
      const x = rnd(i * 5) * TILE.bokeh;
      const y = 60 + rnd(i * 3) * 130;
      for (const dx of [-TILE.bokeh, 0, TILE.bokeh]) {
        const g = c.createRadialGradient(x + dx, y, 2, x + dx, y, r);
        g.addColorStop(0, 'rgba(255,250,235,.55)');
        g.addColorStop(0.5, 'rgba(255,240,210,.18)');
        g.addColorStop(1, 'rgba(255,240,210,0)');
        c.fillStyle = g;
        c.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
  });

  const crowd = canvasTexture(TILE.crowd, 75, (c) => {
    c.fillStyle = '#1c2438';
    c.fillRect(0, 0, TILE.crowd, 75);
    const colours = ['#e11d48', '#f8fafc', '#fbbf24', '#38bdf8', '#334155'];
    for (let i = 0; i < TILE.crowd / 9; i++) {
      c.globalAlpha = 0.35;
      c.fillStyle = colours[Math.floor(rnd(i) * colours.length)]!;
      c.fillRect(i * 9, 10 + rnd(i * 4) * 50, 7, 4.5);
    }
    c.globalAlpha = 1;
  });

  const rail = canvasTexture(TILE.rail, 30, (c) => {
    c.fillStyle = '#f1f5f9';
    c.fillRect(0, 0, TILE.rail, 4);
    c.fillRect(0, 0, 3, 26);
  });

  const turf = canvasTexture(4, 340, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 340);
    g.addColorStop(0, '#2f5d34');
    g.addColorStop(1, '#0d1f10');
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 340);
  });

  const glow = canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });

  // Foreground rail posts, motion-blurred horizontally, one per tile.
  const post = canvasTexture(TILE.posts, 125, (c) => {
    const g = c.createLinearGradient(0, 0, 90, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 90, 125);
  });

  const dot = canvasTexture(8, 8, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 8, 8);
  });

  return { sky, bokeh, crowd, rail, turf, glow, post, dot };
}
