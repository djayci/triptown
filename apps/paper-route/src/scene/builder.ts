import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmpColor = new THREE.Color();

/**
 * Collects low-poly parts and merges them into one lit mesh and one emissive mesh with vertex colours,
 * so a whole street chunk or the courier costs two draw calls instead of hundreds.
 */
export class MeshBuilder {
  private lit: THREE.BufferGeometry[] = [];
  private glow: THREE.BufferGeometry[] = [];

  add(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, matrix: THREE.Matrix4, emissive = false): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.deleteAttribute('uv');
    g.applyMatrix4(matrix);
    g.computeVertexNormals();
    tmpColor.set(color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    (emissive ? this.glow : this.lit).push(g);
    geometry.dispose();
  }

  /** Adds a part placed by position, Euler rotation and scale. */
  place(
    geometry: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    p: readonly [number, number, number],
    r: readonly [number, number, number] = [0, 0, 0],
    s: readonly [number, number, number] = [1, 1, 1],
    emissive = false,
  ): void {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...p),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
      new THREE.Vector3(...s),
    );
    this.add(geometry, color, m, emissive);
  }

  /** A capsule-like limb between two points. */
  limb(a: readonly [number, number, number], b: readonly [number, number, number], radius: number, color: THREE.ColorRepresentation): void {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const m = new THREE.Matrix4().compose(
      A.clone().add(B).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()),
      new THREE.Vector3(1, 1, 1),
    );
    this.add(new THREE.CapsuleGeometry(radius, Math.max(0.01, len), 2, 6), color, m);
  }

  build(litMaterial: THREE.Material, glowMaterial: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    if (this.lit.length) {
      const mesh = new THREE.Mesh(mergeGeometries(this.lit), litMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (this.glow.length) group.add(new THREE.Mesh(mergeGeometries(this.glow), glowMaterial));
    for (const g of [...this.lit, ...this.glow]) g.dispose();
    this.lit = [];
    this.glow = [];
    return group;
  }
}

export function sharedMaterials() {
  return {
    lit: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
}
