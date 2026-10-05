import { readFileSync } from 'node:fs';
import { Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { GRAZE_FADE_SECONDS, GRAZERS } from './flock';
import { FlockStage } from './stage';

// flock-mvp spec "Pen and wolf never read as a near miss or as harm".
const frames = () => Texture.EMPTY;

function run(stage: FlockStage, to: number, seconds: number): void {
  stage.start();
  const steps = seconds * 60;
  for (let i = 0; i < steps; i++) {
    stage.setMultiplier(1 + ((to - 1) * i) / steps);
    stage.setPace(i / steps / 2);
    stage.update(1 / 60);
  }
}

describe('the wolf', () => {
  it('is never on screen before the crash arrives, however long the round runs', () => {
    const stage = new FlockStage(frames, { backdrop: false });
    stage.start();
    for (let i = 0; i < 60 * 60; i++) {
      stage.setMultiplier(1 + i / 600);
      stage.update(1 / 60);
      expect(stage.debugScene().wolfVisible).toBe(false);
    }
    stage.onCrash();
    stage.update(1 / 60);
    expect(stage.debugScene().wolfVisible).toBe(true);
  });

  it('a press that loses the tie shows the wolf and no pull-up', () => {
    // The view calls pullUp only from showWin, after settlement. A lost tie never reaches showWin, so the
    // stage goes straight from running to the crash.
    const stage = new FlockStage(frames, { backdrop: false });
    run(stage, 2, 3);
    stage.onCrash();
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      stage.update(1 / 60);
      seen.add(stage.phase);
    }
    expect([...seen]).toEqual(['crashed']);
    expect(stage.debugScene().present).toBe(0);
  });

  it('reset clears the wolf for the next round', () => {
    const stage = new FlockStage(frames, { backdrop: false });
    run(stage, 2, 1);
    stage.onCrash();
    stage.update(1 / 60);
    stage.reset();
    stage.update(1 / 60);
    expect(stage.debugScene().wolfVisible).toBe(false);
  });
});

describe('the pull-up', () => {
  it('is only ever started by the settled result, never by the press', () => {
    const view = readFileSync(new URL('./view.ts', import.meta.url), 'utf8');
    const calls = [...view.matchAll(/this\.flock\.pullUp\(\)/g)];
    expect(calls).toHaveLength(1);
    const showWin = view.slice(view.indexOf('override showWin('), view.indexOf('private party('));
    expect(showWin).toContain('this.flock.pullUp()');
  });

  it('stops the run and keeps the flock beside him', () => {
    const stage = new FlockStage(frames, { backdrop: false });
    run(stage, 3, 4);
    const before = stage.debugScene().present;
    stage.pullUp();
    for (let i = 0; i < 300; i++) stage.update(1 / 60);
    expect(stage.debugScene().speed).toBeLessThan(5);
    expect(stage.debugScene().present).toBe(before);
    expect(stage.debugScene().heroFrame).toBe('hero-stand');
  });
});

describe('the grazing flock', () => {
  it('fills the betting screen and is never counted as the flock', () => {
    const stage = new FlockStage(frames, { backdrop: false });
    stage.update(1 / 60);
    expect(stage.debugScene().grazing).toBe(GRAZERS);
    expect(stage.debugScene().present).toBe(0);
  });

  it('is left behind when the run starts; the flock with him still comes from the value alone', () => {
    const stage = new FlockStage(frames, { backdrop: false });
    stage.update(1 / 60);
    stage.start();
    for (let i = 0; i < 60 * 6; i++) {
      stage.setMultiplier(1);
      stage.setPace(0.3);
      stage.update(1 / 60);
      // At x1.00 nobody runs with him, however many grazers are still on screen behind.
      expect(stage.debugScene().present).toBe(0);
    }
    expect(stage.debugScene().grazing).toBe(0);
  });

  it('is gone at the wolf and comes back only with the next betting screen', () => {
    const stage = new FlockStage(frames, { backdrop: false });
    run(stage, 3, 2);
    stage.onCrash();
    stage.update(1 / 60);
    expect(stage.debugScene().grazing).toBe(0);
    stage.reset();
    stage.update(GRAZE_FADE_SECONDS);
    expect(stage.debugScene().grazing).toBe(GRAZERS);
  });
});

describe('the grazing flock after a round', () => {
  it('is there again when the next round starts straight from the result, and left behind', () => {
    const stage = new FlockStage(frames, { backdrop: false });
    run(stage, 3, 2);
    stage.pullUp();
    stage.update(1);
    expect(stage.debugScene().grazing).toBe(0);
    // PLAY AGAIN: the view resets the scene and starts the round in the same moment.
    stage.reset();
    stage.start();
    stage.update(1 / 60);
    expect(stage.debugScene().grazing).toBe(GRAZERS);
    expect(stage.debugScene().present).toBe(0);
    for (let i = 0; i < 60 * 6; i++) {
      stage.setPace(0.3);
      stage.update(1 / 60);
    }
    expect(stage.debugScene().grazing).toBe(0);
  });
});
