import { AnimatedSprite, Container, Graphics, Sprite, TilingSprite, type Application, type Texture } from 'pixi.js';
import { gsap } from '@triptown/engine';

/** The shared screen's fixed design size; the stage fills it behind the HUD. */
const SCREEN_W = 390;
const SCREEN_H = 844;

/** Looks a named texture up in the gate atlas. */
export type Frames = (name: string) => Texture;

/** The reference stage the art is laid out against; everything scales from it. */
const REF_W = 358;
const REF_H = 542;

/** One lap of the field, in seconds. Fixed: the lap never knows anything about the round. */
export const LAP_SECONDS = 5;

const COLORS = {
  ink: 0x1d1424,
  night: 0x101b44,
  turf: 0x1f6b3a,
  turf2: 0x1b5e33,
  cream: 0xfff4d6,
  gold: 0xffc414,
  crash: 0x5a1030,
};

/**
 * The value of `multiplier` mapped to 0..1. This is the only input intensity may use: the multiplier
 * is already the biggest thing on screen, so animating from it tells the player nothing new.
 */
export function intensityFor(multiplier: number): number {
  return Math.min(1, Math.log(Math.max(1, multiplier)) / Math.log(20));
}

/** Where the horse sits on its lap at scene time `t`, as an offset in reference units. */
export function lapOffset(t: number, amplitude = 14): number {
  return Math.sin((2 * Math.PI * t) / LAP_SECONDS) * amplitude;
}

export type StageMode = 'idle' | 'out' | 'home' | 'shut';

/**
 * Beat the Gate's scene: a floodlit night field with the yard gate fixed at the left.
 *
 * A plain Pixi container with no HUD, layout or compliance logic; the shared `CrashScreen` owns those
 * and drives this through the `GameStage` interface, which by construction passes the multiplier and
 * nothing else (no crash time, no time remaining).
 *
 * Rules this scene keeps (beat-the-gate-mvp spec "The gate and the horse never reveal the outcome"):
 * - the gate is drawn identically from round start until `slamGate`, which is only called on CRASH;
 * - the horse's lap depends only on scene time modulo LAP_SECONDS, and speed, flashes and gallop rate
 *   depend only on the multiplier, behind the profile's intensity flag;
 * - the ride home (`rideHome`) is only started after the server confirms a cash-out, and on a crash
 *   the horse simply stops where it is, facing away from the gate, so nothing reads as a near miss.
 */
export class GateStage extends Container {
  private readonly sky = new Graphics();
  private readonly beams = new Graphics();
  private readonly lights: [Sprite, Sprite];
  private readonly crowd: TilingSprite;
  private readonly flashLayer = new Container();
  private readonly turf: TilingSprite;
  private readonly rail: TilingSprite;
  private readonly barn: Sprite;
  private readonly posts: [Sprite, Sprite];
  private readonly panels: [Sprite, Sprite];
  private readonly latch: Sprite;
  private readonly horseRun: AnimatedSprite;
  private readonly horseStand: Sprite;
  private readonly horse = new Container();
  private readonly dustLayer = new Container();
  private readonly crashTint = new Graphics();

  private w = REF_W;
  private h = REF_H;
  private u = 1;
  private mode: StageMode = 'idle';
  private time = 0;
  private scroll = 0;
  private intensity = 0;
  private effectsOn = true;
  private reduced = false;
  private flashCooldown = 0;
  /** Horse x in reference units while it is out on the field; the lap adds to this. */
  private fieldX = 250;
  private horseX = 244;

  constructor(
    app: Application,
    private readonly frames: Frames,
  ) {
    super();
    this.lights = [new Sprite(frames('floodlight')), new Sprite(frames('floodlight'))];
    this.crowd = new TilingSprite({ texture: this.crowdTexture(app), width: REF_W, height: 40 });
    this.turf = new TilingSprite({ texture: this.turfTexture(app), width: REF_W, height: 200 });
    this.rail = new TilingSprite({ texture: this.railTexture(app), width: REF_W, height: 30 });
    this.barn = new Sprite(frames('barn'));
    this.posts = [new Sprite(frames('gate-post')), new Sprite(frames('gate-post'))];
    this.panels = [new Sprite(frames('gate-panel')), new Sprite(frames('gate-panel'))];
    this.latch = new Sprite(frames('gate-latch'));
    this.horseRun = new AnimatedSprite([0, 1, 2, 3].map((i) => frames(`horse-gallop-${i}`)));
    this.horseStand = new Sprite(frames('horse-stand'));
    for (const s of [this.horseRun, this.horseStand]) s.anchor.set(0.5, 0.94);
    this.horse.addChild(this.horseStand, this.horseRun);
    for (const p of this.posts) p.anchor.set(0.5, 1);
    this.panels[0].anchor.set(0, 1);
    this.panels[1].anchor.set(0, 1);
    this.latch.anchor.set(0.5);
    this.barn.anchor.set(0, 1);

    // Back to front: sky, beams, lights, crowd, turf, rail, horse, barn, gate, dust, tint.
    this.addChild(
      this.sky,
      this.beams,
      ...this.lights,
      this.crowd,
      this.flashLayer,
      this.turf,
      this.rail,
      // The horse passes behind the barn and the gate, so riding home reads as going in.
      this.horse,
      this.barn,
      this.posts[0],
      this.panels[0],
      this.panels[1],
      this.posts[1],
      this.latch,
      this.dustLayer,
      this.crashTint,
    );
    this.resize(SCREEN_W, SCREEN_H);
    this.idle();
  }

  // ---------- GameStage ----------

  /** A new round is being offered: back to the yard. */
  reset(): void {
    this.idle();
  }

  /** CRASH arrived. */
  onCrash(): void {
    this.slamGate();
  }

  // ---------- inputs ----------

  /** Multiplier drives intensity. Nothing else may. */
  setMultiplier(multiplier: number): void {
    this.intensity = intensityFor(multiplier);
  }

  setEffectsEnabled(on: boolean): void {
    this.effectsOn = on;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  resize(width: number, height: number): void {
    this.w = width;
    this.h = height;
    this.u = Math.min(width / REF_W, (height * 0.64) / REF_H);
    this.layout();
  }

  // ---------- states ----------

  /** Betting: the gate stands open and the horse waits beside it. */
  idle(): void {
    this.killTweens();
    this.mode = 'idle';
    this.setGateOpen(1);
    this.crashTint.alpha = 0;
    this.horseX = 244;
    this.faceHorse(1);
    this.showStanding(true);
    this.dustLayer.removeChildren();
    this.placeHorse();
  }

  /** Round start: the horse rides out onto the field. */
  rideOut(): void {
    this.killTweens();
    this.mode = 'out';
    this.crashTint.alpha = 0;
    this.setGateOpen(1);
    this.faceHorse(1);
    this.showStanding(false);
    if (this.reduced) {
      this.horseX = this.fieldX;
      this.placeHorse();
      return;
    }
    gsap.to(this, { horseX: this.fieldX, duration: 0.7, ease: 'power2.out', onUpdate: () => this.placeHorse() });
  }

  /** Called only after the server confirms the cash-out: the horse rides home through the gate and out of sight. */
  rideHome(onDone?: () => void): void {
    this.killTweens();
    this.mode = 'home';
    this.faceHorse(-1);
    this.showStanding(false);
    const target = -150;
    if (this.reduced) {
      this.horseX = target;
      this.placeHorse();
      onDone?.();
      return;
    }
    gsap.to(this, {
      horseX: target,
      duration: 1.1,
      ease: 'power1.in',
      onUpdate: () => this.placeHorse(),
      onComplete: () => onDone?.(),
    });
  }

  /**
   * Called only on the CRASH event. The gate swings shut; the horse stops where it is, out in the
   * field and facing away, so the result never shows it reaching the gate or losing by a nose.
   */
  slamGate(instant = false): void {
    this.killTweens();
    this.mode = 'shut';
    this.showStanding(true);
    this.faceHorse(1);
    this.horseX = Math.max(this.horseX, this.fieldX - 14);
    this.placeHorse();
    if (instant || this.reduced) {
      this.setGateOpen(0);
      this.crashTint.alpha = 0.35;
      return;
    }
    const gate = { open: 1 };
    gsap.to(gate, { open: 0, duration: 0.28, ease: 'back.in(1.4)', onUpdate: () => this.setGateOpen(gate.open) });
    gsap.to(this.crashTint, { alpha: 0.35, duration: 0.3, delay: 0.2 });
    gsap.delayedCall(0.28, () => this.puff(this.gateCenterX(), this.groundY() - 8, 1));
  }

  // ---------- frame ----------

  update(dtSeconds: number): void {
    this.time += dtSeconds;
    const running = this.mode === 'out';
    const speedRef = this.effectsOn ? 160 + 380 * this.intensity : 160;

    if (running && !this.reduced) {
      this.scroll += speedRef * this.u * dtSeconds;
      this.turf.tilePosition.x = -this.scroll;
      this.rail.tilePosition.x = -this.scroll;
      this.crowd.tilePosition.x = -this.scroll * 0.15;
      this.horseRun.animationSpeed = this.effectsOn ? 0.2 + 0.16 * this.intensity : 0.2;
      if (!this.horseRun.playing) this.horseRun.play();
      if (!gsap.isTweening(this)) {
        this.horseX = this.fieldX + lapOffset(this.time);
        this.placeHorse();
      }
    } else if (this.mode === 'home' && !this.reduced) {
      this.horseRun.animationSpeed = 0.22;
      if (!this.horseRun.playing && this.horseRun.visible) this.horseRun.play();
    } else {
      this.horseRun.stop();
    }

    // Crowd camera flashes: rate follows the multiplier only.
    if (running && this.effectsOn && !this.reduced) {
      this.flashCooldown -= dtSeconds;
      if (this.flashCooldown <= 0) {
        this.flash();
        this.flashCooldown = 1.2 - this.intensity;
      }
    }
  }

  // ---------- internals ----------

  private groundY(): number {
    return this.h * 0.77;
  }

  private gateCenterX(): number {
    return 80 * this.u;
  }

  private layout(): void {
    const { w, h, u } = this;
    const ground = this.groundY();
    const crowdY = h * 0.43;

    this.sky.clear().rect(0, 0, w, h).fill(COLORS.night);
    this.beams
      .clear()
      .poly([0, 0, 80 * u, 0, w * 0.62, crowdY + 40 * u, 0, crowdY + 40 * u])
      .fill({ color: 0xffecaa, alpha: 0.1 })
      .poly([w, 0, w - 80 * u, 0, w * 0.38, crowdY + 40 * u, w, crowdY + 40 * u])
      .fill({ color: 0xffecaa, alpha: 0.1 });
    this.lights[0].scale.set(0.6 * u);
    this.lights[0].position.set(8 * u, 10 * u);
    this.lights[1].scale.set(0.6 * u);
    this.lights[1].position.set(w - 8 * u - this.lights[1].width, 10 * u);

    this.crowd.width = w;
    this.crowd.height = 40 * u;
    this.crowd.tileScale.set(u);
    this.crowd.position.set(0, crowdY);
    this.flashLayer.position.set(0, crowdY);

    this.turf.position.set(0, crowdY + 40 * u);
    this.turf.width = w;
    this.turf.height = h - this.turf.y;
    this.turf.tileScale.set(u);
    this.rail.position.set(0, crowdY + 78 * u);
    this.rail.width = w;
    this.rail.height = 30 * u;
    this.rail.tileScale.set(u);

    this.barn.scale.set(0.8 * u);
    this.barn.position.set(-6 * u, ground - 150 * u);

    const postScale = 0.85 * u;
    this.posts[0].scale.set(postScale);
    this.posts[1].scale.set(postScale);
    this.posts[0].position.set(14 * u, ground + 6 * u);
    this.posts[1].position.set(146 * u, ground + 6 * u);
    this.latch.scale.set(0.6 * u);
    this.setGateOpen(this.mode === 'shut' ? 0 : 1);

    this.horse.scale.set(0.52 * u);
    this.placeHorse();
    this.crashTint.clear().rect(0, 0, w, h).fill(COLORS.crash);
  }

  /** 1 = swung open towards the viewer, 0 = shut across the opening. One texture, squashed about its hinge. */
  private setGateOpen(open: number): void {
    const u = this.u;
    const ground = this.groundY();
    const left = 14 * u;
    const right = 146 * u;
    const half = (right - left) / 2;
    const heightScale = 0.8 * u;
    const shutScaleX = half / 96;
    const scaleX = shutScaleX * (1 - 0.72 * open);
    const [a, b] = this.panels;
    a.scale.set(scaleX, heightScale);
    a.position.set(left, ground - 8 * u);
    a.skew.y = -0.35 * open;
    b.scale.set(-scaleX, heightScale);
    b.position.set(right, ground - 8 * u);
    b.skew.y = 0.35 * open;
    this.latch.position.set((left + right) / 2, ground - 90 * u);
    this.latch.visible = open < 0.05;
  }

  private placeHorse(): void {
    this.horse.position.set(this.horseX * this.u, this.groundY());
  }

  private faceHorse(dir: 1 | -1): void {
    this.horseRun.scale.x = dir;
    this.horseStand.scale.x = dir;
  }

  private showStanding(standing: boolean): void {
    this.horseStand.visible = standing;
    this.horseRun.visible = !standing;
    if (standing) this.horseRun.stop();
  }

  private flash(): void {
    const s = new Sprite(this.frames('flash'));
    s.anchor.set(0.5);
    s.position.set(Math.random() * this.w, (8 + Math.random() * 24) * this.u);
    s.scale.set(0);
    this.flashLayer.addChild(s);
    gsap.to(s.scale, { x: 0.6 * this.u, y: 0.6 * this.u, duration: 0.12, yoyo: true, repeat: 1, onComplete: () => s.destroy() });
  }

  private puff(x: number, y: number, size: number): void {
    const s = new Sprite(this.frames('dust'));
    s.anchor.set(0.5, 1);
    s.position.set(x, y);
    s.scale.set(0.3 * this.u * size);
    this.dustLayer.addChild(s);
    gsap.to(s.scale, { x: 0.7 * this.u * size, y: 0.7 * this.u * size, duration: 0.4, ease: 'power2.out' });
    gsap.to(s, { alpha: 0, duration: 0.5, delay: 0.5, onComplete: () => s.destroy() });
  }

  private killTweens(): void {
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.crashTint);
  }

  private crowdTexture(app: Application): Texture {
    const g = new Graphics().rect(0, 0, 48, 40).fill({ color: COLORS.night, alpha: 0 });
    for (const [x, y, c] of [
      [6, 8, 0xfff4d6],
      [18, 22, 0xffc414],
      [30, 10, 0xfff4d6],
      [42, 26, 0xe03131],
      [12, 32, 0xfff4d6],
      [36, 34, 0xfff4d6],
    ] as const) {
      g.circle(x, y, 3).fill({ color: c, alpha: 0.55 });
    }
    g.rect(0, 37, 48, 3).fill(COLORS.ink);
    return app.renderer.generateTexture(g);
  }

  private turfTexture(app: Application): Texture {
    const g = new Graphics().rect(0, 0, 44, 200).fill(COLORS.turf).rect(44, 0, 44, 200).fill(COLORS.turf2);
    return app.renderer.generateTexture(g);
  }

  private railTexture(app: Application): Texture {
    const g = new Graphics()
      .rect(0, 0, 66, 30)
      .fill({ color: 0, alpha: 0 })
      .rect(0, 2, 66, 10)
      .fill(COLORS.cream)
      .rect(0, 0, 66, 3)
      .fill(COLORS.ink)
      .rect(0, 11, 66, 3)
      .fill(COLORS.ink)
      .rect(28, 2, 10, 28)
      .fill(COLORS.cream)
      .stroke({ color: COLORS.ink, width: 3 });
    return app.renderer.generateTexture(g);
  }
}
