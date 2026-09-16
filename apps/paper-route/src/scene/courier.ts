import * as THREE from 'three';
import { MeshBuilder, sharedMaterials } from './builder';
import { PALETTE } from './palette';
import { COURIER_AHEAD, LANE_X } from './street';

const C = PALETTE.courier;
type V3 = readonly [number, number, number];

export type CourierPose = 'ride' | 'fallen';

/** Ground clearance of the crate holding the unthrown papers, for the throw arc. */
export const CRATE_OFFSET = new THREE.Vector3(0, 1.02, 0.6);

/**
 * An adult courier on a utility delivery bicycle: adult proportions and build, helmet, hi-vis vest
 * with a reflective band, upright riding position, and a rear cargo crate holding the unthrown
 * papers. No child or stunt bike, no mascots, no slapstick (audit item F1).
 */
export class Courier {
  readonly group = new THREE.Group();
  private readonly riding = new THREE.Group();
  private readonly fallen = new THREE.Group();
  private readonly wheels: THREE.Mesh[] = [];
  private readonly pedals = new THREE.Group();
  private rolls = new THREE.Group();
  private readonly materials = sharedMaterials();
  private wobbleUntil = 0;
  private clock = 0;
  private rollCount = -1;

  constructor() {
    this.group.position.set(LANE_X, 0, -COURIER_AHEAD);
    this.buildRiding();
    this.buildFallen();
    // The spill lands a little behind the riding position, so it sits in the same band of the frame
    // as the courier rather than up under the result card.
    this.fallen.position.set(-0.3, 0, 1.8);
    this.group.add(this.riding, this.fallen);
    this.setPose('ride');
    this.setRolls(0);
  }

  setPose(pose: CourierPose): void {
    this.riding.visible = pose === 'ride';
    this.fallen.visible = pose === 'fallen';
  }

  /** Shows one rolled paper in the cargo crate per unthrown paper (capped at 5 visible). */
  setRolls(count: number): void {
    if (count === this.rollCount) return;
    this.rollCount = count;
    this.riding.remove(this.rolls);
    this.rolls.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    const b = new MeshBuilder();
    for (let k = 0; k < Math.min(count, 5); k++) {
      b.place(new THREE.CylinderGeometry(0.036, 0.036, 0.32, 8), C.paper, [-0.15 + k * 0.075, 1.02, 0.6], [Math.PI / 2, 0, 0]);
      b.place(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 8), C.band, [-0.15 + k * 0.075, 1.02, 0.6], [Math.PI / 2, 0, 0]);
    }
    this.rolls = b.build(this.materials.lit, this.materials.glow);
    this.rolls.userData.count = Math.min(count, 5);
    this.riding.add(this.rolls);
  }

  get visibleRolls(): number {
    return (this.rolls.userData.count as number | undefined) ?? 0;
  }

  /** A short sideways wobble, used for the setback splash. Skipped when reduced motion is on. */
  wobble(durationSeconds = 0.6): void {
    this.wobbleUntil = this.clock + durationSeconds;
  }

  update(dt: number, speed: number): void {
    this.clock += dt;
    for (const w of this.wheels) w.rotation.x -= (speed * dt) / 0.34;
    this.pedals.rotation.x -= (speed * dt) / 0.9;
    const wobbling = this.clock < this.wobbleUntil;
    this.riding.rotation.z = wobbling ? Math.sin(this.clock * 28) * 0.08 * ((this.wobbleUntil - this.clock) / 0.6) : 0;
    this.riding.position.y = Math.sin(this.clock * speed * 0.9) * 0.008;
  }

  private buildRiding(): void {
    const b = new MeshBuilder();
    // Utility bicycle: double-diamond frame, upright bars, rear rack and cargo crate.
    b.limb([0, 0.42, 0.52], [0, 0.98, -0.16], 0.028, C.bike); // seat tube
    b.limb([0, 0.98, -0.16], [0, 1.02, -0.5], 0.026, C.bike); // top tube to head tube
    b.limb([0, 0.42, 0.52], [0, 0.5, -0.46], 0.026, C.bike); // down tube
    b.limb([0, 0.42, 0.52], [0, 0.34, 0.55], 0.02, C.bike); // chain stay
    b.limb([0, 0.98, -0.16], [0, 0.34, 0.55], 0.02, C.bike); // seat stay
    b.limb([0, 1.02, -0.5], [0, 0.34, -0.55], 0.024, C.bike); // fork
    b.limb([-0.26, 1.06, -0.48], [0.26, 1.06, -0.48], 0.02, C.trim); // handlebar
    b.place(new THREE.BoxGeometry(0.16, 0.06, 0.3), C.seat, [0, 1.02, -0.12]);
    b.place(new THREE.BoxGeometry(0.3, 0.03, 0.42), C.trim, [0, 0.86, 0.56]); // rear rack
    // Cargo crate with the papers.
    b.place(new THREE.BoxGeometry(0.44, 0.3, 0.42), C.crate, [0, 1.02, 0.6]);
    b.place(new THREE.BoxGeometry(0.4, 0.26, 0.38), C.crateTrim, [0, 1.04, 0.6]);
    b.place(new THREE.BoxGeometry(0.46, 0.04, 0.44), C.crateTrim, [0, 0.87, 0.6]);
    b.place(new THREE.BoxGeometry(0.34, 0.24, 0.16), C.box, [0.24, 0.92, 0.22]); // pannier bag
    this.buildRider(b, false);
    this.riding.add(b.build(this.materials.lit, this.materials.glow));

    for (const z of [0.55, -0.55]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 18), new THREE.MeshStandardMaterial({ color: C.tire, flatShading: true, roughness: 1 }));
      wheel.position.set(0, 0.34, z);
      wheel.rotation.y = Math.PI / 2;
      wheel.castShadow = true;
      this.wheels.push(wheel);
      this.riding.add(wheel);
    }
    // Crank and pedals turn with the ride.
    const crank = new MeshBuilder();
    for (const sx of [-1, 1]) {
      crank.place(new THREE.BoxGeometry(0.04, 0.3, 0.04), C.trim, [sx * 0.09, sx * 0.08, 0]);
      crank.place(new THREE.BoxGeometry(0.08, 0.03, 0.14), C.trim, [sx * 0.11, sx * 0.21, 0]);
    }
    this.pedals.add(crank.build(this.materials.lit, this.materials.glow));
    this.pedals.position.set(0, 0.42, 0.52);
    this.riding.add(this.pedals);
  }

  private buildFallen(): void {
    const b = new MeshBuilder();
    const bike = new THREE.Matrix4().compose(new THREE.Vector3(-0.55, 0.05, -0.9), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, 1.52)), new THREE.Vector3(1, 1, 1));
    const part = (g: THREE.BufferGeometry, color: string, p: V3, r: V3 = [0, 0, 0]) => {
      const local = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(1, 1, 1));
      b.add(g, color, bike.clone().multiply(local));
    };
    // Frame, bars and crate, all lying with the bike.
    part(new THREE.BoxGeometry(0.05, 0.62, 0.05), C.bike, [0, 0.64, 0.2], [0.55, 0, 0]);
    part(new THREE.BoxGeometry(0.05, 0.95, 0.05), C.bike, [0, 0.66, -0.16], [-0.62, 0, 0]);
    part(new THREE.BoxGeometry(0.05, 0.62, 0.05), C.bike, [0, 0.36, 0.02], [1.2, 0, 0]);
    part(new THREE.BoxGeometry(0.5, 0.04, 0.04), C.trim, [0, 1.0, -0.48]);
    part(new THREE.BoxGeometry(0.44, 0.3, 0.42), C.crate, [0, 0.98, 0.58]);
    part(new THREE.BoxGeometry(0.4, 0.26, 0.38), C.crateTrim, [0, 1.0, 0.58]);
    part(new THREE.TorusGeometry(0.33, 0.035, 6, 18), C.tire, [0, 0.34, 0.55], [0, Math.PI / 2, 0]);
    part(new THREE.TorusGeometry(0.33, 0.035, 6, 18), C.tire, [0, 0.34, -0.55], [0, Math.PI / 2, 0]);
    this.buildRider(b, true);
    for (const [x, z, r] of [[-1.2, -1.9, 0.4], [-0.1, -2.4, 1.2], [0.6, -3.3, 2.1]] as const) {
      b.place(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 8), C.paper, [x, 0.06, z], [Math.PI / 2, r, 0]);
    }
    this.fallen.add(b.build(this.materials.lit, this.materials.glow));
  }

  /**
   * Rider parts. Adult build: about 1.8 m standing, long limbs, work clothing. When fallen the rider
   * sits on the road beside the bicycle, shaken but upright.
   */
  private buildRider(b: MeshBuilder, fallen: boolean): void {
    const origin: V3 = fallen ? [0.55, -0.04, -0.1] : [0, 0, 0];
    const turn = fallen ? -2.2 : 0;
    const frame = new THREE.Matrix4().compose(new THREE.Vector3(...origin), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, turn, 0)), new THREE.Vector3(1, 1, 1));
    const at = (p: V3): V3 => {
      const v = new THREE.Vector3(...p).applyMatrix4(frame);
      return [v.x, v.y, v.z];
    };
    const limb = (a: V3, c: V3, r: number, color: string) => b.limb(at(a), at(c), r, color);
    const put = (g: THREE.BufferGeometry, color: string, p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1], emissive = false) =>
      b.place(g, color, at(p), [r[0], r[1] + turn, r[2]], s, emissive);

    if (!fallen) {
      // Seated on the saddle at 1.02, feet at the cranks: thigh back and down, shin to the pedal.
      for (const sx of [-1, 1] as const) {
        limb([sx * 0.12, 1.0, 0.0], [sx * 0.13, 0.74, sx === 1 ? 0.42 : 0.5], 0.08, C.trousers);
        limb([sx * 0.13, 0.74, sx === 1 ? 0.42 : 0.5], [sx * 0.11, sx === 1 ? 0.46 : 0.38, sx === 1 ? 0.62 : 0.44], 0.07, C.trousers);
        put(new THREE.BoxGeometry(0.11, 0.07, 0.24), C.trim, [sx * 0.11, sx === 1 ? 0.43 : 0.35, sx === 1 ? 0.66 : 0.48]);
      }
    } else {
      limb([0.12, 0.2, 0], [0.22, 0.14, -0.7], 0.08, C.trousers);
      limb([-0.12, 0.2, 0], [-0.3, 0.34, -0.5], 0.08, C.trousers);
    }
    const hipY = fallen ? 0.28 : 1.06;
    const lean = fallen ? 0.3 : -0.2;
    put(new THREE.BoxGeometry(0.4, 0.24, 0.26), C.trousers, [0, hipY, 0.08]);
    put(new THREE.CapsuleGeometry(0.19, 0.5, 2, 6), C.jacket, [0, hipY + 0.38, 0.0], [lean, 0, 0], [1.1, 1, 0.82]);
    put(new THREE.CapsuleGeometry(0.2, 0.36, 2, 6), C.vest, [0, hipY + 0.4, 0.01], [lean, 0, 0], [1.16, 1, 0.86]);
    for (const dy of [0.3, 0.52]) put(new THREE.BoxGeometry(0.5, 0.035, 0.34), C.reflective, [0, hipY + dy, 0.02], [lean, 0, 0], [1, 1, 1], true);
    if (!fallen) {
      limb([0.23, hipY + 0.58, -0.06], [0.26, 1.08, -0.46], 0.055, C.jacket);
      limb([-0.23, hipY + 0.58, -0.06], [-0.26, 1.08, -0.46], 0.055, C.jacket);
    } else {
      limb([0.23, hipY + 0.54, 0.06], [0.44, 0.2, 0.34], 0.055, C.jacket);
      limb([-0.23, hipY + 0.54, 0.06], [-0.32, 0.9, -0.08], 0.055, C.jacket);
    }
    const headY = hipY + 0.82;
    const headZ = fallen ? 0.2 : -0.12;
    put(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), C.skin, [0, headY - 0.14, headZ + 0.02]);
    put(new THREE.SphereGeometry(0.105, 10, 8), C.skin, [0, headY, headZ], [0, 0, 0], [0.9, 1.08, 1]);
    put(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), C.helmet, [0, headY + 0.02, headZ + 0.01]);
    put(new THREE.BoxGeometry(0.2, 0.03, 0.1), C.visor, [0, headY + 0.09, headZ - 0.08]);
  }
}
