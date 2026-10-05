import { Container, FillGradient, Graphics, Sprite, type Texture } from 'pixi.js';
import {
  FlockModel,
  GRAZE_FADE_SECONDS,
  H,
  HERO,
  HORIZON,
  W,
  grazerLooksUp,
  grazerX,
  grazers,
  ramView,
  rnd,
  slots,
  strideCadence,
  type Phase,
} from './flock';

export type Frames = (name: string) => Texture;

/** Frames per stride in the atlas (art/art.mjs GAIT_FRAMES). */
const GAIT_FRAMES = 8;
/** Where a ram's feet sit in its frame (art/art.mjs RAM_ANCHOR: box x -135..160, y -178..14). */
const ANCHOR = { x: 135 / 295, y: 178 / 192 };

/** The wolf's size, and how far its nose stays from the hero's, in design px. */
const WOLF_SCALE = 0.95;
export const WOLF_GAP = 55;
/** Nose tips in sprite px at scale 1 (art units 141 and 146 at UNIT 0.5), times the hero's scale. */
const HERO_NOSE = 141 * 0.5 * HERO.scale;
const WOLF_NOSE = 146 * 0.5;

/** The dusk palette from the approved canvas (design/flock/world2.js PAL). */
export const DUSK = {
  sky0: '#141c33',
  sky1: '#3b3550',
  sky2: '#8a4a2c',
  sun: '#ffd79a',
  ridge: 0x1b2036,
  tree: 0x161a2c,
  fence: 0xecdec4,
  dirt0: '#6b4a30',
  dirtMid: '#432d1d',
  dirt1: '#1b1109',
  dirtMark: 0x7a5739,
  dirtMark2: 0x35230f,
  dust: 0xd6b48a,
  /** The colour the multiplier and the money sit on: the sky behind the top of the screen. */
  ground: 0x262840,
} as const;

/** Far flock rams are tinted down to dusk silhouettes; near ones keep their colour. */
const FAR_TINT = [0x6e, 0x76, 0x98] as const;
function depthTint(depth: number): number {
  const c = (i: number) => Math.round(0xff + (FAR_TINT[i]! - 0xff) * depth);
  return (c(0) << 16) | (c(1) << 8) | c(2);
}

/**
 * Flock's scene. It receives the multiplier, the shared pace and what has already happened on screen,
 * and nothing else: never the crash time (flock-mvp spec; `GameStage` in @triptown/crash-client).
 *
 * The hero holds a fixed place in his own lane while the ground, the fence and the hills scroll under the
 * run. Rams join from behind as the value climbs. The wolf exists only after `onCrash`.
 */
export class FlockStage extends Container {
  readonly model = new FlockModel();
  private readonly frames: Frames;
  private reduced = false;
  private effectsOn = true;

  private readonly ridge = new Graphics();
  private readonly trees = new Graphics();
  private readonly fence = new Graphics();
  private readonly marks = new Graphics();
  private readonly haze = new Graphics();
  private readonly streaks = new Graphics();
  private readonly actors = new Container();
  private readonly flockSprites: Sprite[];
  /** The grazing flock on the betting screen: scenery, never counted as the flock (flock.ts `grazers`). */
  private readonly grazeSprites: Sprite[];
  private readonly hero: Sprite;
  private readonly wolf: Sprite;
  private readonly dust: {
    g: Graphics;
    life: number;
    max: number;
    vx: number;
    vy: number;
    r: number;
  }[] = [];
  private readonly dark = new Graphics();
  /** Built with the backdrop: gradients need a browser canvas. */
  private darkFill: FillGradient | null = null;

  private time = 0;
  private cam = 0;
  private gait = 0;
  private pace = 0;
  private wolfT = -1;
  private darkness = 0;
  private dustClock = 0;
  /** Where the camera was when the run set off: the grazing flock stays at that spot, left behind. */
  private camAtStart = 0;
  /** True from the run's start until the next betting screen: the grazers are behind him, not around him. */
  private grazersLeft = false;
  /** When the grazing flock began fading back in, after a round; before the first round it is just there. */
  private grazeFrom = -Infinity;

  /**
   * `backdrop: false` leaves out the gradient sky, ground, haze and dusk, which need a browser canvas. Tests
   * use it; the rams, the wolf and every rule about them are the same either way.
   */
  constructor(frames: Frames, { backdrop = true }: { backdrop?: boolean } = {}) {
    super();
    this.frames = frames;
    if (backdrop) {
      this.addChild(
        this.sky(),
        this.ridge,
        this.trees,
        this.fence,
        this.groundFill(),
        this.marks,
        this.haze,
      );
      this.drawHaze();
      this.darkFill = new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: 'rgba(40,30,24,0)' },
          { offset: 0.5, color: 'rgba(40,30,24,0.8)' },
          { offset: 1, color: 'rgba(10,8,8,0.94)' },
        ],
      });
    }
    this.addChild(this.streaks, this.actors, this.dark);
    this.actors.sortableChildren = true;

    this.flockSprites = slots().map((s) => {
      const sp = new Sprite(frames('flock-stand'));
      sp.anchor.set(ANCHOR.x, ANCHOR.y);
      sp.tint = depthTint(s.depth);
      sp.visible = false;
      sp.zIndex = s.y;
      this.actors.addChild(sp);
      return sp;
    });
    this.grazeSprites = grazers().map((s) => {
      const sp = new Sprite(frames('flock-graze'));
      sp.anchor.set(ANCHOR.x, ANCHOR.y);
      sp.tint = depthTint(s.depth);
      // About half face the other way, as a grazing flock does.
      sp.scale.set(s.ph > 0.55 ? -s.s : s.s, s.s);
      sp.zIndex = s.y - 0.5;
      this.actors.addChild(sp);
      return sp;
    });
    this.hero = new Sprite(frames('hero-stand'));
    this.hero.anchor.set(ANCHOR.x, ANCHOR.y);
    this.hero.position.set(HERO.x, HERO.y);
    this.hero.scale.set(HERO.scale);
    this.hero.zIndex = HERO.y;
    this.wolf = new Sprite(frames('wolf-stand'));
    this.wolf.anchor.set(ANCHOR.x, ANCHOR.y);
    this.wolf.zIndex = HERO.y + 2;
    this.wolf.visible = false;
    for (let i = 0; i < 40; i++) {
      const g = new Graphics().circle(0, 0, 1).fill({ color: DUSK.dust });
      g.visible = false;
      this.dust.push({ g, life: 0, max: 0, vx: 0, vy: 0, r: 0 });
      this.actors.addChild(g);
    }
    this.actors.addChild(this.hero, this.wolf);
    this.paintScroll();
  }

  // ---- GameStage ----------------------------------------------------------

  setMultiplier(multiplier: number): void {
    this.model.setMultiplier(multiplier);
  }

  setEffectsEnabled(on: boolean): void {
    this.effectsOn = on;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  /** The round ended badly. The wolf steps in from ahead; the flock bolts. Nothing led up to this. */
  onCrash(): void {
    this.model.setPhase('crashed');
    this.wolfT = 0;
    this.wolf.visible = true;
  }

  reset(): void {
    // Back from a result: the flock drifts back onto the field. A new round straight from betting keeps it.
    const after = this.model.phase === 'penned' || this.model.phase === 'crashed';
    if (after) this.grazeFrom = this.time;
    this.grazersLeft = false;
    this.model.reset();
    this.wolfT = -1;
    this.wolf.visible = false;
    this.darkness = 0;
    this.pace = 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.model.setPace(this.effectsOn ? this.pace : 0);
    this.model.step(dt);
    const speed = this.model.speed;
    this.cam += speed * dt;
    if (speed > 10) this.gait += dt * strideCadence(speed);
    this.onStride?.(this.model.present(), speed);
    if (this.wolfT >= 0) {
      this.wolfT += dt;
      this.darkness = Math.min(0.75, Math.max(0, this.wolfT - 0.6));
    }
    this.paintScroll();
    this.paintActors();
    this.paintGrazers();
    this.paintDust(dt);
    this.paintDark();
  }

  // ---- Scene cues from the view ---------------------------------------------

  /**
   * Every frame: how many rams are running on screen and how fast. The hooves follow it, so what is heard
   * is what is drawn: the count comes from the multiplier, the speed from elapsed time.
   */
  onStride: ((rams: number, speed: number) => void) | null = null;

  /** The shared controller's pace (elapsed time, 0..1). Drives the run speed; never the flock's size. */
  setPace(pace: number): void {
    this.pace = pace;
  }

  /** The round started. */
  start(): void {
    this.model.reset();
    this.model.setPhase('running');
    // Only he sets off; the grazing flock stays where it stood and the camera leaves it behind.
    this.camAtStart = this.cam;
    // Every round starts from the herd, a replay straight from the result too (the user, 5 Oct 2026): the
    // scene resets with the flock grazing round him, whole, and he sets off from it.
    this.grazersLeft = true;
    this.grazeFrom = -Infinity;
  }

  /** The cash-out settled: the flock pulls up with him. Called only after settlement (flock-mvp D4). */
  pullUp(): void {
    this.model.setPhase('penned');
  }

  get phase(): Phase {
    return this.model.phase;
  }

  /** For demo-build checks: what is on screen. */
  debugScene(): {
    present: number;
    grazing: number;
    wolfVisible: boolean;
    speed: number;
    heroFrame: string;
  } {
    return {
      present: this.model.present(),
      grazing: this.grazeSprites.filter((g) => g.visible).length,
      wolfVisible: this.wolf.visible,
      speed: Math.round(this.model.speed),
      heroFrame: this.heroFrame(),
    };
  }

  // ---- Drawing ------------------------------------------------------------

  private sky(): Container {
    const c = new Container();
    const sky = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: DUSK.sky0 },
        { offset: 0.55, color: DUSK.sky1 },
        { offset: 1, color: DUSK.sky2 },
      ],
    });
    c.addChild(new Graphics().rect(0, 0, W, HORIZON + 2).fill(sky));
    // The sun sits still. Nothing in the sky tracks the round.
    const glow = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 'rgba(255,215,154,1)' },
        { offset: 0.12, color: 'rgba(255,176,92,0.5)' },
        { offset: 1, color: 'rgba(255,176,92,0)' },
      ],
    });
    const sun = new Container();
    sun.addChild(
      new Graphics().circle(136, 247, 200).fill(glow),
      new Graphics().circle(136, 247, 19).fill(DUSK.sun),
    );
    sun.mask = new Graphics().rect(0, 0, W, HORIZON + 2).fill(0xffffff);
    c.addChild(sun, sun.mask);
    // Static rails along the skyline; the posts scroll.
    c.addChild(
      new Graphics()
        .moveTo(0, HORIZON - 12)
        .lineTo(W, HORIZON - 12)
        .moveTo(0, HORIZON - 19)
        .lineTo(W, HORIZON - 19)
        .stroke({ color: DUSK.fence, width: 1.3, alpha: 0.18 }),
    );
    return c;
  }

  private groundFill(): Graphics {
    const dirt = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: DUSK.dirt0 },
        { offset: 0.5, color: DUSK.dirtMid },
        { offset: 1, color: DUSK.dirt1 },
      ],
    });
    return new Graphics().rect(0, HORIZON - 5, W, H - HORIZON + 5).fill(dirt);
  }

  /** Bands of dust between the depth rows, so the far flock sits further away. */
  private drawHaze(): void {
    const band = (y: number, h: number, a: number) => {
      const fill = new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: 'rgba(214,180,138,0)' },
          { offset: 0.5, color: `rgba(214,180,138,${a})` },
          { offset: 1, color: 'rgba(214,180,138,0)' },
        ],
      });
      this.haze.rect(0, y - h, W, h * 2).fill(fill);
    };
    band(300, 31, 0.14);
    band(340, 45, 0.11);
    band(400, 58, 0.08);
    band(480, 70, 0.06);
  }

  /** Hills, trees, fence posts and ground marks, each a repeating tile moved by the camera at its depth. */
  private paintScroll(): void {
    const tile = (factor: number, width: number) =>
      -((((this.cam * factor) % width) + width) % width);
    const r = this.ridge.clear();
    const rx = tile(0.04, 470);
    for (const base of [rx, rx + 470]) {
      r.moveTo(base - 15, HORIZON - 22);
      for (let j = 0; j <= 10; j++) r.lineTo(base + j * 48, HORIZON - 26 - rnd(j * 11 + 3) * 27);
      r.lineTo(base + 490, HORIZON)
        .lineTo(base - 15, HORIZON)
        .closePath();
    }
    r.fill(DUSK.ridge);

    const t = this.trees.clear();
    const tx = tile(0.1, 180);
    for (let k = 0; k < 4; k++) {
      for (let j = 0; j < 2; j++) {
        const x = tx + k * 180 + 35 + j * 85 + rnd(j * 5 + 1) * 30;
        const h = 29 + rnd(j * 3 + 2) * 22;
        t.ellipse(x, HORIZON - h, 15, 10.5).rect(x - 1.75, HORIZON - h, 3.5, h);
      }
    }
    t.fill(DUSK.tree);

    const f = this.fence.clear();
    const fx = tile(0.22, 66);
    for (let x = fx; x < W + 66; x += 66) f.moveTo(x, HORIZON - 21).lineTo(x, HORIZON + 1);
    f.stroke({ color: DUSK.fence, width: 1.3, alpha: 0.3 });

    const m = this.marks.clear();
    const mx = tile(1.1, 450);
    for (const base of [mx, mx + 450]) {
      for (let i = 0; i < 14; i++) {
        const y = HORIZON + 45 + rnd(i) * 500;
        const s = 0.3 + (y - HORIZON) / 450;
        m.ellipse(base + rnd(i * 7) * 450, y, 20 * s, 4.5 * s).fill({
          color: rnd(i * 3) > 0.5 ? DUSK.dirtMark : DUSK.dirtMark2,
          alpha: 0.45,
        });
      }
    }

    // Speed lines on the ground, by pace only. Off with reduced motion or effects off.
    const st = this.streaks.clear();
    const k =
      this.effectsOn && !this.reduced && this.model.phase === 'running'
        ? Math.max(0, (this.pace - 0.1) * 1.4)
        : 0;
    if (k > 0) {
      const sx = tile(1.6, 35);
      let i = Math.floor((this.cam * 1.6) / 35);
      for (let x = sx; x < W + 35; x += 35, i++) {
        const y = HORIZON + 30 + rnd(i * 4.1) * 350;
        const len = 20 + rnd(i * 5.3) * 100 * Math.min(1, k);
        st.moveTo(x, y)
          .lineTo(x + len, y)
          .stroke({
            color: 0xecd6b4,
            width: 0.8 + rnd(i) * 1,
            alpha: (0.08 + rnd(i * 9) * 0.2) * Math.min(1, k),
          });
      }
    }
  }

  private heroFrame(): string {
    const speed = this.model.speed;
    const stopping = this.model.phase === 'penned' || this.model.phase === 'crashed';
    if (speed < 12) return 'hero-stand';
    if (stopping) return 'hero-brake';
    const run = Math.min(1, speed / 720);
    const i = Math.floor((((this.gait % 1) + 1) % 1) * GAIT_FRAMES) % GAIT_FRAMES;
    return `hero-${run < 0.5 ? 'trot' : 'gallop'}-${i}`;
  }

  private paintActors(): void {
    const speed = this.model.speed;
    const run = Math.min(1, speed / 720);
    // The hero: fixed place, his own gait, a little bob with the stride.
    this.hero.texture = this.frames(this.heroFrame());
    const bob =
      speed < 12 || this.reduced
        ? 0
        : -Math.abs(Math.sin(this.gait * Math.PI * 2)) * (1.5 + 4.5 * run);
    this.hero.y = HERO.y + bob;

    const all = slots();
    all.forEach((slot, i) => {
      const sp = this.flockSprites[i]!;
      const v = ramView(slot, this.model.states[i]!, this.time, this.gait, speed, this.reduced);
      if (!v) {
        sp.visible = false;
        return;
      }
      sp.visible = true;
      const frame =
        v.run < 0.05
          ? 'flock-stand'
          : `flock-${v.run < 0.5 ? 'trot' : 'gallop'}-${Math.floor(v.phase * GAIT_FRAMES) % GAIT_FRAMES}`;
      sp.texture = this.frames(frame);
      sp.position.set(
        v.x,
        v.y +
          (this.reduced || v.run < 0.05
            ? 0
            : -Math.abs(Math.sin(v.phase * Math.PI * 2)) * (1 + 4 * v.run) * slot.s),
      );
      sp.scale.set(v.flip ? -slot.s : slot.s, slot.s);
      sp.alpha = v.alpha;
    });

    // The wolf: in from ahead to a stop short of every ram, then it stands. It never closes the gap.
    if (this.wolfT >= 0) {
      // Its nose stops WOLF_GAP px short of his: plainly apart, never a reach or a lunge.
      const stop = HERO.x + HERO_NOSE + WOLF_GAP + WOLF_NOSE * WOLF_SCALE;
      const p = this.reduced ? 1 : Math.min(1, this.wolfT / 0.45);
      const x = W + 80 + (stop - (W + 80)) * (1 - Math.pow(1 - p, 3));
      this.wolf.position.set(x, HERO.y + 2);
      this.wolf.scale.set(-WOLF_SCALE, WOLF_SCALE);
      this.wolf.alpha = this.reduced ? Math.min(1, this.wolfT * 3) : 1;
      this.wolf.texture = this.frames(
        p < 1 ? `wolf-stride-${Math.floor(this.time * 10) % 4}` : 'wolf-stand',
      );
    }
  }

  /**
   * The grazing flock: around him on the betting screen, and left standing as the run sets off. Gone once
   * a round has ended, until the betting screen brings it back. It never runs and is never counted.
   */
  private paintGrazers(): void {
    const phase = this.model.phase;
    const show = phase === 'betting' || (phase === 'running' && this.grazersLeft);
    const shift = phase === 'betting' ? 0 : this.cam - this.camAtStart;
    const fade = Math.min(1, Math.max(0, (this.time - this.grazeFrom) / GRAZE_FADE_SECONDS));
    grazers().forEach((slot, i) => {
      const sp = this.grazeSprites[i]!;
      const x = grazerX(slot, shift);
      sp.visible = show && x > -90 && fade > 0;
      if (!sp.visible) return;
      sp.position.set(x, slot.y);
      sp.alpha = fade;
      const up = !this.reduced && grazerLooksUp(slot, this.time);
      sp.texture = this.frames(up ? 'flock-stand' : 'flock-graze');
    });
  }

  /** Dust kicked up behind him while he runs, heavier with pace. Off with reduced motion or effects off. */
  private paintDust(dt: number): void {
    const running =
      this.model.phase === 'running' && this.model.speed > 100 && this.effectsOn && !this.reduced;
    this.dustClock += dt * (running ? 6 + 30 * this.pace : 0);
    while (this.dustClock >= 1) {
      this.dustClock -= 1;
      const p = this.dust.find((d) => !d.g.visible);
      if (!p) break;
      Object.assign(p, {
        life: 0,
        max: 0.6 + Math.random() * 0.6,
        vx: -20 + (Math.random() - 0.5) * 25,
        vy: -Math.random() * (15 + 20 * this.pace),
        r: 9 + 8 * this.pace,
      });
      p.g.visible = true;
      p.g.position.set(HERO.x - 30, HERO.y - 3);
      p.g.zIndex = HERO.y - 1;
    }
    for (const p of this.dust) {
      if (!p.g.visible) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.g.visible = false;
        continue;
      }
      p.g.x += (p.vx - this.model.speed) * dt;
      p.g.y += p.vy * dt;
      p.g.scale.set(p.r + 17 * p.life);
      p.g.alpha = 0.16 * (1 - p.life / p.max);
    }
  }

  /** After the wolf: the scene dims from the ground up, leaving the wolf and the ram readable. */
  private paintDark(): void {
    const d = this.dark.clear();
    if (this.darkness <= 0 || !this.darkFill) return;
    const h = 450 * this.darkness;
    d.rect(0, H - h, W, h).fill({ fill: this.darkFill, alpha: Math.min(0.85, this.darkness) });
    d.rect(0, 0, W, H).fill({ color: 0x08080c, alpha: this.darkness * 0.3 });
  }
}
