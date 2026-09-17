import { Container, Graphics, Sprite, Text, TilingSprite, type Application, type Texture } from 'pixi.js';
import { COLORS, displayStyle } from '@triptown/crash-client';

const W = 390;
const H = 844;

/**
 * Ascent intensity for a multiplier, and the only thing that may vary the scene's speed.
 *
 * Exported and pure so the rule is testable: two rounds that reach the same multiplier must look
 * identical at that moment, whatever their crash times. An intensity that depended on the crash time
 * would be an advance warning, and there are no warnings before a crash.
 */
export function intensityFor(multiplier: number): number {
  return Math.min(1, Math.log(Math.max(1, multiplier)) / Math.log(20));
}

/** Scene speed in px/s. `effectsOn` is the profile's intensityEffects flag. */
export function scrollSpeed(multiplier: number, effectsOn: boolean): number {
  return effectsOn ? 70 + intensityFor(multiplier) * 260 : 70;
}

/** Tile heights. Each layer scrolls by exactly one tile, so the loop never shows a seam. */
const FAR_TILE = 90;
const BAND_TILE = 190;

/**
 * The ascent: layers of shaft falling past a car that holds still, so the camera reads as rising.
 *
 * Speed is a function of the multiplier ONLY. It must never vary with the crash time, the time
 * remaining, or anything the player cannot already read on screen — a scene that speeds up as the
 * end approaches is an advance warning, and there are no warnings before a crash. The multiplier is
 * already the largest thing on screen, so animating from it tells the player nothing new.
 */
export class LiftScene extends Container {
  private readonly far: TilingSprite;
  private readonly bands: TilingSprite;
  private readonly streaks: Sprite[] = [];
  private readonly motes: Graphics[] = [];
  private readonly glow = new Graphics();
  private readonly car: Container;
  private readonly floorTape = new Container();
  private readonly floorLabels: Text[] = [];

  /** 0 at x1.00, approaching 1 as the multiplier climbs. Derived from the multiplier, nothing else. */
  private intensity = 0;
  private multiplierSeen = 1;
  private effectsOn = true;
  private reduced = false;
  private offset = 0;
  private dropping = false;
  private dropSpeed = 0;

  constructor(app: Application) {
    super();
    this.far = new TilingSprite({ texture: this.farTexture(app), width: W, height: H });
    this.bands = new TilingSprite({ texture: this.bandTexture(app), width: W, height: H });
    this.addChild(this.backdrop(), this.far, this.floorTape, this.bands, this.glow);

    for (const [x, w, h] of [
      [34, 4, 150],
      [96, 3, 110],
      [150, 5, 180],
      [232, 3, 120],
      [300, 4, 160],
      [356, 3, 100],
    ] as const) {
      const s = new Sprite(this.streakTexture(app, w, h));
      s.position.set(x, Math.random() * H);
      s.alpha = 0;
      this.streaks.push(s);
      this.addChild(s);
    }

    for (let i = 0; i < 8; i++) {
      const g = new Graphics().circle(0, 0, 2 + Math.random() * 2).fill(COLORS.cream);
      g.position.set(20 + Math.random() * (W - 40), Math.random() * H);
      g.alpha = 0;
      this.motes.push(g);
      this.addChild(g);
    }

    for (let i = 0; i < 6; i++) {
      const label = new Text({ text: '', style: displayStyle(84, COLORS.ink, 0) });
      label.alpha = 0.16;
      label.anchor.set(0.5);
      this.floorLabels.push(label);
      this.floorTape.addChild(label);
    }

    this.car = this.buildCar();
    this.addChild(this.car);
  }

  private backdrop(): Graphics {
    return new Graphics().rect(0, 0, W, H).fill(COLORS.ink);
  }

  private farTexture(app: Application): Texture {
    const g = new Graphics().rect(0, 0, W, FAR_TILE).fill({ color: COLORS.ink, alpha: 0 }).rect(0, 0, W, 3).fill({ color: COLORS.cream, alpha: 0.06 });
    return app.renderer.generateTexture(g);
  }

  /** One floor: a structural band and a lit window either side. */
  private bandTexture(app: Application): Texture {
    const g = new Graphics();
    g.rect(0, 0, W, BAND_TILE).fill({ color: COLORS.ink, alpha: 0 });
    g.rect(0, 0, W, 22).fill(COLORS.violet);
    g.rect(0, 0, W, 5).fill(COLORS.ink);
    g.rect(0, 17, W, 5).fill(COLORS.ink);
    for (const x of [10, 300]) {
      g.roundRect(x, 40, 80, 74, 8).fill(COLORS.sun);
      g.roundRect(x, 40, 80, 74, 8).stroke({ color: COLORS.ink, width: 6 });
      g.rect(x + 6, 68, 68, 6).fill({ color: COLORS.ink, alpha: 0.55 });
    }
    return app.renderer.generateTexture(g);
  }

  private streakTexture(app: Application, w: number, h: number): Texture {
    const g = new Graphics().roundRect(0, 0, w, h, w).fill({ color: COLORS.cream, alpha: 0.85 });
    return app.renderer.generateTexture(g);
  }

  /** The car holds still; the shaft moves. A rider would imply a person in a failing lift. */
  private buildCar(): Container {
    const c = new Container();
    const g = new Graphics();
    g.moveTo(28, 30).lineTo(84, 8).lineTo(140, 30).closePath().fill(COLORS.sun).stroke({ color: COLORS.ink, width: 7 });
    g.roundRect(18, 28, 132, 110, 10).fill(COLORS.sun).stroke({ color: COLORS.ink, width: 7 });
    g.roundRect(34, 46, 100, 62, 7).fill(COLORS.sky).stroke({ color: COLORS.ink, width: 6 });
    g.moveTo(84, 46).lineTo(84, 108).stroke({ color: COLORS.ink, width: 5 });
    g.roundRect(66, 118, 36, 12, 6).fill(COLORS.lime).stroke({ color: COLORS.ink, width: 5 });
    const cable = new Graphics()
      .moveTo(60, -H)
      .lineTo(60, 16)
      .moveTo(108, -H)
      .lineTo(108, 16)
      .stroke({ color: COLORS.ink, width: 7 });
    c.addChild(cable, g);
    c.position.set(W / 2 - 84, H * 0.62);
    return c;
  }

  /** `multiplier` drives everything here. Nothing else may. */
  setMultiplier(multiplier: number): void {
    this.multiplierSeen = multiplier;
    this.intensity = intensityFor(multiplier);
  }

  setEffectsEnabled(on: boolean): void {
    this.effectsOn = on;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  /** Floor number shown on the tape behind the shaft. Decoration; the multiplier is the value. */
  setFloor(floor: number): void {
    this.floorLabels.forEach((label, i) => {
      const n = floor - i;
      label.text = n > 0 ? String(n) : '';
    });
  }

  /**
   * The cable goes. The car leaves the frame downward and is gone; the camera does not follow it,
   * there is no impact, and nothing is in it. Portugal Reg. 308/2023 Rule 7(b) protects the dignity
   * and integrity of persons, which is why the car is empty; the rest keeps an outcome statement
   * from becoming a fear effect (CAP 4.2). There is no build-up, because that would be a warning.
   */
  onCrash(): void {
    this.dropping = true;
    this.dropSpeed = 0;
  }

  reset(): void {
    this.dropping = false;
    this.dropSpeed = 0;
    this.car.y = H * 0.62;
  }

  update(dtSeconds: number): void {
    if (this.dropping) {
      // Gravity, briefly, then it is simply gone. No landing frame.
      this.dropSpeed += 2600 * dtSeconds;
      this.car.y += this.dropSpeed * dtSeconds;
      if (this.car.y > H + 200) this.car.visible = false;
      return;
    }
    this.car.visible = true;
    if (this.reduced) return;
    // Baseline speed with intensity off: constant, so a regulated profile still reads as motion
    // without the escalation that makes speed a risk factor.
    const speed = scrollSpeed(this.multiplierSeen, this.effectsOn);
    this.offset += speed * dtSeconds;
    this.far.tilePosition.y = (this.offset * 0.55) % FAR_TILE;
    this.bands.tilePosition.y = this.offset % BAND_TILE;

    this.floorTape.y = this.offset % 132;
    this.floorLabels.forEach((label, i) => {
      label.position.set(W / 2, i * 132 - 66);
    });

    const streakAlpha = this.effectsOn ? this.intensity * 0.55 : 0;
    this.streaks.forEach((s, i) => {
      s.alpha = streakAlpha;
      s.y = (s.y + speed * dtSeconds * (1.6 + i * 0.12)) % (H + 200);
    });

    const moteAlpha = this.effectsOn ? this.intensity * 0.8 : 0;
    this.motes.forEach((m, i) => {
      m.alpha = moteAlpha;
      m.y -= speed * dtSeconds * (0.35 + i * 0.05);
      if (m.y < -10) m.y = H + 10;
    });

    this.glow
      .clear()
      .rect(0, 0, W, H)
      .fill({ color: COLORS.sun, alpha: this.effectsOn ? this.intensity * 0.1 : 0.02 });
  }
}
