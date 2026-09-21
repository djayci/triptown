import { AnimatedSprite, Container, Graphics, PerspectiveMesh, Rectangle, Sprite, TilingSprite, type Application, type Texture } from 'pixi.js';
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
  /** Broadcast: a floodlit pitch seen from the camera gantry, under a night sky graded to navy. */
  broadcast: { ink: 0x0d0f14, night: 0x16304d, ray: 0x11253c, turf: 0x1c6b3a, turf2: 0x186034, cream: 0xe8eef5, crash: 0x5a1220 },
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

export type StageMode = 'idle' | 'out' | 'heading' | 'arriving' | 'home' | 'shut';

/**
 * How the round's result is shown (gate-odds-mvp). `live`: Beat the Gate, the gate is on screen and
 * slams at the crash. `onCollect`: Gate Rush, the horse leaves through the open gate, the gate is left
 * behind off screen while it is out, and it comes back into view only at the reveal after IN!.
 */
export type RevealMode = 'live' | 'onCollect';

/** Seconds the heading-home turn takes. Fixed, and the same for every outcome (gate-odds-mvp D6). */
export const HEADING_HOME_SECONDS = 1.2;

/** Gate posts in reference units, clear of the screen edge so an open door never swings off it. */
const GATE_LEFT = 58;
const GATE_RIGHT = 170;
/** How far an open door swings towards the viewer, in degrees, and the camera distance for its perspective. */
const OPEN_DEGREES = 115;
const CAMERA_DISTANCE = 220;
/** Where the horse waits at the start, clear of the open right-hand door. */
const IDLE_X = 292;
/**
 * The yard is on the far side of the left post: a horse whose right edge is left of the post is inside and
 * out of sight. The horse is clipped at the post whenever it goes in or out, so it only shows through the
 * opening. Its sprite reaches about 105 reference units either side of its x.
 */
const INSIDE_X = GATE_LEFT - 115;
/** Seconds the gate takes to come back into view at the reveal: the departure played in reverse. */
const ARRIVE_SECONDS = 1.6;
/** Fence posts either side of the gate, in reference units apart; the fence runs on past both screen edges. */
const FENCE_SPACING = 52;
/** The right-hand side fence stands just past the screen edge, out of view while the gate is home, and runs straight back. */
const FENCE_INSET = -12;
/** Horses at grass in the paddock: how many, and how fast one walks, in reference units per second. */
const GRAZERS = 3;
const WALK_SPEED = 22;
/** The horse drawings are 400 wide but declared smaller in the atlas (art/art.mjs): the stage scales them back. */
const RIDDEN_ART_SCALE = 400 / 300;
const PADDOCK_ART_SCALE = 400 / 152;

/** One horse at grass. `x` is in reference units in the yard; `depth` 0 is at the back rail, 1 at the fence. */
interface Grazer {
  sprite: AnimatedSprite;
  coat: number;
  x: number;
  depth: number;
  facing: 1 | -1;
  state: 'graze' | 'look' | 'walk';
  /** Seconds left in the current state. */
  timer: number;
  target: { x: number; depth: number };
}
/** Seconds the doors take to swing open when a round starts. */
const OPEN_SECONDS = 0.8;

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
  /** The field's shape: the striped turf is clipped to the mound so the stripes follow its curved top. */
  private readonly fieldMask = new Graphics();
  private readonly beams = new Graphics();
  private readonly lights: [Sprite, Sprite];
  private readonly crowd: TilingSprite;
  private readonly flashLayer = new Container();
  private readonly turf: TilingSprite;
  private readonly rail: TilingSprite;
  private readonly barn: Sprite;
  private readonly posts: [Sprite, Sprite];
  private readonly panels: [PerspectiveMesh, PerspectiveMesh];
  private readonly latch: Sprite;
  /** Barn, posts, panels and latch, moved as one so Gate Rush can leave the gate behind and bring it back. */
  private readonly yard = new Container();
  /** The paddock fence, in the yard so it leaves and returns with the gate, and the horses behind it. */
  private readonly fence = new Graphics();
  private readonly paddock = new Container();
  private readonly grazers: Grazer[] = [];
  private readonly c: StagePalette;
  /** The candy stage is a sunburst; the broadcast stage is a graded night sky. */
  private readonly rays: boolean;
  private readonly horseRun: AnimatedSprite;
  private readonly horseStand: Sprite;
  private readonly horse = new Container();
  private readonly dustLayer = new Container();
  private readonly crashTint = new Graphics();
  private revealMode: RevealMode = 'live';
  /** How open the doors are now (0 shut, 1 open), kept so a resize redraws them where they were. */
  private gateOpen = 1;
  private readonly gateSwing = { open: 1 };
  /** Clips the horse at the left gate post while it goes in or out of the yard. Follows the yard as it moves. */
  private readonly horseMask = new Graphics();
  private clipAtPost = false;
  /** True while the horse is coming out of the yard, so the lap motion leaves its position alone. */
  private emerging = false;
  /**
   * True from BET until the gate starts to leave: the field holds still while the doors open, so the doors
   * never look as if they are sliding with it. The field and the gate then start moving together.
   */
  private fieldHeld = false;
  /**
   * The gate is fixed to the ground: while it leaves or comes back it moves by exactly as much as the field
   * scrolls each frame, so it never slides over the grass. `departTo` is where a leaving gate stops;
   * `arrival` drives a returning one.
   */
  private departTo: number | null = null;
  private departCall: gsap.core.Tween | null = null;
  /** Scene time the field started moving after BET, to ease it up to speed rather than jump. */
  private rampFrom: number | null = null;
  private arrival: { from: number; t: number; onArrived?: () => void } | null = null;

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
  private horseX = IDLE_X;

  constructor(
    app: Application,
    private readonly frames: Frames,
    skin: StageSkin = 'candy',
  ) {
    super();
    this.c = STAGE_PALETTES[skin];
    this.rays = skin !== 'broadcast';
    this.lights = [new Sprite(frames('floodlight')), new Sprite(frames('floodlight'))];
    this.crowd = new TilingSprite({ texture: this.crowdTexture(app), width: REF_W, height: 40 });
    this.turf = new TilingSprite({ texture: this.turfTexture(app), width: REF_W, height: 200 });
    this.rail = new TilingSprite({ texture: this.railTexture(app), width: REF_W, height: 30 });
    this.barn = new Sprite(frames('barn'));
    this.posts = [new Sprite(frames('gate-post')), new Sprite(frames('gate-post'))];
    this.panels = [0, 1].map(() => new PerspectiveMesh({ texture: frames('gate-panel'), verticesX: 6, verticesY: 6 })) as [PerspectiveMesh, PerspectiveMesh];
    this.latch = new Sprite(frames('gate-latch'));
    this.horseRun = new AnimatedSprite([0, 1, 2, 3].map((i) => frames(`horse-gallop-${i}`)));
    this.horseStand = new Sprite(frames('horse-stand'));
    for (const s of [this.horseRun, this.horseStand]) s.anchor.set(0.5, 0.94);
    this.horse.addChild(this.horseStand, this.horseRun);
    for (const p of this.posts) p.anchor.set(0.5, 1);
    this.latch.anchor.set(0.5);
    this.barn.anchor.set(0, 1);

    for (let i = 0; i < GRAZERS; i++) {
      const coat = i % 3;
      const sprite = new AnimatedSprite([frames(`graze-${coat}-0`), frames(`graze-${coat}-1`)]);
      sprite.anchor.set(0.5, 0.94);
      this.paddock.addChild(sprite);
      this.grazers.push({ sprite, coat, x: 0, depth: 0, facing: 1, state: 'graze', timer: 0, target: { x: 0, depth: 0 } });
    }
    this.scatterGrazers();
    // The horse lives in the yard's layer so it can pass through the gate: in front of the right door and
    // the right post, behind the left door and the left post, going out and coming back. The paddock and
    // its fence sit behind everything else in the yard: a horse at grass is always behind the fence.
    this.yard.addChild(this.paddock, this.fence, this.barn, this.panels[1], this.posts[1], this.horse, this.posts[0], this.panels[0], this.latch);
    // Back to front: sky, beams, lights, crowd, turf, rail, yard (barn, gate and the horse), dust, tint.
    this.addChild(
      this.sky,
      this.beams,
      ...this.lights,
      this.crowd,
      this.flashLayer,
      this.turf,
      this.fieldMask,
      this.mound,
      this.rail,
      // The horse passes behind the barn and the gate, so riding home reads as going in.
      this.horseMask,
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

  /** Betting: the gate stands shut with the horse inside the yard, out of sight, in both presentations. */
  idle(): void {
    this.killTweens();
    this.mode = 'idle';
    this.setGateOpen(0);
    this.yard.x = 0;
    this.crashTint.alpha = 0;
    this.horseX = INSIDE_X;
    this.faceHorse(1);
    this.showStanding(true);
    this.horse.visible = false;
    this.setClip(false);
    this.emerging = false;
    this.dustLayer.removeChildren();
    this.placeHorse();
  }

  /**
   * Round start: the doors swing open, the horse comes out of the yard through them and runs. In Gate Rush
   * the gate, left open, then drops behind off screen. Every round does exactly this, so it says nothing
   * about the result. Called again after a refused IN!, when the horse is already out: it just runs on.
   */
  rideOut(): void {
    const fromYard = this.mode === 'idle';
    this.killTweens();
    this.mode = 'out';
    this.crashTint.alpha = 0;
    this.faceHorse(1);
    this.showStanding(false);
    this.horse.visible = true;
    if (!fromYard) {
      this.setClip(false);
      this.emerging = false;
      return;
    }
    // Measured with the doors open, the widest the gate gets, so it clears the screen once they are.
    this.setGateOpen(1);
    const yardX = this.revealMode === 'onCollect' ? this.yardAway() : 0;
    this.setGateOpen(0);
    if (this.reduced) {
      this.setGateOpen(1);
      this.horseX = this.fieldX;
      this.yard.x = yardX;
      this.placeHorse();
      return;
    }
    this.horseX = INSIDE_X;
    this.setClip(true);
    this.emerging = true;
    this.fieldHeld = true;
    this.placeHorse();
    this.gateSwing.open = 0;
    gsap.to(this.gateSwing, { open: 1, duration: OPEN_SECONDS, ease: 'power2.inOut', onUpdate: () => this.setGateOpen(this.gateSwing.open) });
    // The horse sets off once the doors are half open, and is clear of the yard by the time the gate moves.
    gsap.to(this, {
      horseX: this.fieldX,
      duration: 1.1,
      delay: OPEN_SECONDS * 0.5,
      ease: 'power1.out',
      onUpdate: () => this.placeHorse(),
      onComplete: () => {
        this.emerging = false;
        this.setClip(false);
      },
    });
    // The gate leaves as soon as the horse is through, so it is gone by the time the horse is running.
    // Nothing moves but the doors until they are fully open; then the field and the gate start together.
    this.departCall = gsap.delayedCall(OPEN_SECONDS, () => {
      this.fieldHeld = false;
      this.departTo = yardX;
      this.rampFrom = this.time;
    });
  }

  /**
   * Called only after the server confirms a win: the horse gallops in through the open gate and out of
   * sight, and the doors close behind it.
   */
  rideHome(onDone?: () => void): void {
    this.killTweens();
    this.mode = 'home';
    this.faceHorse(-1);
    this.showStanding(false);
    this.horse.visible = true;
    const closed = () => {
      this.horse.visible = false;
      this.showStanding(true);
      this.setClip(false);
      onDone?.();
    };
    if (this.reduced) {
      this.horseX = INSIDE_X;
      this.setGateOpen(0);
      this.placeHorse();
      closed();
      return;
    }
    this.setClip(true);
    gsap.to(this, {
      horseX: INSIDE_X,
      duration: 1.1,
      ease: 'power1.in',
      onUpdate: () => this.placeHorse(),
      onComplete: () => {
        this.gateSwing.open = this.gateOpen;
        gsap.to(this.gateSwing, { open: 0, duration: OPEN_SECONDS, ease: 'power2.inOut', onUpdate: () => this.setGateOpen(this.gateSwing.open), onComplete: closed });
      },
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
    this.horse.visible = true;
    this.setClip(false);
    this.emerging = false;
    this.horseX = this.fieldX;
    this.placeHorse();
  }

  /** Gate Rush: settled as won. The gate comes back into view open and the horse rides through it. */
  revealOpen(): void {
    this.killTweens();
    this.mode = 'arriving';
    this.setGateOpen(1);
    this.faceHorse(-1);
    this.showStanding(false);
    // The horse keeps galloping as the open gate comes towards it, then rides through.
    this.bringYardBack(() => this.rideHome());
  }

  /**
   * Gate Rush: settled as lost. The yard appears with the gate already shut; the horse stops out in the
   * field and turns away. Nothing slams in front of it and no position hints at how close it was.
   */
  revealShut(): void {
    this.killTweens();
    this.mode = 'arriving';
    this.setGateOpen(0);
    this.faceHorse(-1);
    this.showStanding(false);
    this.horse.visible = true;
    this.setClip(false);
    // Well clear of the shut gate, so the loss never reads as stopping just short of it: the horse eases
    // back as the gate comes in, then stands and turns away.
    const stopX = IDLE_X - 8;
    const settle = () => {
      this.mode = 'shut';
      this.horseX = stopX;
      this.placeHorse();
      this.showStanding(true);
      this.faceHorse(1);
      if (this.reduced) this.crashTint.alpha = 0.35;
      else gsap.to(this.crashTint, { alpha: 0.35, duration: 0.3 });
    };
    if (!this.reduced) gsap.to(this, { horseX: stopX, duration: ARRIVE_SECONDS, ease: 'power1.out', onUpdate: () => this.placeHorse() });
    this.bringYardBack(settle);
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
    const running = this.mode === 'out' || this.mode === 'heading' || this.mode === 'arriving';
    // Heading home and the gate coming back scroll the field the other way at the baseline speed: no
    // multiplier, no outcome.
    const speedRef = this.mode === 'heading' || this.mode === 'arriving' ? -160 : this.effectsOn ? 160 + 380 * this.intensity : 160;

    if (running && !this.reduced) {
      const before = this.scroll;
      this.moveField(speedRef, dtSeconds);
      this.turf.tilePosition.x = -this.scroll;
      this.rail.tilePosition.x = -this.scroll;
      this.crowd.tilePosition.x = -this.scroll * 0.15;
      // A flash belongs to someone in the stand, so it moves with the stand, not with the camera.
      const drift = -(this.scroll - before) * 0.15;
      for (const f of this.flashLayer.children) f.x += drift;
      this.horseRun.animationSpeed = this.effectsOn ? 0.2 + 0.16 * this.intensity : 0.2;
      if (!this.horseRun.playing) this.horseRun.play();
      if (this.mode === 'out' && !this.emerging && !gsap.isTweening(this)) {
        this.horseX = this.fieldX + lapOffset(this.time);
        this.placeHorse();
      }
    } else if (this.mode === 'home' && !this.reduced) {
      this.horseRun.animationSpeed = 0.22;
      if (!this.horseRun.playing && this.horseRun.visible) this.horseRun.play();
    } else {
      this.horseRun.stop();
    }

    // The yard may be moving; keep the horse where it is on screen, and the clip on the post.
    this.placeHorse();
    this.grazeStep(dtSeconds);

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
    return ((GATE_LEFT + GATE_RIGHT) / 2) * this.u;
  }

  private layout(): void {
    const { w, h, u } = this;
    const ground = this.groundY();
    // The field's arch tops out at 300 of 844 in broadcast, where the scene band starts; the paddock keeps its lower field.
    // Broadcast: the stand starts where the scene band does (300 of 844) and the pitch begins under it.
    const crowdY = this.rays ? h * 0.43 : h * 0.3555;

    this.sky.clear().rect(0, 0, w, h).fill(this.c.night);
    if (this.rays) {
      // Sunburst: alternating wedges around a point above the field, as on Whack's stage card.
      const cx = w / 2;
      const cy = h * 0.36;
      const reach = Math.hypot(w, h);
      for (let i = 0; i < 40; i += 2) {
        const a0 = (i / 40) * Math.PI * 2;
        const a1 = ((i + 1) / 40) * Math.PI * 2;
        this.sky.poly([cx, cy, cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach, cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach]).fill(this.c.ray);
      }
    } else {
      // Broadcast: the night sky graded down to the floodlit pitch, no rays.
      for (let i = 0; i < 12; i++) {
        this.sky.rect(0, (i * h) / 12, w, h / 12 + 1).fill({ color: this.c.ray, alpha: i / 14 });
      }
    }
    // Floodlights, beams and barn belong to the old night look. The crowd is the broadcast stand.
    this.beams.clear();
    for (const part of [this.beams, ...this.lights, this.barn]) part.visible = false;
    this.crowd.visible = !this.rays;
    this.lights[0].scale.set(0.6 * u);
    this.lights[0].position.set(8 * u, 10 * u);
    this.lights[1].scale.set(0.6 * u);
    this.lights[1].position.set(w - 8 * u - this.lights[1].width, 10 * u);

    const standH = 44 * u;
    this.crowd.width = w;
    this.crowd.height = standH;
    this.crowd.tileScale.set(u);
    this.crowd.position.set(0, crowdY);
    this.flashLayer.position.set(0, crowdY);

    const moundTop = this.rays ? crowdY + 26 * u : crowdY + standH;
    this.fieldMask.clear();
    this.mound.clear();
    if (this.rays) {
      // Paddock: the field is one shape, an arched top edge then straight down to the bottom of the screen.
      // The stripes are clipped to it and the ink outline follows the same curve.
      const arch = (g: Graphics) => {
        g.moveTo(-10, moundTop + 34 * u).quadraticCurveTo(w / 2, moundTop - 34 * u, w + 10, moundTop + 34 * u);
        return g;
      };
      arch(this.fieldMask).lineTo(w + 10, h + 10).lineTo(-10, h + 10).closePath().fill(0xffffff);
      arch(this.mound).stroke({ color: this.c.ink, width: 5 });
      this.turf.position.set(0, moundTop - 34 * u);
    } else {
      // Broadcast: a straight pitch edge under the stand, with the perimeter board along it.
      this.fieldMask.rect(-10, moundTop, w + 20, h).fill(0xffffff);
      this.mound.rect(0, moundTop, w, 4 * u).fill(this.c.ink);
      this.turf.position.set(0, moundTop);
    }
    this.turf.mask = this.fieldMask;
    this.turf.width = w;
    this.turf.height = h - this.turf.y;
    this.turf.tileScale.set(u);
    this.rail.position.set(0, crowdY + 78 * u);
    this.rail.width = w;
    this.rail.height = 30 * u;
    this.rail.tileScale.set(u);

    this.barn.scale.set(0.8 * u);
    this.barn.position.set(-6 * u, ground - 150 * u);
    this.drawFence();
    for (const g of this.grazers) this.placeGrazer(g);

    const postScale = 0.85 * u;
    this.posts[0].scale.set(postScale);
    this.posts[1].scale.set(postScale);
    this.posts[0].position.set(GATE_LEFT * u, ground + 6 * u);
    this.posts[1].position.set(GATE_RIGHT * u, ground + 6 * u);
    this.latch.scale.set(0.6 * u);
    this.setGateOpen(this.gateOpen);

    this.horse.scale.set(0.52 * u * RIDDEN_ART_SCALE);
    this.placeHorse();
    this.crashTint.clear().rect(0, 0, w, h).fill(this.c.crash);
  }

  /**
   * 1 = swung open towards the viewer, 0 = shut across the opening. Each door turns on its post's hinge
   * and is drawn in perspective: the free edge comes towards the camera, so it grows and moves away from
   * the centre of the view, as a real door opening towards you does.
   */
  private setGateOpen(open: number): void {
    this.gateOpen = open;
    const u = this.u;
    const ground = this.groundY();
    const left = GATE_LEFT * u;
    const right = GATE_RIGHT * u;
    const half = (right - left) / 2;
    const bottom = ground - 8 * u;
    const top = bottom - 160 * u;
    // The camera looks at the middle of the gate, from about the door's mid-height.
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const angle = (open * OPEN_DEGREES * Math.PI) / 180;
    const project = (x: number, y: number, depth: number): [number, number] => {
      const s = (CAMERA_DISTANCE * u) / (CAMERA_DISTANCE * u - depth);
      return [cx + (x - cx) * s, cy + (y - cy) * s];
    };
    const door = (mesh: PerspectiveMesh, hinge: number, dir: 1 | -1) => {
      // Past 90 degrees the free edge passes its own post, so each door flares outward and towards the viewer.
      const freeX = hinge + dir * half * Math.cos(angle);
      const depth = half * Math.sin(angle);
      const [hx0, hy0] = project(hinge, top, 0);
      const [hx1, hy1] = project(hinge, bottom, 0);
      const [fx0, fy0] = project(freeX, top, depth);
      const [fx1, fy1] = project(freeX, bottom, depth);
      // Texture left edge on the hinge, right edge on the free edge: the right door comes out mirrored.
      mesh.setCorners(hx0, hy0, fx0, fy0, fx1, fy1, hx1, hy1);
    };
    door(this.panels[0], left, 1);
    door(this.panels[1], right, -1);
    this.latch.position.set(cx, ground - 90 * u);
    this.latch.visible = open < 0.05;
  }

  private placeHorse(): void {
    // Screen position, undoing the yard's own offset while it moves.
    this.horse.position.set(this.horseX * this.u - this.yard.x, this.groundY());
    this.drawClip();
  }

  private setClip(on: boolean): void {
    this.clipAtPost = on;
    this.horse.mask = on ? this.horseMask : null;
    this.drawClip();
  }

  /** Everything right of the left post, which moves with the yard. */
  private drawClip(): void {
    this.horseMask.clear();
    if (!this.clipAtPost) return;
    const left = this.yard.x + GATE_LEFT * this.u;
    this.horseMask.rect(left, 0, Math.max(0, this.w - left) + 400 * this.u, this.h).fill(0xffffff);
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

  /** A milestone: dust kicked up behind the running horse. Follows the multiplier only, like the rest of the ride. */
  /** Demo builds: the stand's tile width and scroll, and where the flashes are, so a check can see they move together. */
  debugScene(): { tileW: number; crowdX: number; flashes: number[] } {
    return { tileW: this.crowd.texture.width, crowdX: this.crowd.tilePosition.x, flashes: this.flashLayer.children.map((f) => f.x) };
  }

  kick(size = 1): void {
    if (this.mode !== 'out' || this.reduced || !this.effectsOn) return;
    const x = (this.horseX - 70) * this.u;
    this.puff(x, this.groundY(), size);
    this.puff(x - 30 * this.u, this.groundY(), size * 0.7);
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

  /**
   * Where the yard waits while the horse is out: fully off the left edge. Measured from what is drawn (an
   * open door flares past its post), so moving or widening the gate can't leave part of it on screen.
   */
  private yardAway(): number {
    // The gate and its fence only: the horse shares this layer and must not push the gate further away.
    const rightDoor = this.panels[1].getLocalBounds().maxX;
    const rightPost = this.posts[1].x + this.posts[1].width / 2;
    const fenceEnd = this.w + (7 - FENCE_INSET) * this.u;
    return -(Math.max(rightDoor, rightPost, fenceEnd) + 16 * this.u);
  }

  /**
   * The reveal: the gate, already in its final state, comes back into view the way it left, over
   * ARRIVE_SECONDS while the field scrolls. The same motion and timing for either result.
   */
  private bringYardBack(onArrived?: () => void): void {
    gsap.killTweensOf(this.yard);
    if (this.reduced) {
      this.yard.x = 0;
      onArrived?.();
      return;
    }
    this.yard.x = Math.min(this.yard.x, this.yardAway());
    this.arrival = { from: this.yard.x, t: 0, ...(onArrived ? { onArrived } : {}) };
  }

  /**
   * Scrolls the field for one frame and carries the gate with it. Riding out, the field waits for the doors,
   * eases up to speed, and a leaving gate moves by the same distance until it is off screen. Coming back,
   * the gate's approach sets the distance and the field scrolls by exactly that, starting at the heading-home
   * speed and settling as the gate stops, so the two never move apart.
   */
  private moveField(speedRef: number, dt: number): void {
    const u = this.u;
    if (this.mode === 'out') {
      if (this.fieldHeld) return;
      const ramp = this.rampFrom === null ? 1 : Math.min(1, (this.time - this.rampFrom) / 0.4);
      const d = speedRef * u * dt * ramp;
      this.scroll += d;
      if (this.departTo !== null) {
        this.yard.x = Math.max(this.departTo, this.yard.x - d);
        if (this.yard.x <= this.departTo) this.departTo = null;
      }
      return;
    }
    if (this.mode === 'arriving' && this.arrival) {
      const a = this.arrival;
      a.t += dt;
      const p = Math.min(1, a.t / ARRIVE_SECONDS);
      // Hermite curve: leaves at the heading-home speed, arrives at rest.
      const distance = -a.from;
      const k = distance > 0 ? (Math.abs(speedRef) * u * ARRIVE_SECONDS) / distance : 0;
      const h = k * (p - 2 * p * p + p * p * p) + (3 * p * p - 2 * p * p * p);
      const x = a.from + distance * h;
      this.scroll -= x - this.yard.x;
      this.yard.x = x;
      if (p >= 1) {
        this.arrival = null;
        a.onArrived?.();
      }
      return;
    }
    this.scroll += speedRef * u * dt;
  }

  private killTweens(): void {
    this.emerging = false;
    this.fieldHeld = false;
    this.departCall?.kill();
    this.departCall = null;
    this.departTo = null;
    this.rampFrom = null;
    this.arrival = null;
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.yard);
    gsap.killTweensOf(this.gateSwing);
    gsap.killTweensOf(this.crashTint);
  }

  // ---------- the paddock ----------

  /**
   * Post-and-rail fence on the gate's line, cream like the gate posts, with two rails. It runs from well
   * off the left edge to the left post and from the right post past the right edge, so the gate is its
   * only opening. Drawn in the yard, so it goes and comes back with the gate.
   */
  private drawFence(): void {
    const { u, w } = this;
    const ground = this.groundY();
    const g = this.fence.clear();
    const { far } = this.paddockDepth();
    const ink = { color: this.c.ink, width: 3 };
    const postH = 60 * u;
    const railY = [-46, -24];
    const railT = 9 * u;
    const post = (x: number, y: number, k: number) => g.roundRect(x - 7 * u * k, y - (postH - 4 * u) * k, 14 * u * k, postH * k, 3 * u).fill(this.c.cream).stroke(ink);
    const rail = (x0: number, y0: number, k0: number, x1: number, y1: number, k1: number, ry: number) => {
      const a = y0 + ry * u * k0;
      const b = y1 + ry * u * k1;
      g.poly([x0, a - (railT / 2) * k0, x1, b - (railT / 2) * k1, x1, b + (railT / 2) * k1, x0, a + (railT / 2) * k0]).fill(this.c.cream).stroke(ink);
    };
    // The right-hand side runs from the front line straight back to the rail, shrinking with distance
    // like the mown stripes it follows. The left runs off the screen edge: the pen carries on that way.
    const sideX = w - FENCE_INSET * u;
    const backY = far - 10 * u;
    const steps = 5;
    const at = (n: number) => {
      const d = n / steps;
      return { x: sideX, y: ground + (backY - ground) * d, k: 1 - 0.42 * d };
    };
    for (let n = 0; n < steps; n++) {
      const p0 = at(n);
      const p1 = at(n + 1);
      for (const ry of railY) rail(p0.x, p0.y, p0.k, p1.x, p1.y, p1.k, ry);
    }
    for (let n = steps; n > 0; n--) {
      const p = at(n);
      post(p.x, p.y, p.k);
    }
    // The front: a rail either side of the gate, with posts stepping out from the gate posts so none
    // lands in the opening.
    const spans: [number, number][] = [
      [-w - 20 * u, GATE_LEFT * u],
      [GATE_RIGHT * u, sideX],
    ];
    for (const [x0, x1] of spans) for (const ry of railY) rail(x0, ground, 1, x1, ground, 1, ry);
    for (let x = (GATE_LEFT - FENCE_SPACING) * u; x > -w; x -= FENCE_SPACING * u) post(x, ground, 1);
    for (let x = (GATE_RIGHT + FENCE_SPACING) * u; x < sideX - 10 * u; x += FENCE_SPACING * u) post(x, ground, 1);
    post(sideX, ground, 1);
  }

  /** The strip of grass between the back rail and the fence, as hoof lines in screen pixels: far and near. */
  private paddockDepth(): { far: number; near: number } {
    const crowdY = this.rays ? this.h * 0.43 : this.h * 0.3555;
    return { far: crowdY + 118 * this.u, near: this.groundY() - 34 * this.u };
  }

  /**
   * Somewhere behind the fence, mostly in view: a horse may stand partly behind the right-hand door, but
   * never so far that only its rump shows, and never inside the side fence. Tries a few times to keep
   * clear of the others, so two never graze on the same spot.
   */
  private grazeSpot(self?: Grazer): { x: number; depth: number } {
    let best = { x: GATE_RIGHT + 60, depth: 0.5 };
    for (let tries = 0; tries < 8; tries++) {
      const depth = 0.1 + Math.random() * 0.9;
      const half = (0.24 + 0.16 * depth) * 200;
      const lo = GATE_RIGHT + 24 + 0.35 * half;
      const hi = this.w / this.u - half;
      best = { x: lo + Math.random() * Math.max(10, hi - lo), depth };
      const crowded = this.grazers.some((o) => o !== self && Math.abs(o.target.x - best.x) < 75 && Math.abs(o.target.depth - depth) < 0.35);
      if (!crowded) break;
    }
    return best;
  }

  private scatterGrazers(): void {
    this.grazers.forEach((g, i) => {
      // Spread the first three so they never start on top of each other.
      g.x = [GATE_RIGHT + 55, GATE_RIGHT + 145, GATE_RIGHT + 105][i] ?? GATE_RIGHT + 60;
      g.depth = [0.85, 0.2, 0.5][i] ?? 0.5;
      g.target = { x: g.x, depth: g.depth };
      g.facing = Math.random() < 0.5 ? 1 : -1;
      g.state = 'graze';
      g.timer = 2 + Math.random() * 5;
      g.sprite.animationSpeed = 0.025;
      g.sprite.play();
    });
    this.sortPaddock();
  }

  private placeGrazer(g: Grazer): void {
    const { far, near } = this.paddockDepth();
    const scale = (0.24 + 0.16 * g.depth) * this.u * PADDOCK_ART_SCALE;
    g.sprite.position.set(g.x * this.u, far + (near - far) * g.depth);
    g.sprite.scale.set(scale * g.facing, scale);
  }

  /** Nearer horses draw in front. */
  private sortPaddock(): void {
    this.paddock.children.sort((a, b) => a.y - b.y);
  }

  private setGrazerFrames(g: Grazer, state: Grazer['state']): void {
    const { frames, coat } = { frames: this.frames, coat: g.coat };
    g.state = state;
    if (state === 'graze') {
      g.sprite.textures = [frames(`graze-${coat}-0`), frames(`graze-${coat}-1`)];
      g.sprite.animationSpeed = 0.025;
    } else if (state === 'walk') {
      g.sprite.textures = [frames(`walk-${coat}-0`), frames(`walk-${coat}-1`)];
      g.sprite.animationSpeed = 0.07;
    } else {
      g.sprite.textures = [frames(`loose-${coat}`)];
    }
    if (this.reduced) g.sprite.gotoAndStop(0);
    else g.sprite.play();
  }

  /**
   * Horses at grass: graze a while, look up, sometimes wander to another spot, graze again. Cosmetic and
   * random, with nothing from the round in it; under reduced motion they stand still at grass.
   */
  private grazeStep(dt: number): void {
    if (this.reduced) {
      for (const g of this.grazers) if (g.sprite.playing) g.sprite.gotoAndStop(0);
      return;
    }
    let moved = false;
    for (const g of this.grazers) {
      if (!g.sprite.playing) g.sprite.play();
      if (g.state === 'walk') {
        const dx = g.target.x - g.x;
        const step = WALK_SPEED * dt;
        if (Math.abs(dx) <= step) {
          g.x = g.target.x;
          g.depth = g.target.depth;
          this.setGrazerFrames(g, 'graze');
          g.timer = 3 + Math.random() * 6;
        } else {
          const total = Math.abs(g.target.x - g.x) + step;
          g.x += Math.sign(dx) * step;
          g.depth += (g.target.depth - g.depth) * (step / total);
        }
        this.placeGrazer(g);
        moved = true;
        continue;
      }
      g.timer -= dt;
      if (g.timer > 0) continue;
      if (g.state === 'graze') {
        this.setGrazerFrames(g, 'look');
        g.timer = 1 + Math.random() * 1.8;
        if (Math.random() < 0.3) g.facing = g.facing === 1 ? -1 : 1;
        this.placeGrazer(g);
      } else if (Math.random() < 0.6) {
        g.target = this.grazeSpot(g);
        g.facing = g.target.x >= g.x ? 1 : -1;
        this.setGrazerFrames(g, 'walk');
        this.placeGrazer(g);
      } else {
        this.setGrazerFrames(g, 'graze');
        g.timer = 3 + Math.random() * 6;
      }
    }
    if (moved) this.sortPaddock();
  }

  /**
   * The stand: two rows of spectators, heads and shoulders, in mixed clothing, on a dark terrace. One tile,
   * repeated across the width and scrolled slowly with the field.
   */
  private crowdTexture(app: Application): Texture {
    const W = 96;
    const H = 44;
    const g = new Graphics().rect(0, 0, W, H).fill(0x0b1522);
    const skins = [0x7a4a2b, 0x5b3620, 0x8a5a36, 0xc68642, 0x3b2314];
    const shirts = [0xd90429, 0xe8eef5, 0xffd166, 0x2f9e44, 0x1971c2, 0xf3a5b1, 0x7048e8];
    // Deterministic placement (no Math.random): the tile must join seamlessly and look the same every frame.
    const rows: [number, number, number][] = [
      [8, 6, 0.85],
      [8, 24, 1],
    ];
    rows.forEach(([x0, y, scale], r) => {
      for (let i = 0; i < 6; i++) {
        const x = x0 + i * 16 + (r % 2 ? 8 : 0);
        const skin = skins[(i + r) % skins.length]!;
        const shirt = shirts[(i * 3 + r) % shirts.length]!;
        // A figure near the right edge is drawn again one tile to the left, so the repeat has no seam.
        for (const cx of x + 7 * scale > W ? [x, x - W] : [x]) {
          g.roundRect(cx - 7 * scale, y + 6 * scale, 14 * scale, 12 * scale, 4).fill(shirt);
          g.circle(cx, y + 2 * scale, 4.2 * scale).fill(skin);
        }
      }
    });
    g.rect(0, H - 3, W, 3).fill(this.c.ink);
    // The wrapped figures spill past the tile on both sides; the texture is cut to the tile, not the drawing,
    // or the repeat would carry that spill as a gap.
    return app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, W, H) });
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
