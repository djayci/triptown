import * as THREE from 'three';
import { MeshBuilder, sharedMaterials } from './builder';
import { PALETTE } from './palette';

/** Street length covered by one merged chunk, in metres. */
export const CHUNK_LENGTH = 40;
/** Street distance the courier sits ahead of the street origin (world z of the courier is -COURIER_AHEAD). */
export const COURIER_AHEAD = 2.2;

/** The courier rides here; nothing may be placed in this lane (spec: clear travel lane). */
export const LANE_X = 1.6;
export const LANE_HALF_WIDTH = 0.9;

const ROAD_HALF = 3.2;
const WALK_OUTER = 5.9;
const FENCE_X = 6.6;
const HOUSE_X = 13.2;
const HOUSE_DEPTH = 7.4;
const HOUSE_FACE = HOUSE_X - HOUSE_DEPTH / 2;

export interface Porch {
  /** Street coordinate (metres along the route) of the front door. */
  s: number;
  x: number;
  side: -1 | 1;
}

export interface Placement {
  x: number;
  /** Half-width across the street, for the travel-lane check. */
  halfWidth: number;
  kind: string;
}

interface Chunk {
  index: number;
  group: THREE.Group;
  porches: Porch[];
  placements: Placement[];
}

type Rng = () => number;

/** Deterministic per-chunk stream, so a chunk rebuilt after recycling is identical to its first build. */
function chunkRng(seed: number, index: number): Rng {
  let a = (seed ^ (index * 0x9e3779b9)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roofPrism(width: number, height: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-depth / 2 - 0.35, 0);
  shape.lineTo(depth / 2 + 0.35, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width + 0.5, bevelEnabled: false });
  g.translate(0, 0, -(width + 0.5) / 2);
  return g;
}

/**
 * Procedural suburban street for the angled overhead view, built in merged chunks around the courier
 * and recycled by distance. Houses sit on the far side (+X) so nothing blocks the courier; the near
 * side carries pavement, gardens and parked cars. Spacing is irregular, nothing is a target or a
 * collectable, and nothing stands in the travel lane, so no object invites aiming or timing a throw
 * (audit item D6). Randomness here is cosmetic and unrelated to the round.
 */
export class Street {
  readonly group = new THREE.Group();
  private readonly chunks = new Map<number, Chunk>();
  private readonly materials = sharedMaterials();
  private nextChunk = 0;
  private nearSideDetail = true;

  constructor(private readonly seed = Math.floor(Math.random() * 0xffffffff)) {}

  /** Near-side gardens and parked cars are dropped at the lowest quality tier. */
  setNearSideDetail(on: boolean): void {
    this.nearSideDetail = on;
  }

  /** Positions chunks for the courier's distance along the route, building ahead and dropping behind. */
  update(distance: number, drawDistance: number): void {
    while (this.nextChunk * CHUNK_LENGTH < distance + drawDistance) this.buildChunk(this.nextChunk++);
    for (const chunk of this.chunks.values()) {
      if ((chunk.index + 1) * CHUNK_LENGTH < distance - 30) {
        this.group.remove(chunk.group);
        chunk.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        this.chunks.delete(chunk.index);
      } else {
        chunk.group.position.z = distance - chunk.index * CHUNK_LENGTH;
      }
    }
  }

  /** The porch closest to the courier. Returns world coordinates. */
  porchAlongside(distance: number): THREE.Vector3 | null {
    const s = distance + COURIER_AHEAD;
    let best: Porch | null = null;
    for (const chunk of this.chunks.values()) {
      for (const p of chunk.porches) {
        if (!best || Math.abs(p.s - s) < Math.abs(best.s - s)) best = p;
      }
    }
    return best ? new THREE.Vector3(best.x, 0.45, -(best.s - distance)) : null;
  }

  /** Number of mesh objects currently in the street, for draw-call budgeting. */
  meshCount(): number {
    let n = 0;
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) n++;
    });
    return n;
  }

  /** Street coordinates of built houses, for spacing checks. */
  houseStarts(side: -1 | 1): number[] {
    return [...this.chunks.values()].flatMap((c) => c.porches.filter((p) => p.side === side).map((p) => p.s)).sort((a, b) => a - b);
  }

  /** Everything placed in the built chunks, for the travel-lane and scene-inventory checks. */
  placements(): Placement[] {
    return [...this.chunks.values()].flatMap((c) => c.placements);
  }

  private buildChunk(index: number): void {
    const b = new MeshBuilder();
    const base = index * CHUNK_LENGTH;
    const L = CHUNK_LENGTH;
    const rng = chunkRng(this.seed, index);
    const localZ = (s: number) => -(s - base);
    const porches: Porch[] = [];
    const placements: Placement[] = [];
    const put = (kind: string, x: number, halfWidth: number) => placements.push({ kind, x, halfWidth });

    // Ground: lawns either side with mowing stripes, road, kerbs, pavements with slab joints,
    // and the centre line.
    const lawn = new THREE.PlaneGeometry(90, L, 18, 8);
    const pos = lawn.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setZ(i, (rng() - 0.5) * 0.06);
    b.place(lawn, PALETTE.lawn, [0, 0.04, -L / 2], [-Math.PI / 2, 0, 0]);
    for (let k = 0; k < 5; k++) {
      b.place(new THREE.PlaneGeometry(26, L / 5), k % 2 ? PALETTE.lawnAlt : PALETTE.lawn, [HOUSE_FACE - 6, 0.05, -(k + 0.5) * (L / 5)], [-Math.PI / 2, 0, 0]);
    }
    b.place(new THREE.BoxGeometry(ROAD_HALF * 2, 0.3, L), PALETTE.road, [0, 0, -L / 2]);
    for (const sg of [-1, 1] as const) {
      b.place(new THREE.BoxGeometry(0.25, 0.42, L), PALETTE.curb, [sg * (ROAD_HALF + 0.12), 0.13, -L / 2]);
      b.place(new THREE.BoxGeometry(WALK_OUTER - ROAD_HALF - 0.25, 0.36, L), PALETTE.walk, [sg * ((WALK_OUTER + ROAD_HALF + 0.25) / 2), 0.12, -L / 2]);
      for (let s = Math.ceil(base / 1.8) * 1.8; s < base + L; s += 1.8) {
        b.place(new THREE.BoxGeometry(WALK_OUTER - ROAD_HALF - 0.25, 0.01, 0.06), PALETTE.walkJoint, [sg * ((WALK_OUTER + ROAD_HALF + 0.25) / 2), 0.185, localZ(s)]);
      }
    }
    for (let s = Math.ceil(base / 6) * 6; s < base + L; s += 6) {
      b.place(new THREE.BoxGeometry(0.16, 0.02, 2.6), PALETTE.lane, [0, 0.16, localZ(s) - 1.3]);
    }

    // Far side: houses at irregular spacing with porches, paths, driveways, fences and trees.
    // Laid out inside the chunk so nothing crosses a boundary and each chunk stands on its own.
    let cursor = base + rng() * 1.5;
    let houseIndex = 0;
    while (cursor < base + L - 7) {
      // Keep the last house of a chunk inside it, so the run of houses has no long empty stretch.
      const width = Math.min(8.5 + rng() * 3, base + L - cursor - 0.5);
      const start = cursor;
      const [wall, roof] = PALETTE.houses[(index * 3 + houseIndex++) % PALETTE.houses.length]!;
      const tall = rng() > 0.65;
      const height = tall ? 5.8 : 3.4;
      const centerZ = localZ(start + width / 2);
      const doorS = start + width * (0.35 + rng() * 0.25);
      b.place(new THREE.BoxGeometry(HOUSE_DEPTH, height, width), wall, [HOUSE_X, 0.1 + height / 2, centerZ]);
      b.place(roofPrism(width, 2.6, HOUSE_DEPTH), roof, [HOUSE_X, 0.1 + height, centerZ], [0, Math.PI / 2, 0]);
      b.place(new THREE.BoxGeometry(0.9, 1.8, 0.9), wall, [HOUSE_X - 1.6, height + 1.9, centerZ - width * 0.3]);
      put('house', HOUSE_X, HOUSE_DEPTH / 2);
      // Porch: slab, two posts, a small roof, and the front door behind it.
      b.place(new THREE.BoxGeometry(0.12, 2.2, 1.2), PALETTE.door, [HOUSE_FACE - 0.02, 1.2, localZ(doorS)]);
      b.place(new THREE.BoxGeometry(1.9, 0.25, 2.6), PALETTE.porch, [HOUSE_FACE - 0.95, 0.22, localZ(doorS)]);
      for (const pz of [doorS - 1.2, doorS + 1.2]) b.place(new THREE.BoxGeometry(0.14, 2.1, 0.14), PALETTE.frame, [HOUSE_FACE - 1.8, 1.3, localZ(pz)]);
      b.place(new THREE.BoxGeometry(2.3, 0.16, 3.0), roof, [HOUSE_FACE - 1.0, 2.45, localZ(doorS)]);
      put('porch', HOUSE_FACE - 0.95, 1.3);
      // Windows, some lit for the early hour.
      for (const wz of [start + width * 0.16, start + width * 0.8]) {
        const lit = rng() > 0.55;
        b.place(new THREE.BoxGeometry(0.08, 1.2, 1.5), lit ? PALETTE.window : PALETTE.frame, [HOUSE_FACE - 0.02, 1.9, localZ(wz)], [0, 0, 0], [1, 1, 1], lit);
        b.place(new THREE.BoxGeometry(0.14, 1.45, 0.14), PALETTE.frame, [HOUSE_FACE - 0.04, 1.9, localZ(wz)]);
        if (tall) b.place(new THREE.BoxGeometry(0.08, 1.1, 1.3), PALETTE.frame, [HOUSE_FACE - 0.02, 4.4, localZ(wz)]);
      }
      // Garden path from the pavement to the porch, and a driveway on one side.
      b.place(new THREE.BoxGeometry(HOUSE_FACE - 1.8 - WALK_OUTER, 0.06, 1.1), PALETTE.path, [(HOUSE_FACE - 1.8 + WALK_OUTER) / 2, 0.14, localZ(doorS)]);
      put('path', (HOUSE_FACE - 1.8 + WALK_OUTER) / 2, (HOUSE_FACE - 1.8 - WALK_OUTER) / 2);
      if (rng() > 0.45) {
        const driveS = start + width * 0.94;
        b.place(new THREE.BoxGeometry(HOUSE_FACE - WALK_OUTER, 0.05, 2.4), PALETTE.drive, [(HOUSE_FACE + WALK_OUTER) / 2, 0.135, localZ(driveS)]);
        put('driveway', (HOUSE_FACE + WALK_OUTER) / 2, (HOUSE_FACE - WALK_OUTER) / 2);
      }
      // Picket fence along the garden boundary, with a gap at the path.
      for (let fs = start - 1; fs < start + width + 1; fs += 0.55) {
        if (Math.abs(fs - doorS) < 0.85) continue;
        b.place(new THREE.BoxGeometry(0.08, 0.8, 0.12), PALETTE.fence, [FENCE_X, 0.5, localZ(fs)]);
      }
      put('fence', FENCE_X, 0.1);
      porches.push({ s: doorS, x: HOUSE_FACE - 0.95, side: 1 });

      const gap = 2.5 + rng() * 5;
      if (gap > 4.5) {
        const treeS = start + width + gap / 2;
        const tx = 7.6 + rng() * 0.8;
        const sc = 0.8 + rng() * 0.35;
        b.place(new THREE.CylinderGeometry(0.18 * sc, 0.26 * sc, 2.4 * sc, 6), PALETTE.trunk, [tx, 1.3 * sc, localZ(treeS)]);
        b.place(new THREE.IcosahedronGeometry(1.7 * sc, 0), PALETTE.leaf[0], [tx, 3.3 * sc, localZ(treeS)], [rng(), rng(), 0]);
        b.place(new THREE.IcosahedronGeometry(1.1 * sc, 0), PALETTE.leaf[1], [tx + 0.6 * sc, 4.3 * sc, localZ(treeS) + 0.2], [rng(), rng(), 0]);
        put('tree', tx, 1.7 * sc);
      }
      cursor = start + width + gap;
    }

    // Near side: hedges, low trees and parked cars along the kerb. Never in the travel lane.
    if (this.nearSideDetail) {
      let nearCursor = base + rng() * 4;
      while (nearCursor < base + L - 6) {
        const s = nearCursor;
        const roll = rng();
        if (roll > 0.62) {
          const sc = 0.7 + rng() * 0.3;
          b.place(new THREE.CylinderGeometry(0.16 * sc, 0.24 * sc, 2.2 * sc, 6), PALETTE.trunk, [-7.4, 1.2 * sc, localZ(s)]);
          b.place(new THREE.IcosahedronGeometry(1.5 * sc, 0), PALETTE.leaf[2], [-7.4, 3 * sc, localZ(s)], [rng(), rng(), 0]);
          put('tree', -7.4, 1.5 * sc);
        } else if (roll > 0.3) {
          const len = 3 + rng() * 4;
          b.place(new THREE.BoxGeometry(1.1, 0.9, len), PALETTE.hedge, [-6.8, 0.55, localZ(s + len / 2)]);
          put('hedge', -6.8, 0.55);
        } else {
          // Parked car at the near kerb.
          const color = PALETTE.cars[(index + Math.floor(s)) % PALETTE.cars.length]!;
          const cx = -(ROAD_HALF - 1.1);
          b.place(new THREE.BoxGeometry(1.8, 0.8, 4.2), color, [cx, 0.72, localZ(s + 2.1)]);
          b.place(new THREE.BoxGeometry(1.6, 0.7, 2.3), color, [cx, 1.45, localZ(s + 2.3)]);
          b.place(new THREE.BoxGeometry(1.64, 0.5, 2.1), PALETTE.carGlass, [cx, 1.45, localZ(s + 2.3)]);
          for (const wz of [s + 0.9, s + 3.3]) {
            b.place(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 8), PALETTE.tyre, [cx - 0.78, 0.36, localZ(wz)], [0, 0, Math.PI / 2]);
            b.place(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 8), PALETTE.tyre, [cx + 0.78, 0.36, localZ(wz)], [0, 0, Math.PI / 2]);
          }
          put('parked-car', cx, 1.2);
        }
        nearCursor = s + 5 + rng() * 7;
      }
    }

    // Street lamps on the far pavement.
    for (let s = Math.ceil(base / 30) * 30; s < base + L; s += 30) {
      b.place(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 6), PALETTE.pole, [WALK_OUTER - 0.5, 2.4, localZ(s)]);
      b.place(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), PALETTE.pole, [WALK_OUTER - 1.05, 4.65, localZ(s)], [0, 0, Math.PI / 2]);
      b.place(new THREE.IcosahedronGeometry(0.2, 0), PALETTE.lamp, [WALK_OUTER - 1.6, 4.5, localZ(s)], [0, 0, 0], [1, 1, 1], true);
      put('lamp', WALK_OUTER - 0.5, 0.2);
    }

    const group = b.build(this.materials.lit, this.materials.glow);
    this.group.add(group);
    this.chunks.set(index, { index, group, porches, placements });
  }
}
