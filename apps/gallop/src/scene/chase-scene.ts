// Prime Time Chase: a floodlit steeplechase shot like a TV broadcast (design D8). The camera follows the
// horse; fences sit at fixed course positions with their value above them.
import { Container, Graphics, Sprite, Text, TilingSprite, type Texture } from 'pixi.js';
import { drawHorse, type HorseLook, type HorsePose } from './horse';
import { RES, createChaseTextures, rnd, type ChaseTextures } from './textures';

export const DESIGN_W = 390;
export const DESIGN_H = 844;
export const GROUND_Y = 562;
/** Horse screen x in design px; the course scrolls under it. */
export const HORSE_X = 140;
/** Distance between fences along the course (design px). */
export const FENCE_SPACING = 540;
/** Course position of fence k (1-based); the stand point before fence 1 is course position 0. */
export const fencePosition = (k: number) => 250 + (k - 1) * FENCE_SPACING;
export const standPosition = (k: number) => fencePosition(k) - 250;

const LOOK: HorseLook = {
  body: 0x1b1210,
  far: 0x120b09,
  mane: 0x070404,
  rim: 0xfff4e0,
  silk1: 0xe11d48,
  silk2: 0xf8fafc,
  cap: 0xf8fafc,
  skin: 0x3e271b,
  breeches: 0xf1f5f9,
  boot: 0x141414,
  rein: 0x140e0a,
};

export interface SceneState {
  /** Horse course position (design px). */
  course: number;
  lift: number;
  tilt: number;
  /** Ground speed in design px per second. */
  speed: number;
  pose: HorsePose;
  /** Fence values (paytable); the finish post follows the last fence. */
  paytable: readonly number[];
  /** Fences already cleared this round. */
  cleared: number;
  /** Fence currently refused (shakes), or null. */
  refusedFence: number | null;
  reducedMotion: boolean;
}

interface Layer {
  sprite: TilingSprite;
  factor: number;
}

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export class ChaseScene {
  readonly view = new Container();
  private readonly world = new Container();
  private readonly tex: ChaseTextures;
  private readonly layers: Layer[] = [];
  private readonly stretched: Sprite[] = [];
  private readonly pool: Sprite;
  private readonly lines = new Graphics();
  private readonly fences = new Container();
  private readonly fenceViews: { g: Graphics; label: Text; k: number }[] = [];
  private readonly finish = new Container();
  private readonly shadow = new Graphics();
  private readonly horse = new Graphics();
  private readonly particleLayer = new Container();
  private readonly particles: Particle[] = [];
  private readonly free: Sprite[] = [];
  private readonly foreground: TilingSprite;
  private readonly flashLayer = new Graphics();
  private left = 0;
  private visibleW = DESIGN_W;
  private scale = 1;
  private gait = 0;
  private time = 0;
  private punch = 0;
  private flash = 0;
  private paytableKey = '';
  private shakeT = 0;

  constructor() {
    this.tex = createChaseTextures();
    const t = this.tex;
    this.world.addChild(this.stretch(t.sky, 0, 482));
    this.addLayer(t.bokeh, 130, 260, 0.12);
    this.addLayer(t.crowd, 402, 75, 0.6);
    this.addLayer(t.rail, 475, 30, 0.95);
    this.world.addChild(this.stretch(t.turf, 479, 370));
    this.pool = new Sprite(t.glow);
    this.pool.anchor.set(0.5);
    this.pool.tint = 0xfff0d2;
    this.pool.alpha = 0.28;
    this.pool.width = 520;
    this.pool.height = 420;
    this.pool.position.set(HORSE_X, GROUND_Y);
    this.world.addChild(this.pool, this.lines, this.fences, this.finish, this.shadow, this.horse, this.particleLayer);
    this.foreground = this.addLayer(t.post, 470, 125, 2.6);
    this.foreground.alpha = 0;
    this.world.addChild(this.flashLayer);
    this.view.addChild(this.world);
    this.buildFinish();
  }

  private stretch(texture: Texture, y: number, h: number): Sprite {
    const s = new Sprite(texture);
    s.y = y;
    s.height = h;
    this.stretched.push(s);
    return s;
  }

  private addLayer(texture: Texture, y: number, h: number, factor: number): TilingSprite {
    const sprite = new TilingSprite({ texture, width: DESIGN_W, height: h });
    sprite.tileScale.set(1 / RES);
    sprite.y = y;
    this.world.addChild(sprite);
    this.layers.push({ sprite, factor });
    return sprite;
  }

  private buildFinish() {
    const pole = new Graphics().rect(-5, -230, 10, 230).fill(0xffffff);
    const disc = new Graphics().circle(0, -230, 24).fill(0xe11d48);
    const label = new Text({ text: 'FIN', style: { fontFamily: "'Barlow Condensed', sans-serif", fontStyle: 'italic', fontWeight: '900', fontSize: 16, fill: 0xffffff } });
    label.anchor.set(0.5);
    label.position.set(0, -230);
    this.finish.addChild(pole, disc, label);
  }

  private ensureFences(paytable: readonly number[]) {
    const key = paytable.join(',');
    if (key === this.paytableKey) return;
    this.paytableKey = key;
    this.fences.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.fenceViews.length = 0;
    paytable.forEach((value, i) => {
      const k = i + 1;
      const g = new Graphics();
      g.poly([-46, 3, -36, -96, 36, -96, 46, 3]).fill(0x123d1c);
      for (let b = 0; b < 16; b++) g.rect(-38 + b * 5, -112 + rnd(b + k) * 12, 2.5, 24).fill(0x1f5a2b);
      g.rect(-54, -38, 108, 7).fill(0xf8fafc);
      const label = new Text({
        text: `x${value.toFixed(2)}`,
        style: { fontFamily: "'Barlow Condensed', sans-serif", fontStyle: 'italic', fontWeight: '900', fontSize: 19, fill: 0xffffff, dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.8, angle: 0 } },
      });
      label.anchor.set(0.5, 1);
      label.position.set(0, -122);
      const holder = new Container();
      holder.addChild(g, label);
      this.fences.addChild(holder);
      this.fenceViews.push({ g, label, k });
    });
  }

  layout(width: number, height: number) {
    this.scale = height / DESIGN_H;
    this.visibleW = Math.max(DESIGN_W, width / this.scale);
    this.left = -(this.visibleW - DESIGN_W) / 2;
    this.world.scale.set(this.scale);
    this.world.x = width / 2 - (DESIGN_W / 2) * this.scale;
    for (const s of this.stretched) {
      s.x = this.left;
      s.width = this.visibleW;
    }
    for (const l of this.layers) {
      l.sprite.x = this.left;
      l.sprite.width = this.visibleW;
    }
  }

  /** Landing punch and turf burst after a cleared fence. */
  landed(reducedMotion: boolean) {
    this.punch = reducedMotion ? 0 : 1;
    const n = reducedMotion ? 4 : 18;
    for (let i = 0; i < n; i++) this.spawn(HORSE_X + 30, GROUND_Y - 3, 0x335c2a, 520, 500);
  }

  /** Shakes the refused fence briefly. */
  refused() {
    this.shakeT = 0.6;
  }

  /** Win flash, only for returns above the stake. */
  winFlash(reducedMotion: boolean) {
    this.flash = reducedMotion ? 0.3 : 1;
  }

  update(dtSeconds: number, s: SceneState) {
    const dt = Math.min(0.05, dtSeconds);
    this.time += dt;
    this.ensureFences(s.paytable);
    this.shakeT = Math.max(0, this.shakeT - dt);
    const scroll = s.course;
    const run = Math.min(1, s.speed / 220);
    this.gait += dt * (s.lift > 0 ? 0 : s.speed > 30 ? 1.3 + s.speed / 200 : s.pose === 'upright' ? 0.25 : 0.5);

    for (const l of this.layers) l.sprite.tilePosition.x = -this.left - scroll * l.factor;
    this.foreground.alpha = Math.min(1, s.speed / 260) * (s.reducedMotion ? 0.4 : 1);

    this.lines.clear();
    const lineCount = Math.floor(22 * Math.min(1, s.speed / 280));
    for (let i = 0; i < lineCount; i++) {
      const len = 40 + rnd(i * 2) * 60;
      const span = this.visibleW + len;
      const raw = rnd(i * 3) * span - scroll * (1.6 + rnd(i) * 1.2);
      const x = this.left + (((raw % span) + span) % span) - len;
      this.lines.rect(x, 490 + rnd(i) * 110, len, 1 + rnd(i * 7) * 1.5).fill({ color: 0xcfe8c9, alpha: 0.15 + 0.4 * rnd(i * 5) });
    }

    for (const f of this.fenceViews) {
      const holder = f.g.parent!;
      const shake = s.refusedFence === f.k && !s.reducedMotion ? Math.sin(this.time * 60) * 3 * (this.shakeT / 0.6) : 0;
      holder.position.set(HORSE_X + fencePosition(f.k) - scroll + shake, GROUND_Y);
      holder.alpha = f.k <= s.cleared ? 0.55 : 1;
    }
    this.finish.position.set(HORSE_X + fencePosition(s.paytable.length) + FENCE_SPACING * 0.6 - scroll, GROUND_Y);

    this.shadow.clear().ellipse(HORSE_X, GROUND_Y + 4, 70 - s.lift * 0.12, 6).fill({ color: 0x000000, alpha: 0.45 });
    this.horse.clear();
    this.horse.position.set(0, -s.lift);
    this.horse.pivot.set(0, 0);
    this.horse.rotation = 0;
    const hooves = drawHorse(this.horse, { gait: s.lift > 0 ? 0.3 : this.gait, run: s.lift > 0 ? 1 : run, pose: s.pose, x: HORSE_X, groundY: GROUND_Y, scale: 0.88 }, LOOK);
    this.applyTilt(s.tilt);
    if (s.lift === 0 && s.speed > 60) {
      for (const [hx, hy] of hooves) if (hy > GROUND_Y - 6 && Math.random() < 2.5 * dt * (s.speed / 200)) this.spawn(hx, GROUND_Y - 2, 0x2a3a20, 260, 330);
    }
    this.stepParticles(dt, s.speed, s.reducedMotion);

    this.punch = Math.max(0, this.punch - dt * 2.5);
    const z = 1 + 0.05 * this.punch;
    this.world.scale.set(this.scale * z);
    this.world.pivot.set(this.punch > 0 && !s.reducedMotion ? (Math.random() - 0.5) * 5 * this.punch : 0, (z - 1) * GROUND_Y * 0.3);

    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.flashLayer.clear();
    if (this.flash > 0) this.flashLayer.rect(this.left, 0, this.visibleW, DESIGN_H).fill({ color: 0xffffff, alpha: this.flash * 0.7 });
  }

  private applyTilt(tilt: number) {
    const cx = HORSE_X;
    const cy = GROUND_Y - 75;
    this.horse.pivot.set(cx, cy);
    this.horse.position.x = cx;
    this.horse.position.y += cy;
    this.horse.rotation = tilt;
  }

  private spawn(x: number, y: number, tint: number, spread: number, lift: number) {
    if (this.particles.length > 160) return;
    const sprite = this.free.pop() ?? new Sprite(this.tex.dot);
    sprite.tint = tint;
    sprite.width = sprite.height = 2 + Math.random() * 2.5;
    sprite.position.set(x + (Math.random() - 0.5) * 10, y);
    sprite.alpha = 0.95;
    this.particleLayer.addChild(sprite);
    this.particles.push({ sprite, vx: -90 + (Math.random() - 0.5) * spread * 0.5, vy: -Math.random() * lift, life: 0, max: 0.5 + Math.random() * 0.5 });
  }

  private stepParticles(dt: number, speed: number, reduced: boolean) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      p.vy += 850 * dt;
      p.sprite.x += (p.vx - speed * 0.6) * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = 0.95 * Math.max(0, 1 - p.life / p.max);
      if (p.life >= p.max || (reduced && i > 60)) {
        this.particleLayer.removeChild(p.sprite);
        this.free.push(p.sprite);
        this.particles.splice(i, 1);
      }
    }
  }

  destroy() {
    for (const t of Object.values(this.tex)) t.destroy(true);
    this.view.destroy({ children: true });
  }
}
