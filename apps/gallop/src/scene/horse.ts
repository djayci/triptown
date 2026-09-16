// Vector placeholder for the horse and adult jockey, ported from the design canvas
// (design/night-gallop/src/engine.js). Production art is pre-rendered sprite sheets (design D5).
import { Graphics } from 'pixi.js';

type Mat = [number, number, number, number, number, number]; // a b c d tx ty

export interface HorseLook {
  body: number;
  far: number;
  mane: number;
  rim: number;
  silk1: number;
  silk2: number;
  cap: number;
  skin: number;
  breeches: number;
  boot: number;
  rein: number;
}

export const NIGHT_LOOK: HorseLook = {
  body: 0x171010,
  far: 0x0e0909,
  mane: 0x050303,
  rim: 0xdff1ff,
  silk1: 0xffb23e,
  silk2: 0x16b8a6,
  cap: 0x16b8a6,
  skin: 0x3e271b,
  breeches: 0xe9ecf5,
  boot: 0x141414,
  rein: 0x140e0a,
};

export type HorsePose = 'running' | 'upright' | 'easing';

const TAU = Math.PI * 2;

/** Draws through a transform stack so the canvas prototype's nested frames carry over. */
class Pen {
  private m: Mat = [1, 0, 0, 1, 0, 0];
  private stack: Mat[] = [];
  constructor(readonly g: Graphics) {}
  save() {
    this.stack.push([...this.m]);
  }
  restore() {
    this.m = this.stack.pop() ?? [1, 0, 0, 1, 0, 0];
  }
  translate(x: number, y: number) {
    const [a, b, c, d, tx, ty] = this.m;
    this.m = [a, b, c, d, tx + a * x + c * y, ty + b * x + d * y];
  }
  rotate(r: number) {
    const [a, b, c, d, tx, ty] = this.m;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    this.m = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin, tx, ty];
  }
  scale(s: number) {
    const [a, b, c, d, tx, ty] = this.m;
    this.m = [a * s, b * s, c * s, d * s, tx, ty];
  }
  private get unit() {
    return Math.hypot(this.m[0], this.m[1]);
  }
  pt(x: number, y: number): [number, number] {
    const [a, b, c, d, tx, ty] = this.m;
    return [a * x + c * y + tx, b * x + d * y + ty];
  }
  line(points: number[], width: number, color: number, alpha = 1) {
    const [x0, y0] = this.pt(points[0]!, points[1]!);
    this.g.moveTo(x0, y0);
    for (let i = 2; i < points.length; i += 2) {
      const [x, y] = this.pt(points[i]!, points[i + 1]!);
      this.g.lineTo(x, y);
    }
    this.g.stroke({ width: width * this.unit, color, alpha, cap: 'round', join: 'round' });
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, color: number) {
    const pts: number[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      pts.push(...this.pt(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
    }
    this.g.poly(pts).fill(color);
  }
  arcStroke(cx: number, cy: number, rx: number, ry: number, from: number, to: number, width: number, color: number, alpha: number) {
    const pts: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = from + ((to - from) * i) / 10;
      pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    this.line(pts, width, color, alpha);
  }
  poly(points: number[], color: number) {
    const out: number[] = [];
    for (let i = 0; i < points.length; i += 2) out.push(...this.pt(points[i]!, points[i + 1]!));
    this.g.poly(out).fill(color);
  }
}

export interface HorseFrame {
  /** Gait phase in cycles. */
  gait: number;
  /** 0..1 how hard the horse is running. */
  run: number;
  pose: HorsePose;
  x: number;
  groundY: number;
  scale: number;
}

/** Redraws the horse into `g`; returns hoof positions in design px for dirt kick-up. */
export function drawHorse(g: Graphics, f: HorseFrame, L: HorseLook = NIGHT_LOOK): [number, number][] {
  const pen = new Pen(g);
  const p = f.gait;
  const run = f.run;
  const bob = -Math.abs(Math.sin(TAU * p)) * 7 * run;
  const pitch = Math.sin(TAU * p + 0.8) * 0.045 * run;
  const upright = f.pose === 'running' ? 0 : f.pose === 'easing' ? 1 - run : 0.35;
  const hooves: [number, number][] = [];
  pen.translate(f.x, f.groundY);
  pen.scale(f.scale);
  pen.translate(0, bob);
  pen.rotate(pitch);
  const amp = 0.18 + 0.5 * run;

  const leg = (hx: number, hy: number, ph: number, front: boolean, near: boolean) => {
    const th = TAU * (p + ph);
    const a = amp * Math.sin(th);
    const fold = Math.max(0, Math.cos(th)) * (front ? 1.5 : 1.0) * (0.3 + 0.7 * run);
    const kx = hx + Math.sin(a) * 36;
    const ky = hy + Math.cos(a) * 36;
    const a2 = a - fold;
    const fx = kx + Math.sin(a2) * 40;
    const fy = ky + Math.cos(a2) * 40;
    const color = near ? L.body : L.far;
    pen.line([hx, hy, kx, ky], near ? (front ? 12 : 15) : front ? 10 : 13, color);
    pen.line([kx, ky, fx, fy], near ? 7 : 6, color);
    pen.ellipse(fx, fy + 1, 5, 5, L.body);
    hooves.push(pen.pt(fx, fy));
  };

  leg(-38, -74, 0.0, false, false);
  leg(40, -74, 0.44, true, false);

  const tw = Math.sin(TAU * p) * 8 * run;
  pen.line([-60, -98, -98, -104 + tw, -128, -72 - run * 22 + tw], 10, L.mane);
  pen.line([-62, -94, -104, -94 + tw, -136, -58 - run * 16 + tw * 1.4], 5, L.mane);

  pen.ellipse(0, -88, 60, 22, L.body);
  pen.ellipse(-36, -92, 31, 27, L.body);
  pen.ellipse(38, -90, 29, 26, L.body);

  const r1 = -0.95 + 0.4 * run + Math.sin(TAU * p + 1.6) * 0.09 * run;
  const r2 = 0.95 - 0.25 * run;
  pen.save();
  pen.translate(46, -98);
  pen.rotate(r1);
  pen.poly([-8, -18, 62, -10, 66, 10, -4, 24], L.body);
  pen.line([-6, -18, 30, -20 - 5 * run, 60, -12], 6, L.mane);
  pen.translate(62, 0);
  pen.rotate(r2);
  pen.ellipse(20, 0, 27, 11, L.body);
  pen.ellipse(42, 2, 9, 9, L.body);
  pen.poly([0, -8, 4, -24, 11, -9], L.body);
  const mouth = pen.pt(40, 3);
  pen.restore();

  pen.arcStroke(0, -90, 60, 22, Math.PI * 1.08, Math.PI * 1.92, 3, L.rim, 0.75);
  pen.arcStroke(-36, -94, 31, 27, Math.PI * 1.1, Math.PI * 1.7, 3, L.rim, 0.75);

  // Adult jockey: small head, long torso, full riding kit.
  const jb = -bob * 0.6;
  const hip = [4, -118 + jb] as const;
  const sh = [40 - 22 * upright, -130 - 26 * upright + jb] as const;
  const head = [sh[0] + 12 - 6 * upright, sh[1] - 11 - 3 * upright] as const;
  const knee = [26, -106 + jb * 0.5] as const;
  const foot = [16, -92] as const;
  pen.line([hip[0], hip[1], knee[0], knee[1]], 11, L.breeches);
  pen.line([knee[0], knee[1], foot[0], foot[1]], 8, L.boot);
  pen.line([hip[0], hip[1], sh[0], sh[1]], 18, L.silk1);
  pen.line([hip[0] + 4, hip[1] - 2, sh[0] + 2, sh[1] - 1], 6, L.silk2);
  const pump = Math.sin(TAU * p) * 5 * run;
  const hand = [sh[0] + 28 + pump, sh[1] + 12 - pump * 0.3] as const;
  pen.line([sh[0], sh[1], sh[0] + 10, sh[1] + 16, hand[0], hand[1]], 7, L.silk2);
  const [hx, hy] = pen.pt(hand[0], hand[1]);
  g.moveTo(hx, hy).lineTo(mouth[0], mouth[1]).stroke({ width: 1.6 * f.scale, color: L.rein });
  pen.ellipse(head[0], head[1], 8.5, 8.5, L.skin);
  pen.poly([head[0] - 9.5, head[1] - 1, head[0] - 7, head[1] - 8, head[0], head[1] - 10.5, head[0] + 7, head[1] - 8, head[0] + 9.5, head[1] - 1], L.cap);
  pen.poly([head[0], head[1] - 2, head[0] + 13, head[1] - 2, head[0] + 13, head[1] + 1, head[0], head[1] + 1], L.cap);
  pen.poly([head[0] + 2, head[1] + 1, head[0] + 9, head[1] + 1, head[0] + 9, head[1] + 4, head[0] + 2, head[1] + 4], 0x141418);

  leg(-38, -74, 0.1, false, true);
  leg(40, -74, 0.56, true, true);
  return hooves;
}
