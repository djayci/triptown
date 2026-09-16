import { Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js';
import { gsap, prefersReducedMotion } from '@triptown/engine';
import { COLORS, METER_COLORS } from '../theme';
import { drawSticker, labelStyle, text } from './primitives';

export type Frames = (name: string) => Texture;

/** Hole height the mole is clipped to (hole centerline + lip depth), in hole units. */
// The hole's front rim, in hole space: the lip sprite's ellipse (centre, radii).
const RIM_CX = 140;
const RIM_Y = 250;
const RIM_RX = 134;
const RIM_RY = 42;
/** Ray rotation in radians per second: idle drift, round floor, and how much pace adds on top. */
const IDLE_SPIN = 0.09;
const RUN_SPIN_BASE = 0.45;
const RUN_SPIN_RAMP = 2.2;

export const RISE_FULL = 10;
export const RISE_HIDDEN = 300;

export type MoleFrame =
  | 'mole-good-happy'
  | 'mole-gold-smug'
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
    // The mole is clipped by the hole's own shape: everything above the rim line, plus the rim ellipse
    // itself, so the body disappears behind the front lip instead of ending on a straight cut.
    const mask = new Graphics()
      .rect(20, -60, 240, RIM_Y + 60)
      .ellipse(RIM_CX, RIM_Y, RIM_RX, RIM_RY)
      .fill(0xffffff);
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
  /** Good mole wash: lime stripes leaning the other way, so the two modifiers never look alike. */
  private readonly boon = new Graphics();
  private readonly clip = new Graphics();
  private readonly inner = new Container();
  private w = 358;
  private h = 542;
  private mood: StageMood = 'sun';
  private readonly spin = (t: Ticker) => {
    // Winds up over ~150 ms and drops back in ~250 ms, so a finished round settles without snapping.
    const up = this.rateTarget > this.rateNow;
    this.rateNow += (this.rateTarget - this.rateNow) * Math.min(1, t.deltaMS / (up ? 150 : 250));
    if (!prefersReducedMotion()) this.rays.rotation += (t.deltaMS * this.rateNow) / 1000;
  };
  private rateNow = IDLE_SPIN;
  private rateTarget = IDLE_SPIN;

  /** Round pace, 0..1: about 26°/s at the start of a round and 150°/s at full ramp. */
  set speed(pace: number) {
    this.rateTarget = RUN_SPIN_BASE + RUN_SPIN_RAMP * Math.max(0, pace) ** 0.5;
  }

  /** Starts the rays at `pace` with no wind-up, so a round opens already moving. */
  spinFrom(pace: number) {
    this.speed = pace;
    this.rateNow = this.rateTarget;
  }

  /** Slow drift for the betting and result screens: alive, but calm. */
  idleSpin() {
    this.rateTarget = IDLE_SPIN;
  }

  constructor(private readonly ticker: Ticker) {
    super();
    this.hazard.alpha = 0;
    this.boon.alpha = 0;
    this.inner.addChild(this.base, this.rays, this.hazard, this.boon, this.content);
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

  /** Short lime wash for a good mole boost: brighter and quicker than the hazard flash. */
  flashBoon(duration = 0.75) {
    gsap.killTweensOf(this.boon);
    this.boon.alpha = 1;
    gsap.to(this.boon, { alpha: 0, duration, ease: 'power2.in', delay: 0.22 });
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
    this.boon.clear();
    // A lime wash over the whole stage, then broad stripes leaning the other way to the hazard.
    this.boon.rect(0, 0, w, h).fill({ color: COLORS.lime2, alpha: 0.3 });
    for (let x = -h; x < w + h; x += 44) {
      this.boon.poly([x, 0, x + 26, 0, x + 26 - h, h, x - h, h]).fill({ color: COLORS.lime, alpha: 0.55 });
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

/** Ten-segment speed meter: SLOW … FAST. Describes the multiplier's speed, nothing about the player. */
export class Meter extends Container {
  private readonly bg = new Graphics();
  private readonly segs = new Graphics();
  private readonly left = text('SLOW', labelStyle(10));
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
