import type { GameApp } from '@triptown/engine';
import type { ResultKind } from '@triptown/core';
import type { Texture } from 'pixi.js';
import type { HistoryChip, HistoryStrip } from '../ui/hud';

/** Looks a named texture out of a game's atlas. Neutral: the names are the game's business. */
export type Frames = (name: string) => Texture;

export type Phase = 'betting' | 'starting' | 'running' | 'cashing' | 'won' | 'lost';

export interface BetUi {
  bet: string;
  betMinor: number;
  autoOn: boolean;
  auto: string;
  canBet: boolean;
  reason: string | null;
  locked: boolean;
}

export interface SessionHud {
  showClock: boolean;
  showNet: boolean;
  startedAt: number;
  netMinor: number;
  currency: import('@triptown/core').CurrencyRules;
}

export interface PresentationFlags {
  quickReplay: boolean;
  intensityEffects: boolean;
  setbacks: boolean;
  boosts: boolean;
  /** The market offers stake-free practice rounds, so a game may show a control for one. */
  practiceRounds: boolean;
}

/** What the player can do. `onCollect` is the cash-out; each game names the button itself. */
export interface CrashViewCallbacks {
  onBigButton(): void;
  /** Starts a stake-free practice round. Only ever called where the profile permits one. */
  onPractice(): void;
  onCollect(): void;
  onCountdownDone(): void;
  onStepBet(dir: 1 | -1): void;
  onChip(minor: number): void;
  onToggleAuto(): void;
  onCycleAuto(): void;
  onSound(): void;
  onFairness(): void;
  onRules(): void;
  onHistory(): void;
  onEditBet(): void;
}

/**
 * The contract between the shared controller and a game's rendering. A game implements this; the
 * controller never knows which game it is driving. Four members are compliance behaviours rather
 * than presentation and are implemented once in the shared base, not per game:
 * `showWin` (splits on ResultKind so a return at or below the stake is never celebrated),
 * `disarm`/`isArmed` (release-and-press before a new round), and `setBetCountdown`
 * (the minimum-gap wait, which must restore the control it borrowed).
 */
export interface CrashView {
  readonly isArmed: boolean;
  setDemo(on: boolean): void;
  setMuted(muted: boolean): void;
  setBalance(amount: string, currency: string): void;
  setBetUi(ui: BetUi): void;
  setSessionHud(hud: SessionHud): void;
  setPresentation(flags: PresentationFlags): void;
  setBetCountdown(msLeft: number): void;
  disarm(): void;
  showBetting(): void;
  showStarting(): void;
  showRunning(stake: string): void;
  showCashing(payout: string): void;
  cancelCashing(payout: string): void;
  /** Splits on `kind`: a return at or below the stake must not be celebrated (UK RTS 14F). */
  showWin(multiplier: string, payout: string, big: boolean, kind: ResultKind, net: string): void;
  showCrash(multiplier: string, loss: string, instant: boolean): void;
  frame(multiplier: string, payout: string, level: number, intensity: string, pace: number, belowStake: boolean): void;
  checkpoint(multiplier: number, label: string): void;
  miniCheckpoint(multiplier: string): void;
  boost(percent: number, to: string, payout: string): void;
  setback(from: string, to: string, payout: string): void;
  toast(message: string): void;
  /**
   * Optional, deferred reveal (gate-odds-mvp). Called at every round start with the round's reveal mode,
   * before any frame, so a game can choose its presentation for the round.
   */
  setRevealMode?(mode: 'live' | 'onCollect'): void;
  /** Optional: the live win chance of a deferred round (already formatted), or null to hide it. */
  setRevealOdds?(chance: string | null): void;
  /**
   * Optional: the player pressed collect on a deferred round. The value is locked and the result is
   * not known yet; this state must look and sound the same whatever the outcome.
   */
  showHeadingHome?(multiplier: string, payoutIfWon: string): void;
  /** Optional: whether this game has audio at all. A sound control with nothing behind it is a false signal. */
  setAudioAvailable?(available: boolean): void;
  /** Optional: market disclosures a profile switches on, e.g. a withholding-tax notice. */
  setDisclosures?(d: { withholdingNotice?: boolean }): void;
  /**
   * Optional: screen shakes played, for the presentation check. Emphasis effects are not just sound
   * and confetti — a shake on a return at or below the stake reads as celebration too (UK RTS 14F),
   * and a check that only counts the obvious cues would pass a game that shakes on a loss.
   */
  readonly shakesShown?: number;
  readonly history: Pick<HistoryStrip, 'setAll' | 'push'>;
}

export type { HistoryChip };

/** A game hands the controller this; the controller builds the view and wires the callbacks. */
export type CrashViewFactory = (app: GameApp, frames: Frames, cb: CrashViewCallbacks) => CrashView;
