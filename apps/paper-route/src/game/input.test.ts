import { describe, expect, it } from 'vitest';
import { InputArm, autoCashoutSteps, nextAutoCashout } from './input';

describe('InputArm', () => {
  it('fires once per press and re-arms only after release', () => {
    const arm = new InputArm();
    expect(arm.press()).toBe(true);
    expect(arm.press()).toBe(false);
    expect(arm.press()).toBe(false);
    arm.release();
    expect(arm.press()).toBe(true);
  });

  it('ignores key auto-repeat even when armed', () => {
    const arm = new InputArm();
    expect(arm.press(true)).toBe(false);
    expect(arm.isArmed).toBe(true);
  });
});

describe('auto cash-out steps', () => {
  it('never offers a target below the profile minimum', () => {
    expect(autoCashoutSteps(1.01)[0]).toBe(1.01);
    expect(Math.min(...autoCashoutSteps(1.25))).toBe(1.25);
    expect(autoCashoutSteps(1.25)).not.toContain(1.1);
  });

  it('steps from off to the minimum and back to off', () => {
    expect(nextAutoCashout(null, 1, 1.1)).toBe(1.1);
    expect(nextAutoCashout(1.1, 1, 1.1)).toBe(1.25);
    expect(nextAutoCashout(1.1, -1, 1.1)).toBeNull();
    expect(nextAutoCashout(100, 1, 1.01)).toBe(100);
  });
});
