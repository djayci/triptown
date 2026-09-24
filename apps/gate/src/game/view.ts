import {
  COLORS,
  CrashScreen,
  bodyStyle,
  displayStyle,
  drawSticker,
  labelStyle,
  text,
  type CrashViewCallbacks,
  type Frames,
  type GameStage,
  type LayoutBox,
  type ScreenLook,
} from '@triptown/crash-client';
import type { ResultKind, RevealMode } from '@triptown/core';
import type { GameConfig } from '@triptown/fairness';
import { Confetti, gsap, pop, prefersReducedMotion, shake, type GameApp } from '@triptown/engine';
import { Container, Graphics, type Text } from 'pixi.js';
import { t } from '../i18n/en';
import type { GateScene } from './scene';
import { GateStage, HEADING_CUE, type StageSkin } from './stage';
import { TrackStage } from './track';

/**
 * The horse game. The layout belongs to `CrashScreen` and every compliance behaviour to
 * `CrashViewBase`; this file supplies the scene, the words and a few scene cues.
 *
 * It presents one of two ways, chosen from the market (gate-odds-mvp D8):
 * - **Beat the Gate** (live reveal): the gate is on screen and slams at the crash.
 * - **Gate Rush** (deferred reveal): the horse leaves through the open gate and the gate drops out of view;
 *   IN! turns for home and the gate comes back open or shut only when the server has settled.
 *
 * The cues only tell the scene what already happened, and none of them looks at the result kind: the
 * base decides whether to celebrate.
 */
/**
 * Multiplier colour per milestone tier, and the colours the in-between numbers fly off in. Each colour keeps
 * at least 3:1 against its skin's stage (the yellow sunburst, or the charcoal one), the floor useSkin checks
 * for the multiplier, so a tier change never costs legibility.
 */
const TIERS: Record<StageSkin, { tiers: [number, number][]; minis: number[] }> = {
  candy: {
    tiers: [
      [1.5, 0x1971c2],
      [3, 0xd6246e],
      [5, 0xc92a2a],
      // Not ink: the multiplier has an ink outline, and ink on ink fills the digits in.
      [10, 0x0b7285],
      [25, 0x7048e8],
    ],
    minis: [0x1971c2, 0xd6246e, 0xc92a2a, 0x0b7285, 0x6d28d9],
  },
  broadcast: {
    // The value stays white until x5: amber is the money's colour, and the badge already marks the tier.
    tiers: [
      [5, 0xff7a5c],
      [10, 0xff7a5c],
      [25, 0xd90429],
    ],
    minis: [0xffd166, 0xff7a5c, 0xe8eef5],
  },
  // Dirt Track: every colour keeps 3:1 against the gold sunburst card the value sits on (its darker ray).
  track: {
    tiers: [
      [2, 0x1f6b3a],
      [5, 0x7f1d1d],
      [10, 0x5b2a86],
      [25, 0xa3201a],
    ],
    minis: [0xc8261e, 0x2f8a3e, 0x1a1614, 0x7f1d1d],
  },
  adult: {
    tiers: [
      [1.5, 0xd4a85a],
      [3, 0x7cc4b2],
      [5, 0xe8907a],
      [10, 0xf0c96b],
      [25, 0x8ec5e0],
    ],
    minis: [0xd4a85a, 0x7cc4b2, 0xe8907a, 0xf0c96b],
  },
};

/** The design frame's width: effects are placed in its coordinates. */
const FRAME_W = 390;

/** Paddock: the chance tower is a column on the left of the sunburst, under the multiplier. */
const TOWER = { x: 12, y: 238, w: 156, rowH: 24, headH: 32 };

/**
 * Broadcast, from the audited grid (design canvas "Gate Rush Broadcast Layout"): 14px margins; a header row
 * of wordmark, DEMO and balance, all 32 tall; a second row of last rides and the four controls, 32 tall; a
 * 150-tall data band with the chance table on the left (14–186) and the value block on the right (200–376);
 * the scene; the stake row; the action. No two boxes share any pixel. The result is one full-width box in
 * the data band's place, so the value and the money are not drawn under it.
 */
const BC = { margin: 14, right: 376, header: 14, row2: 56, data: 100, dataH: 150 };
const BROADCAST_LOOK: Partial<ScreenLook> = {
  logo: { x: BC.margin, y: BC.header, w: 100, h: 32 },
  demo: { x: 122, y: BC.header, w: 50, h: 32, underHistory: false },
  balance: { x: BC.right, y: BC.header, width: BC.right - 184, compact: true },
  // The last rides share the second row with the controls (from 224): the strip stops 8 short of them, and
  // its chips are the controls' 32 height so the row lines up.
  history: { x: BC.margin, y: BC.row2, w: 224 - 8 - BC.margin, chipH: 32, byOutcome: true },
  controls: { x: 224, y: BC.row2, size: 32, gap: 8, horizontal: true },
  // Measured ink on screen: value 100–160, money 164–191, label 208–217, chance line 230–239, gauge 246–250.
  value: { x: BC.right, anchor: 1, valueY: BC.data, valueSize: 52, payoutY: 168, payoutSize: 30, labelY: 205, chanceY: 234 },
  liveText: { x: 288, width: 176 },
  resultCard: { x: BC.margin, y: BC.data, w: BC.right - BC.margin, h: BC.dataH, titleY: 34, lineY: 96 },
  hideValueOnResult: true,
  hideValueWhileBetting: true,
  buttonSub: true,
  hideStakeInRound: true,
  // Between the control row (ends 88) and the stand (starts 300).
  lobby: { top: 88, bottom: 300 },
};
const BROADCAST_TOWER = { x: BC.margin, y: BC.data, w: 172, rowH: 28, headH: 38 };
const BROADCAST_GAUGE = { x: 200, y: 246, w: 176, h: 4 };
/**
 * Dirt Track: the HUD is a cream card across the top of the track (drawn by the scene): wordmark, DEMO and
 * balance in its header, then the value, the money if the gate is open, its caption and the chance, with a
 * gauge under it. The result card takes the value's place inside it. The last rides and the controls share
 * a row over the track, above the stake row; the painted ground is the chance table, so there is no tower.
 */
const TRACK_LOOK: Partial<ScreenLook> = {
  // The design's wordmark: a racing-red tag, GATE in cream and RUSH in gold (the value's red would sink into it).
  logo: { x: 24, y: 19, w: 104, h: 30, colors: { fill: 0xc8261e, first: 0xfff4dc, second: 0xffd24a } },
  demo: { x: 136, y: 19, w: 52, h: 30, underHistory: false },
  balance: { x: 366, y: 19, width: 168, compact: true },
  // Coloured by result: in Gate Rush the value climbs on past a shut gate, so a high value is no win.
  history: { x: 14, y: 626, w: 224 - 8 - 14, chipH: 32, byOutcome: true },
  controls: { x: 224, y: 626, size: 32, gap: 8, horizontal: true },
  value: { x: 195, anchor: 0.5, valueY: 66, valueSize: 62, payoutY: 136, payoutSize: 28, labelY: 170, chanceY: 191 },
  liveText: { x: 195, width: 330 },
  resultCard: { x: 24, y: 66, w: 342, h: 148, titleY: 28, lineY: 94 },
  hideValueOnResult: true,
  hideValueWhileBetting: true,
  buttonSub: true,
  hideStakeInRound: true,
  lobby: { top: 58, bottom: 226 },
};
const TRACK_GAUGE = { x: 40, y: 212, w: 310, h: 5 };

/** The ride home's bar: in the stake row's place, which is empty during a ride, just above the button. */
const REVEAL_BAR = { x: 14, y: 712, w: 362, h: 6 };

export class GateView extends CrashScreen {
  private readonly gate: GateScene;
  private roundReveal: RevealMode;
  private readonly palette: (typeof TIERS)[StageSkin];
  private readonly skin: StageSkin;
  /** The multiplier's colour before any milestone, restored for every new round. */
  private readonly baseFill: number;
  /** The chance tower, drawn while the ride runs (see setChanceTable). */
  private readonly tower = new Container();
  private readonly towerBg = new Graphics();
  private readonly towerMark = new Graphics();
  /** Broadcast: the thin chance gauge under the live lines. */
  private readonly gauge = new Graphics();
  private towerRows: { multiplier: number; value: Text; chance: Text; yours: Text }[] = [];
  /** The table's title and column heads, built once; only the rows are rebuilt on an update. */
  private towerHead: Text[] = [];
  /** Heading home: a bar that fills over the fixed length, and the pulses timed to the drumroll's hits. */
  private readonly revealBar = new Graphics();
  private readonly revealFill = { p: 0 };
  private buildCalls: gsap.core.Tween[] = [];
  /** Win confetti, on top of everything so no panel hides it. */
  private readonly confetti: Confetti;
  /** Screen shakes shown, read by the presentation check: a shake must only ever follow a celebrated win. */
  shakesShown = 0;

  /** The round's configuration, for a scene that paints the chance table into itself. */
  private readonly configOf: () => GameConfig | undefined;
  private ladderFor = '';

  constructor(
    game: GameApp,
    frames: Frames,
    handlers: CrashViewCallbacks,
    presentation: RevealMode = 'live',
    skin: StageSkin = 'candy',
    configOf: () => GameConfig | undefined = () => undefined,
  ) {
    const gate: GateScene = skin === 'track' ? new TrackStage(game.app, frames) : new GateStage(game.app, frames, skin);
    const rush = presentation === 'onCollect';
    super(
      game,
      handlers,
      {
        logo: rush ? [t('logo.gate'), t('logo.rush')] : [t('logo.beatThe'), t('logo.gate')],
        collect: t('button.collect'),
        collectSub: t('button.collectSub'),
        liveLabel: rush ? t('run.ifOpen') : t('run.winNow', { amount: '' }),
        // Gate Rush says nothing under the multiplier while betting: the chance belongs to the ride and to
        // the rules screen, which is one tap away before every bet.
        readySub: rush ? t('stage.readySubRush') : t('stage.readySub'),
        readyTitle: t('stage.readyTitle'),
        settledTitle: rush ? t('result.gateOpen') : t('result.cashedOut'),
        crashedTitle: t('result.crashed'),
      },
      gate as unknown as GameStage,
      skin === 'broadcast' ? BROADCAST_LOOK : skin === 'track' ? TRACK_LOOK : { demo: { x: 12, y: 0, w: 62, h: 24, underHistory: true } },
    );
    this.gate = gate;
    this.configOf = configOf;
    this.roundReveal = presentation;
    gate.setRevealMode(presentation);
    this.palette = TIERS[skin];
    this.skin = skin;
    this.baseFill = COLORS.sun;
    this.gauge.visible = false;
    this.effects.addChild(this.gauge);
    this.revealBar.visible = false;
    this.effects.addChild(this.revealBar);
    this.confetti = new Confetti(game.app.ticker);
    this.root.addChild(this.confetti);
    this.tower.addChild(this.towerBg, this.towerMark);
    this.tower.visible = false;
    this.tower.position.set(this.bounds().x, this.bounds().y);
    this.effects.addChild(this.tower);
  }

  /** Demo builds: the scene's stand and flash positions. */
  debugScene(): { tileW: number; crowdX: number; flashes: number[] } {
    return this.gate.debugScene();
  }

  /** The tower and the gauge, for the layout audit. */
  protected override extraBoxes(): LayoutBox[] {
    const out: LayoutBox[] = [];
    const box = this.bounds();
    if (this.tower.visible) out.push({ name: 'table', x: box.x, y: box.y, w: box.w, h: box.headH + this.towerRows.length * box.rowH + 8 });
    if (this.gauge.visible) out.push({ name: 'gauge', ...this.gaugeBox() });
    // Dirt Track's HUD card (drawn by the scene): the words on it keep its 12 px inner margin.
    if (this.skin === 'track') out.push({ name: 'panel-hud', x: 12, y: 12, w: 366, h: 214, inset: 12 });
    if (this.revealBar.visible) out.push({ name: 'reveal', ...REVEAL_BAR });
    return out;
  }

  /** Where the chance table sits in this look. */
  private bounds(): { x: number; y: number; w: number; rowH: number; headH: number } {
    return this.skin === 'broadcast' ? BROADCAST_TOWER : TOWER;
  }

  private gaugeBox(): { x: number; y: number; w: number; h: number } {
    return this.skin === 'track' ? TRACK_GAUGE : BROADCAST_GAUGE;
  }

  /** Broadcast and Dirt Track: a thin bar under the chance line, as long as the chance is likely. */
  private drawGauge(chance: string | null): void {
    this.gauge.clear();
    const percent = chance === null ? null : Number(chance.replace(/[^\d.]/g, ''));
    if ((this.skin !== 'broadcast' && this.skin !== 'track') || percent === null || !Number.isFinite(percent)) {
      this.gauge.visible = false;
      return;
    }
    const { x, y, w, h } = this.gaugeBox();
    const track = this.skin === 'track';
    this.gauge.visible = true;
    this.gauge.roundRect(x, y, w, h, h / 2).fill(track ? { color: COLORS.ink, alpha: 0.15 } : { color: COLORS.cream, alpha: 0.25 });
    this.gauge.roundRect(x, y, Math.max(h, (w * Math.max(0, Math.min(100, percent))) / 100), h, h / 2).fill(track ? COLORS.ink : 0xd90429);
  }

  /**
   * Deferred reveal: the chance at each value, for the whole ride. Every row carries the same expected
   * return, so no row is marked as the place to go in; the highlight only says where the value is now.
   */
  setChanceTable(rows: { multiplier: number; value: string; chance: string; yours: string | null }[] | null): void {
    // Dirt Track paints the values on the ground from the round's own configuration, with their chances
    // where the round reveals at RIDE HOME.
    const config = this.configOf();
    const key = config ? `${config.id}/${rows ? 'chances' : 'values'}` : '';
    if (config && key !== this.ladderFor && this.gate.setLadder) {
      this.ladderFor = key;
      this.gate.setLadder(config, rows !== null);
    }
    for (const r of this.towerRows) {
      r.value.destroy();
      r.chance.destroy();
      r.yours.destroy();
    }
    this.towerRows = [];
    const box = this.bounds();
    if (!rows || rows.length === 0) {
      this.tower.visible = false;
      return;
    }
    const h = box.headH + rows.length * box.rowH + 8;
    this.towerBg.clear();
    drawSticker(this.towerBg, box.w, h, { fill: COLORS.cream, radius: 12, border: 4, shadow: 4 });
    if (this.towerHead.length === 0) {
      const title = text(t('run.chanceTable'), labelStyle(9, COLORS.ink), [0, 0.5]);
      title.position.set(10, box.headH * 0.32);
      const headChance = text(t('run.chanceHeadChance'), labelStyle(8, COLORS.ink), [1, 0.5]);
      headChance.position.set(box.w - 54, box.headH * 0.76);
      headChance.alpha = 0.6;
      const headYours = text(t('run.chanceHeadYours'), labelStyle(8, COLORS.ink), [1, 0.5]);
      headYours.position.set(box.w - 10, box.headH * 0.76);
      headYours.alpha = 0.6;
      this.towerHead = [title, headChance, headYours];
      this.tower.addChild(...this.towerHead);
    }
    rows.forEach((row, i) => {
      const y = box.headH + i * box.rowH + box.rowH / 2;
      const value = text(row.value, bodyStyle(12, COLORS.ink), [0, 0.5]);
      value.position.set(10, y);
      const chance = text(row.chance, bodyStyle(12, COLORS.ink), [1, 0.5]);
      chance.position.set(box.w - 54, y);
      // The player's own record at this value, this session. Blank until they have one.
      const yours = text(row.yours ?? '—', bodyStyle(12, COLORS.ink), [1, 0.5]);
      yours.position.set(box.w - 10, y);
      this.tower.addChild(value, chance, yours);
      this.towerRows.push({ multiplier: row.multiplier, value, chance, yours });
    });
    this.markTower(1);
  }

  /**
   * Lights the row the value has just reached; rows already behind go quiet, rows ahead stay plain. It marks
   * where the value is, never a row to aim for: the expected return is the same on all of them.
   */
  private markTower(multiplier: number): void {
    let index = -1;
    this.towerRows.forEach((r, i) => {
      if (multiplier >= r.multiplier) index = i;
    });
    this.towerRows.forEach((r, i) => {
      const here = i === index;
      r.value.style.fill = here ? COLORS.cream : COLORS.ink;
      r.chance.style.fill = here ? COLORS.cream : COLORS.ink;
      r.yours.style.fill = here ? COLORS.cream : COLORS.ink;
      r.value.alpha = r.chance.alpha = r.yours.alpha = i < index ? 0.4 : 1;
    });
    const box = this.bounds();
    this.towerMark.clear();
    if (index < 0) return;
    this.towerMark.roundRect(5, box.headH + index * box.rowH + 2, box.w - 10, box.rowH - 4, 8).fill(COLORS.ink);
  }

  /** No themed counter: the multiplier and the money are the only numbers on screen. */
  protected counterFor(): string | null {
    return null;
  }

  /** The control column steps aside during a round, as on Whack Crash; it is back for every bet and result. */
  protected override hideControlsInRound(): boolean {
    return true;
  }

  /** Broadcast: one action colour, the red of the flash tag. Paddock keeps the shared defaults. */
  protected override actionColors(): { ready: number; running: number; celebrate: number } {
    // Dirt Track: green to bet (and to play again), racing red to ride home, as on Whack Crash's lime and pink.
    if (this.skin === 'track') return { ready: 0x2f8a3e, running: 0xc8261e, celebrate: 0x2f8a3e };
    if (this.skin !== 'broadcast') return super.actionColors();
    // One red for every state: the broadcast look carries the result on the card, not the button.
    return { ready: 0xd90429, running: 0xd90429, celebrate: 0xd90429 };
  }

  /** No auto cash-out: IN! is the only way a ride ends before the automatic reveal. */
  protected override hasAutoCashout(): boolean {
    return false;
  }

  /** The server says how this round reveals; the scene follows it for the round. */
  setRevealMode(mode: RevealMode): void {
    if (mode !== this.roundReveal) {
      this.roundReveal = mode;
      this.gate.setRevealMode(mode);
    }
  }

  override showBetting(): void {
    super.showBetting();
    this.endBuild();
    // Paddock keeps the table up between rounds. Broadcast's lobby only invites the player to ride: the
    // chances are on the rules screen before any bet, and on the screen once the rider is out.
    this.tower.visible = this.skin !== 'broadcast' && this.skin !== 'track' && this.towerRows.length > 0;
    this.gauge.visible = false;
    // Dirt Track's READY? is a title, not a value: cream carried by its ink outline, as on the design and on
    // Whack Crash. The multiplier that replaces it keeps its checked red (showRunning).
    this.multiplierText.style.fill = this.skin === 'track' ? COLORS.cream : this.baseFill;
    // Milestone badges and flying numbers only: the tower and the gauge live here too and are reused.
    for (const child of [...this.effects.children]) {
      if (child === this.tower || child === this.gauge || child === this.revealBar) continue;
      this.effects.removeChild(child);
      child.destroy({ children: true });
    }
  }

  override showRunning(): void {
    super.showRunning();
    this.multiplierText.style.fill = this.baseFill;
    // Dirt Track's chance table is the painted ground, so it draws no tower.
    this.tower.visible = this.skin !== 'track' && this.towerRows.length > 0;
    this.gate.rideOut();
  }

  override frame(multiplier: string, payout: string, level: number, intensity: string, pace: number, belowStake: boolean): void {
    super.frame(multiplier, payout, level, intensity, pace, belowStake);
    this.markTower(Number(multiplier.replace(/[^\d.]/g, '')) || 1);
  }

  override setRevealOdds(chance: string | null): void {
    super.setRevealOdds(chance);
    this.drawGauge(chance);
  }

  /**
   * A milestone (x1.5, x2, x3, x5, x10 ...), as on Whack Crash: the multiplier changes to the tier's colour
   * and keeps it, pops, a sticker with the value flies off beside it, and the horse kicks up dust. It is
   * driven by the multiplier on screen and nothing else, so it plays the same whether or not the round has
   * already been decided. It says the value, never "win": in Gate Rush the value is paid only if the gate
   * is open, and the chance line beside it stays on screen.
   */
  override checkpoint(value: number, label: string): void {
    const mult = this.multiplierText;
    let fill = this.baseFill;
    for (const [from, colour] of this.palette.tiers) if (value >= from) fill = colour;
    mult.style.fill = fill;
    pop(mult, 1.2, 0.24);
    this.gate.kick(value >= 10 ? 1.4 : 1);
    if (prefersReducedMotion()) return;

    const badge = new Container();
    const words = text(label, displayStyle(24, COLORS.cream, 4, 0), [0.5, 0.5]);
    const w = Math.max(64, words.width + 24);
    const bg = drawSticker(new Graphics(), w, 40, { fill, radius: 12, border: 4, shadow: 4 });
    bg.position.set(-w / 2, -20);
    badge.addChild(bg, words);
    if (this.skin === 'track') {
      // Just under the HUD card, on the right of the track: nothing else is drawn there during a ride.
      badge.position.set(FRAME_W - 22 - w / 2, 262);
    } else if (this.skin === 'broadcast') {
      // In the gap between the data band and the scene (250–300), under the value: no HUD row is there.
      badge.position.set(FRAME_W - 14 - w / 2, 276);
    } else {
      // Above the multiplier's right half and left of the control column, so no button covers it.
      const controlsLeft = FRAME_W - 12 - 40 - 8;
      badge.position.set(Math.min(mult.x + mult.width * 0.28, controlsLeft - w / 2), mult.y - 2);
    }
    badge.rotation = -0.12;
    badge.scale.set(0.2);
    this.effects.addChild(badge);
    const lift = this.skin === 'broadcast' || this.skin === 'track' ? 0 : 30;
    gsap
      .timeline({ onComplete: () => badge.destroy({ children: true }) })
      .to(badge.scale, { x: 1, y: 1, duration: 0.16, ease: 'back.out(3)' })
      .to(badge, { y: badge.y - lift, alpha: 0, duration: 0.32, delay: 0.18, ease: 'power2.in' });
  }

  /** A small in-between step: its number flies off the multiplier in a bright colour, as on Whack Crash. */
  override miniCheckpoint(label: string): void {
    if (prefersReducedMotion()) return;
    const mult = this.multiplierText;
    const colour = this.palette.minis[Math.floor(Math.random() * this.palette.minis.length)]!;
    const chip = text(label, displayStyle(24, colour, 4, 0), [0.5, 0.5]);
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (this.skin === 'track') chip.position.set(250, 262);
    else if (this.skin === 'broadcast') chip.position.set(240, 276);
    else chip.position.set(mult.x + dir * mult.width * 0.3, mult.y + mult.height * 0.55);
    chip.scale.set(0.5);
    this.effects.addChild(chip);
    gsap
      .timeline({ onComplete: () => chip.destroy() })
      .to(chip.scale, { x: 1.1, y: 1.1, duration: 0.12, ease: 'back.out(3)' })
      .to(chip, { x: chip.x + dir * 70, y: chip.y - (this.skin === 'broadcast' || this.skin === 'track' ? 0 : 56), rotation: dir * 0.35, alpha: 0, duration: 0.45, ease: 'power2.out' }, 0.05);
  }

  /** Gate Rush: IN! pressed, result unknown. The same turn for home whatever happens next. */
  override showHeadingHome(multiplier: string, payoutIfWon: string): void {
    super.showHeadingHome(multiplier, payoutIfWon);
    this.gate.headHome();
    this.startBuild();
  }

  /**
   * The ride home builds with its drumroll: the bar fills over the fixed length and the value pulses on
   * each of the cue's hits, a little harder each time. Everything here runs on the clock from the press and
   * starts before the result is known, so it is the same for a win and a loss; if the settlement is late
   * the bar waits full.
   */
  private startBuild(): void {
    this.endBuild();
    this.revealBar.visible = true;
    this.revealFill.p = 0;
    this.drawRevealBar();
    this.buildCalls.push(gsap.to(this.revealFill, { p: 1, duration: HEADING_CUE.seconds, ease: 'none', onUpdate: () => this.drawRevealBar() }));
    if (prefersReducedMotion()) return;
    HEADING_CUE.hits.forEach((at, i) => {
      this.buildCalls.push(gsap.delayedCall(at, () => pop(this.multiplierText, 1.05 + 0.025 * i, 0.14)));
    });
  }

  private endBuild(): void {
    for (const c of this.buildCalls) c.kill();
    this.buildCalls = [];
    this.revealBar.visible = false;
    this.revealBar.clear();
  }

  private drawRevealBar(): void {
    const { x, y, w, h } = REVEAL_BAR;
    this.revealBar.clear();
    this.revealBar.roundRect(x, y, w, h, h / 2).fill({ color: COLORS.cream, alpha: 0.25 });
    if (this.revealFill.p > 0) this.revealBar.roundRect(x, y, Math.max(h, w * this.revealFill.p), h, h / 2).fill(COLORS.sun);
  }

  /**
   * A celebrated win: the gate bursts with light and fireworks go up (the scene), confetti from the pitch,
   * a second volley from both sides, and one shake. Only called after the celebrate decision.
   */
  private party(big: boolean): void {
    this.gate.celebrate(big);
    if (!this.intensityEffects || prefersReducedMotion()) return;
    const colors = this.skin === 'track' ? [0xc8261e, 0xffd24a, 0x2f8a3e, 0xfff4dc] : [0xffd166, 0xffffff, 0xd90429, 0xff7a5c, 0x7cc4b2];
    // Launch speeds keep every piece below the result card (it ends at 250): the amount won must stay
    // readable, so the confetti peaks over the stand, not over the card.
    this.confetti.burst({ x: FRAME_W / 2, y: 620, count: big ? 150 : 90, speed: 900, colors, outline: 0x0d0f14 });
    gsap.delayedCall(0.35, () => {
      this.confetti.burst({ x: 20, y: 660, count: big ? 60 : 35, speed: 880, colors, outline: 0x0d0f14 });
      this.confetti.burst({ x: FRAME_W - 20, y: 660, count: big ? 60 : 35, speed: 880, colors, outline: 0x0d0f14 });
    });
    if (shake(this.root, big ? 9 : 6, 0.35)) this.shakesShown++;
  }

  /** A refused IN! (below the minimum) puts the horse back out on the field. */
  override cancelCashing(payout: string): void {
    super.cancelCashing(payout);
    this.endBuild();
    if (this.roundReveal === 'onCollect') this.gate.rideOut();
  }

  override showCrash(multiplier: string, loss: string, instant: boolean): void {
    super.showCrash(multiplier, loss, instant);
    this.endBuild();
    this.tower.visible = false;
    this.gauge.visible = false;
  }

  override showWin(multiplier: string, payout: string, big: boolean, kind: ResultKind, net: string): void {
    super.showWin(multiplier, payout, big, kind, net);
    this.endBuild();
    // The party asks the base's celebrate decision, the one place the rule lives: a return at or below the
    // stake gets none of it (UK RTS 14F, AGCO 2.20).
    if (this.resultPresentation(kind, payout, net).celebrate) this.party(big);
    this.tower.visible = false;
    this.gauge.visible = false;
    if (this.roundReveal === 'onCollect') this.gate.revealOpen();
    else this.gate.rideHome();
  }
}
