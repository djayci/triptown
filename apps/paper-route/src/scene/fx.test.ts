import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Fx, THROW_SECONDS, throwApex, throwArcPoint } from './fx';

const box = new THREE.Vector3(0.8, 1.3, -1.4);

describe('throws', () => {
  it('always land exactly on the porch, whatever the distance', () => {
    for (const porch of [new THREE.Vector3(7.6, 0.45, -1), new THREE.Vector3(-7.6, 0.45, 9), new THREE.Vector3(7.6, 0.45, -12)]) {
      expect(throwArcPoint(box, porch, 1).distanceTo(porch)).toBeLessThan(1e-9);
    }
  });

  it('take the same time and land once, for throws at different moments', () => {
    const fx = new Fx({ reducedMotion: false });
    const landed: number[] = [];
    let clock = 0;
    fx.throwPaper(box, new THREE.Vector3(7.6, 0.45, -1), () => landed.push(clock));
    for (let i = 0; i < 20; i++) { clock += 1 / 60; fx.update(1 / 60, 10); }
    fx.throwPaper(box, new THREE.Vector3(-7.6, 0.45, 6), () => landed.push(clock));
    for (let i = 0; i < 120; i++) { clock += 1 / 60; fx.update(1 / 60, 10); }
    expect(landed).toHaveLength(2);
    expect(landed[0]!).toBeCloseTo(Math.ceil(THROW_SECONDS * 60) / 60, 5);
    expect(landed[1]! - 20 / 60).toBeCloseTo(landed[0]!, 5);
    expect(fx.activeThrows).toBe(0);
  });
});

describe('arc shape', () => {
  it('depends only on the throw, never on when it was thrown', () => {
    const porch = new THREE.Vector3(7.6, 0.45, -3);
    const early = throwArcPoint(box, porch, 0.5).clone();
    const late = throwArcPoint(box, porch, 0.5).clone();
    expect(early.equals(late)).toBe(true);
    // A longer throw arcs higher, but both stay within the clamp.
    expect(throwApex(box, new THREE.Vector3(7.6, 0.45, -12))).toBeGreaterThan(throwApex(box, porch));
    for (const to of [new THREE.Vector3(7.6, 0.45, 0), new THREE.Vector3(7.6, 0.45, -13)]) {
      expect(throwApex(box, to)).toBeGreaterThanOrEqual(1);
      expect(throwApex(box, to)).toBeLessThanOrEqual(2.4);
    }
  });
});

describe('reduced motion', () => {
  it('turns off shake and speed streaks', () => {
    const fx = new Fx({ reducedMotion: true });
    fx.splash(new THREE.Vector3(0.8, 0.3, -1.6));
    fx.update(0.016, 20);
    expect(fx.cameraShake(1).length()).toBe(0);
    expect(fx.group.children.find((c) => (c as THREE.LineSegments).isLineSegments)?.visible).toBe(false);
  });

  it('shakes briefly on a splash when motion is allowed', () => {
    const fx = new Fx({ reducedMotion: false });
    fx.splash(new THREE.Vector3(0.8, 0.3, -1.6));
    fx.update(0.016, 20);
    expect(fx.cameraShake(1.3).length()).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) fx.update(0.016, 20);
    expect(fx.cameraShake(2).length()).toBe(0);
  });
});
