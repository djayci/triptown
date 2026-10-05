/**
 * The flock, as a pure model: which rams run with the player's ram, where each one stands, and what each
 * is doing. No Pixi here, so the rules the spec puts on the scene can be tested directly.
 *
 * The rules (flock-mvp spec "The flock and the pace never know the crash"):
 * - The flock's size is `flockCount(multiplier)`, a pure non-decreasing function of the value on screen.
 * - Rams join in a fixed order, nearest the player's ram first and the horizon last.
 * - The model's inputs are the multiplier, the shared `pace` (elapsed time) and what has already happened
 *   on screen (the run started, the cash-out settled, the crash arrived). It never sees the crash time.
 */

/** Design frame, CSS px. */
export const W = 390;
export const H = 844;
export const HORIZON = 274;

/** The player's ram: a fixed place on screen, in a lane no flock ram ever stands in. */
export const HERO = { x: 128, y: 600, scale: 1.1 } as const;
/** No slot's centre comes nearer the hero than this, in his own row and the rows in front of him. */
export const HERO_LANE = { near: 105, front: 150 } as const;

/** How many rams run with him at a value: none at x1.00, a handful by x1.5, a crowd by x3, the field full past ~x46 (205 places). */
export function flockCount(multiplier: number): number {
  return Math.floor(24 * Math.pow(Math.max(0, Math.log(multiplier)), 1.6));
}

/**
 * Strides per second at a run speed (design px/s): the legs on screen and the hooves heard both use it,
 * so the sound keeps step with the picture.
 */
export function strideCadence(speed: number): number {
  return 0.9 + speed / 215;
}

/** Seeded and fixed: the same table on every device and every round. */
export function rnd(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface Slot {
  /** Where the ram stands, feet on the ground, in design px. */
  x: number;
  y: number;
  /** Sprite scale. */
  s: number;
  /** Gait phase offset, so the flock does not move in step. */
  ph: number;
  /** 0 nearest, 1 at the horizon: the stage tints far rams into dusk silhouettes. */
  depth: number;
}

/** Depth rows: [ground y, scale, spacing], from the horizon to the front. */
const ROWS: readonly (readonly [number, number, number])[] = [
  [289, 0.2, 15],
  [296, 0.23, 17],
  [303, 0.26, 19],
  [312, 0.3, 21],
  [321, 0.34, 24],
  [333, 0.39, 27.5],
  [347, 0.45, 31],
  [364, 0.51, 35],
  [383, 0.58, 40],
  [406, 0.66, 45],
  [431, 0.74, 51],
  [462, 0.83, 57],
  [495, 0.92, 64],
  [545, 1.0, 75],
  [600, 1.1, 90],
  [685, 1.34, 115],
];

let cached: readonly Slot[] | null = null;

/** Every place a ram can stand, in join order: nearest the hero first, out to the horizon last. */
export function slots(): readonly Slot[] {
  if (cached) return cached;
  const out: (Slot & { order: number })[] = [];
  ROWS.forEach(([y, s, gap], ri) => {
    for (let x = -15 + rnd(ri * 3.3) * gap; x < 410; x += gap) {
      const seed = ri * 97.1 + x * 2.74;
      const sx = x + (rnd(seed) - 0.5) * gap * 0.5;
      const sy = y + (rnd(seed * 1.3) - 0.5) * gap * 0.16;
      // His lane: nobody stands on him in his own row or in front of him.
      if (y >= 545 && Math.abs(sx - HERO.x) < (y > HERO.y ? HERO_LANE.front : HERO_LANE.near))
        continue;
      out.push({
        x: sx,
        y: sy,
        s: s * (0.9 + rnd(seed * 2.1) * 0.2),
        ph: rnd(seed * 3.7),
        depth: 1 - Math.min(1, (y - 289) / (685 - 289)),
        order: Math.abs(sx - HERO.x) / 350 + Math.abs(sy - HERO.y) / 300 + rnd(seed * 5.3) * 0.35,
      });
    }
  });
  out.sort((a, b) => a.order - b.order);
  cached = out.map(({ order: _order, ...slot }) => slot);
  return cached;
}

/** What the round has shown so far. The model never learns anything the screen has not already shown. */
export type Phase = 'betting' | 'running' | 'penned' | 'crashed';

export type RamMode = 'out' | 'joining' | 'in' | 'leaving' | 'fleeing';
export interface RamState {
  mode: RamMode;
  /** Seconds since this mode began. */
  age: number;
}

/** A joining ram runs in from behind for this long, then holds its place. */
export const JOIN_SECONDS = 1;
/** A leaving or fleeing ram is gone after this long. */
export const LEAVE_SECONDS = 1.6;
/** At most this many rams start joining per second, so a jump in value reads as a stream, not a pop. */
export const JOINS_PER_SECOND = 40;

export class FlockModel {
  readonly states: RamState[];
  phase: Phase = 'betting';
  /** The run speed of the hero and the flock, design px/s. Zero while standing. */
  speed = 0;
  private multiplier = 1;
  private pace = 0;
  private joinBudget = 0;

  constructor() {
    this.states = slots().map(() => ({ mode: 'out', age: 0 }));
  }

  setMultiplier(m: number): void {
    this.multiplier = m;
  }

  /** The shared controller's pace, 0..1 from elapsed time. */
  setPace(p: number): void {
    this.pace = Math.max(0, Math.min(1, p));
  }

  /** The speed the run is heading for. From pace only: the crash time is never an input. */
  targetSpeed(): number {
    return this.phase === 'running' ? 170 + 550 * this.pace : 0;
  }

  /** How many rams should be with him now. */
  wanted(): number {
    return this.phase === 'running' || this.phase === 'penned' ? flockCount(this.multiplier) : 0;
  }

  setPhase(phase: Phase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    // At the crash every ram turns and bolts at once; nobody holds a place near the wolf.
    if (phase === 'crashed') {
      for (const r of this.states)
        if (r.mode === 'in' || r.mode === 'joining') Object.assign(r, { mode: 'fleeing', age: 0 });
    }
  }

  /** Starts a fresh round with nobody beside him. */
  reset(): void {
    this.phase = 'betting';
    this.multiplier = 1;
    this.pace = 0;
    for (const r of this.states) Object.assign(r, { mode: 'out', age: 0 });
  }

  step(dt: number): void {
    const target = this.targetSpeed();
    const rate = this.phase === 'crashed' ? 6 : this.phase === 'penned' ? 1.4 : 2.2;
    this.speed += (target - this.speed) * Math.min(1, dt * rate);

    const want = this.wanted();
    this.joinBudget = Math.min(JOINS_PER_SECOND, this.joinBudget + dt * JOINS_PER_SECOND);
    this.states.forEach((r, i) => {
      r.age += dt;
      if (r.mode === 'joining' && r.age >= JOIN_SECONDS) Object.assign(r, { mode: 'in', age: 0 });
      else if ((r.mode === 'leaving' || r.mode === 'fleeing') && r.age >= LEAVE_SECONDS)
        Object.assign(r, { mode: 'out', age: 0 });
      if (i < want && r.mode === 'out' && this.joinBudget >= 1) {
        Object.assign(r, { mode: 'joining', age: 0 });
        this.joinBudget -= 1;
      } else if (i >= want && (r.mode === 'in' || r.mode === 'joining')) {
        Object.assign(r, { mode: this.phase === 'crashed' ? 'fleeing' : 'leaving', age: 0 });
      }
    });
  }

  /** Rams with him or arriving: what a player would count if they could. */
  present(): number {
    return this.states.filter((r) => r.mode === 'in' || r.mode === 'joining').length;
  }
}

export interface RamView {
  x: number;
  y: number;
  alpha: number;
  /** True when the ram faces left, the way it is going. */
  flip: boolean;
  /** How open the stride is, 0 standing to 1 flat out. */
  run: number;
  /** Gait phase, 0..1. */
  phase: number;
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * Where a flock ram is drawn and how. Every ram faces the way it moves (user rule, 4 Oct 2026):
 * - joining: in from the left, behind him, facing right and running harder than the flock;
 * - leaving while the run goes on: still running forward, peeling out and dropping back, facing right;
 * - leaving once stopped, or bolting from the wolf: turned to face left, going back the way they came.
 */
export function ramView(
  slot: Slot,
  state: RamState,
  time: number,
  gait: number,
  speed: number,
  reduced: boolean,
): RamView | null {
  if (state.mode === 'out') return null;
  const run = Math.min(1, speed / 720);
  let x = slot.x + Math.sin(time * 0.8 + slot.ph * 6.28) * 5 * slot.s;
  let y = slot.y;
  let alpha = 1;
  let flip = false;
  let r = run;
  let phase = gait + slot.ph;
  const age = state.age;
  if (state.mode === 'joining') {
    const p = Math.min(1, age / JOIN_SECONDS);
    if (reduced) alpha = p;
    else {
      const from = -80 * slot.s - 30;
      x = from + (x - from) * easeOut(p);
      r = Math.max(run, 1 - p);
      phase = time * 3.4 + slot.ph;
    }
  } else if (state.mode === 'leaving' || state.mode === 'fleeing') {
    alpha = Math.max(0, 1 - age / LEAVE_SECONDS);
    if (!reduced) {
      const outward = slot.y < HERO.y ? -1 : 1;
      if (speed < 75) {
        flip = true;
        r = 0.9;
        phase = time * 3.2 + slot.ph;
        const v = state.mode === 'fleeing' ? 210 + slot.ph * 180 : 80;
        x -= age * v * (0.5 + slot.s * 0.5);
        if (state.mode === 'fleeing') y += outward * age * 15 * slot.s;
      } else {
        x -= age * age * 60 * (0.5 + slot.s * 0.5);
        y += outward * age * 13 * slot.s;
      }
    }
  }
  if (x < -130 || alpha <= 0) return null;
  return { x, y, alpha, flip, run: r, phase: ((phase % 1) + 1) % 1 };
}

/**
 * The grazing flock on the betting screen (approved design "Flock — the flock waits", 5 Oct 2026): the
 * whole flock out on the field around him, heads down, before the run. It is scenery, not the flock that
 * runs with him: it is never counted in `present()`, it plays no part in `flockCount`, and when the run
 * starts it is left standing where it was while the camera goes with him. The rams that then join still
 * come from `FlockModel`, from the multiplier alone.
 */
export const GRAZERS = 70;
/** A grazing flock fades back in over this long when the betting screen returns after a round. */
export const GRAZE_FADE_SECONDS = 0.9;

let grazing: readonly Slot[] | null = null;

/** Which places the grazing flock stands in: the nearest, big enough to read, on screen, his lane clear. */
export function grazers(): readonly Slot[] {
  if (grazing) return grazing;
  grazing = slots()
    .filter((s) => s.s >= 0.3 && s.x > -10 && s.x < W + 10)
    .slice(0, GRAZERS);
  return grazing;
}

/**
 * Where a grazer stands once the camera has moved `shift` px with him: left behind, nearer ones sliding
 * past faster, as the ground does. The hero's row moves with the ground marks (1.1x the camera).
 */
export function grazerX(slot: Slot, shift: number): number {
  return slot.x - shift * 1.1 * (slot.s / HERO.scale);
}

/** Heads down, now and then one looks up; slow and out of step, so the field never moves as one. */
export function grazerLooksUp(slot: Slot, time: number): boolean {
  return Math.sin(time * 0.45 + slot.ph * 37) > 0.55;
}
