import { Container, Graphics, Sprite, Text, TilingSprite, type Application, type Texture } from 'pixi.js';
import { COLORS, displayStyle, labelStyle, text as mkText } from '@triptown/crash-client';
import { t } from '../i18n/en';

const W = 390;
const H = 844;
/** Where the car sits on screen. Everything keyed to the ride is anchored to it. */
const CAR_Y = 452;

/**
 * Ride intensity for a multiplier, and the only thing that may vary the scene's speed.
 *
 * Pure and exported so the rule is testable: two rounds that reach the same multiplier must look
 * identical at that moment, whatever their crash times. An intensity that depended on the crash
 * time would be an advance warning, and there are no warnings before a round ends.
 */
export function intensityFor(multiplier: number): number {
  return Math.min(1, Math.log(Math.max(1, multiplier)) / Math.log(20));
}

/** Scene speed in px/s. `effectsOn` is the profile's intensityEffects flag. */
export function scrollSpeed(multiplier: number, effectsOn: boolean): number {
  return effectsOn ? 60 + intensityFor(multiplier) * 240 : 60;
}

/**
 * The stops along the line.
 *
 * Each is entered at a MULTIPLIER, never at a time, so two rounds reaching the same value have
 * passed the same places. The ladder roughly halves in reachability at each step
 * (P(reach m) = RTP / m, so ~65% see Pine Halt and ~4% Eagle Point), which is what makes arriving
 * somewhere mean something without any of it being a prediction.
 *
 * They are scenery, not cash-out points: the player may collect at any instant. Making the stops
 * the only place a collect could land would change the maths and break the certified engine.
 */
export interface Stop {
  readonly from: number;
  /** Catalogue key, not the words: every player-facing string is translated and reviewed together. */
  readonly key: string;
  readonly band: number;
  readonly light: number;
}

export const STOPS: readonly Stop[] = [
  { from: 1, key: 'stop.valley', band: 0x3f4b57, light: 0xffd43b },
  { from: 1.5, key: 'stop.pineHalt', band: 0x2f5d73, light: 0xfff4d6 },
  { from: 3, key: 'stop.midway', band: 0x2f6f63, light: 0x9be86d },
  { from: 6, key: 'stop.cloudDeck', band: 0x8b5cf6, light: 0x3ec6ff },
  { from: 12, key: 'stop.eaglePoint', band: 0xb98a3c, light: 0xffc414 },
  { from: 25, key: 'stop.openSky', band: 0xff3d8b, light: 0xfff4d6 },
];

/** The stop a multiplier is at. Pure, and a function of the multiplier alone. */
export function stopFor(multiplier: number): Stop {
  let found = STOPS[0] as Stop;
  for (const s of STOPS) if (multiplier >= s.from) found = s;
  return found;
}

/**
 * How high the car has climbed, as a continuous height in metres.
 *
 * Logarithmic, so the mountain is a mountain: the top stop sits near 2 000 m rather than the
 * arbitrarily large number a linear mapping produces. It also moves fastest early, where most
 * rounds actually live. Decoration over the multiplier, which is the value.
 */
export function heightExact(multiplier: number): number {
  return (Math.log(Math.max(1, multiplier)) / Math.log(25)) * 2000;
}

/** The height shown on the car, rounded to a readable step. */
export function heightFor(multiplier: number): number {
  return Math.round(heightExact(multiplier) / 10) * 10;
}

/**
 * The silhouettes each landscape layer is cut from, as [x, y] pairs across one tile width.
 *
 * Exported so the seam is testable as a property rather than as a screenshot: a capture taken at
 * the wrong phase of the loop proves nothing either way. A tile whose first and last y differ
 * shows a step every time it wraps, which is the only way these layers can seam.
 */
export const FAR_PROFILE: readonly (readonly [number, number])[] = [
  [0, 150], [64, 34], [130, 128], [196, 22], [262, 120], [326, 48], [390, 150],
];
export const RIDGE_PROFILE: readonly (readonly [number, number])[] = [
  [0, 96], [98, 30], [196, 104], [292, 42], [390, 96],
];

/** The landscape occupies the lower screen; the sky above it is where the value is read. */
const FAR_TOP = 430;
const FAR_H = 210;
const RIDGE_TOP = 596;
const RIDGE_H = 260;

/**
 * The ride, seen from the side: the line and the landscape move past a car that holds still.
 *
 * Speed, colour and every other animated property are functions of the MULTIPLIER ONLY. None may
 * vary with the crash time, the time remaining, or anything the player cannot already read on
 * screen. That is why the arrival is abrupt: a car that slowed as it neared its stop would be
 * telling the player the round was about to end, which is the warning that is not allowed.
 */
export class CableCarScene extends Container {
  private readonly far: TilingSprite;
  private readonly ridge: TilingSprite;
  private readonly motes: Graphics[] = [];
  private readonly streaks: Sprite[] = [];
  private readonly glow = new Graphics();
  private readonly car: Container;
  private readonly doorLeft = new Graphics();
  private readonly doorRight = new Graphics();
  private readonly lamp = new Graphics();
  private readonly heightValue: Text;
  private readonly stopLabel: Text;
  private readonly stopTextures = new Map<string, Texture>();
  private readonly app: Application;

  private intensity = 0;
  private multiplierSeen = 1;
  private stop: Stop = STOPS[0] as Stop;
  private effectsOn = true;
  private reduced = false;
  private offset = 0;
  private arrived = false;
  private doorOpen = 0;
  private requested = false;

  constructor(app: Application) {
    super();
    this.app = app;
    this.far = new TilingSprite({ texture: this.farTexture(app), width: W, height: FAR_H });
    this.far.position.set(0, FAR_TOP);
    this.ridge = new TilingSprite({ texture: this.ridgeTexture(app, STOPS[0] as Stop), width: W, height: RIDGE_H });
    this.ridge.position.set(0, RIDGE_TOP);
    this.addChild(this.backdrop(), this.far, this.ridge, this.glow);

    for (const [x, w, h] of [
      [40, 4, 120],
      [110, 3, 90],
      [250, 4, 140],
      [330, 3, 100],
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

    this.addChild(this.rope());
    this.car = this.buildCar();
    this.addChild(this.car);

    // On the car, not in a HUD chip: a vehicle carries its own readout, and a floating panel
    // belongs to no part of the picture. Subordinate to the multiplier, and never styled as money.
    this.heightValue = mkText('0 m', displayStyle(15, COLORS.sun, 0), [0.5, 0.5]);
    this.heightValue.position.set(W / 2, CAR_Y + 128);
    this.addChild(this.heightValue);

    this.stopLabel = mkText(t(STOPS[0]!.key), labelStyle(13, COLORS.cream), [0.5, 0.5]);
    this.stopLabel.position.set(W / 2, CAR_Y - 62);
    this.addChild(this.stopLabel);
  }

  private backdrop(): Graphics {
    return new Graphics().rect(0, 0, W, H).fill(COLORS.ink);
  }

  /**
   * The haul rope, climbing out of frame into cover at both ends. No terminus is ever drawn: a
   * visible end of the line is a progress bar toward the crash.
   */
  private rope(): Graphics {
    return new Graphics()
      .moveTo(-20, 700)
      .lineTo(410, 120)
      .stroke({ color: COLORS.mutedInk, width: 7 })
      .moveTo(-20, 684)
      .lineTo(410, 104)
      .stroke({ color: COLORS.mutedInk, width: 3, alpha: 0.45 });
  }

  private farTexture(app: Application): Texture {
    const g = new Graphics()
      .rect(0, 0, W, FAR_H)
      .fill({ color: COLORS.ink, alpha: 0 })
      .moveTo(0, 150)
      .lineTo(64, 34)
      .lineTo(130, 128)
      .lineTo(196, 22)
      .lineTo(262, 120)
      .lineTo(326, 48)
      .lineTo(390, 150)
      .lineTo(390, 210)
      .lineTo(0, 210)
      .fill({ color: COLORS.violet, alpha: 0.3 });
    return app.renderer.generateTexture(g);
  }

  /** One length of line: the near ridge, and a lit stop building whose colour marks the zone. */
  private ridgeTexture(app: Application, stop: Stop): Texture {
    const cached = this.stopTextures.get(stop.key);
    if (cached) return cached;
    const g = new Graphics();
    g.rect(0, 0, W, RIDGE_H).fill({ color: COLORS.ink, alpha: 0 });
    // One length of ridge, seamless left to right: the first and last points share a height.
    g.moveTo(0, 96).lineTo(98, 30).lineTo(196, 104).lineTo(292, 42).lineTo(390, 96).lineTo(390, 260).lineTo(0, 260).fill(stop.band);
    g.moveTo(0, 96).lineTo(98, 30).lineTo(196, 104).lineTo(292, 42).lineTo(390, 96).stroke({ color: COLORS.ink, width: 5 });
    // A lit building on the ridge, in the colour that marks this part of the line.
    g.roundRect(150, 118, 52, 44, 8).fill(stop.light).stroke({ color: COLORS.ink, width: 5 });
    g.roundRect(24, 150, 34, 30, 6).fill(stop.light).stroke({ color: COLORS.ink, width: 5 });
    const tex = app.renderer.generateTexture(g);
    this.stopTextures.set(stop.key, tex);
    return tex;
  }

  private streakTexture(app: Application, w: number, h: number): Texture {
    const g = new Graphics().roundRect(0, 0, w, h, w).fill({ color: COLORS.cream, alpha: 0.8 });
    return app.renderer.generateTexture(g);
  }

  /**
   * The car: grip, hanger, cabin, and two people riding.
   *
   * One window with a central seam, rather than two separate doors: two framed panels side by side
   * read as a row of bars, not as a cable car. The glass is tinted so the riders show through while
   * it is shut, and the panes slide behind the cabin's own sides when it opens.
   */
  private buildCar(): Container {
    const c = new Container();
    const body = new Graphics();
    // The grip sits ON the rope. At the car's x the rope is at y 410, so the hanger spans the gap
    // down to the cabin roof rather than floating above it.
    body.roundRect(70, -52, 28, 16, 5).fill(COLORS.ink);
    body.rect(79, -38, 10, 30).fill(COLORS.ink);
    body.roundRect(1, -8, 166, 152, 20).fill(COLORS.sun).stroke({ color: COLORS.ink, width: 7 });
    body.moveTo(9, -8).lineTo(84, -32).lineTo(159, -8).closePath().fill(COLORS.sun2).stroke({ color: COLORS.ink, width: 7 });
    // The window opening, and the interior behind it.
    body.roundRect(31, 16, 106, 96, 10).fill(0x0d0f12);
    body.roundRect(50, 116, 68, 24, 6).fill(0x0d0f12);
    c.addChild(body, this.riders());

    for (const [pane, x] of [
      [this.doorLeft, 31],
      [this.doorRight, 84],
    ] as const) {
      pane.roundRect(0, 0, 53, 96, 6).fill({ color: COLORS.sky, alpha: 0.38 });
      pane.position.set(x, 16);
    }
    // The seam where the two panes meet, and the frame around the whole window.
    const trim = new Graphics();
    trim.moveTo(84, 16).lineTo(84, 112).stroke({ color: COLORS.ink, width: 4 });
    trim.roundRect(31, 16, 106, 96, 10).stroke({ color: COLORS.ink, width: 6 });
    // The cabin's own sides, drawn last so an opening pane slides out of sight behind them.
    const sides = new Graphics();
    sides.roundRect(1, -8, 32, 152, 16).fill(COLORS.sun).stroke({ color: COLORS.ink, width: 7 });
    sides.roundRect(135, -8, 32, 152, 16).fill(COLORS.sun).stroke({ color: COLORS.ink, width: 7 });

    this.lamp.position.set(33, 124);
    c.addChild(this.doorLeft, this.doorRight, trim, sides, this.lamp);
    c.position.set(W / 2 - 84, CAR_Y);
    return c;
  }

  /**
   * Two people riding, seen from the side and deliberately NOT a symmetrical pair: two circles set
   * level in a window read as a pair of eyes and turn the cabin into a cartoon face. Adults — small
   * heads on square shoulders (CAP under-18 guidance Oct 2025 §14, CAP 16.3.14, PT R7c, Kenya
   * reg 95). They can be here at all only because nothing falls and nothing is harmed.
   */
  private riders(): Graphics {
    const r = new Graphics();
    r.moveTo(40, 30).lineTo(128, 30).stroke({ color: COLORS.ink, width: 4, alpha: 0.4 });
    r.roundRect(50, 52, 28, 60, 9).fill(COLORS.violet).stroke({ color: COLORS.ink, width: 3 });
    r.circle(64, 42, 10).fill(COLORS.cream).stroke({ color: COLORS.ink, width: 3 });
    r.roundRect(96, 64, 24, 48, 7).fill(COLORS.pink).stroke({ color: COLORS.ink, width: 3 });
    r.circle(108, 55, 9).fill(COLORS.cream).stroke({ color: COLORS.ink, width: 3 });
    return r;
  }

  /** `multiplier` drives everything here. Nothing else may. */
  setMultiplier(multiplier: number): void {
    this.multiplierSeen = multiplier;
    this.intensity = intensityFor(multiplier);
    const stop = stopFor(multiplier);
    if (stop.key !== this.stop.key) {
      this.stop = stop;
      this.ridge.texture = this.ridgeTexture(this.app, stop);
      this.stopLabel.text = t(stop.key);
    }
    this.heightValue.text = `${heightFor(multiplier)} m`;
  }

  setEffectsEnabled(on: boolean): void {
    this.effectsOn = on;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  /**
   * The player has asked for the next stop. Lights the lamp, and nothing else: this reports what
   * the PLAYER did, never anything about where the car will stop or whether the ride is still
   * running. Every visible consequence of the press must be identical for a win and a loss.
   */
  setStopRequested(on: boolean): void {
    this.requested = on;
    this.lamp.clear().roundRect(0, 0, 14, 8, 4).fill(on ? COLORS.lime : COLORS.ink).stroke({ color: COLORS.ink, width: 4 });
  }

  /**
   * The car reaches the stop it was always going to. The doors open, the ride is over, and nothing
   * preceded it: no slowing, no chime, no flicker. A build-up would be a warning. Nothing falls and
   * nobody is harmed, which is what lets people be in the car at all (PT Reg. 308/2023 Rule 7(b),
   * Ghana AAG Art. 15) and keeps the ending an outcome statement rather than a fear effect.
   */
  onCrash(): void {
    this.arrived = true;
  }

  reset(): void {
    this.arrived = false;
    this.doorOpen = 0;
    this.doorLeft.x = 31;
    this.doorRight.x = 84;
    this.setStopRequested(false);
    this.stop = STOPS[0] as Stop;
    this.ridge.texture = this.ridgeTexture(this.app, this.stop);
    this.stopLabel.text = t(this.stop.key);
  }

  update(dtSeconds: number): void {
    if (this.arrived) {
      // The doors part AFTER the outcome, so this animation tells the player nothing they do not
      // already know. The line is still; the landscape has stopped going past.
      this.doorOpen = Math.min(1, this.doorOpen + dtSeconds * 3);
      const slide = this.doorOpen * 26;
      this.doorLeft.x = 31 - slide;
      this.doorRight.x = 84 + slide;
      return;
    }
    if (this.reduced) return;
    const speed = scrollSpeed(this.multiplierSeen, this.effectsOn);
    this.offset += speed * dtSeconds;
    // Down and to the left: the landscape falls away as the car climbs to the right.
    // Sideways only. A vertical scroll would tile the landscape up the sky; the climb is conveyed
    // by the value, the height on the car and the part of the line being passed.
    this.far.tilePosition.x = -this.offset * 0.25;
    this.ridge.tilePosition.x = -this.offset * 0.6;

    const streakAlpha = this.effectsOn ? this.intensity * 0.5 : 0;
    this.streaks.forEach((s, i) => {
      s.alpha = streakAlpha;
      s.y = (s.y + speed * dtSeconds * (1.5 + i * 0.12)) % (H + 200);
    });
    const moteAlpha = this.effectsOn ? this.intensity * 0.75 : 0;
    this.motes.forEach((m, i) => {
      m.alpha = moteAlpha;
      m.y -= speed * dtSeconds * (0.3 + i * 0.05);
      if (m.y < -10) m.y = H + 10;
    });
    this.glow
      .clear()
      .rect(0, 0, W, H)
      .fill({ color: this.stop.light, alpha: this.effectsOn ? this.intensity * 0.09 : 0.02 });
  }
}
