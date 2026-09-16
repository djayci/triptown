import { describe, expect, it } from 'vitest';
import { CHUNK_LENGTH, LANE_HALF_WIDTH, LANE_X, Street } from './street';

// Street layout for the angled overhead view (paper-route-iso-look 2.1–2.3).

describe('Street', () => {
  it('dresses the whole cross-section of every chunk', () => {
    const street = new Street(3);
    street.update(0, 200);
    const kinds = new Set(street.placements().map((p) => p.kind));
    for (const kind of ['house', 'porch', 'path', 'driveway', 'fence', 'tree', 'lamp', 'hedge', 'parked-car']) {
      expect(kinds, `missing ${kind}`).toContain(kind);
    }
    // Dressing on both sides of the road, not just the house side.
    expect(street.placements().some((p) => p.x < 0)).toBe(true);
    expect(street.placements().some((p) => p.x > 0)).toBe(true);
  });

  it('rebuilds a recycled chunk exactly as it was built the first time', () => {
    const first = new Street(11);
    first.update(0, 120);
    const before = JSON.stringify(first.placements());
    // Ride far enough to recycle every chunk, then come back to the start.
    first.update(4000, 120);
    const second = new Street(11);
    second.update(0, 120);
    expect(JSON.stringify(second.placements())).toBe(before);
  });

  it('spaces houses irregularly on the far side and puts none on the near side', () => {
    const street = new Street(3);
    street.update(0, 400);
    const starts = street.houseStarts(1);
    const gaps = starts.slice(1).map((v, i) => v - starts[i]!);
    expect(gaps.length).toBeGreaterThan(10);
    const distinct = new Set(gaps.map((g) => g.toFixed(1)));
    expect(distinct.size).toBeGreaterThan(gaps.length * 0.7);
    expect(street.houseStarts(-1)).toEqual([]);
  });

  it('leaves the travel lane clear and places nothing to aim at', () => {
    const street = new Street(7);
    street.update(0, 400);
    for (const p of street.placements()) {
      const clear = p.x + p.halfWidth < LANE_X - LANE_HALF_WIDTH || p.x - p.halfWidth > LANE_X + LANE_HALF_WIDTH;
      expect(clear, `${p.kind} at x=${p.x} blocks the lane`).toBe(true);
      expect(['mailbox', 'letterbox', 'bin', 'target', 'hoop', 'marker', 'coin']).not.toContain(p.kind);
    }
  });

  it('always has a porch alongside the courier to land a throw on', () => {
    const street = new Street(9);
    for (let d = 0; d < 1500; d += 3.7) {
      street.update(d, 150);
      const porch = street.porchAlongside(d);
      expect(porch).not.toBeNull();
      // Worst case is a porch a little over a house-width away; the throw still lands on a porch.
      expect(Math.abs(porch!.z)).toBeLessThan(14);
      expect(porch!.x).toBeGreaterThan(LANE_X);
    }
  });

  it('recycles chunks behind the courier', () => {
    const street = new Street(5);
    street.update(0, 150);
    const early = street.meshCount();
    street.update(5000, 150);
    expect(street.meshCount()).toBeLessThanOrEqual(early + 2 * 2);
    expect(street.group.children.length).toBeLessThanOrEqual(Math.ceil((150 + 30) / CHUNK_LENGTH) + 2);
  });

  it('drops near-side dressing at the lowest tier', () => {
    const street = new Street(5);
    street.setNearSideDetail(false);
    street.update(0, 200);
    expect(street.placements().some((p) => p.kind === 'parked-car')).toBe(false);
    expect(street.placements().some((p) => p.kind === 'house')).toBe(true);
  });
});
