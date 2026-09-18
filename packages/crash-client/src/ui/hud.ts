import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { t } from '../i18n';
import { gsap, pop } from '@triptown/engine';
import { formatMinor, type CurrencyRules } from '@triptown/core';
import { formatMultiplier } from '../game/display';
import { bandColors, COLORS } from '../theme';
import { bodyStyle, displayStyle, drawSticker, labelStyle, text } from './primitives';

/** The game's wordmark. Each game passes its own two words; the shared client knows none of them. */
export class Logo extends Container {
  constructor(first: string, second: string, size = 22) {
    super();
    const bg = new Graphics();
    const a = text(first, displayStyle(size, COLORS.cream, 3));
    const b = text(second, displayStyle(size, COLORS.sun, 3));
    const padX = size * 0.55;
    const padY = size * 0.34;
    a.position.set(padX, padY);
    b.position.set(padX + a.width + size * 0.2, padY);
    drawSticker(bg, b.x + b.width + padX, a.height + padY * 2 - 4, { fill: COLORS.pink, radius: 14, border: 4, shadow: 4 });
    this.addChild(bg, a, b);
    this.rotation = (-3 * Math.PI) / 180;
  }
}

export class BalancePill extends Container {
  private readonly bg = new Graphics();
  private readonly key = text(t('label.balance'), labelStyle(10), [1, 0]);
  private readonly value: Text;
  private readonly unit: Text;

  /** Last values, so the pill can size itself again once the real font is available. */
  private last: { amount: string; currency: string; maxWidth: number } | null = null;

  constructor(private readonly big = false) {
    super();
    this.key.alpha = 0.6;
    // `padding` is texture padding, not layout: bodyStyle sets none, so Pixi sizes the canvas from its
    // own measurement and a bold glyph whose ink runs past its advance width — a D, an S — loses its
    // right edge inside the texture. No amount of room in the pill fixes that; the glyph is already
    // clipped by the time it is drawn.
    this.value = text('—', { ...bodyStyle(big ? 22 : 18), padding: 4 }, [1, 0]);
    this.unit = text('USD', { ...bodyStyle(big ? 13 : 11), padding: 4 }, [1, 0]);
    this.unit.alpha = 0.6;
    this.addChild(this.bg, this.key, this.value, this.unit);
    // The pill is drawn to fit its text, so it is only correct if the text was measured with the font
    // it will be drawn in. The first balance can arrive before the web font is ready, in which case the
    // pill is sized from fallback metrics and the currency code overhangs it once the real font loads.
    // Re-measure once, when the fonts settle.
    void globalThis.document?.fonts?.ready
      .then(() => {
        if (this.last) this.set(this.last.amount, this.last.currency, this.last.maxWidth);
      })
      .catch(() => {});
  }

  /**
   * `maxWidth` is the room the pill has to its left. Without it the pill simply grows with the amount,
   * and a longer balance — or a currency whose amounts run long — pushes it off the edge of the screen,
   * taking the currency code with it.
   */
  set(amount: string, currency: string, maxWidth = Infinity) {
    const changed = this.value.text !== amount && this.value.text !== '—';
    this.last = { amount, currency, maxWidth };
    this.value.text = amount;
    this.unit.text = currency;
    // 14 left the currency code about 10px clear of the inner border once the 4px border is taken off,
    // which reads as touching it at a glance even though it never overlapped.
    const padX = 20;
    const base = this.big ? 22 : 18;
    this.value.style = { ...bodyStyle(base), padding: 4 };
    if (this.value.width + this.unit.width + 4 + padX * 2 > maxWidth) {
      const room = maxWidth - padX * 2 - this.unit.width - 4;
      if (room > 0) this.value.style = { ...bodyStyle(Math.max(11, Math.floor((base * room) / this.value.width))), padding: 4 };
    }
    const w = Math.min(maxWidth, Math.max(this.key.width, this.value.width + this.unit.width + 4) + padX * 2);
    const h = this.big ? 58 : 46;
    drawSticker(this.bg, w, h, { fill: COLORS.cream, radius: 14, border: 4, shadow: 4 });
    this.bg.x = -w;
    this.key.position.set(-padX, 6);
    this.unit.position.set(-padX, this.big ? 29 : 23);
    this.value.position.set(-padX - this.unit.width - 4, this.big ? 24 : 19);
    if (changed) pop(this.value, 1.15, 0.25);
  }
}

/** Strip of recent results, newest first. */
/**
 * Session clock and net position, shown where the market requires them (UK RTS 7/8, AGCO 2.07-2.10).
 * Net is the player's own position: returns minus stakes, this session.
 */
export class SessionStrip extends Container {
  private readonly bg = new Graphics();
  private readonly clock = text('', labelStyle(11), [0, 0.5]);
  private readonly net = text('', labelStyle(11), [1, 0.5]);
  private startedAt = 0;
  private netMinor = 0;
  private currency: Pick<CurrencyRules, 'decimals'> = { decimals: 2 };
  private showClock = false;
  private showNet = false;

  constructor(private w = 358) {
    super();
    this.addChild(this.bg, this.clock, this.net);
    this.visible = false;
  }

  set(opts: { showClock: boolean; showNet: boolean; startedAt: number; netMinor: number; currency: Pick<CurrencyRules, 'decimals'> }) {
    this.showClock = opts.showClock;
    this.showNet = opts.showNet;
    this.startedAt = opts.startedAt;
    this.netMinor = opts.netMinor;
    this.currency = opts.currency;
    this.visible = opts.showClock || opts.showNet;
    this.redraw();
  }

  resize(w: number) {
    this.w = w;
    this.redraw();
  }

  /** Called every frame by the view so the clock ticks during a round. */
  tick() {
    if (this.visible) this.redraw();
  }

  private redraw() {
    if (!this.visible) return;
    const seconds = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    this.clock.text = this.showClock ? `SESSION ${mm}:${ss}` : '';
    const sign = this.netMinor > 0 ? '+' : this.netMinor < 0 ? '-' : '';
    this.net.text = this.showNet ? `NET ${sign}${formatMinor(Math.abs(this.netMinor), this.currency)}` : '';
    this.net.style.fill = this.netMinor < 0 ? COLORS.red : COLORS.ink;
    this.bg.clear().roundRect(0, 0, this.w, 26, 10).fill({ color: COLORS.cream, alpha: 0.92 }).stroke({ width: 3, color: COLORS.ink });
    this.clock.position.set(12, 13);
    this.net.position.set(this.w - 12, 13);
  }
}

/** One past round on the strip: its multiplier and how it ended. */
export interface HistoryChip {
  multiplier: number;
  kind: 'win' | 'even' | 'loss' | 'void';
}

export class HistoryStrip extends Container {
  private readonly chips = new Container();
  private readonly clip = new Graphics();
  private values: HistoryChip[] = [];
  private contentWidth = 0;
  private dragFrom: { pointer: number; chips: number } | null = null;
  private dragged = false;
  /** Set by the view: opens the full history dialog. */
  onOpen: (() => void) | null = null;

  constructor(private w: number) {
    super();
    this.addChild(this.chips, this.clip);
    this.chips.mask = this.clip;
    this.resize(w);
    // Older rounds run off the right edge, so the strip scrolls by dragging; a tap opens the full
    // history, which is where stake, return, net and crash point live (GLI-19 4.14).
    this.eventMode = 'static';
    this.cursor = 'grab';
    this.on('pointerdown', (e) => {
      this.dragFrom = { pointer: e.global.x, chips: this.chips.x };
    });
    this.on('globalpointermove', (e) => {
      if (!this.dragFrom) return;
      const dx = e.global.x - this.dragFrom.pointer;
      if (Math.abs(dx) > 4) this.dragged = true;
      this.chips.x = this.clampScroll(this.dragFrom.chips + dx);
    });
    for (const end of ['pointerup', 'pointerupoutside', 'pointercancel'] as const) {
      this.on(end, () => {
        this.dragFrom = null;
      });
    }
    this.on('pointertap', () => {
      if (!this.dragged) this.onOpen?.();
      this.dragged = false;
    });
  }

  resize(w: number) {
    this.w = w;
    this.clip.clear().rect(-4, -4, w + 8, 44).fill(0xffffff);
    this.hitArea = new Rectangle(-4, -4, w + 8, 44);
    this.chips.x = this.clampScroll(this.chips.x);
  }

  /** Keeps the newest chip at the left edge and the oldest one reachable. */
  private clampScroll(x: number) {
    return Math.max(Math.min(0, this.w - this.contentWidth), Math.min(0, x));
  }

  setAll(values: HistoryChip[]) {
    this.values = values.slice(0, 20);
    this.rebuild();
  }

  push(value: HistoryChip) {
    this.values = [value, ...this.values].slice(0, 20);
    this.rebuild();
    const first = this.chips.children[0];
    if (first) {
      first.scale.set(0.2);
      gsap.to(first.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2.5)' });
    }
  }

  private rebuild() {
    this.chips.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.chips.x = 0;
    let x = 0;
    for (const v of this.values) {
      const { fill, text: tc } = bandColors(v.multiplier);
      // A marker and a sign, so the result survives greyscale and colour blindness (GLI-19 4.14).
      const mark = v.kind === 'win' ? '✓' : v.kind === 'void' ? '•' : '✕';
      const label = text(`${mark} ${formatMultiplier(v.multiplier)}`, bodyStyle(13, tc), [0.5, 0.5]);
      const cw = label.width + 20;
      const chip = new Container();
      const bg = drawSticker(new Graphics(), cw, 30, { fill, radius: 10, border: 3, shadow: 3 });
      bg.position.set(-cw / 2, -15);
      chip.addChild(bg, label);
      chip.position.set(x + cw / 2, 15);
      this.chips.addChild(chip);
      x += cw + 6;
    }
    this.contentWidth = x;
  }
}

/** Centered sticker label on the stage, e.g. "WIN NOW 42.00", "RETURNED 7.20", "-10.00". */
export class StickerLabel extends Container {
  private readonly bg = new Graphics();
  readonly caption: Text;

  constructor(
    value: string,
    private fill: number,
    private readonly styleFor: (fill: number) => ReturnType<typeof displayStyle>,
    private readonly padX = 14,
    private readonly padY = 6,
    private readonly shadow = 4,
  ) {
    super();
    this.caption = text(value, styleFor(fill), [0.5, 0.5]);
    this.addChild(this.bg, this.caption);
    this.redraw();
  }

  set(value: string, fill = this.fill) {
    this.caption.text = value;
    this.fill = fill;
    this.caption.style = this.styleFor(fill);
    this.redraw();
  }

  private redraw() {
    const w = this.caption.width + this.padX * 2;
    const h = this.caption.height + this.padY * 2;
    drawSticker(this.bg, w, h, { fill: this.fill, radius: 12, border: 4, shadow: this.shadow });
    this.bg.position.set(-w / 2, -h / 2);
  }
}
