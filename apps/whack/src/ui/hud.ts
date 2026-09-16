import { Container, Graphics, Text } from 'pixi.js';
import { gsap, pop } from '@triptown/engine';
import { formatMultiplier } from '../game/display';
import { bandColors, COLORS } from '../theme';
import { bodyStyle, displayStyle, drawSticker, labelStyle, text } from './primitives';

export class Logo extends Container {
  constructor(size = 22) {
    super();
    const bg = new Graphics();
    const a = text('WHACK', displayStyle(size, COLORS.cream, 3));
    const b = text('CRASH', displayStyle(size, COLORS.sun, 3));
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
  private readonly key = text('BALANCE', labelStyle(10), [1, 0]);
  private readonly value: Text;
  private readonly unit: Text;

  constructor(private readonly big = false) {
    super();
    this.key.alpha = 0.6;
    this.value = text('—', bodyStyle(big ? 22 : 18), [1, 0]);
    this.unit = text('USD', bodyStyle(big ? 13 : 11), [1, 0]);
    this.unit.alpha = 0.6;
    this.addChild(this.bg, this.key, this.value, this.unit);
  }

  set(amount: string, currency: string) {
    const changed = this.value.text !== amount && this.value.text !== '—';
    this.value.text = amount;
    this.unit.text = currency;
    const padX = 14;
    const w = Math.max(this.key.width, this.value.width + this.unit.width + 4) + padX * 2;
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
export class HistoryStrip extends Container {
  private readonly chips = new Container();
  private readonly clip = new Graphics();
  private values: number[] = [];

  constructor(private w: number) {
    super();
    this.addChild(this.chips, this.clip);
    this.chips.mask = this.clip;
    this.resize(w);
  }

  resize(w: number) {
    this.w = w;
    this.clip.clear().rect(-4, -4, w + 8, 44).fill(0xffffff);
  }

  setAll(values: number[]) {
    this.values = values.slice(0, 20);
    this.rebuild();
  }

  push(value: number) {
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
    let x = 0;
    for (const v of this.values) {
      const { fill, text: tc } = bandColors(v);
      const label = text(formatMultiplier(v), bodyStyle(13, tc), [0.5, 0.5]);
      const cw = label.width + 20;
      const chip = new Container();
      const bg = drawSticker(new Graphics(), cw, 30, { fill, radius: 10, border: 3, shadow: 3 });
      bg.position.set(-cw / 2, -15);
      chip.addChild(bg, label);
      chip.position.set(x + cw / 2, 15);
      this.chips.addChild(chip);
      x += cw + 6;
      if (x > this.w + 40) break;
    }
  }
}

/** Centered sticker label on the stage ("WIN NOW 42.00", "MOLE ESCAPED", "-10.00"). */
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
