import { AnimatedSprite, BlurFilter, Container, Graphics, PerspectiveMesh, Rectangle, RenderTexture, Sprite, TilingSprite, type Application, type Texture } from 'pixi.js';
import { gsap } from '@triptown/engine';
import { formatRevealChance, text } from '@triptown/crash-client';
import { growth, type GameConfig } from '@triptown/fairness';
import { HEADING_CUE, intensityFor, type Frames, type RevealMode } from './stage';

/**
 * The Dirt Track look (design canvas "Aerial lane · 5 variants", B, chosen 24 Sep 2026): the ride seen from
 * directly above on a sunny afternoon. The horse runs up the screen and the ground moves under it.
 *
 * The ground is the chance table. The horse gallops at one steady speed from the first stride, and every
 * painted line across the track is a value, placed where the horse will be when the value on screen reaches
 * it. Where that is comes from the game's public growth curve, which every round follows until it ends, so a
 * line reaches the horse's nose exactly when the value does and never before. The ground's position is read
 * back from the multiplier on screen (the time the curve takes to reach it), so nothing here knows when the
 * round will end: every input is the multiplier or the clock since a press (beat-the-gate-mvp spec "The gate
 * and the horse never reveal the outcome"). Painted values are kept at least MIN_GAP seconds apart.
 *
 * The camera is tilted a touch: the scene is drawn flat and shown through a perspective mesh whose far
 * (top) edge is a little narrower, so the track recedes slightly.
 *
 * The yard gate is at the bottom: the horse waits inside it, leaves through it, and the yard falls behind.
 * RIDE HOME turns the horse for home, the painted lines lift away and the ground runs the other way for the
 * fixed ride home. At the reveal the yard comes back up from the bottom with the gate open (the horse rides
 * through, and the party is the view's to call) or shut (the horse eases up well clear, turns away and
 * stands; nothing puts it close to the gate).
 */

const W = 390;
const H = 844;
/**
 * The gallop winds up through the ride: the ground passes at an easy canter at first and accelerates steadily
 * to flat out. A fixed curve of the seconds since the ride began, the same for every ride.
 */
const CANTER = 140;
const ACCEL = 35;
const FLAT_OUT = 520;
const T_FLAT = (FLAT_OUT - CANTER) / ACCEL;
/**
 * Seconds of riding between checkpoints: long at first, so each early one is real progress, then shorter as
 * the value (and the risk) climbs, down to a floor.
 */
const GAPS = [3.2, 2.7, 2.3, 2.0, 1.75, 1.55, 1.4, 1.25, 1.1, 1.0];
const MIN_GAP = 0.9;
/** Without the round's configuration (before a session), the ground falls back to K px per unit of ln(value). */
const K = 600;
/** The camera's tilt: how much narrower the far edge of the picture is, each side, in px. Enough that the
 * rails converge and everything on the ground, the painted values included, lies at the ground's angle. */
const TILT = 40;
/**
 * Where the horse's nose is while it rides out: the value on screen sits at this line. Scene positions, before
 * the camera's tilt: the tilt draws the far (upper) part of the scene smaller and higher, so these sit lower in
 * the scene than they appear on screen (with the tilt at 40, the nose lands about 470 px down the screen, the
 * idle gate about 470, the returning gate about 600). The mesh maps scene height v to screen height
 * y = v·Wt / (Wb·(1 − v) + Wt·v) on unit heights, Wt and Wb its top and bottom widths.
 */
const RIDE_NOSE = 536;
/** The horse sprite's scale, and its nose's distance from its centre at that scale. */
const HORSE_SCALE = 0.95;
const NOSE = 78;
const RIDE_C = RIDE_NOSE + NOSE;
/** Heading home the horse turns and sits higher, so its nose keeps well clear of where the gate returns. */
const HOME_C = 492;
/** Where the shut gate stops the horse: galloped home, nose a stride short of the shut doors, facing them. */
const SHUT_C = 653 - 16 - NOSE;
/** The gate line at the start, and where it stops when it comes back at the reveal. */
const GATE_IDLE = 537;
const GATE_REVEAL = 653;
/** The horse's centre while it waits in the yard, nose just inside the gate. */
const IDLE_C = GATE_IDLE + 22 + NOSE;
/** The ride home's ground speed, in px/s: fixed, the same for every press. */
const HOME_SPEED = 200;
/** The track between the rails. */
const RAIL_L = 32;
const RAIL_R = 358;
const GATE_L = 136;
const GATE_R = 254;
/** A friendly value near `m`: tenths below x2, quarters to x5, halves to x10, then whole and round numbers. */
function friendly(m: number): number {
  const step = m < 2 ? 0.1 : m < 5 ? 0.25 : m < 10 ? 0.5 : m < 20 ? 1 : m < 50 ? 5 : m < 100 ? 10 : m < 500 ? 50 : m < 1000 ? 100 : 500;
  return Number((Math.round(m / step) * step).toFixed(2));
}

/**
 * The Dirt Track's checkpoints for a configuration: the value the public growth curve reaches after each
 * gap of riding, rounded to a friendly figure, up to the round's cap. The controller marks the same values
 * (badge and sound), and the scene paints them, so the three land together. Public configuration only.
 */
export function trackCheckpoints(config: GameConfig): number[] {
  const out: number[] = [];
  let t = 0;
  for (let k = 0; k < 400; k++) {
    t += GAPS[k] ?? MIN_GAP;
    const v = friendly(growth(t, config));
    if (v > config.maxWinMultiplier) break;
    if (v > (out.at(-1) ?? 1)) out.push(v);
  }
  return out;
}

/** Seconds the growth curve takes to reach `m` (bisection on the public curve; no crash involved). */
export function secondsTo(m: number, config: GameConfig): number {
  if (m <= 1) return 0;
  let lo = 0;
  let hi = 1;
  while (growth(hi, config) < m && hi < 3600) hi *= 2;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (growth(mid, config) < m) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** The HUD card: a gold sunburst, Whack Crash's card in racing colours. main.ts checks the values against the ray. */
export const TRACK_CARD = { fill: 0xf2b705, ray: 0xe5a800, ink: 0x1a1614 };

/** Racing colours for the scene's own paint: kerbs, bunting, silks, confetti. */
const RACING = { red: 0xc8261e, cream: 0xfff4dc, gold: 0xffd24a, green: 0x2f8a3e, ink: 0x1a1614 };

const PALETTE = {
  dirt: 0xdda05c,
  groove: 0xc48f52,
  pebble: 0xb98247,
  grass: 0x4f9a34,
  grass2: 0x468c2e,
  rail: 0xfafaf5,
  railShadow: 0x9c6b36,
  ink: 0x1c1c1c,
  chalk: 0xfffdf4,
  board: 0xfafaf5,
  open: 0xb3261e,
  yard: 0xc9a47a,
  straw: 0xe2c26b,
  shade: 0x3a2410,
  cloud: 0x2a3440,
};

type Mode = 'idle' | 'out' | 'heading' | 'arriving' | 'home' | 'shut';

/** Ground speed `t` seconds into the ride, px/s. */
export const speedAt = (t: number): number => Math.min(FLAT_OUT, CANTER + ACCEL * t);

/** Ground travelled `t` seconds into the ride: the integral of speedAt. */
export const groundAt = (t: number): number =>
  t <= T_FLAT ? CANTER * t + (ACCEL * t * t) / 2 : CANTER * T_FLAT + (ACCEL * T_FLAT * T_FLAT) / 2 + FLAT_OUT * (t - T_FLAT);

/**
 * The ground's travel at a value: how far the accelerating gallop has gone by the time the public curve
 * reaches it, or, with no configuration yet, K·ln(value). The one rule that moves the track, and the one that
 * places every line.
 */
export const travelAt = (multiplier: number, config?: GameConfig): number =>
  config ? groundAt(secondsTo(multiplier, config)) : K * Math.log(Math.max(1, multiplier));

/** Where a painted value's line is on screen after `travel` px of ground: at the horse's nose when the value is reached. */
export const lineY = (value: number, travel: number, config?: GameConfig): number => RIDE_NOSE - travelAt(value, config) + travel;

/** The horse's nose while it rides out. */
export const NOSE_Y = RIDE_NOSE;

/** Deterministic noise for the ground texture, so every session draws the same track. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

interface Mark {
  value: number;
  node: Container;
  /** The painted value and chance, which pop as the line is crossed. */
  words: Container;
  /** Repaints the line white (ahead) or green (crossed). */
  paint: (crossed: boolean) => void;
  /** The glow that pulses on the next line as the horse closes on it. */
  glow: Graphics;
  passed: boolean;
}

export class TrackStage extends Container {
  private readonly scene = new Container();
  private readonly ground: TilingSprite;
  private readonly marks = new Container();
  private marksList: Mark[] = [];
  private readonly prints = new Container();
  private readonly yard = new Container();
  private readonly doors: [Sprite, Sprite];
  private readonly latch: Sprite;
  private readonly gateGlow = new Graphics();
  private readonly grazers: { sprite: Sprite; shadow: Graphics; frames: Texture[]; head: { k: number }; x: number; y: number; t: number; up: boolean; next: number }[] = [];
  /** True from a celebrated win until the next round: every head stays up. */
  private cheering = false;
  private readonly horse = new Container();
  private readonly horseShadow: AnimatedSprite;
  private readonly horseRun: AnimatedSprite;
  private readonly horseStand: Sprite;
  private readonly standShadow: Sprite;
  private readonly dust = new Container();
  /** Speed streaks rushing past on the track, thicker as the value climbs. */
  private readonly streaks = new Container();
  private streakTimer = 0;
  private readonly party = new Container();
  private readonly dark = new Graphics();
  private readonly spot = new Graphics();
  private readonly card = new Container();
  /** The scene is drawn into this and shown through the tilted mesh. */
  private readonly picture: RenderTexture;
  private readonly tilted: PerspectiveMesh;
  private config: GameConfig | undefined;

  private mode: Mode = 'idle';
  private revealMode: RevealMode = 'live';
  private multiplier = 1;
  private intensity = 0;
  private effectsOn = true;
  private reduced = false;
  /** The ground's travel in px. While out it follows K·ln(value), eased so a 0.01 step never jumps. */
  private travel = 0;
  private travelTarget = 0;
  /** Travel since the last hoof print. */
  private printStride = 0;
  private clodTimer = 0;
  /** How wound-up the gallop is, 0 (canter) to 1 (flat out): read from the value on the public curve. */
  private pace = 0;
  private time = 0;
  private marksAlpha = { a: 1 };
  private readonly doorOpen = { k: 0 };
  /** The ride home's build, 0..1, on the clock from the press only; and a kick on each drum hit. */
  private readonly build = { k: 0 };
  private readonly pulse = { v: 0 };
  private readonly dim = { k: 0 };
  private hitCalls: gsap.core.Tween[] = [];
  private arrival: { onArrived?: () => void } | null = null;

  constructor(
    private readonly app: Application,
    private readonly frames: Frames,
  ) {
    super();
    this.ground = new TilingSprite({ texture: this.groundTexture(), width: W, height: H });

    // Eight frames of one gallop stride (art/track.mjs).
    const run = Array.from({ length: 8 }, (_, i) => frames(`td-gallop-${i}`));
    this.horseRun = new AnimatedSprite(run);
    this.horseShadow = new AnimatedSprite(run);
    this.horseStand = new Sprite(frames('td-stand'));
    this.standShadow = new Sprite(frames('td-stand'));
    for (const s of [this.horseRun, this.horseShadow, this.horseStand, this.standShadow]) {
      s.anchor.set(0.5, 0.484);
      s.scale.set(HORSE_SCALE);
    }
    // Soft-edged: a hard shadow reads as a cut-out, a soft one sits the horse on the ground.
    const soft = new BlurFilter({ strength: 3, quality: 2 });
    for (const s of [this.horseShadow, this.standShadow]) {
      s.tint = 0x000000;
      s.alpha = 0.3;
      s.filters = [soft];
    }
    // The sun is high and to the upper left: shadows fall down and to the right, whichever way the horse faces.
    this.horse.addChild(this.horseStand, this.horseRun);

    // The yard, drawn from its gate line (y = 0) downwards.
    const yardGround = new Graphics().rect(0, 0, W, 640).fill(PALETTE.yard);
    const r = seeded(11);
    for (let i = 0; i < 260; i++) yardGround.rect(r() * W, r() * 640, 4 + r() * 6, 1.4).fill({ color: PALETTE.straw, alpha: 0.55 });
    for (let i = 0; i < 60; i++) yardGround.circle(r() * W, r() * 640, 1 + r() * 2).fill({ color: 0xa8845a, alpha: 0.7 });
    const fence = new Graphics();
    // The fence either side of the gate, seen from above: two rails on posts, with the posts' shadows.
    for (const [a, b] of [
      [-10, GATE_L],
      [GATE_R, W + 10],
    ] as [number, number][]) {
      fence.rect(a, 2, b - a, 5).fill({ color: PALETTE.railShadow, alpha: 0.45 });
      fence.rect(a, -4, b - a, 6).fill(PALETTE.rail).stroke({ color: PALETTE.ink, width: 1.5 });
    }
    const posts = [GATE_L - 8, GATE_R - 8, 30, 80, 300, 350].map((x) => {
      const p = new Sprite(frames('td-post'));
      p.position.set(x, -9);
      p.scale.set(0.8);
      return p;
    });
    this.doors = [new Sprite(frames('td-door')), new Sprite(frames('td-door'))];
    // Each door hangs from its post and reaches the middle; the right one is the left one turned round.
    this.doors[0].anchor.set(6 / 62, 0.5);
    this.doors[0].position.set(GATE_L, -1);
    this.doors[1].anchor.set(6 / 62, 0.5);
    this.doors[1].position.set(GATE_R, -1);
    for (const d of this.doors) d.scale.set((GATE_R - GATE_L) / 2 / 56, 1);
    this.latch = new Sprite(frames('td-latch'));
    this.latch.anchor.set(0.5);
    this.latch.position.set((GATE_L + GATE_R) / 2, -1);
    this.latch.scale.set(0.9);

    // The yard's horses, loosely about it and each at something different: the grey drinking at a trough,
    // the chestnut at a pile of hay, the dun on its own grazing and looking about, the dark bay drinking at a
    // second trough. They are side-on to the tilted camera, so they show their sides and legs, and they share
    // one drawing whose head pivots at the shoulder, so the head is the same whether up, at the water or at
    // the grass. A trough's back half is behind the horse and its front face in front, so a lowered muzzle
    // goes into the water; the hay is in front of the muzzle. Now and then one lifts its head, and on a win
    // they all do. The lane up the middle stays clear for the ridden horse.
    const underHorses: Sprite[] = [];
    const overHorses: Sprite[] = [];
    const prop = (name: string, x: number, bottom: number, scale: number, layer: Sprite[]): void => {
      const p = new Sprite(frames(name));
      p.anchor.set(0.5, 1);
      p.position.set(x, bottom);
      p.scale.set(scale);
      layer.push(p);
    };
    // Where the muzzle is, from the horse's feet, per pose (art/track.mjs sideHorse, frame 167 wide).
    const MUZZLE = { drink: { ahead: 47.1, up: 9.4 }, graze: { ahead: 34.7, up: 5.3 } };
    const yardHorses: { x: number; y: number; facing: 1 | -1; scale: number; down: 'drink' | 'graze' | 'rest'; at: 'trough' | 'hay' | null }[] = [
      { x: 86, y: 56, facing: -1, scale: 0.72, down: 'drink', at: 'trough' },
      { x: 106, y: 120, facing: -1, scale: 0.7, down: 'graze', at: 'hay' },
      // Lying down at rest, head up, now and then lifting it a little higher.
      { x: 302, y: 44, facing: 1, scale: 0.66, down: 'rest', at: null },
      { x: 292, y: 108, facing: 1, scale: 0.74, down: 'drink', at: 'trough' },
    ];
    // Head frames from lowered to raised (art/track.mjs YARD_POSES): 6 for the standing horses, 4 for the nod.
    const HEAD_FRAMES = [6, 6, 4, 6];
    yardHorses.forEach((h, i) => {
      const head = Array.from({ length: HEAD_FRAMES[i]! }, (_, k) => frames(`yard-${i}-${k}`));
      const s = new Sprite(head[0]);
      s.anchor.set(0.5, 274 / 300);
      // The yard drawings are declared 120 wide (art/track.mjs); positions and muzzles were measured at 167.
      const SIDE_SCALE = 167 / 120;
      s.scale.set(h.scale * h.facing * SIDE_SCALE, h.scale * SIDE_SCALE);
      const shadow = new Graphics().ellipse(0, 0, (h.down === 'rest' ? 72 : 62) * h.scale, 10 * h.scale).fill({ color: 0x000000, alpha: 0.3 });
      shadow.filters = [soft];
      this.grazers.push({ sprite: s, shadow, frames: head, head: { k: 0 }, x: h.x, y: h.y, t: 0, up: false, next: 0.6 + Math.random() * 6 });
      if (h.down === 'rest') return;
      const m = MUZZLE[h.down];
      const mx = h.x + h.facing * m.ahead * h.scale;
      const my = h.y - m.up * h.scale;
      if (h.at === 'trough') {
        // The water's centre line (16 units above the trough's foot) at the muzzle's height, and the trough
        // set forward so its near end clears the forelegs: the muzzle dips in over the back of the water.
        const bottom = my + 16 * 0.8;
        prop('tub-back', mx + h.facing * 18, bottom, 0.8, underHorses);
        prop('tub-front', mx + h.facing * 18, bottom, 0.8, overHorses);
      } else if (h.at === 'hay') {
        // Set forward, so the horse stands clear of the pile and eats from its near edge.
        prop('side-hay', mx + h.facing * 24, h.y + 5, 0.8, overHorses);
      }
    });
    this.gateGlow.position.set((GATE_L + GATE_R) / 2, -4);
    // The fence and gate are at the back of the yard, so the yard's horses (nearer the camera) are drawn over
    // them: a raised head passes in front of a rail, never behind it.
    this.yard.addChild(yardGround, this.gateGlow, fence, ...posts, this.doors[0], this.doors[1], this.latch, ...this.grazers.map((g) => g.shadow), ...underHorses, ...this.grazers.map((g) => g.sprite), ...overHorses);

    this.scene.addChild(this.ground, this.prints, this.streaks, this.marks, this.yard, this.standShadow, this.horseShadow, this.horse, this.dust, this.party, this.dark, this.spot);
    // The scene is drawn flat into a texture each frame and shown through a mesh whose far edge is a little
    // narrower: the slight tilt of a camera looking up the track. Grass behind fills the corners the
    // narrower edge leaves. The HUD card sits over it all, flat, under the shared screen's words; the ride
    // home's shade is in the scene, under the card, so the value and the chance never dim.
    this.picture = RenderTexture.create({ width: W, height: H, resolution: Math.min(2, globalThis.devicePixelRatio || 1) });
    this.tilted = new PerspectiveMesh({ texture: this.picture, verticesX: 12, verticesY: 16 });
    this.tilted.setCorners(TILT, 0, W - TILT, 0, W + TILT * 0.5, H, -TILT * 0.5, H);
    const behind = new Graphics().rect(0, 0, W, H).fill(PALETTE.grass);
    this.addChild(behind, this.tilted, this.card);
    this.drawCard();
    this.idle();
  }

  // ---------- GameStage ----------

  setMultiplier(multiplier: number): void {
    this.multiplier = Math.max(1, multiplier);
    this.intensity = intensityFor(this.multiplier);
    this.pace = this.config ? (speedAt(secondsTo(this.multiplier, this.config)) - CANTER) / (FLAT_OUT - CANTER) : this.intensity;
    // Never backwards while out: a live round's setback lowers the value, not the ground already ridden.
    if (this.mode === 'out') this.travelTarget = Math.max(this.travelTarget, travelAt(this.multiplier, this.config));
  }

  setEffectsEnabled(on: boolean): void {
    this.effectsOn = on;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  reset(): void {
    this.idle();
  }

  /** CRASH arrived: in Gate Rush the shut reveal after heading home; live, the gate comes back shut now. */
  onCrash(): void {
    this.revealShut();
  }

  setRevealMode(mode: RevealMode): void {
    this.revealMode = mode;
    this.idle();
  }

  /**
   * The round's configuration: its growth curve places the painted values and moves the ground. With
   * `chances` (Gate Rush) each board gives the chance the gate is open there, by the same formula as the
   * chance line and the rules (RTP ÷ value, rounded down); live, the boards give the value alone.
   */
  setLadder(config: GameConfig, chances: boolean): void {
    this.config = config;
    for (const m of this.marksList) {
      for (const c of m.words.children) gsap.killTweensOf(c.scale);
      m.node.destroy({ children: true });
    }
    this.marksList = [];
    for (const value of trackCheckpoints(config)) {
      const mark: Mark = { value, passed: false, ...this.markFor(value, chances ? formatRevealChance(config.rtp, value) : null) };
      this.marks.addChild(mark.node);
      this.marksList.push(mark);
    }
    this.placeMarks();
  }

  // ---------- states ----------

  /** Betting: the horse waits inside the shut gate; the first values are painted on the track beyond. */
  idle(): void {
    this.killTweens();
    this.mode = 'idle';
    this.travel = this.travelTarget = 0;
    this.ground.tilePosition.y = 0;
    this.marksAlpha.a = 1;
    this.prints.removeChildren().forEach((c) => c.destroy());
    this.dust.removeChildren().forEach((c) => c.destroy());
    for (const c of [...this.streaks.children]) this.drop(c as Graphics);
    for (const c of [...this.party.children]) this.drop(c as Graphics);
    this.gateGlow.clear();
    this.yard.visible = true;
    this.yard.y = GATE_IDLE;
    this.setDoors(0);
    this.latch.scale.set(0.9);
    this.build.k = 0;
    this.pulse.v = 0;
    this.dim.k = 0;
    this.drawDim();
    this.drawSpot();
    this.cheering = false;
    for (const g of this.grazers) {
      gsap.killTweensOf(g.head);
      g.up = false;
      g.head.k = 0;
      g.next = 0.6 + Math.random() * 6;
      g.sprite.texture = g.frames[0]!;
    }
    this.placeHorse(IDLE_C, 0, 'stand');
    this.placeMarks();
  }

  /**
   * Round start: the doors swing open, the horse walks out through them to its riding line, and the ground
   * takes over. Called again after a refused RIDE HOME, when the horse is already out: it just rides on.
   */
  rideOut(): void {
    const fromYard = this.mode === 'idle';
    this.killTweens();
    this.mode = 'out';
    this.marksAlpha.a = 1;
    this.travelTarget = Math.max(fromYard ? 0 : this.travelTarget, travelAt(this.multiplier, this.config));
    if (!fromYard) {
      this.placeHorse(RIDE_C, 0, 'run');
      return;
    }
    if (this.reduced) {
      this.setDoors(1);
      this.placeHorse(RIDE_C, 0, 'run');
      return;
    }
    gsap.to(this.doorOpen, { k: 1, duration: 0.5, ease: 'power2.inOut', onUpdate: () => this.setDoors(this.doorOpen.k) });
    this.placeHorse(IDLE_C, 0, 'run');
    gsap.to(this.horse, { y: RIDE_C, duration: 0.75, delay: 0.2, ease: 'power1.out', onUpdate: () => this.followShadow() });
  }

  /**
   * Gate Rush: RIDE HOME. The horse turns for home, the painted values lift off the ground, and the ground
   * runs the other way at the fixed home speed while the ride home builds: the shade closes in on the horse
   * and the stride quickens, both on the clock from the press. Identical for every outcome.
   */
  headHome(): void {
    this.killTweens();
    this.mode = 'heading';
    this.yard.visible = false;
    this.placeHorse(this.horse.y, this.horse.rotation, 'run');
    if (this.reduced) {
      this.placeHorse(HOME_C, Math.PI, 'run');
      this.marksAlpha.a = 0;
      this.build.k = 0.5;
      this.placeMarks();
      this.drawSpot();
      return;
    }
    gsap.to(this.horse, { rotation: Math.PI, duration: 0.42, ease: 'power2.inOut', onUpdate: () => this.followShadow() });
    gsap.to(this.horse, { y: HOME_C, duration: 0.6, ease: 'power1.inOut', onUpdate: () => this.followShadow() });
    gsap.to(this.marksAlpha, { a: 0, duration: 0.35, onUpdate: () => this.placeMarks() });
    gsap.to(this.build, { k: 1, duration: HEADING_CUE.seconds, ease: 'power1.in' });
    this.hitCalls = HEADING_CUE.hits.map((at, i) =>
      gsap.delayedCall(at, () => {
        this.pulse.v = 0.6 + (0.4 * i) / Math.max(1, HEADING_CUE.hits.length - 1);
        gsap.to(this.pulse, { v: 0, duration: 0.28, ease: 'power2.out' });
        if (this.effectsOn) this.kickDust(0.6 + 0.12 * i);
      }),
    );
  }

  /** Gate Rush, settled as won: the yard comes back up with the gate open and the horse rides home through it. */
  revealOpen(): void {
    this.killTweens();
    this.releaseBuild();
    this.setDoors(1);
    this.bringYardBack();
    if (this.reduced) {
      this.placeHorse(H + 200, Math.PI, 'run');
      this.mode = 'home';
      return;
    }
    this.placeHorse(this.horse.y, Math.PI, 'run');
    // On home at the gallop, through the open gate and into the yard beyond.
    gsap.to(this.horse, {
      y: H + 220,
      duration: 1.9,
      delay: 0.25,
      ease: 'none',
      onUpdate: () => this.followShadow(),
      onComplete: () => {
        this.mode = 'home';
        gsap.to(this.doorOpen, { k: 0, duration: 0.5, ease: 'power2.inOut', onUpdate: () => this.setDoors(this.doorOpen.k) });
      },
    });
  }

  /** Live (Beat the Gate): a confirmed cash-out rides home through the open gate, as Gate Rush's win. */
  rideHome(onDone?: () => void): void {
    this.revealOpen();
    if (onDone) gsap.delayedCall(2, onDone);
  }

  /**
   * Settled as lost: the yard comes back with the gate already shut, and the horse gallops on home to it and
   * pulls up at the shut doors, facing them. The light drops as a cloud covers the sun, in two steps with the
   * two thunks in the sound, and stays down. The gate is shut from the moment it is seen: the horse arrives
   * at a closed gate, it is never beaten to it.
   */
  revealShut(): void {
    this.killTweens();
    this.releaseBuild();
    this.setDoors(0);
    this.coverSun();
    this.bringYardBack(() => {
      if (this.reduced || !this.effectsOn) return;
      // The gate is home and shut: the latch drops into place and dust kicks up at each post.
      gsap.fromTo(this.latch.scale, { x: 1.5, y: 1.5 }, { x: 0.9, y: 0.9, duration: 0.3, ease: 'bounce.out' });
      this.puff(GATE_L, this.yard.y + 4, 0.7);
      this.puff(GATE_R, this.yard.y + 4, 0.7);
    });
    const halt = () => {
      this.mode = 'shut';
      this.placeHorse(SHUT_C, Math.PI, 'stand');
      if (!this.reduced && this.effectsOn) this.kickDustAt(SHUT_C + 62, 0.7);
    };
    if (this.reduced) {
      halt();
      return;
    }
    this.placeHorse(this.horse.y, Math.PI, 'run');
    gsap.to(this.horse, { y: SHUT_C, duration: 1.1, delay: 0.25, ease: 'power2.out', onUpdate: () => this.followShadow(), onComplete: halt });
  }

  /** Live: CRASH while out. The same as the shut reveal: the gate is seen shut, the horse far from it. */
  slamGate(_instant = false): void {
    this.revealShut();
  }

  /** A milestone: dust kicked up behind the running horse and a surge of stride. Multiplier-driven only. */
  kick(size = 1): void {
    if (this.mode !== 'out' || this.reduced || !this.effectsOn) return;
    this.kickDust(size);
    gsap.to(this.horse, { y: RIDE_C - 10 * size, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', onUpdate: () => this.followShadow() });
  }

  /**
   * A return above the stake, and only then: the caller asks the base's celebrate decision first. Sun rays
   * burst from the gate, fireworks go up over the track and the horses at grass look up.
   */
  celebrate(big: boolean): void {
    if (this.reduced || !this.effectsOn) return;
    const g = this.gateGlow;
    g.clear();
    const rays = 20;
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2;
      const a1 = a0 + Math.PI / rays;
      g.poly([0, 0, Math.cos(a0) * 460, Math.sin(a0) * 460, Math.cos(a1) * 460, Math.sin(a1) * 460]).fill({ color: 0xfff1a8, alpha: 0.45 });
    }
    g.alpha = 1;
    g.scale.set(0.2);
    g.rotation = 0;
    gsap.to(g.scale, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2)' });
    gsap.to(g, { rotation: 0.5, duration: 2.8, ease: 'none' });
    gsap.to(g, { alpha: 0, duration: 0.8, delay: 2, onComplete: () => g.clear() });
    this.cheering = true;
    for (const z of this.grazers) this.moveHead(z, true);
    const shots = big ? 9 : 5;
    for (let i = 0; i < shots; i++) {
      gsap.delayedCall(0.05 + i * (big ? 0.22 : 0.3), () => this.firework(40 + Math.random() * (W - 80), 250 + Math.random() * 260, big));
    }
  }

  /** Demo builds: kept for the shared debug hook. */
  debugScene(): { tileW: number; crowdX: number; flashes: number[] } {
    return { tileW: W, crowdX: this.ground.tilePosition.y, flashes: [] };
  }

  // ---------- frame ----------

  update(dt: number): void {
    this.time += dt;
    const before = this.travel;
    if (this.mode === 'out') {
      // Eased towards the value's place: smooth between the 0.01 steps the value is shown in, never ahead of it.
      this.travel += (this.travelTarget - this.travel) * Math.min(1, dt * 7);
    } else if (this.mode === 'heading' && !this.reduced) {
      this.travel -= HOME_SPEED * dt;
    } else if (this.mode === 'arriving' && this.arrival) {
      // The yard comes back fixed to the ground: both move by the same amount, slowing as the gate arrives.
      const left = this.yard.y - GATE_REVEAL;
      const step = Math.min(left, Math.max(40, Math.min(420, left * 6)) * dt);
      this.yard.y -= step;
      this.travel -= step;
      if (left - step <= 0.5) {
        this.yard.y = GATE_REVEAL;
        const done = this.arrival.onArrived;
        this.arrival = null;
        this.mode = this.mode === 'arriving' ? 'home' : this.mode;
        done?.();
      }
    }
    const moved = this.travel - before;
    this.ground.tilePosition.y = this.travel;
    for (const p of this.prints.children) p.y += moved;
    if (this.mode === 'out') this.yard.y = GATE_IDLE + this.travel;
    this.placeMarks();

    const running = this.mode === 'out' || this.mode === 'heading' || this.mode === 'arriving' || this.mode === 'home';
    if (running && !this.reduced) {
      this.horseRun.animationSpeed =
        this.mode === 'heading' ? 0.36 + 0.1 * this.build.k : this.effectsOn ? 0.28 + 0.26 * this.pace : 0.3;
      if (!this.horseRun.playing) this.horseRun.play();
      this.leaveTracks(Math.abs(moved), dt);
      this.streakStep(moved, dt);
    } else {
      this.horseRun.stop();
    }
    this.followShadow();
    this.grazeStep(dt);
    if (this.build.k > 0 || this.spot.visible) this.drawSpot();
    this.app.renderer.render({ container: this.scene, target: this.picture, clear: true });
  }

  // ---------- internals ----------

  private placeHorse(y: number, rotation: number, pose: 'run' | 'stand'): void {
    this.horse.position.set(W / 2, y);
    this.horse.rotation = rotation;
    const run = pose === 'run';
    this.horseRun.visible = run;
    this.horseShadow.visible = run;
    this.horseStand.visible = !run;
    this.standShadow.visible = !run;
    if (!run) this.horseRun.stop();
    this.followShadow();
  }

  /** The shadow falls down and to the right of the horse, whichever way it faces. */
  private followShadow(): void {
    for (const s of [this.horseShadow, this.standShadow]) {
      s.position.set(this.horse.x + 12, this.horse.y + 9);
      s.rotation = this.horse.rotation;
    }
    // The shadow is never played on its own: it shows whatever frame the horse is on.
    if (this.horseShadow.currentFrame !== this.horseRun.currentFrame) this.horseShadow.currentFrame = this.horseRun.currentFrame;
  }

  private setDoors(k: number): void {
    this.doorOpen.k = k;
    // Swung out towards the track as the horse leaves; shut, each reaches the latch.
    this.doors[0].rotation = -k * 1.75;
    this.doors[1].rotation = Math.PI + k * 1.75;
    this.latch.visible = k < 0.05;
  }

  /** Each painted value where it falls: K·ln(value) above the horse's nose at value 1, moved by the ground. */
  private placeMarks(): void {
    const shown = this.mode === 'out' || this.mode === 'idle' || this.marksAlpha.a > 0;
    this.marks.visible = shown;
    if (!shown) return;
    const travelled = this.mode === 'idle' ? 0 : this.travel;
    for (const m of this.marksList) {
      const y = lineY(m.value, travelled, this.config);
      m.node.y = y;
      const passed = m.value <= this.multiplier + 1e-9 && this.mode !== 'idle';
      m.node.visible = y > 150 && y < H + 20 && (this.mode !== 'idle' || y < GATE_IDLE - 10);
      m.node.alpha = this.marksAlpha.a;
      // The line just ahead pulses as the horse closes on it: its distance is the value's, nothing else.
      const ahead = RIDE_NOSE - y;
      const near = this.mode === 'out' && !passed && ahead > 0 && ahead < 200 ? 1 - ahead / 200 : 0;
      m.glow.alpha = near * (0.55 + 0.45 * Math.sin(this.time * (10 + 14 * this.pace)));
      if (passed !== m.passed) {
        m.passed = passed;
        m.paint(passed);
        // Crossed: a flash as the value on screen goes past it, then the line is just paint behind the horse.
        // No tick and no "done" colour: a checkpoint is a point on the risk curve, not an objective met.
        if (passed && this.mode === 'out' && !this.reduced) {
          if (this.effectsOn) this.splash(y);
          // Each piece pops about its own anchor, so nothing slides along the line.
          for (const w of m.words.children) gsap.fromTo(w.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(3)' });
        }
      }
    }
  }

  /**
   * One painted value, and its checkpoint: a thick stripe across the track, white ahead of the horse, flashing
   * yellow as it is crossed and then left behind as faded paint. Deliberately no tick or "done" colour: the
   * lines mark how far the value has risen, and the chance with it, never a target to reach. The value is painted big on the ground
   * left of the horse and the chance right of it, just ahead of the stripe, in the same worn white road paint,
   * flattened to lie on the ground; the tilted camera then lays everything at the ground's angle.
   */
  private markFor(value: number, chance: string | null): Omit<Mark, 'value' | 'passed'> {
    const node = new Container();
    const band = new Graphics();
    const glow = new Graphics();
    const x0 = RAIL_L + 14;
    const w = RAIL_R - RAIL_L - 28;
    glow.roundRect(x0 - 6, -20, w + 12, 34, 10).fill({ color: 0xffe14d, alpha: 0.55 });
    glow.alpha = 0;
    const paint = (crossed: boolean, flash = false): void => {
      band.clear();
      band.rect(x0 + 2, -6, w, 18).fill({ color: PALETTE.railShadow, alpha: 0.35 });
      band.rect(x0, -9, w, 18).fill({ color: flash ? 0xffe14d : PALETTE.chalk, alpha: crossed && !flash ? 0.45 : 1 });
      // Worn paint: the dirt shows through in a few places, the same places every time.
      const r = seeded(Math.round(value * 1000));
      for (let k = 0; k < 9; k++) band.rect(x0 + r() * w, -9 + r() * 16, 3 + r() * 9, 2).fill({ color: PALETTE.dirt, alpha: 0.55 });
    };
    paint(false);
    // Road paint: white with a thin sun-baked edge, no sticker outline, squashed to lie flat on the ground.
    const painted = (words: string, size: number) => {
      const t = text(words, { fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800', fontSize: size, fill: 0xfffdf4, stroke: { color: 0xa8743c, width: 2.5, join: 'round' }, padding: 6 }, [0.5, 1]);
      t.scale.y = 0.78;
      return t;
    };
    const words = new Container();
    const label = value >= 1000 ? `x${Math.round(value).toLocaleString('en-US')}` : `x${Number(value.toFixed(2))}`;
    const left = painted(label, 50);
    left.position.set((x0 + W / 2 - 48) / 2, -12);
    words.addChild(left);
    if (chance !== null) {
      const right = painted(`OPEN ${chance}`, 26);
      right.position.set((W / 2 + 48 + x0 + w) / 2, -14);
      words.addChild(right);
    }
    node.addChild(glow, band, words);
    return {
      node,
      words,
      glow,
      paint: (crossed: boolean) => {
        if (!crossed || this.reduced) return paint(crossed);
        // Crossed: a yellow flash, then faded paint.
        paint(true, true);
        gsap.delayedCall(0.12, () => paint(true));
      },
    };
  }

  /** Paint confetti off a crossed line: a burst of coloured flecks that spray out and fall. */
  private splash(y: number): void {
    const colours = [RACING.gold, RACING.red, RACING.green, RACING.cream];
    for (let i = 0; i < 28; i++) {
      const f = new Graphics().rect(-3, -2, 6, 4).fill(colours[i % colours.length]!);
      f.position.set(RAIL_L + 20 + Math.random() * (RAIL_R - RAIL_L - 40), y);
      f.rotation = Math.random() * Math.PI;
      this.dust.addChild(f);
      const dx = (Math.random() - 0.5) * 70;
      gsap.to(f, { x: f.x + dx, y: y - 30 - Math.random() * 60, rotation: f.rotation + (Math.random() - 0.5) * 6, duration: 0.35, ease: 'power2.out' });
      gsap.to(f, { y: y + 20, alpha: 0, duration: 0.45, delay: 0.35, ease: 'power2.in', onComplete: () => this.drop(f) });
    }
  }

  /** Speed streaks: pale lines rushing past either side of the horse, more of them as the value climbs. */
  private streakStep(moved: number, dt: number): void {
    for (const st of [...this.streaks.children]) {
      st.y += moved * 2.4;
      st.alpha -= dt * 1.2;
      if (st.alpha <= 0 || st.y > H + 40 || st.y < -40) this.drop(st as Graphics);
    }
    if (this.reduced || !this.effectsOn || (this.mode !== 'out' && this.mode !== 'heading')) return;
    this.streakTimer -= dt;
    if (this.streakTimer > 0) return;
    const k = this.mode === 'heading' ? this.build.k : this.pace;
    this.streakTimer = 0.2 - 0.17 * k;
    const leftSide = Math.random() < 0.5;
    const x = leftSide ? RAIL_L + 18 + Math.random() * 100 : RAIL_R - 18 - Math.random() * 100;
    const len = 24 + k * 70 + Math.random() * 40;
    const st = new Graphics().roundRect(-1.5, -len / 2, 3, len, 1.5).fill({ color: 0xffffff });
    st.position.set(x, 180 + Math.random() * 380);
    st.alpha = 0.25 + 0.45 * k;
    this.streaks.addChild(st);
  }

  /** Hoof prints in pairs as the ground passes, and clods of dirt thrown up behind. */
  private leaveTracks(moved: number, dt: number): void {
    const facingUp = Math.abs(this.horse.rotation) < Math.PI / 2;
    const hindY = this.horse.y + (facingUp ? 58 : -58);
    this.printStride += moved;
    if (this.printStride > 34 && this.mode !== 'home') {
      this.printStride = 0;
      const n = this.prints.children.length;
      for (const dx of [-9, 9]) {
        const p = new Graphics()
          .moveTo(-3, 0)
          .bezierCurveTo(-3.5, 5, 3.5, 5, 3, 0)
          .stroke({ color: 0x8a5a2b, width: 2, cap: 'round' });
        p.position.set(W / 2 + dx + (n % 4 === 0 ? -3 : 3), hindY);
        p.rotation = facingUp ? 0 : Math.PI;
        p.alpha = 0.7;
        this.prints.addChild(p);
      }
    }
    for (const p of [...this.prints.children]) {
      p.alpha -= dt * 0.18;
      if (p.alpha <= 0 || p.y > H + 20 || p.y < -20) p.destroy();
    }
    if (!this.effectsOn) return;
    this.clodTimer -= dt;
    if (this.clodTimer > 0) return;
    this.clodTimer = 0.12 - 0.08 * (this.mode === 'heading' ? this.build.k : this.pace);
    for (let i = 0; i < 2; i++) {
      const c = new Graphics().circle(0, 0, 1.4 + Math.random() * 2).fill(0xa8743c);
      c.position.set(W / 2 + (Math.random() - 0.5) * 22, hindY);
      this.dust.addChild(c);
      const dir = facingUp ? 1 : -1;
      gsap.to(c, { x: c.x + (Math.random() - 0.5) * 30, y: c.y + dir * (20 + Math.random() * 30), alpha: 0, duration: 0.45, ease: 'power2.out', onComplete: () => this.drop(c) });
    }
  }

  /** Dust where the forefeet pull up. */
  private kickDustAt(y: number, size: number): void {
    this.puff(W / 2 - 12, y, size);
    this.puff(W / 2 + 12, y, size * 0.8);
  }

  private kickDust(size: number): void {
    const facingUp = Math.abs(this.horse.rotation) < Math.PI / 2;
    const y = this.horse.y + (facingUp ? 64 : -64);
    this.puff(W / 2 - 14, y, size);
    this.puff(W / 2 + 14, y, size * 0.8);
  }

  private puff(x: number, y: number, size: number): void {
    const s = new Sprite(this.frames('td-dust'));
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set(0.3 * size);
    s.alpha = 0.9;
    this.dust.addChild(s);
    gsap.to(s.scale, { x: 0.75 * size, y: 0.75 * size, duration: 0.45, ease: 'power2.out' });
    gsap.to(s, { alpha: 0, duration: 0.45, delay: 0.35, onComplete: () => this.drop(s) });
  }

  /** The horses at grass: heads down, shifting a step now and then. They look up only for a celebrated win. */
  /** Lifts or lowers a yard horse's head through its frames: smoothly, raising a touch quicker than lowering. */
  private moveHead(g: (typeof this.grazers)[number], up: boolean): void {
    const last = g.frames.length - 1;
    gsap.killTweensOf(g.head);
    if (this.reduced) {
      g.head.k = up ? last : 0;
      g.sprite.texture = g.frames[g.head.k]!;
      return;
    }
    gsap.to(g.head, {
      k: up ? last : 0,
      // Each movement a little different in speed.
      duration: (up ? 0.3 : 0.42) * (0.8 + Math.random() * 0.5),
      ease: 'sine.inOut',
      onUpdate: () => {
        g.sprite.texture = g.frames[Math.round(g.head.k)]!;
      },
    });
  }

  /** The row at the trough: heads down drinking, one lifting its head now and then. Decoration only. */
  private grazeStep(dt: number): void {
    for (const g of this.grazers) {
      g.t += dt;
      g.next -= dt;
      if (!this.cheering && !this.reduced && g.next <= 0) {
        // Each horse on its own clock: sometimes a quick glance up, sometimes a long look, and long spells
        // with its head down. Nothing in step with the others.
        g.up = !g.up;
        g.next = g.up ? (Math.random() < 0.35 ? 0.5 + Math.random() * 0.6 : 1.4 + Math.random() * 3) : 2.5 + Math.random() * 8;
        this.moveHead(g, g.up);
      }
      g.sprite.position.set(g.x, g.y);
      g.shadow.position.set(g.x + 6, g.y - 1);
    }
  }

  private bringYardBack(onArrived?: () => void): void {
    this.yard.visible = true;
    if (this.reduced) {
      this.yard.y = GATE_REVEAL;
      this.mode = 'arriving';
      this.arrival = null;
      onArrived?.();
      return;
    }
    // It comes up from just behind the stake row, so the gate is in view almost as the result shows.
    // Always from the same place, however far the ride went: the reveal takes the same time for every round.
    this.yard.y = H - 60;
    this.mode = 'arriving';
    this.arrival = onArrived ? { onArrived } : {};
  }

  /** Loss: a cloud comes over the sun in two steps, then stays: the whole scene cools and dims a little. */
  private coverSun(): void {
    const settled = 0.45;
    if (this.reduced) {
      this.dim.k = settled;
      this.drawDim();
      return;
    }
    const draw = () => this.drawDim();
    gsap
      .timeline({ onUpdate: draw })
      .set(this.dim, { k: 0.8 })
      .to(this.dim, { k: 0.35, duration: 0.1 }, 0.06)
      .set(this.dim, { k: 0.8 }, 0.22)
      .to(this.dim, { k: settled, duration: 0.6, ease: 'power2.out' }, 0.32);
    draw();
  }

  private drawDim(): void {
    this.dark.clear();
    this.dark.visible = this.dim.k > 0;
    if (this.dark.visible) this.dark.rect(0, 0, W, H).fill({ color: PALETTE.cloud, alpha: 0.42 * this.dim.k });
  }

  /** The ride home's shade: a soft-edged hole around the horse that tightens and deepens with the build. */
  private drawSpot(): void {
    const k = this.build.k;
    this.spot.clear();
    this.spot.visible = k > 0.001;
    if (!this.spot.visible) return;
    const r = (320 - 210 * k) * (1 + 0.1 * this.pulse.v);
    const alpha = Math.min(0.85, 0.7 * k * (1 - 0.3 * this.pulse.v));
    const { x, y } = this.horse;
    this.spot.rect(0, 0, W, H).fill({ color: PALETTE.shade, alpha: alpha * 0.5 }).circle(x, y, r * 1.35).cut();
    this.spot.rect(0, 0, W, H).fill({ color: PALETTE.shade, alpha: alpha * 0.5 }).circle(x, y, r).cut();
  }

  private releaseBuild(): void {
    if (this.build.k <= 0) return;
    if (this.reduced) {
      this.build.k = 0;
      this.drawSpot();
      return;
    }
    gsap.to(this.build, { k: 0, duration: 0.25, ease: 'power2.out', onUpdate: () => this.drawSpot() });
  }

  /** One firework over the track: the shell bursts into a ring of stars that falls a little and fades. */
  private firework(x: number, y: number, big: boolean): void {
    const colours = [RACING.red, RACING.gold, RACING.green, RACING.cream];
    const colour = colours[Math.floor(Math.random() * colours.length)]!;
    const sparks = big ? 28 : 20;
    const radius = (big ? 90 : 66) * (0.8 + Math.random() * 0.4);
    const core = new Graphics().circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.95 });
    core.position.set(x, y);
    this.party.addChild(core);
    gsap.to(core.scale, { x: 3, y: 3, duration: 0.25 });
    gsap.to(core, { alpha: 0, duration: 0.25, onComplete: () => this.drop(core) });
    for (let i = 0; i < sparks; i++) {
      const a = (i / sparks) * Math.PI * 2 + Math.random() * 0.2;
      const s = new Graphics().circle(0, 0, 3.2).fill(i % 4 === 0 ? 0xffffff : colour).stroke({ color: PALETTE.ink, width: 1 });
      s.position.set(x, y);
      this.party.addChild(s);
      gsap.to(s, { x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius + 26, duration: 0.9 + Math.random() * 0.3, ease: 'power3.out' });
      gsap.to(s, { alpha: 0, duration: 0.5, delay: 0.6 + Math.random() * 0.3, onComplete: () => this.drop(s) });
    }
  }

  /** Removes a short-lived piece, stopping every tween on it first so none writes to it once destroyed. */
  private drop(g: Container): void {
    gsap.killTweensOf(g);
    gsap.killTweensOf(g.scale);
    g.destroy();
  }

  private killTweens(): void {
    gsap.killTweensOf(this.horse);
    gsap.killTweensOf(this.doorOpen);
    gsap.killTweensOf(this.marksAlpha);
    gsap.killTweensOf(this.build);
    gsap.killTweensOf(this.pulse);
    gsap.killTweensOf(this.dim);
    gsap.killTweensOf(this.latch.scale);
    gsap.killTweensOf(this.gateGlow);
    gsap.killTweensOf(this.gateGlow.scale);
    for (const c of this.hitCalls) c.kill();
    this.hitCalls = [];
    this.arrival = null;
  }

  /** The HUD card the shared screen writes the value, the money and the chance on. */
  private drawCard(): void {
    const { fill, ray, ink } = TRACK_CARD;
    const x = 12;
    const y = 12;
    const w = W - 24;
    const h = 214;
    const r = 16;
    // Hard ink drop shadow, then the gold face with its sunburst, clipped to the card by a mask.
    const face = new Graphics().roundRect(x, y + 5, w, h, r).fill(ink).roundRect(x, y, w, h, r).fill(fill);
    const rays = new Graphics();
    const cx = W / 2;
    const cy = y + h * 0.62;
    const n = 40;
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      rays.poly([cx, cy, cx + Math.cos(a0) * 400, cy + Math.sin(a0) * 400, cx + Math.cos(a1) * 400, cy + Math.sin(a1) * 400]).fill(ray);
    }
    const clip = new Graphics().roundRect(x, y, w, h, r).fill(0xffffff);
    rays.mask = clip;
    const edge = new Graphics().roundRect(x, y, w, h, r).stroke({ color: ink, width: 3.5 });
    this.card.addChild(face, rays, clip, edge);
  }

  /** Harrowed dirt between white rails on grass verges, one tile tall; the posts are part of it, so they pass with the ground. */
  private groundTexture(): Texture {
    const TILE = 512;
    const r = seeded(20260924);
    const g = new Graphics().rect(0, 0, W, TILE).fill(PALETTE.dirt);
    for (let x = RAIL_L + 8; x < RAIL_R - 4; x += 5) g.rect(x, 0, 1.4, TILE).fill({ color: PALETTE.groove, alpha: 0.35 + 0.3 * r() });
    for (let i = 0; i < 70; i++) g.circle(RAIL_L + 8 + r() * (RAIL_R - RAIL_L - 16), r() * TILE, 1 + r() * 1.8).fill({ color: PALETTE.pebble, alpha: 0.65 });
    for (let i = 0; i < 16; i++) g.ellipse(RAIL_L + 20 + r() * (RAIL_R - RAIL_L - 40), r() * TILE, 3 + r() * 3, 1.6).fill({ color: 0xc0864a, alpha: 0.6 });
    g.rect(0, 0, RAIL_L - 4, TILE).fill(PALETTE.grass).rect(RAIL_R + 4, 0, W - RAIL_R - 4, TILE).fill(PALETTE.grass);
    for (let i = 0; i < 90; i++) {
      const left = i % 2 === 0;
      const x = left ? r() * (RAIL_L - 8) : RAIL_R + 6 + r() * (W - RAIL_R - 8);
      g.moveTo(x, r() * TILE)
        .lineTo(x + (r() - 0.5) * 3, 0)
        .stroke({ color: PALETTE.grass2, width: 1.2 });
    }
    // Racing kerbs just inside each rail, red and white, 32 px a block, so they scroll with the ground.
    for (const kx of [RAIL_L + 3, RAIL_R - 13]) {
      for (let y = 0; y < TILE; y += 32) g.rect(kx, y, 10, 32).fill((y / 32) % 2 ? RACING.cream : RACING.red);
      g.rect(kx, 0, 10, TILE).stroke({ color: PALETTE.ink, width: 1, alpha: 0.35 });
    }
    // Bunting along the outside of each rail: pennants in bright colours on a line.
    const pennants = [RACING.red, RACING.cream, RACING.ink];
    for (const [bx, dir] of [[RAIL_L - 9, -1], [RAIL_R + 9, 1]] as [number, number][]) {
      g.moveTo(bx, 0).lineTo(bx, TILE).stroke({ color: 0x333333, width: 1 });
      for (let y = 0, n = 0; y < TILE; y += 16, n++) g.poly([bx, y, bx, y + 11, bx + dir * 9, y + 5.5]).fill(pennants[n % pennants.length]!);
    }
    // Rails, their shadows to the right, and a post every 32 px (512 is a whole number of posts).
    for (const x of [RAIL_L, RAIL_R]) {
      g.rect(x + 3, 0, 10, TILE).fill({ color: PALETTE.railShadow, alpha: 0.3 });
      g.rect(x - 3, 0, 6, TILE).fill(PALETTE.rail);
      for (let y = 0; y < TILE; y += 32) {
        g.moveTo(x + 4, y + 4)
          .lineTo(x + 20, y + 13)
          .stroke({ color: PALETTE.railShadow, width: 5, alpha: 0.3 });
        g.rect(x - 4, y, 8, 8).fill(PALETTE.rail).stroke({ color: 0x8c8c80, width: 1 });
      }
    }
    // Framed to exactly one tile, so strokes at the edges can't grow it and put a seam in the scroll.
    return this.app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, W, TILE), resolution: 2 });
  }
}

