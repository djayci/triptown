import { Container, Graphics, Sprite, Text, TilingSprite, type Application, type Texture } from 'pixi.js';
import { COLORS, displayStyle, labelStyle, text as mkText } from '@triptown/crash-client';
import { t } from '../i18n/en';

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

/**
 * The building, as zones the ride passes through.
 *
 * Each zone is entered at a MULTIPLIER, never at a time, so two rounds reaching the same value have
 * passed through exactly the same building. The ladder roughly halves in reachability at each step
 * (P(reach m) = RTP/m, so ~65% see Offices, ~32% the Sky Lobby, ~4% the Penthouse), which is what
 * makes arriving somewhere feel like it meant something without any of it being a prediction.
 */
export interface Zone {
  readonly from: number;
  /** Catalogue key, not the words: every player-facing string is translated and reviewed together. */
  readonly key: string;
  readonly band: number;
  readonly window: number;
}

export const ZONES: readonly Zone[] = [
  { from: 1, key: 'zone.lobby', band: 0x3f4b57, window: 0xffd43b },
  { from: 1.5, key: 'zone.offices', band: 0x2f5d73, window: 0xfff4d6 },
  { from: 3, key: 'zone.skyLobby', band: 0x2f6f63, window: 0x9be86d },
  { from: 6, key: 'zone.terrace', band: 0x8b5cf6, window: 0x3ec6ff },
  { from: 12, key: 'zone.penthouse', band: 0xb98a3c, window: 0xffc414 },
  { from: 25, key: 'zone.roof', band: 0xff3d8b, window: 0xfff4d6 },
];

/** The zone a multiplier is in. Pure, and a function of the multiplier alone. */
export function zoneFor(multiplier: number): Zone {
  let found = ZONES[0] as Zone;
  for (const z of ZONES) if (multiplier >= z.from) found = z;
  return found;
}

/** The floor number shown on the tape. Decoration over the multiplier, which is the real value. */
export function floorFor(multiplier: number): number {
  return Math.max(0, Math.round((multiplier - 1) * 10));
}

/** Tile heights. Each layer scrolls by exactly one tile, so the loop never shows a seam. */
const FAR_TILE = 90;
const BAND_TILE = 190;

/**
 * The ascent: a lift climbing a building, with the shaft falling past a car that holds still.
 *
 * Speed, colour and every other animated property are functions of the MULTIPLIER ONLY. None may
 * vary with the crash time, the time remaining, or anything the player cannot already read on
 * screen. That is why the arrival is abrupt: a lift that slowed as it neared its floor would be
 * telling the player the round was about to end, which is precisely the warning that is not allowed.
 */
export class LiftScene extends Container {
  private readonly far: TilingSprite;
  private readonly bands: TilingSprite;
  private readonly streaks: Sprite[] = [];
  private readonly motes: Graphics[] = [];
  private readonly glow = new Graphics();
  private readonly car: Container;
  private readonly doorLeft = new Graphics();
  private readonly doorRight = new Graphics();
  private readonly floorTape = new Container();
  private readonly floorLabels: Text[] = [];
  private readonly zoneLabel: Text;
  private readonly zoneTextures = new Map<string, Texture>();
  private app!: Application;

  /** 0 at x1.00, approaching 1 as the multiplier climbs. Derived from the multiplier, nothing else. */
  private intensity = 0;
  private multiplierSeen = 1;
  private zone: Zone = ZONES[0] as Zone;
  private effectsOn = true;
  private reduced = false;
  private offset = 0;
  private arrived = false;
  private doorOpen = 0;

  constructor(app: Application) {
    super();
    this.app = app;
    this.far = new TilingSprite({ texture: this.farTexture(app), width: W, height: H });
    this.bands = new TilingSprite({ texture: this.bandTexture(app, ZONES[0] as Zone), width: W, height: H });
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
      // Cream, not ink: the backdrop is ink, so ink numerals were invisible against it and the
      // floor tape had never once been seen.
      const label = new Text({ text: '', style: displayStyle(84, COLORS.cream, 0) });
      label.alpha = 0.1;
      label.anchor.set(0.5);
      this.floorLabels.push(label);
      this.floorTape.addChild(label);
    }

    this.car = this.buildCar();
    this.addChild(this.car);

    // The zone name rides just above the car, so where you are reads at a glance.
    this.zoneLabel = mkText(t(ZONES[0]!.key), labelStyle(13, COLORS.cream), [0.5, 0.5]);
    this.zoneLabel.position.set(W / 2, H * 0.62 - 34);
    this.addChild(this.zoneLabel);
  }

  private backdrop(): Graphics {
    return new Graphics().rect(0, 0, W, H).fill(COLORS.ink);
  }

  private farTexture(app: Application): Texture {
    const g = new Graphics().rect(0, 0, W, FAR_TILE).fill({ color: COLORS.ink, alpha: 0 }).rect(0, 0, W, 3).fill({ color: COLORS.cream, alpha: 0.06 });
    return app.renderer.generateTexture(g);
  }

  /** One floor of a given zone: a structural band and a lit window either side. */
  private bandTexture(app: Application, zone: Zone): Texture {
    const cached = this.zoneTextures.get(zone.key);
    if (cached) return cached;
    const g = new Graphics();
    g.rect(0, 0, W, BAND_TILE).fill({ color: COLORS.ink, alpha: 0 });
    g.rect(0, 0, W, 22).fill(zone.band);
    g.rect(0, 0, W, 5).fill(COLORS.ink);
    g.rect(0, 17, W, 5).fill(COLORS.ink);
    // The right window is pulled in from 300 so it does not sit under the shared icon column
    // (x 338-378): a rules or history button over a lit window reads as clutter and hides both.
    for (const x of [10, 246]) {
      g.roundRect(x, 40, 80, 74, 8).fill(zone.window);
      g.roundRect(x, 40, 80, 74, 8).stroke({ color: COLORS.ink, width: 6 });
      g.rect(x + 6, 68, 68, 6).fill({ color: COLORS.ink, alpha: 0.55 });
    }
    const tex = app.renderer.generateTexture(g);
    this.zoneTextures.set(zone.key, tex);
    return tex;
  }

  private streakTexture(app: Application, w: number, h: number): Texture {
    const g = new Graphics().roundRect(0, 0, w, h, w).fill({ color: COLORS.cream, alpha: 0.85 });
    return app.renderer.generateTexture(g);
  }

  /** The car: a shell with doors that stay shut for the whole climb and open only on arrival. */
  private buildCar(): Container {
    const c = new Container();
    const g = new Graphics();
    g.moveTo(28, 30).lineTo(84, 8).lineTo(140, 30).closePath().fill(COLORS.sun).stroke({ color: COLORS.ink, width: 7 });
    g.roundRect(18, 28, 132, 110, 10).fill(COLORS.sun).stroke({ color: COLORS.ink, width: 7 });
    g.roundRect(66, 118, 36, 12, 6).fill(COLORS.lime).stroke({ color: COLORS.ink, width: 5 });
    // The doorway, the rider inside it, and the two doors that slide apart over them.
    const frame = new Graphics().roundRect(34, 46, 100, 62, 7).fill(COLORS.ink);
    c.addChild(g, frame, this.rider());
    // Glazed doors, so the rider is visible for the whole climb rather than only at the end.
    for (const [door, x] of [
      [this.doorLeft, 36],
      [this.doorRight, 85],
    ] as const) {
      // Drawn as a frame around a real opening rather than a tinted panel: a translucent rectangle
      // over a solid door still hides what is behind it, and the rider was invisible for the ride.
      door.rect(0, 0, 49, 9).fill(COLORS.sky);
      door.rect(0, 39, 49, 19).fill(COLORS.sky);
      door.rect(0, 9, 7, 30).fill(COLORS.sky);
      door.rect(42, 9, 7, 30).fill(COLORS.sky);
      door.roundRect(0, 0, 49, 58, 5).stroke({ color: COLORS.ink, width: 4 });
      door.rect(7, 9, 35, 30).stroke({ color: COLORS.ink, width: 3 });
      door.position.set(x, 48);
    }
    c.addChild(this.doorLeft, this.doorRight);
    c.position.set(W / 2 - 84, H * 0.62);
    return c;
  }

  /**
   * The rider: an adult in work clothes, standing. Deliberately an adult with a coat and a case and
   * no cute proportions (CAP under-18 guidance Oct 2025 §14, CAP 16.3.14, PT R7c, Kenya reg 95).
   * A person can be here at all only because nothing falls and nothing is harmed — the empty car was
   * a consequence of the cable, not a rule in its own right.
   */
  private rider(): Graphics {
    // Stood to one side, as people do. Centred would put them behind the rails where the two doors
    // meet, which is where the first attempt hid them almost entirely.
    const r = new Graphics();
    // A small head on broad shoulders is the adult proportion; the reverse is what reads as a child.
    r.roundRect(46, 76, 28, 32, 9).fill(COLORS.violet).stroke({ color: COLORS.ink, width: 3 });
    r.circle(60, 66, 9).fill(COLORS.cream).stroke({ color: COLORS.ink, width: 3 });
    r.roundRect(96, 74, 14, 12, 2).fill(COLORS.coral).stroke({ color: COLORS.ink, width: 3 });
    return r;
  }

  /** `multiplier` drives everything here. Nothing else may. */
  setMultiplier(multiplier: number): void {
    this.multiplierSeen = multiplier;
    this.intensity = intensityFor(multiplier);
    const zone = zoneFor(multiplier);
    if (zone.key !== this.zone.key) {
      this.zone = zone;
      this.bands.texture = this.bandTexture(this.app, zone);
      this.zoneLabel.text = t(zone.key);
    }
    // Floor numerals on the tape. Driven from here because the shared stage contract passes the
    // multiplier and nothing else — an earlier `setFloor` was never called by anything and the
    // numerals stayed blank for the life of the game.
    const floor = floorFor(multiplier);
    this.floorLabels.forEach((label, i) => {
      const n = floor - i;
      label.text = n > 0 ? String(n) : '';
    });
  }

  setEffectsEnabled(on: boolean): void {
    this.effectsOn = on;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  /**
   * The lift reaches the floor it was always going to. The doors open, the ride is over, and nothing
   * preceded it: no slowing, no chime, no flicker. A build-up would be a warning, and there are
   * none. Nothing is harmed and nobody falls, which is what lets a person be in the car at all
   * (Portugal Reg. 308/2023 Rule 7(b) protects dignity and integrity; there is nothing here to
   * offend it) and keeps the ending a statement of outcome rather than a fear effect (CAP 4.2).
   */
  onCrash(): void {
    this.arrived = true;
  }

  reset(): void {
    this.arrived = false;
    this.doorOpen = 0;
    this.doorLeft.x = 36;
    this.doorRight.x = 85;
    this.zone = ZONES[0] as Zone;
    this.bands.texture = this.bandTexture(this.app, this.zone);
    this.zoneLabel.text = t(this.zone.key);
  }

  update(dtSeconds: number): void {
    if (this.arrived) {
      // Doors open AFTER the outcome, so this animation tells the player nothing they did not
      // already know. The shaft is still; the building has stopped going past.
      this.doorOpen = Math.min(1, this.doorOpen + dtSeconds * 3);
      const slide = this.doorOpen * 24;
      this.doorLeft.x = 36 - slide;
      this.doorRight.x = 85 + slide;
      return;
    }
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
      .fill({ color: this.zone.window, alpha: this.effectsOn ? this.intensity * 0.1 : 0.02 });
  }
}
