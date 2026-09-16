import * as THREE from 'three';
import { PALETTE } from './palette';

// Scene effects. Every effect is started by a local tap or a server event, never scheduled ahead of
// one, and none of them varies with timing: a throw always takes the same arc time and lands on the
// porch alongside (audit D6).

export const THROW_SECONDS = 0.6;
/** Arc height scales with the throw's length, so a long throw across a garden still looks thrown. */
const APEX_PER_METRE = 0.16;
const APEX_MIN = 1.0;
const APEX_MAX = 2.4;

/** Apex of a throw, from the distance alone: it never varies with when the paper was thrown. */
export function throwApex(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.min(APEX_MAX, Math.max(APEX_MIN, from.distanceTo(to) * APEX_PER_METRE));
}
const SPLASH_SECONDS = 0.7;

export interface FxOptions {
  reducedMotion: boolean;
}

/** Position along a throw arc at progress 0..1, from the courier's box to the porch. */
export function throwArcPoint(from: THREE.Vector3, to: THREE.Vector3, progress: number, out = new THREE.Vector3()): THREE.Vector3 {
  const p = Math.min(1, Math.max(0, progress));
  out.lerpVectors(from, to, p);
  out.y += Math.sin(Math.PI * p) * throwApex(from, to);
  return out;
}

interface Flight {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  onLand: () => void;
}

interface Splash {
  points: THREE.Points;
  velocities: Float32Array;
  t: number;
}

export class Fx {
  readonly group = new THREE.Group();
  private readonly flights: Flight[] = [];
  private splashes: Splash[] = [];
  private readonly paperGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8);
  private readonly paperMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.courier.paper, flatShading: true, roughness: 0.9 });
  private readonly streaks: THREE.LineSegments;
  shake = 0;

  constructor(private options: FxOptions) {
    const positions = new Float32Array(40 * 6);
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1;
      const x = 1.6 + side * (0.9 + Math.random() * 1.6), y = 0.2 + Math.random() * 0.15, z = -Math.random() * 30;
      positions.set([x, y, z, x, y, z - 1.6], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.streaks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#fff4e6', transparent: true, opacity: 0.12 }));
    this.group.add(this.streaks);
  }

  setOptions(options: FxOptions): void {
    this.options = options;
  }

  /** Throws one paper from the delivery box to the porch. `onLand` fires once at arc end. */
  throwPaper(from: THREE.Vector3, to: THREE.Vector3, onLand: () => void): void {
    const mesh = new THREE.Mesh(this.paperGeometry, this.paperMaterial);
    mesh.position.copy(from);
    this.group.add(mesh);
    this.flights.push({ mesh, from: from.clone(), to: to.clone(), t: 0, onLand });
  }

  /** Setback splash at the rear wheel; only called for a server setback event under a setbacks-on profile. */
  splash(at: THREE.Vector3): void {
    const count = this.options.reducedMotion ? 30 : 90;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions.set([at.x, at.y, at.z], i * 3);
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.2;
      velocities.set([Math.cos(a) * r, 1.5 + Math.random() * 2.5, Math.sin(a) * r * 0.5], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(g, new THREE.PointsMaterial({ color: '#d8e6ee', size: 0.06, transparent: true, opacity: 0.9 }));
    this.group.add(points);
    this.splashes.push({ points, velocities, t: 0 });
    if (!this.options.reducedMotion) this.shake = 0.25;
  }

  update(dt: number, speed: number): void {
    // Speed streaks scroll with the ride; hidden entirely under reduced motion.
    this.streaks.visible = !this.options.reducedMotion && speed > 12;
    if (this.streaks.visible) {
      this.streaks.position.z += speed * dt * 1.5;
      if (this.streaks.position.z > 30) this.streaks.position.z -= 30;
    }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i]!;
      f.t += dt;
      const p = f.t / THROW_SECONDS;
      throwArcPoint(f.from, f.to, p, f.mesh.position);
      f.mesh.rotation.x += dt * 12;
      if (p >= 1) {
        this.group.remove(f.mesh);
        this.flights.splice(i, 1);
        f.onLand();
      }
    }
    this.splashes = this.splashes.filter((s) => {
      s.t += dt;
      const pos = s.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        s.velocities[i * 3 + 1]! -= 9.8 * dt;
        pos.setXYZ(i, pos.getX(i) + s.velocities[i * 3]! * dt, Math.max(0.17, pos.getY(i) + s.velocities[i * 3 + 1]! * dt), pos.getZ(i) + s.velocities[i * 3 + 2]! * dt);
      }
      pos.needsUpdate = true;
      (s.points.material as THREE.PointsMaterial).opacity = Math.max(0, 0.9 * (1 - s.t / SPLASH_SECONDS));
      if (s.t < SPLASH_SECONDS) return true;
      this.group.remove(s.points);
      s.points.geometry.dispose();
      return false;
    });
    this.shake = Math.max(0, this.shake - dt);
  }

  /** Camera offset for the current shake; always zero under reduced motion. */
  cameraShake(clock: number): THREE.Vector3 {
    if (this.options.reducedMotion || this.shake <= 0) return new THREE.Vector3();
    const k = this.shake * 0.12;
    return new THREE.Vector3(Math.sin(clock * 61) * k, Math.sin(clock * 47) * k, 0);
  }

  get activeThrows(): number {
    return this.flights.length;
  }
}
