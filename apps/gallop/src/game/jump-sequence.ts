// The jump animation as a pure function of time. Until the server's result is applied, every frame is
// identical whatever that result will be (client spec "Jump presentation is the same every time").

export type JumpResult = 'cleared' | 'refused' | 'finished';
export type JumpPhase = 'waiting' | 'approach' | 'hold' | 'jump' | 'land' | 'refuse';

export interface JumpFrame {
  phase: JumpPhase;
  /** Horse position along the course in design px, relative to the stand point before this fence. */
  offset: number;
  /** Height above the ground in design px. */
  lift: number;
  /** Body tilt in radians (nose up is negative). */
  tilt: number;
  /** Ground speed in design px per second, for gait, dust and parallax. */
  speed: number;
  /** True once the whole sequence has played out. */
  done: boolean;
}

export const TIMING = { approachMs: 650, jumpMs: 700, landMs: 450, refuseMs: 700 } as const;
/** Design px: stand point → take-off point → landing point → next stand point. */
export const GEOMETRY = { takeoff: 175, landing: 395, nextStand: 540 } as const;

const ease = (u: number) => u * u * (3 - 2 * u);

export class JumpSequence {
  private startedAt: number | null = null;
  private result: JumpResult | null = null;
  private branchAt: number | null = null;

  get running() {
    return this.startedAt !== null;
  }

  /** Starts the approach to the next fence. */
  start(nowMs: number) {
    this.startedAt = nowMs;
    this.result = null;
    this.branchAt = null;
  }

  /** Applies the server's answer. The branch begins at the take-off point, never earlier. */
  resolve(result: JumpResult, nowMs: number) {
    if (this.startedAt === null || this.result) return;
    this.result = result;
    this.branchAt = Math.max(nowMs, this.startedAt + TIMING.approachMs);
  }

  reset() {
    this.startedAt = null;
    this.result = null;
    this.branchAt = null;
  }

  frame(nowMs: number): JumpFrame {
    if (this.startedAt === null) return { phase: 'waiting', offset: 0, lift: 0, tilt: 0, speed: 0, done: false };
    const t = nowMs - this.startedAt;
    if (t < TIMING.approachMs || this.branchAt === null || nowMs < this.branchAt) {
      if (t < TIMING.approachMs) {
        const u = t / TIMING.approachMs;
        return { phase: 'approach', offset: GEOMETRY.takeoff * u, lift: 0, tilt: 0, speed: GEOMETRY.takeoff / (TIMING.approachMs / 1000), done: false };
      }
      // Waiting for the server at the take-off point: the horse gathers on the spot, the same for any result.
      return { phase: 'hold', offset: GEOMETRY.takeoff, lift: 0, tilt: 0, speed: 60, done: false };
    }
    const b = nowMs - this.branchAt;
    if (this.result === 'refused') {
      const u = Math.min(1, b / TIMING.refuseMs);
      return { phase: 'refuse', offset: GEOMETRY.takeoff + 20 * ease(u) - 12 * Math.max(0, u - 0.6), lift: 0, tilt: -0.08 * Math.sin(Math.PI * Math.min(1, u * 1.6)), speed: 80 * (1 - u), done: u >= 1 };
    }
    if (b < TIMING.jumpMs) {
      const u = b / TIMING.jumpMs;
      const span = GEOMETRY.landing - GEOMETRY.takeoff;
      return { phase: 'jump', offset: GEOMETRY.takeoff + span * u, lift: Math.sin(Math.PI * u) * 110, tilt: -0.14 * Math.sin(Math.PI * 2 * u), speed: span / (TIMING.jumpMs / 1000), done: false };
    }
    const u = Math.min(1, (b - TIMING.jumpMs) / TIMING.landMs);
    const span = GEOMETRY.nextStand - GEOMETRY.landing;
    return { phase: 'land', offset: GEOMETRY.landing + span * ease(u), lift: 0, tilt: 0, speed: (span / (TIMING.landMs / 1000)) * (1 - u), done: u >= 1 };
  }
}
