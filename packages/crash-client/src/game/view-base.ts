import type { ResultKind } from '@triptown/core';
import type { GameApp } from '@triptown/engine';
import { t } from '../i18n';
import type { CrashViewCallbacks, Phase, PresentationFlags } from './view-contract';

/** What the shared base needs a game's view to expose. Everything else about the art is the game's. */
export interface ActionControl {
  setLabel(label: string, sub: string): void;
  setEnabled(on: boolean): void;
}

/** The label a screen wants on the action control, so a countdown can borrow it and give it back. */
export interface ActionLabel {
  label: string;
  sub: string;
  enabled: boolean;
}

/**
 * The compliance half of a crash view. A game extends this and implements only its art; these
 * behaviours are then identical in every game rather than remembered in each one:
 *
 * - **Release and press** (UK RTS 14G). A held pointer or key can never roll into the next round.
 * - **The minimum-gap countdown**, which borrows the action control and puts it back exactly as the
 *   screen wanted it — a countdown must not leave the control disabled or overwrite a result label.
 * - **The celebration decision** (UK RTS 14F, AGCO 2.20). Only a return strictly above the stake is
 *   a win; everything else states the amount returned and the net.
 * - **Presentation flags** from the jurisdiction profile.
 *
 * Rendering stays per game: the base decides, the game draws. `resultPresentation` is the single
 * place the celebration rule is written down, so a game that asks it never has to know the rule.
 */
export abstract class CrashViewBase {
  protected phase: Phase = 'betting';
  protected quickReplay = true;
  protected intensityEffects = true;
  protected modifiers = { setbacks: true, boosts: false };

  private armed = true;
  private countdownUntil = 0;
  private action: ActionLabel = { label: 'BET', sub: '', enabled: true };

  protected constructor(protected readonly handlers: CrashViewCallbacks) {}

  /** The control the countdown borrows. A game returns its start/collect button. */
  protected abstract actionControl(): ActionControl;

  // ---------- release and press (RTS 14G) ----------

  /**
   * Wires keyboard and pointer so a round needs a fresh press. Call once from the game's
   * constructor. `armed` is cleared on every start and only a release re-arms it.
   */
  protected installInput(game: GameApp): void {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      if (this.phase === 'running') this.handlers.onCollect();
      else if (this.armed) this.handlers.onBigButton();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.armed = true;
    });
    game.app.canvas.addEventListener('pointerup', () => {
      this.armed = true;
    });
    game.app.canvas.addEventListener('pointercancel', () => {
      this.armed = true;
    });
  }

  disarm(): void {
    this.armed = false;
  }

  get isArmed(): boolean {
    return this.armed;
  }

  // ---------- the minimum-gap countdown ----------

  setBetCountdown(msLeft: number): void {
    this.countdownUntil = msLeft > 0 ? performance.now() + msLeft : 0;
    this.updateCountdown();
  }

  /** Call every frame from the game's ticker. */
  protected tickCountdown(): void {
    if (this.countdownUntil) this.updateCountdown();
  }

  /** Records what the current screen wants on the control, so the countdown can restore it. */
  protected setActionLabel(next: ActionLabel): void {
    this.action = next;
  }

  protected get actionLabel(): ActionLabel {
    return this.action;
  }

  protected get counting(): boolean {
    return this.countdownUntil > 0;
  }

  private updateCountdown(): void {
    if (this.phase === 'running' || this.phase === 'starting' || this.phase === 'cashing') return;
    const control = this.actionControl();
    const left = this.countdownUntil - performance.now();
    if (left > 0) {
      control.setEnabled(false);
      control.setLabel(t('button.wait', { seconds: (left / 1000).toFixed(1) }), t('button.waitSub'));
    } else if (this.countdownUntil) {
      this.countdownUntil = 0;
      // Put the control back the way the screen wanted it, then let the controller refresh.
      control.setLabel(this.action.label, this.action.sub);
      control.setEnabled(this.action.enabled);
      this.handlers.onCountdownDone();
    }
  }

  // ---------- the celebration rule (RTS 14F, AGCO 2.20) ----------

  /**
   * The single place the celebration rule is written. A return at or below the stake is never a win:
   * no celebratory effect, and the line states the amount returned and the net rather than a gain.
   */
  protected resultPresentation(kind: ResultKind, payout: string, net: string): { celebrate: boolean; line: string } {
    const celebrate = kind === 'win';
    const line = celebrate
      ? t('result.net', { amount: net })
      : kind === 'even'
        ? t('result.returnedEven', { amount: payout })
        : t('result.returnedBelow', { amount: payout, net });
    return { celebrate, line };
  }

  // ---------- profile presentation ----------

  setPresentation(flags: PresentationFlags): void {
    this.quickReplay = flags.quickReplay;
    this.intensityEffects = flags.intensityEffects;
    this.modifiers = { setbacks: flags.setbacks, boosts: flags.boosts };
  }
}
