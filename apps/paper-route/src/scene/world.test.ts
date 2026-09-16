import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COURIER_AHEAD, LANE_X } from './street';
import { CAMERA_OFFSET, CAMERA_TARGET, COURIER_SCREEN_Y, COURIER_SCREEN_Y as COURIER_Y, depthBlurWeight, isoCamera, tierSettings, VIEW_WIDTH } from './world';

// The camera contract of the Dawn Diorama view (paper-route-iso-look 1.1): orthographic, fixed, and
// never moving with the round.

const ASPECT = 390 / 844;
const screen = (camera: THREE.Camera, p: THREE.Vector3) => p.clone().project(camera);
/** On-screen height in clip units of a 1 m vertical stick standing at `z` metres along the route. */
const stickHeight = (camera: THREE.Camera, z: number) => screen(camera, new THREE.Vector3(6, 1, z)).y - screen(camera, new THREE.Vector3(6, 0, z)).y;

describe('isoCamera', () => {
  it('projects equal objects to the same size near and far', () => {
    const camera = isoCamera(ASPECT);
    const near = stickHeight(camera, 0);
    const far = stickHeight(camera, -90);
    expect(far).toBeCloseTo(near, 6);
  });

  it('keeps parallel street edges parallel', () => {
    const camera = isoCamera(ASPECT);
    const edge = (x: number) => {
      const a = screen(camera, new THREE.Vector3(x, 0, 0));
      const b = screen(camera, new THREE.Vector3(x, 0, -60));
      return Math.atan2(b.y - a.y, b.x - a.x);
    };
    expect(edge(-3.2)).toBeCloseTo(edge(3.2), 6);
  });

  it('runs the route up the frame to the left, with the houses across the street to the right', () => {
    const camera = isoCamera(ASPECT);
    const here = screen(camera, new THREE.Vector3(0, 0, 0));
    const ahead = screen(camera, new THREE.Vector3(0, 0, -20));
    expect(ahead.y).toBeGreaterThan(here.y);
    expect(ahead.x).toBeLessThan(here.x);
    const farSide = screen(camera, new THREE.Vector3(10, 0, 0));
    expect(farSide.x).toBeGreaterThan(here.x);
    expect(farSide.y).toBeGreaterThan(here.y);
  });

  it('holds the courier at the same height above the HUD panel at every frame shape', () => {
    for (const aspect of [390 / 844, 360 / 640, 414 / 896, 1440 / 900]) {
      const p = screen(isoCamera(aspect), new THREE.Vector3(LANE_X, 1.1, -COURIER_AHEAD));
      expect(p.y).toBeCloseTo(COURIER_SCREEN_Y, 3);
      expect(Math.abs(p.x)).toBeLessThan(0.8);
    }
  });

  it('is orthographic, and keeps the same angle at every frame shape', () => {
    const camera = isoCamera(ASPECT);
    expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
    expect(camera.right - camera.left).toBeCloseTo(VIEW_WIDTH, 6);
    // The aim point slides along the route per aspect, but the offset (and so the angle) never changes.
    const direction = (c: THREE.Camera) => new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    expect(direction(camera).angleTo(direction(isoCamera(360 / 640)))).toBeCloseTo(0, 6);
    expect(direction(camera).angleTo(CAMERA_OFFSET.clone().negate().normalize())).toBeCloseTo(0, 6);
    expect(CAMERA_TARGET.y).toBeGreaterThan(0);
  });
});

describe('tierSettings', () => {
  it('drops the depth pass before draw distance, and near-side detail last', () => {
    const high = tierSettings('high', 2);
    const medium = tierSettings('medium', 2);
    const low = tierSettings('low', 2);
    expect([high.depthPass, medium.depthPass, low.depthPass]).toEqual([true, false, false]);
    expect(medium.drawDistance).toBeLessThan(high.drawDistance);
    expect(low.drawDistance).toBeLessThan(medium.drawDistance);
    expect([high.nearSideDetail, medium.nearSideDetail, low.nearSideDetail]).toEqual([true, true, false]);
    expect(low.shadowMap).toBe(0);
  });
});

describe('depth treatment', () => {
  it('keeps the courier band sharp and softens the top and bottom of the frame', () => {
    // The courier sits inside the sharp band at every frame shape (see the camera test above).
    const courierBand = (COURIER_Y + 1) / 2;
    expect(depthBlurWeight(courierBand)).toBe(0);
    expect(depthBlurWeight(0.5)).toBe(0);
    expect(depthBlurWeight(0.02)).toBeGreaterThan(0.5);
    expect(depthBlurWeight(0.98)).toBeGreaterThan(0.5);
    // The blur rises smoothly toward the edges, never jumping.
    let previous = 0;
    for (let y = 0.8; y <= 1; y += 0.02) {
      const w = depthBlurWeight(y);
      expect(w).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = w;
    }
  });
});
