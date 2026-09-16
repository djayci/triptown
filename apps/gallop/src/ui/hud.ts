// Pixi HUD in the 390-wide design column, scaled with the scene: broadcast strip, multiplier, LIVE chyron,
// ladder, result banner and the bet panel. Text uses bundled Barlow faces, never a fallback monospace.
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { t } from '../i18n/en';
import { DESIGN_H, DESIGN_W } from '../scene/chase-scene';

const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const UI = "'Barlow', 'Helvetica Neue', Arial, sans-serif";
const RED = 0xe11d48;
const INK = 0xf1f5f9;
const NIGHT = 0x030712;

const ui = (s: TextStyleOptions): TextStyleOptions => ({ fontFamily: UI, fill: INK, fontWeight: '600', ...s });
const display = (s: TextStyleOptions): TextStyleOptions => ({ fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: '900', fill: INK, ...s });

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface HudHandlers {
  onRules(): void;
  onStake(delta: -1 | 1): void;
  onDifficulty(d: Difficulty): void;
  onBet(): void;
  onJump(): void;
  onCollect(): void;
}

export interface LadderChip {
  label: string;
  value: string;
  state: 'done' | 'next' | 'todo';
}

export interface PanelState {
  mode: 'betting' | 'round';
  stake: string;
  difficulty: Difficulty;
  betTop: string;
  betSub: string;
  betEnabled: boolean;
  jumpTop: string;
  jumpSub: string;
  jumpEnabled: boolean;
  collectSub: string;
  collectEnabled: boolean;
  ladder: LadderChip[];
  statusLeft: string;
  statusRight: string;
}

class Button extends Container {
  readonly bg = new Graphics();
  readonly top: Text;
  readonly sub: Text;
  private enabled = true;
  constructor(
    private readonly w: number,
    private readonly h: number,
    topSize: number,
    onPress: () => void,
  ) {
    super();
    this.top = new Text({ text: '', style: display({ fontSize: topSize }) });
    this.sub = new Text({ text: '', style: ui({ fontSize: 12, fontWeight: '700' }) });
    this.top.anchor.set(0.5);
    this.sub.anchor.set(0.5);
    this.top.position.set(w / 2, h / 2 - 7);
    this.sub.position.set(w / 2, h / 2 + 15);
    this.addChild(this.bg, this.top, this.sub);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => this.enabled && onPress());
  }
  set(top: string, sub: string, enabled: boolean, style: 'primary' | 'outline') {
    this.enabled = enabled;
    this.top.text = top;
    this.sub.text = sub;
    this.sub.visible = sub !== '';
    this.top.position.y = sub ? this.h / 2 - 7 : this.h / 2;
    const primary = style === 'primary' && enabled;
    this.bg.clear().rect(0, 0, this.w, this.h);
    if (primary) this.bg.fill(RED);
    else this.bg.fill({ color: 0xffffff, alpha: 0.08 }).stroke({ width: 1.5, color: INK, alpha: enabled ? 0.9 : 0.3 });
    this.top.style.fill = INK;
    this.sub.style.fill = INK;
    this.alpha = enabled ? 1 : 0.45;
    this.cursor = enabled ? 'pointer' : 'default';
  }
}

export class Hud {
  readonly view = new Container();
  private readonly column = new Container();
  private readonly strip = new Graphics();
  private readonly panelBg = new Graphics();
  private readonly clock = new Text({ text: '00:00:00', style: ui({ fontSize: 13, fontWeight: '700' }) });
  private readonly net = new Text({ text: '', style: ui({ fontSize: 13, fontWeight: '700' }) });
  private readonly multX = new Text({ text: 'x', style: display({ fontSize: 58 }) });
  private readonly multValue = new Text({ text: '1.00', style: display({ fontSize: 108, dropShadow: { color: RED, blur: 0, distance: 6, angle: Math.PI / 2, alpha: 1 } }) });
  private readonly multBox = new Container();
  private readonly chyronText = new Text({ text: '', style: display({ fontSize: 17, fontWeight: '800', fill: NIGHT }) });
  private readonly chyronBg = new Graphics();
  private readonly banner = new Container();
  private readonly bannerBg = new Graphics();
  private readonly bannerTitle = new Text({ text: '', style: display({ fontSize: 40, align: 'center' }) });
  private readonly bannerSub = new Text({ text: '', style: ui({ fontSize: 14, align: 'center' }) });
  private readonly statusLeft = new Text({ text: '', style: ui({ fontSize: 11, fontWeight: '700', letterSpacing: 1.6 }) });
  private readonly statusRight = new Text({ text: '', style: ui({ fontSize: 11, fontWeight: '700', letterSpacing: 1.6 }) });
  private readonly betting = new Container();
  private readonly round = new Container();
  private readonly stake = new Text({ text: '', style: ui({ fontSize: 20, fontWeight: '700' }) });
  private readonly difficultyButtons: { d: Difficulty; bg: Graphics; label: Text }[] = [];
  private readonly ladder = new Container();
  private readonly chips: { bg: Graphics; label: Text; value: Text }[] = [];
  private readonly betButton: Button;
  private readonly jumpButton: Button;
  private readonly collectButton: Button;
  private readonly demo = new Container();

  constructor(handlers: HudHandlers, demo: boolean) {
    const small = (text: string) => {
      const s = new Text({ text, style: ui({ fontSize: 10, letterSpacing: 1.4 }) });
      s.alpha = 0.7;
      return s;
    };

    const rules = new Container();
    const rulesIcon = new Graphics().circle(14, 14, 9).stroke({ width: 1.8, color: INK }).rect(13, 12, 2, 7).fill(INK).rect(13, 8, 2, 2).fill(INK);
    const rulesLabel = new Text({ text: t('rules'), style: ui({ fontSize: 14, fontWeight: '700' }) });
    rulesLabel.position.set(30, 5);
    const rulesHit = new Graphics().rect(0, -8, 90, 44).fill({ color: 0, alpha: 0.001 });
    rules.addChild(rulesHit, rulesIcon, rulesLabel);
    rules.position.set(10, 12);
    rules.eventMode = 'static';
    rules.cursor = 'pointer';
    rules.on('pointertap', handlers.onRules);

    const sessionLabel = small(t('session'));
    const netLabel = small(t('net'));
    for (const x of [sessionLabel, netLabel, this.clock, this.net]) x.anchor.set(1, 0);
    sessionLabel.position.set(300, 10);
    this.clock.position.set(300, 24);
    netLabel.position.set(378, 10);
    this.net.position.set(378, 24);

    const demoBg = new Graphics().rect(0, 0, 54, 22).fill(RED);
    const demoText = new Text({ text: t('demo'), style: ui({ fontSize: 12, fontWeight: '700', letterSpacing: 2 }) });
    demoText.anchor.set(0.5);
    demoText.position.set(27, 11);
    this.demo.addChild(demoBg, demoText);
    this.demo.position.set(DESIGN_W / 2 - 27, 15);
    this.demo.visible = demo;

    this.multX.anchor.set(1, 1);
    this.multValue.anchor.set(0, 1);
    this.multBox.addChild(this.multX, this.multValue);
    this.multBox.position.set(DESIGN_W / 2, 176);

    const live = new Container();
    const liveBg = new Graphics().rect(0, 0, 62, 28).fill(RED).circle(14, 14, 3.5).fill(0xffffff);
    const liveText = new Text({ text: t('live'), style: display({ fontSize: 17, fontWeight: '800' }) });
    liveText.position.set(23, 3);
    live.addChild(liveBg, liveText, this.chyronBg, this.chyronText);
    this.chyronText.position.set(76, 3);
    live.position.set(0, 196);

    this.bannerTitle.anchor.set(0.5, 0);
    this.bannerSub.anchor.set(0.5, 0);
    this.bannerTitle.position.set((DESIGN_W - 48) / 2, 14);
    this.bannerSub.position.set((DESIGN_W - 48) / 2, 62);
    this.banner.addChild(this.bannerBg, this.bannerTitle, this.bannerSub);
    this.banner.position.set(24, 262);
    this.banner.visible = false;

    const panelTop = 612;
    this.statusLeft.position.set(16, panelTop + 12);
    this.statusRight.anchor.set(1, 0);
    this.statusRight.position.set(DESIGN_W - 16, panelTop + 12);

    // Betting: difficulty, stake and BET.
    const segW = (DESIGN_W - 32 - 12) / 3;
    (['easy', 'medium', 'hard'] as const).forEach((d, i) => {
      const holder = new Container();
      const bg = new Graphics();
      const label = new Text({ text: t(d), style: ui({ fontSize: 15, fontWeight: '700' }) });
      label.anchor.set(0.5);
      label.position.set(segW / 2, 20);
      holder.addChild(bg, label);
      holder.position.set(16 + i * (segW + 6), panelTop + 34);
      holder.eventMode = 'static';
      holder.cursor = 'pointer';
      holder.on('pointertap', () => handlers.onDifficulty(d));
      this.betting.addChild(holder);
      this.difficultyButtons.push({ d, bg, label });
    });
    const stepper = (glyph: '−' | '+', x: number, delta: -1 | 1) => {
      const b = new Container();
      const g = new Graphics().rect(0, 0, 44, 60).stroke({ width: 1.5, color: INK, alpha: 0.45 });
      const s = new Text({ text: glyph, style: ui({ fontSize: 24, fontWeight: '600' }) });
      s.anchor.set(0.5);
      s.position.set(22, 30);
      b.addChild(g, s);
      b.position.set(x, panelTop + 86);
      b.eventMode = 'static';
      b.cursor = 'pointer';
      b.on('pointertap', () => handlers.onStake(delta));
      return b;
    };
    const stakeLabel = small(t('stake'));
    stakeLabel.anchor.set(0.5, 0);
    stakeLabel.position.set(98, panelTop + 92);
    this.stake.anchor.set(0.5, 0);
    this.stake.position.set(98, panelTop + 106);
    this.betButton = new Button(DESIGN_W - 16 - 188, 60, 26, handlers.onBet);
    this.betButton.position.set(188, panelTop + 86);
    this.betting.addChild(stepper('−', 16, -1), stakeLabel, this.stake, stepper('+', 136, 1), this.betButton);

    // Round: ladder, COLLECT and JUMP.
    const chipW = (DESIGN_W - 32 - 4 * 6) / 5;
    for (let i = 0; i < 5; i++) {
      const bg = new Graphics();
      const label = new Text({ text: '', style: ui({ fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }) });
      const value = new Text({ text: '', style: display({ fontSize: 17, fontWeight: '800' }) });
      label.anchor.set(0.5, 0);
      value.anchor.set(0.5, 0);
      label.position.set(chipW / 2, 5);
      value.position.set(chipW / 2, 18);
      const holder = new Container();
      holder.addChild(bg, label, value);
      holder.position.set(16 + i * (chipW + 6), 0);
      this.ladder.addChild(holder);
      this.chips.push({ bg, label, value });
    }
    this.ladder.position.set(0, panelTop + 34);
    const colW = (DESIGN_W - 32 - 8) * 0.4;
    this.collectButton = new Button(colW, 64, 20, handlers.onCollect);
    this.collectButton.position.set(16, panelTop + 90);
    this.jumpButton = new Button(DESIGN_W - 32 - 8 - colW, 64, 30, handlers.onJump);
    this.jumpButton.position.set(16 + colW + 8, panelTop + 90);
    this.round.addChild(this.ladder, this.collectButton, this.jumpButton);
    this.round.visible = false;

    const footer = new Text({ text: t('footer'), style: ui({ fontSize: 11, fontWeight: '500' }) });
    footer.alpha = 0.6;
    footer.anchor.set(0.5, 0);
    footer.position.set(DESIGN_W / 2, DESIGN_H - 28);

    this.column.addChild(
      this.strip, rules, sessionLabel, this.clock, netLabel, this.net, this.demo, this.multBox, live, this.banner,
      this.panelBg, this.statusLeft, this.statusRight, this.betting, this.round, footer,
    );
    this.view.addChild(this.column);
  }

  layout(width: number, height: number) {
    const s = height / DESIGN_H;
    this.column.scale.set(s);
    this.column.x = width / 2 - (DESIGN_W / 2) * s;
    const extra = (width / s - DESIGN_W) / 2;
    this.strip.clear().rect(-extra, 0, DESIGN_W + extra * 2, 56).fill({ color: 0x000000, alpha: 0.55 });
    this.panelBg.clear().rect(-extra, 596, DESIGN_W + extra * 2, DESIGN_H - 596).fill({ color: NIGHT, alpha: 0.9 }).rect(-extra, 596, DESIGN_W + extra * 2, 2).fill({ color: RED, alpha: 0.8 });
  }

  setSession(clock: string, net: string) {
    this.clock.text = clock;
    this.net.text = net;
  }

  setMultiplier(value: string, dim: boolean, punch: number) {
    this.multValue.text = value;
    this.multBox.alpha = dim ? 0.5 : 1;
    this.multBox.scale.set(1 + 0.1 * punch);
    // Centre "x1.23" as one word.
    const total = this.multX.width + this.multValue.width;
    this.multX.x = -total / 2 + this.multX.width;
    this.multValue.x = this.multX.x + 2;
  }

  setChyron(text: string) {
    this.chyronText.text = text;
    this.chyronBg.clear().rect(62, 0, this.chyronText.width + 28, 28).fill({ color: 0xffffff, alpha: 0.95 });
  }

  setBanner(state: { title: string; sub: string; win: boolean } | null) {
    this.banner.visible = !!state;
    if (!state) return;
    this.bannerTitle.text = state.title;
    this.bannerSub.text = state.sub;
    this.bannerBg.clear().rect(0, 0, DESIGN_W - 48, 92).fill(state.win ? RED : { color: NIGHT, alpha: 0.92 });
    if (!state.win) this.bannerBg.stroke({ width: 1, color: INK, alpha: 0.25 });
  }

  setPanel(p: PanelState) {
    this.statusLeft.text = p.statusLeft;
    this.statusRight.text = p.statusRight;
    this.betting.visible = p.mode === 'betting';
    this.round.visible = p.mode === 'round';
    this.stake.text = p.stake;
    const segW = (DESIGN_W - 32 - 12) / 3;
    for (const b of this.difficultyButtons) {
      const on = b.d === p.difficulty;
      b.bg.clear().rect(0, 0, segW, 40);
      if (on) b.bg.fill(INK);
      else b.bg.stroke({ width: 1.5, color: INK, alpha: 0.4 });
      b.label.style.fill = on ? NIGHT : INK;
    }
    this.betButton.set(p.betTop, p.betSub, p.betEnabled, 'primary');
    this.jumpButton.set(p.jumpTop, p.jumpSub, p.jumpEnabled, 'primary');
    this.collectButton.set(t('collect'), p.collectSub, p.collectEnabled, 'outline');
    const chipW = (DESIGN_W - 32 - 4 * 6) / 5;
    p.ladder.forEach((c, i) => {
      const chip = this.chips[i];
      if (!chip) return;
      chip.label.text = c.label;
      chip.value.text = c.value;
      chip.bg.clear().rect(0, 0, chipW, 44);
      if (c.state === 'done') chip.bg.fill({ color: RED, alpha: 0.85 });
      else if (c.state === 'next') chip.bg.fill(0xffffff);
      else chip.bg.fill({ color: NIGHT, alpha: 0.6 }).stroke({ width: 1, color: INK, alpha: 0.25 });
      const ink = c.state === 'next' ? NIGHT : INK;
      chip.label.style.fill = ink;
      chip.value.style.fill = ink;
    });
  }
}
