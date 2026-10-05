import { describe, expect, it } from 'vitest';
import { strideCadence } from '../game/flock';
import { layerGain, runGain, strideRate } from './hooves';

// flock-mvp: the hooves grow with the rams on screen (user, 5 Oct 2026). They hear only the count the
// stage draws and the run speed, so the sound can never say more than the picture does.
const LAYERS = [
  { from: -1, full: 0 },
  { from: 0, full: 6 },
  { from: 6, full: 45 },
  { from: 45, full: 170 },
];

describe('layerGain', () => {
  it('has the hero alone at x1.00 and every layer in for a full field', () => {
    expect(LAYERS.map((l) => layerGain(0, l))).toEqual([1, 0, 0, 0]);
    expect(LAYERS.map((l) => layerGain(205, l))).toEqual([1, 1, 1, 1]);
  });

  it('only ever adds hooves as rams join', () => {
    for (const l of LAYERS) {
      let last = 0;
      for (let rams = 0; rams <= 205; rams++) {
        expect(layerGain(rams, l)).toBeGreaterThanOrEqual(last);
        last = layerGain(rams, l);
      }
    }
  });
});

describe('strideRate and runGain', () => {
  it('keeps step with the legs on screen, within a range that still sounds like hooves', () => {
    expect(strideRate(170, 2.2)).toBeCloseTo(strideCadence(170) / 2.2, 9);
    expect(strideRate(10000, 2.2)).toBe(1.8);
    expect(strideRate(0, 2.2)).toBe(0.6);
  });

  it('is silent standing and fades in as he gets going', () => {
    expect(runGain(0)).toBe(0);
    expect(runGain(45)).toBeCloseTo(0.5, 9);
    expect(runGain(170)).toBe(1);
  });
});
