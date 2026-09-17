import { Container, Graphics, Rectangle, Sprite, Text, type TextStyleOptions, type Texture } from 'pixi.js';
import { pop } from '@triptown/engine';
import { COLORS, FONT_BODY, FONT_DISPLAY } from '../theme';

export interface StickerStyle {
  fill: number;
  radius?: number;
  border?: number;
  shadow?: number;
  borderColor?: number;
}

/** The Candy Arcade Pop "sticker": fill, thick ink border, hard drop shadow. */
export function drawSticker(g: Graphics, w: number, h: number, s: StickerStyle): Graphics {
  const r = s.radius ?? 18;
  const b = s.border ?? 4;
  const sh = s.shadow ?? 5;
  const ink = s.borderColor ?? COLORS.ink;
  g.clear();
  if (sh > 0) g.roundRect(0, sh, w, h, r).fill(ink);
  g.roundRect(b / 2, b / 2, w - b, h - b, Math.max(0, r - b / 2))
    .fill(s.fill)
    .stroke({ width: b, color: ink });
  return g;
}

export function displayStyle(size: number, fill: number, stroke = 0, shadow = 0): TextStyleOptions {
  return {
    fontFamily: FONT_DISPLAY,
    fontSize: size,
    fill,
    padding: stroke + shadow + 4,
    ...(stroke ? { stroke: { color: COLORS.ink, width: stroke * 2, join: 'round' as const } } : {}),
    ...(shadow ? { dropShadow: { color: COLORS.ink, alpha: 1, angle: Math.PI / 2, distance: shadow, blur: 0 } } : {}),
  };
}

export function bodyStyle(size: number, fill: number = COLORS.ink, weight: '500' | '700' | '800' = '800'): TextStyleOptions {
  return { fontFamily: FONT_BODY, fontSize: size, fill, fontWeight: weight };
}

export function labelStyle(size: number, fill: number = COLORS.ink): TextStyleOptions {
  return { ...bodyStyle(size, fill, '800'), letterSpacing: 1.2, padding: 6 };
}

export function text(value: string, style: TextStyleOptions, anchor: [number, number] = [0, 0]): Text {
  const t = new Text({ text: value, style });
  t.anchor.set(anchor[0], anchor[1]);
  return t;
}

export interface ButtonOptions {
  width: number;
  height: number;
  fill: number;
  radius?: number;
  label: string;
  labelSize?: number;
  sub?: string;
  icon?: Texture;
  iconSize?: number;
  shadow?: number;
  border?: number;
  onTap?: () => void;
  a11y?: string;
}

/** Sticker button with pressed and disabled states. */
export class StickerButton extends Container {
  private readonly bg = new Graphics();
  private readonly face = new Container();
  private readonly labelText: Text;
  private readonly subText: Text | null;
  private readonly iconSprite: Sprite | null;
  private enabled = true;
  private pressed = false;
  private opts: ButtonOptions;

  constructor(opts: ButtonOptions) {
    super();
    this.opts = opts;
    const size = opts.labelSize ?? 44;
    this.labelText = text(opts.label, displayStyle(size, COLORS.cream, 4, 4), [0, 0.5]);
    this.subText = opts.sub !== undefined ? text(opts.sub.toUpperCase(), labelStyle(12, COLORS.cream), [0, 0.5]) : null;
    this.iconSprite = opts.icon ? new Sprite(opts.icon) : null;
    this.addChild(this.bg, this.face);
    if (this.iconSprite) this.face.addChild(this.iconSprite);
    this.face.addChild(this.labelText);
    if (this.subText) this.face.addChild(this.subText);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.accessible = true;
    this.accessibleTitle = opts.a11y ?? opts.label;
    this.accessibleType = 'button';
    this.on('pointerdown', () => this.setPressed(true));
    this.on('pointerup', () => this.setPressed(false));
    this.on('pointerupoutside', () => this.setPressed(false));
    this.on('pointertap', () => {
      if (this.enabled) this.opts.onTap?.();
    });
    this.redraw();
  }

  set onTap(fn: (() => void) | undefined) {
    this.opts.onTap = fn;
  }

  setLabel(label: string, sub?: string) {
    this.labelText.text = label;
    if (this.subText && sub !== undefined) this.subText.text = sub.toUpperCase();
    this.accessibleTitle = sub ? `${label} ${sub}` : label;
    this.layoutFace();
  }

  setFill(fill: number) {
    if (this.opts.fill === fill) return;
    this.opts.fill = fill;
    this.redraw();
  }

  setIcon(texture: Texture | null) {
    if (!this.iconSprite) return;
    if (texture) this.iconSprite.texture = texture;
    this.iconSprite.visible = !!texture;
    this.layoutFace();
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.cursor = enabled ? 'pointer' : 'default';
    this.redraw();
  }

  get isEnabled() {
    return this.enabled;
  }

  resize(width: number, height: number) {
    this.opts.width = width;
    this.opts.height = height;
    this.redraw();
  }

  bump() {
    pop(this.face, 1.06, 0.2);
  }

  private setPressed(p: boolean) {
    if (!this.enabled && p) return;
    this.pressed = p;
    this.redraw();
  }

  private redraw() {
    const { width: w, height: h, radius = 28, shadow = 8, border = 5 } = this.opts;
    const disabled = !this.enabled;
    const offset = this.pressed ? shadow : 0;
    if (disabled) {
      this.bg.clear();
      this.bg.roundRect(border / 2, border / 2, w - border, h - border, radius).fill(COLORS.muted).stroke({ width: border, color: COLORS.mutedInk });
    } else {
      drawSticker(this.bg, w, h, { fill: this.opts.fill, radius, border, shadow: shadow - offset });
      this.bg.y = offset;
    }
    if (disabled) this.bg.y = 0;
    this.face.y = disabled ? 0 : offset;
    const tc = disabled ? COLORS.mutedInk : COLORS.cream;
    const size = this.opts.labelSize ?? 44;
    this.labelText.style = displayStyle(size, tc, disabled ? 0 : 4, disabled ? 0 : 4);
    if (this.subText) this.subText.style = labelStyle(12, tc);
    if (this.iconSprite) this.iconSprite.tint = disabled ? COLORS.mutedInk : 0xffffff;
    this.hitArea = new Rectangle(0, 0, w, h + shadow);
    this.layoutFace();
  }

  private layoutFace() {
    const { width: w, height: h } = this.opts;
    const iconSize = this.iconSprite?.visible ? (this.opts.iconSize ?? Math.round((this.opts.labelSize ?? 44) * 0.8)) : 0;
    const gap = iconSize ? 14 : 0;
    // Shrink a label that does not fit rather than letting it run past both edges. The button's width is
    // fixed by the layout but its text is not: "INSUFFICIENT BALANCE" is three times the width of "BET".
    const room = w - iconSize - gap - 24;
    const base = this.opts.labelSize ?? 44;
    if (room > 0 && this.labelText.width > room) {
      const fitted = Math.max(12, Math.floor((base * room) / this.labelText.width));
      if (this.labelText.style.fontSize !== fitted) this.labelText.style.fontSize = fitted;
    } else if (this.labelText.style.fontSize !== base) {
      this.labelText.style.fontSize = base;
    }
    // The measured width includes the drop shadow, which extends only to the right, so centring on it
    // pushes every label half a shadow off-centre.
    const SHADOW = 4;
    const textW = Math.max(this.labelText.width, this.subText?.width ?? 0);
    const total = iconSize + gap + textW;
    let x = (w - total) / 2 - SHADOW / 2;
    if (this.iconSprite?.visible) {
      this.iconSprite.width = this.iconSprite.height = iconSize;
      this.iconSprite.position.set(x, h / 2 - iconSize / 2);
      x += iconSize + gap;
    }
    const hasSub = !!this.subText && this.subText.text.length > 0;
    this.labelText.position.set(x, hasSub ? h / 2 - 10 : h / 2);
    if (this.subText) {
      this.subText.visible = hasSub;
      this.subText.position.set(x + 2, h / 2 + this.labelText.height / 2 - 2);
    }
  }
}

/** Small square sticker button with an icon (sound, fairness, −/+). */
export class IconButton extends Container {
  private readonly bg = new Graphics();
  private readonly sprite: Sprite;

  constructor(
    texture: Texture,
    private size: number,
    private fill: number,
    onTap: () => void,
    a11y: string,
    private iconScale = 0.55,
  ) {
    super();
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.addChild(this.bg, this.sprite);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.accessible = true;
    this.accessibleTitle = a11y;
    this.accessibleType = 'button';
    this.hitArea = new Rectangle(-4, -4, size + 8, size + 8);
    this.on('pointertap', () => {
      pop(this.sprite, 1.2, 0.2);
      onTap();
    });
    this.redraw();
  }

  setTexture(texture: Texture, a11y?: string) {
    this.sprite.texture = texture;
    if (a11y) this.accessibleTitle = a11y;
    this.redraw();
  }

  setFill(fill: number) {
    this.fill = fill;
    this.redraw();
  }

  private redraw() {
    drawSticker(this.bg, this.size, this.size, { fill: this.fill, radius: 14, border: 4, shadow: 4 });
    this.sprite.width = this.sprite.height = this.size * this.iconScale;
    this.sprite.position.set(this.size / 2, this.size / 2);
  }
}

/** Selectable chip (bet quick picks). */
export class Chip extends Container {
  private readonly bg = new Graphics();
  private readonly caption: Text;
  private selected = false;
  private enabled = true;

  constructor(
    value: string,
    private w: number,
    private h: number,
    onTap: () => void,
  ) {
    super();
    this.caption = text(value, bodyStyle(17), [0.5, 0.5]);
    this.addChild(this.bg, this.caption);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.accessible = true;
    this.accessibleTitle = `Bet ${value}`;
    this.accessibleType = 'button';
    this.hitArea = new Rectangle(0, 0, w, h + 4);
    this.on('pointertap', () => {
      if (!this.enabled) return;
      pop(this.caption, 1.2, 0.18);
      onTap();
    });
    this.redraw();
  }

  resize(w: number) {
    if (w === this.w) return;
    this.w = w;
    this.hitArea = new Rectangle(0, 0, w, this.h + 4);
    this.redraw();
  }

  setState(selected: boolean, enabled: boolean) {
    if (selected === this.selected && enabled === this.enabled) return;
    this.selected = selected;
    this.enabled = enabled;
    this.redraw();
  }

  private redraw() {
    drawSticker(this.bg, this.w, this.h, { fill: this.selected ? COLORS.pink : COLORS.cream, radius: 14, border: 4, shadow: 4 });
    this.caption.style = bodyStyle(17, this.selected ? COLORS.cream : COLORS.ink);
    this.caption.position.set(this.w / 2, this.h / 2);
    this.alpha = this.enabled ? 1 : 0.45;
  }
}

/** "BET 10.00" style stat box. */
export class StatBox extends Container {
  private readonly bg = new Graphics();
  private readonly key: Text;
  private readonly value: Text;

  constructor(
    label: string,
    private w: number,
    private h: number,
    private fill: number = COLORS.cream,
  ) {
    super();
    this.key = text(label.toUpperCase(), labelStyle(10), [0, 0.5]);
    this.value = text('', bodyStyle(17), [1, 0.5]);
    this.key.alpha = 0.65;
    this.addChild(this.bg, this.key, this.value);
    this.redraw();
  }

  set(label: string, value: string, fill?: number, textColor: number = COLORS.ink) {
    this.key.text = label.toUpperCase();
    this.value.text = value;
    this.key.style = labelStyle(10, textColor);
    this.value.style = bodyStyle(17, textColor);
    if (fill !== undefined) this.fill = fill;
    this.redraw();
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.redraw();
  }

  private redraw() {
    drawSticker(this.bg, this.w, this.h, { fill: this.fill, radius: 14, border: 4, shadow: 4 });
    this.key.position.set(14, this.h / 2);
    this.value.position.set(this.w - 14, this.h / 2);
  }
}

/** Star-shaped burst sprite with centered display text. */
export class Burst extends Container {
  readonly caption: Text;
  constructor(texture: Texture, size: number, value: string, textSize: number) {
    super();
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.width = s.height = size;
    this.caption = text(value, displayStyle(textSize, COLORS.cream, 3, 3), [0.5, 0.5]);
    this.addChild(s, this.caption);
  }
}
