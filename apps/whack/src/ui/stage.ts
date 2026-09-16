import { Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js';
import { gsap, prefersReducedMotion } from '@triptown/engine';
import { COLORS, METER_COLORS } from '../theme';
import { drawSticker, labelStyle, text } from './primitives';

export type Frames = (name: string) => Texture;

/** Hole height the mole is clipped to (hole centerline + lip depth), in hole units. */
const CLIP_BOTTOM = 266;
export const RISE_FULL = 10;
export const RISE_HIDDEN = 266;

export type MoleFrame =
  | 'mole-gold-happy'
  | 'mole-gold-shock'
  | 'mole-gold-dizzy'
  | 'mole-gold-sleep'
  | 'mole-bad-angry'
  | 'mole-decoy-happy'
  | 'mole-decoy-shock'
  | 'mole-decoy-sleep';

/**
 * A hole in 280×320 local units: dark back, a masked mole that rises from it, grass lip in front.
 * `rise` is the mole's top offset (10 = fully out, 266 = hidden).
 */
export class Hole extends Container {
  readonly mole: Sprite;
  private readonly moleLayer = new Container();
  private riseValue = RISE_HIDDEN;

  constructor(frames: Frames, frame: MoleFrame | null) {
    super();
    const back = new Sprite(frames('hole-back'));
    back.position.set(4, 222);
    const lip = new Sprite(frames('hole-lip'));
    lip.position.set(-12, 222);
    this.mole = new Sprite(frames(frame ?? 'mole-decoy-happy'));
    this.mole.visible = frame !== null;
    this.mole.x = 40;
    const mask = new Graphics().rect(20, -60, 240, CLIP_BOTTOM + 60).fill(0xffffff);
    this.moleLayer.addChild(this.mole);
    this.moleLayer.mask = mask;
    this.addChild(back, this.moleLayer, mask, lip);
    this.rise = RISE_HIDDEN;
  }

  get rise() {
    return this.riseValue;
  }

  set rise(v: number) {
    this.riseValue = v;
    this.mole.y = v;
  }

  setFrame(frames: Frames, frame: MoleFrame | null) {
    this.mole.visible = frame !== null;
    if (frame) this.mole.texture = frames(frame);
  }

  riseTo(target: number, duration = 0.35, ease = 'back.out(1.6)') {
    gsap.killTweensOf(this);
    return gsap.to(this, { rise: target, duration, ease });
  }
}

export type StageMood = 'sun' | 'lime' | 'coral';

const MOODS: Record<StageMood, [number, number]> = {
  sun: [COLORS.sun, COLORS.sun2],
  lime: [COLORS.lime, COLORS.lime2],
  coral: [COLORS.coral, COLORS.coral2],
};

/** Sticker-framed stage with slowly spinning sunburst rays and a content layer clipped to its shape. */
export class Stage extends Container {
  readonly content = new Container();
  private readonly frame = new Graphics();
  private readonly base = new Graphics();
  private readonly rays = new Graphics();
  private readonly hazard = new Graphics();
  private readonly clip = new Graphics();
  private readonly inner = new Container();
  private w = 358;
  private h = 542;
  private mood: StageMood = 'sun';
  private readonly spin = (t: Ticker) => {
    // Eased towards the target so the ramp reads as building speed, not as steps.
    // Winds up over ~150 ms, but drops back in ~80 ms so a finished round settles before the next one.
    this.spinNow += (this.speed - this.spinNow) * Math.min(1, t.deltaMS / (this.speed > this.spinNow ? 150 : 80));
    // A wound-down round comes to a full stop instead of drifting forever.
    if (this.speed === 0 && this.spinNow < 0.005) this.spinNow = 0;
    // Front-loaded curve (pace^0.5): most rounds bust in the first seconds, so the rays are already
    // racing by then — about 50°/s half a second in, 90°/s at three seconds, 150°/s at full pace. The
    // last stretch to zero is eased by `gate` while winding down, so the rays glide to a standstill.
    // A running round never uses the gate: it opens at the curve's floor (~26°/s), never from still.
    const gate = this.speed === 0 ? Math.min(1, this.spinNow / 0.1) : 1;
    if (!prefersReducedMotion() && this.spinNow > 0) {
      this.rays.rotation += (t.deltaMS * (0.45 + 2.2 * this.spinNow ** 0.5) * gate) / 1000;
    }
  };
  /** Target pace, 0..1. */
  speed = 0;
  private spinNow = 0;

  /** Starts the rays at `pace` with no wind-up, so a round opens already moving. */
  spinFrom(pace: number) {
    this.speed = this.spinNow = pace;
  }

  constructor(private readonly ticker: Ticker) {
    super();
    this.hazard.alpha = 0;
    this.inner.addChild(this.base, this.rays, this.hazard, this.content);
    this.inner.mask = this.clip;
    this.addChild(this.frame, this.inner, this.clip);
    ticker.add(this.spin);
    this.redraw();
  }

  get size() {
    return { width: this.w, height: this.h };
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.redraw();
  }

  setMood(mood: StageMood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.redrawRays();
  }

  flashHazard(duration = 1.1) {
    gsap.killTweensOf(this.hazard);
    this.hazard.alpha = 1;
    gsap.to(this.hazard, { alpha: 0, duration, ease: 'power2.in', delay: 0.4 });
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.ticker.remove(this.spin);
    super.destroy(options);
  }

  private redraw() {
    const { w, h } = this;
    drawSticker(this.frame, w, h, { fill: COLORS.ink, radius: 28, border: 5, shadow: 6 });
    this.clip.clear().roundRect(5, 5, w - 10, h - 10, 24).fill(0xffffff);
    this.hazard.clear();
    for (let x = -h; x < w + h; x += 32) {
      this.hazard.poly([x, 0, x + 16, 0, x + 16 + h, h, x + h, h]).fill({ color: COLORS.violet, alpha: 0.28 });
    }
    this.redrawRays();
  }

  private redrawRays() {
    const { w, h } = this;
    const [a, b] = MOODS[this.mood];
    this.base.clear().rect(0, 0, w, h).fill(a);
    const cx = w / 2;
    const cy = h * 0.42;
    const r = Math.hypot(w, h);
    this.rays.clear();
    this.rays.position.set(cx, cy);
    const step = (Math.PI * 2) / 40;
    for (let i = 0; i < 40; i += 2) {
      const a0 = i * step;
      const a1 = a0 + step;
      this.rays.poly([0, 0, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r]).fill(b);
    }
  }
}

/** Ten-segment speed meter: CALM … FRENZY. */
export class Meter extends Container {
  private readonly bg = new Graphics();
  private readonly segs = new Graphics();
  private readonly left = text('CALM', labelStyle(10));
  private readonly right = text('FAST', labelStyle(10, COLORS.pink));
  private level = -1;

  constructor(private w = 326) {
    super();
    this.left.alpha = 0.55;
    this.left.anchor.set(0, 0.5);
    this.right.anchor.set(1, 0.5);
    this.addChild(this.bg, this.segs, this.left, this.right);
    this.redraw();
  }

  resize(w: number) {
    this.w = w;
    this.redraw();
  }

  set(level10: number, name: string) {
    if (level10 === this.level && this.right.text === name) return;
    this.level = level10;
    this.right.text = name;
    this.drawSegments();
  }

  private redraw() {
    drawSticker(this.bg, this.w, 40, { fill: COLORS.cream, radius: 14, border: 4, shadow: 4 });
    this.left.position.set(12, 20);
    this.right.position.set(this.w - 12, 20);
    this.drawSegments();
  }

  private drawSegments() {
    const x0 = 56;
    const x1 = this.w - 64;
    const gap = 3;
    const segW = (x1 - x0 - gap * 9) / 10;
    this.segs.clear();
    METER_COLORS.forEach((c, i) => {
      this.segs
        .roundRect(x0 + i * (segW + gap), 13, segW, 14, 4)
        .fill(i < this.level ? c : COLORS.meterOff)
        .stroke({ width: 2.5, color: COLORS.ink });
    });
  }
}
