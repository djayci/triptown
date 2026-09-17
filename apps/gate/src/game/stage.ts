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

/**
 * Stage colours per skin, matching the atlas of the same name (art/art.mjs).
 * - candy: Candy Paddock (chosen 17 Sep 2026), Whack Crash's yellow sunburst and green paddock.
 * - adult: Adult Sticker, Whack Crash's adult tokens on a charcoal sunburst.
 * `night` is the stage ground the shared screen's contrast check is given in main.ts.
 */
export const STAGE_PALETTES = {
  candy: { ink: 0x1d1424, night: 0xffd43b, ray: 0xffc414, turf: 0x6fd14a, turf2: 0x4fbf3a, cream: 0xfff4d6, crash: 0xff7361 },
  adult: { ink: 0x14161a, night: 0x2c333b, ray: 0x232930, turf: 0x4a6b52, turf2: 0x3c5744, cream: 0xe8e3d9, crash: 0x5a4045 },
} as const;
export type StageSkin = keyof typeof STAGE_PALETTES;
type StagePalette = (typeof STAGE_PALETTES)[StageSkin];

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

export type StageMode = 'idle' | 'out' | 'heading' | 'home' | 'shut';

/**
 * How the round's result is shown (gate-odds-mvp). `live`: Beat the Gate, the gate is on screen and
 * slams at the crash. `onCollect`: Gate Rush, the horse leaves through the open gate, the gate is left
 * behind off screen while it is out, and it comes back into view only at the reveal after IN!.
 */
export type RevealMode = 'live' | 'onCollect';

/** Seconds the heading-home turn takes. Fixed, and the same for every outcome (gate-odds-mvp D6). */
export const HEADING_HOME_SECONDS = 1.2;

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
  /** The green mound the field sits on; its top edge is outlined like Whack's hole lip. */
  private readonly mound = new Graphics();
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
  /** Barn, posts, panels and latch, moved as one so Gate Rush can leave the gate behind and bring it back. */
  private readonly yard = new Container();
  private readonly c: StagePalette;
  private readonly horseRun: AnimatedSprite;
  private readonly horseStand: Sprite;
  private readonly horse = new Container();
  private readonly dustLayer = new Container();
  private readonly crashTint = new Graphics();
  private revealMode: RevealMode = 'live';

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
    skin: StageSkin = 'candy',
  ) {
    super();
    this.c = STAGE_PALETTES[skin];
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

    this.yard.addChild(this.barn, this.posts[0], this.panels[0], this.panels[1], this.posts[1], this.latch);
    // Back to front: sky, beams, lights, crowd, turf, rail, horse, yard (barn and gate), dust, tint.
    this.addChild(
      this.sky,
      this.beams,
      ...this.lights,
      this.crowd,
      this.flashLayer,
      this.mound,
      this.turf,
      this.rail,
      // The horse passes behind the barn and the gate, so riding home reads as going in.
      this.horse,
      this.yard,
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

  /** CRASH arrived. Live: the gate slams now. Deferred: this is the shut reveal after heading home. */
  onCrash(): void {
    if (this.revealMode === 'onCollect') this.revealShut();
    else this.slamGate();
  }

  /** Chosen once per session from the effective reveal mode; Gate Rush leaves the gate behind while out. */
  setRevealMode(mode: RevealMode): void {
    this.revealMode = mode;
    this.idle();
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

  /** Betting: the gate stands open and the horse waits beside it, in both presentations. */
  idle(): void {
    this.killTweens();
    this.mode = 'idle';
    this.setGateOpen(1);
    this.yard.x = 0;
    this.crashTint.alpha = 0;
    this.horseX = 244;
    this.faceHorse(1);
    this.showStanding(true);
    this.dustLayer.removeChildren();
    this.placeHorse();
  }

  /**
   * Round start: the horse rides out through the open gate onto the field. In Gate Rush the gate, still
   * open, drops behind off screen, the same way every round, so it says nothing about the result.
   */
  rideOut(): void {
    this.killTweens();
    this.mode = 'out';
    this.crashTint.alpha = 0;
    this.setGateOpen(1);
    this.faceHorse(1);
    this.showStanding(false);
    const yardX = this.revealMode === 'onCollect' ? this.yardAway() : 0;
    if (this.reduced) {
      this.horseX = this.fieldX;
      this.yard.x = yardX;
      this.placeHorse();
      return;
    }
    gsap.to(this, { horseX: this.fieldX, duration: 0.7, ease: 'power2.out', onUpdate: () => this.placeHorse() });
    gsap.to(this.yard, { x: yardX, duration: 0.9, ease: 'power1.in' });
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
   * Gate Rush: IN! was pressed. The horse turns and gallops for home in place, never closing on the yard,
   * for HEADING_HOME_SECONDS. It is identical for every outcome and must be played before the result is
   * known; the reveal comes from `revealOpen` or `revealShut` once the server settles.
   */
  headHome(): void {
    this.killTweens();
    this.mode = 'heading';
    this.faceHorse(-1);
    this.showStanding(false);
    this.horseX = this.fieldX;
    this.placeHorse();
  }

  /** Gate Rush: settled as won. The gate comes back into view open and the horse rides through it. */
  revealOpen(): void {
    this.setGateOpen(1);
    // rideHome clears running tweens, so the gate is brought back after it starts.
    this.rideHome();
    this.bringYardBack();
  }

  /**
   * Gate Rush: settled as lost. The yard appears with the gate already shut; the horse stops out in the
   * field and turns away. Nothing slams in front of it and no position hints at how close it was.
   */
  revealShut(): void {
    this.killTweens();
    this.mode = 'shut';
    this.setGateOpen(0);
    this.bringYardBack();
    this.showStanding(true);
    this.faceHorse(1);
    this.horseX = this.fieldX;
    this.placeHorse();
    if (this.reduced) this.crashTint.alpha = 0.35;
    else gsap.to(this.crashTint, { alpha: 0.35, duration: 0.3 });
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
    // Heading home scrolls the field the other way at the baseline speed: no multiplier, no outcome.
    const running = this.mode === 'out' || this.mode === 'heading';
    const speedRef = this.mode === 'heading' ? -160 : this.effectsOn ? 160 + 380 * this.intensity : 160;

    if (running && !this.reduced) {
      this.scroll += speedRef * this.u * dtSeconds;
      this.turf.tilePosition.x = -this.scroll;
      this.rail.tilePosition.x = -this.scroll;
      this.crowd.tilePosition.x = -this.scroll * 0.15;
      this.horseRun.animationSpeed = this.effectsOn ? 0.2 + 0.16 * this.intensity : 0.2;
      if (!this.horseRun.playing) this.horseRun.play();
      if (this.mode === 'out' && !gsap.isTweening(this)) {
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
    if (this.mode === 'out' && this.effectsOn && !this.reduced) {
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

    // Sunburst: alternating wedges around a point above the field, as on Whack's stage card.
    this.sky.clear().rect(0, 0, w, h).fill(this.c.night);
    const cx = w / 2;
    const cy = h * 0.36;
    const reach = Math.hypot(w, h);
    for (let i = 0; i < 40; i += 2) {
      const a0 = (i / 40) * Math.PI * 2;
      const a1 = ((i + 1) / 40) * Math.PI * 2;
      this.sky.poly([cx, cy, cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach, cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach]).fill(this.c.ray);
    }
    // Floodlights, beams, crowd and barn belong to the night look; the sticker stage has none.
    this.beams.clear();
    for (const part of [this.beams, ...this.lights, this.crowd, this.barn]) part.visible = false;
    this.lights[0].scale.set(0.6 * u);
    this.lights[0].position.set(8 * u, 10 * u);
    this.lights[1].scale.set(0.6 * u);
    this.lights[1].position.set(w - 8 * u - this.lights[1].width, 10 * u);

    this.crowd.width = w;
    this.crowd.height = 40 * u;
    this.crowd.tileScale.set(u);
    this.crowd.position.set(0, crowdY);
    this.flashLayer.position.set(0, crowdY);

    const moundTop = crowdY + 26 * u;
    this.mound
      .clear()
      .ellipse(w / 2, moundTop + 150 * u, w * 0.9, 150 * u)
      .fill(this.c.turf)
      .stroke({ color: this.c.ink, width: 5 });
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
    this.crashTint.clear().rect(0, 0, w, h).fill(this.c.crash);
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

  /** Where the yard waits while the horse is out: fully off the left edge. */
  private yardAway(): number {
    return -170 * this.u;
  }

  /** The reveal: the gate, already in its final state, slides back into view. Same motion either way. */
  private bringYardBack(): void {
    gsap.killTweensOf(this.yard);
    if (this.reduced) {
      this.yard.x = 0;
      return;
    }
    this.yard.x = Math.min(this.yard.x, this.yardAway());
    gsap.to(this.yard, { x: 0, duration: 0.3, ease: 'power2.out' });
  }

  private killTweens(): void {
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.yard);
    gsap.killTweensOf(this.crashTint);
  }

  private crowdTexture(app: Application): Texture {
    const g = new Graphics().rect(0, 0, 48, 40).fill({ color: this.c.night, alpha: 0 });
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
    g.rect(0, 37, 48, 3).fill(this.c.ink);
    return app.renderer.generateTexture(g);
  }

  private turfTexture(app: Application): Texture {
    const g = new Graphics().rect(0, 0, 44, 200).fill(this.c.turf).rect(44, 0, 44, 200).fill(this.c.turf2);
    return app.renderer.generateTexture(g);
  }

  private railTexture(app: Application): Texture {
    const g = new Graphics()
      .rect(0, 0, 66, 30)
      .fill({ color: 0, alpha: 0 })
      .rect(0, 2, 66, 10)
      .fill(this.c.cream)
      .rect(0, 0, 66, 3)
      .fill(this.c.ink)
      .rect(0, 11, 66, 3)
      .fill(this.c.ink)
      .rect(28, 2, 10, 28)
      .fill(this.c.cream)
      .stroke({ color: this.c.ink, width: 3 });
    return app.renderer.generateTexture(g);
  }
}
