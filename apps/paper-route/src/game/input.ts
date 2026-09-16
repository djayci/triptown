// Fresh-press input: an action fires only on a new press, and re-arms only after release, so a held
// key or finger never starts rounds back to back (UKGC RTS 14G / AGCO 2.18 "release and press again").

export class InputArm {
  private armed = true;

  /** Returns true if this press may act; the arm stays spent until release(). */
  press(repeat = false): boolean {
    if (repeat || !this.armed) return false;
    this.armed = false;
    return true;
  }

  release(): void {
    this.armed = true;
  }

  get isArmed(): boolean {
    return this.armed;
  }
}

/** Wires a key (default Space) to an InputArm; key auto-repeat never fires. Returns a disposer. */
export function bindKey(target: Window, arm: InputArm, onPress: () => void, code = 'Space'): () => void {
  const down = (e: KeyboardEvent) => {
    if (e.code !== code) return;
    e.preventDefault();
    if (arm.press(e.repeat)) onPress();
  };
  const up = (e: KeyboardEvent) => {
    if (e.code === code) arm.release();
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}

/** Auto cash-out targets offered by the HUD, never below the profile's minimum cash-out. */
export function autoCashoutSteps(minCashout: number): number[] {
  const steps = [1.1, 1.25, 1.5, 2, 3, 5, 10, 25, 50, 100];
  return [Math.max(1.01, minCashout), ...steps.filter((s) => s > minCashout)];
}

export function nextAutoCashout(current: number | null, direction: -1 | 1, minCashout: number): number | null {
  const steps = autoCashoutSteps(minCashout);
  if (current === null) return direction > 0 ? steps[0]! : null;
  const index = steps.findIndex((s) => s >= current - 1e-9);
  const next = index + direction;
  if (next < 0) return null;
  return steps[Math.min(next, steps.length - 1)]!;
}
