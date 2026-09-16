import type { Settlement, TerminalEvent } from '@triptown/core';
import type { AudioManager, GameApp } from '@triptown/engine';
import type { GameConfig } from '@triptown/fairness';
import {
  RoundServiceError,
  type RoundEvent,
  type RoundHandle,
  type RoundService,
  type SessionInfo,
} from '@triptown/rgs-client';
import {
  displayMultiplier,
  formatMoney,
  formatMultiplier,
  crossedCheckpoint,
  crossedMini,
  intensity10,
  intensityAudioLevel,
  pace,
  intensityName,
  nextAutoPreset,
  optimisticPayout,
  stepBet,
} from './display';
import type { Frames } from '../ui/stage';
import { GameView, type Phase } from './view';

interface ActiveRound {
  id: string;
  betMinor: number;
  startedAt: number;
  /** serverNow - clientNow, so elapsed time follows the server clock. */
  clockOffset: number;
  setbackTimes: Set<number>;
  /** Boost times already applied, so a replay after a reconnect stays idempotent. */
  boostTimes: Set<number>;
  handle: RoundHandle | null;
  resolved: boolean;
  cashRequested: boolean;
  lastDisplayed: number;
  /** Highest milestone multiplier already celebrated this round. */
  checkpoint: number;
  /** Highest small in-between milestone shown this round. */
  mini: number;
}

export interface ControllerHooks {
  onFairness?: () => void;
}

/** Taps on the big button are ignored this long after a round ends. */
const RESULT_INPUT_GUARD_MS = 700;

const ERROR_TEXT: Partial<Record<RoundServiceError['code'], string>> = {
  insufficient_funds: 'Not enough balance',
  bet_limit: 'Bet outside limits',
  round_in_progress: 'Round still running',
  round_voided: 'Round voided · stake refunded',
  cycle_too_soon: 'Please wait a moment',
  below_min_cashout: 'Too low to cash out yet',
  game_disabled: 'Game temporarily unavailable',
  integrity_blocked: 'Game temporarily unavailable',
  network: 'Connection problem',
};

/** Client round state machine: talks to the RoundService and drives the view and audio. */
export class GameController {
  readonly view: GameView;
  private session: SessionInfo | null = null;
  private phase: Phase = 'betting';
  private betMinor = 10_00;
  private autoOn = false;
  private autoTarget = 5;
  private round: ActiveRound | null = null;
  private balanceMinor = 0;
  private inputGuardUntil = 0;

  constructor(
    private readonly game: GameApp,
    frames: Frames,
    private readonly service: RoundService,
    private readonly audio: AudioManager | null,
    private readonly hooks: ControllerHooks = {},
  ) {
    this.view = new GameView(game, frames, {
      onBigButton: () => this.onBigButton(),
      onWhack: () => this.whack(),
      onStepBet: (dir) => this.editBet(() => stepBet(this.betMinor, dir, this.currency())),
      onChip: (minor) => this.editBet(() => minor),
      onToggleAuto: () => this.editBet(() => ((this.autoOn = !this.autoOn), this.betMinor)),
      onCycleAuto: () => this.editBet(() => ((this.autoTarget = nextAutoPreset(this.autoTarget)), (this.autoOn = true), this.betMinor)),
      onSound: () => {
        if (!this.audio) return;
        this.audio.unlock();
        this.audio.setMuted(!this.audio.current.muted);
      },
      onFairness: () => this.hooks.onFairness?.(),
      onEditBet: () => {
        if (this.phase === 'won' || this.phase === 'lost') this.toBetting();
      },
    });
    this.view.setDemo(service.mode === 'demo');
    if (audio) {
      this.view.setMuted(audio.current.muted);
      audio.onChange((s) => this.view.setMuted(s.muted));
      game.onVisibility((visible) => audio.setVisible(visible));
      // Any first touch unlocks audio (browsers block it until a gesture) and starts the lobby bed.
      game.app.canvas.addEventListener('pointerdown', () => {
        audio.unlock();
        audio.loadMusic();
        if (this.phase !== 'running') audio.startLobby();
      });
    }
    game.app.ticker.add(() => this.tick());
  }

  get config(): GameConfig {
    if (!this.session) throw new Error('not initialised');
    return this.session.config;
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  async init() {
    this.session = await this.service.getSession();
    this.balanceMinor = this.session.balanceMinor;
    this.renderBalance();
    const past = await this.service.history(20).catch(() => []);
    this.view.history.setAll(past.filter((r) => r.settlement).map((r) => r.settlement!.multiplier));
    this.toBetting();
  }

  async refreshSession() {
    this.session = await this.service.getSession();
    this.balanceMinor = this.session.balanceMinor;
    this.renderBalance();
  }

  // ---------- actions ----------

  private onBigButton() {
    // A late second tap on WHACK must not become a new bet on the result screen.
    if (performance.now() < this.inputGuardUntil) return;
    if (this.phase === 'running') this.whack();
    else if (this.phase === 'betting' || this.phase === 'won' || this.phase === 'lost') void this.bet();
  }

  private editBet(change: () => number) {
    if (this.phase !== 'betting' && this.phase !== 'won' && this.phase !== 'lost') return;
    this.betMinor = change();
    this.audio?.playSfx('tick');
    this.renderBetUi();
  }

  private toBetting() {
    this.phase = 'betting';
    this.view.showBetting();
    this.renderBetUi();
  }

  async bet() {
    if (!this.session) return;
    const reason = this.betBlockReason();
    if (reason) {
      if (this.phase !== 'betting') this.toBetting();
      return;
    }
    this.audio?.unlock();
    this.audio?.loadMusic();
    this.audio?.playSfx('bet');
    this.phase = 'starting';
    this.view.showStarting();
    const betMinor = this.betMinor;
    try {
      const handle = await this.service.startRound(
        { betMinor, autoCashout: this.autoOn ? this.autoTarget : null },
        (e) => this.onEvent(e),
      );
      if (this.round && this.round.id === handle.roundId) this.attachHandle(handle);
    } catch (err) {
      const code = err instanceof RoundServiceError ? err.code : 'network';
      this.view.toast(ERROR_TEXT[code] ?? 'Could not start round');
      await this.refreshSession().catch(() => {});
      this.toBetting();
    }
  }

  whack() {
    const r = this.round;
    if (this.phase !== 'running' || !r || r.cashRequested || r.resolved) return;
    r.cashRequested = true;
    this.phase = 'cashing';
    const m = r.lastDisplayed;
    this.view.showCashing(formatMoney(optimisticPayout(r.betMinor, m, this.config), this.currency()));
    this.audio?.playSfx('whack');
    this.service
      .cashout(r.id)
      .then((res) => {
        this.balanceMinor = res.balanceMinor;
        this.resolve(r, res.settlement);
      })
      .catch((err: unknown) => {
        const code = err instanceof RoundServiceError ? err.code : 'unknown';
        // A refused cash-out leaves the round running, so the button has to come back.
        if (code === 'below_min_cashout' && !r.resolved && this.round === r) {
          r.cashRequested = false;
          this.phase = 'running';
          const min = (err as RoundServiceError).details?.minCashout;
          const now = displayMultiplier(this.elapsed(r), r.setbackTimes.size, this.config, r.boostTimes.size);
          this.view.cancelCashing(formatMoney(optimisticPayout(r.betMinor, now, this.config), this.currency()));
          this.view.toast(typeof min === 'number' ? `Cash out from x${min.toFixed(2)}` : (ERROR_TEXT[code] ?? 'Too low to cash out yet'));
          return;
        }
        // The stream or a round fetch will settle it.
        void this.recover(r);
      });
  }

  // ---------- round events ----------

  private onEvent(e: RoundEvent) {
    if (e.type === 'START') {
      if (this.round?.id === e.roundId) {
        this.round.clockOffset = e.serverNow - Date.now();
        return;
      }
      this.round = {
        id: e.roundId,
        betMinor: e.betMinor,
        startedAt: e.startedAt,
        clockOffset: e.serverNow - Date.now(),
        setbackTimes: new Set(),
        boostTimes: new Set(),
        handle: null,
        resolved: false,
        cashRequested: false,
        lastDisplayed: 1,
        checkpoint: 0,
        mini: 0,
      };
      this.balanceMinor -= e.betMinor;
      this.renderBalance();
      this.phase = 'running';
      this.view.showRunning(formatMoney(e.betMinor, this.currency()));
      this.renderBetUi();
      this.audio?.stopLobby(200);
      this.audio?.startMusic();
      this.audio?.startTone();
      return;
    }
    const r = this.round;
    if (!r || r.id !== e.roundId || r.resolved) return;
    if (e.type === 'SETBACK') {
      if (r.setbackTimes.has(e.time)) return;
      const from = r.lastDisplayed;
      r.setbackTimes.add(e.time);
      const to = displayMultiplier(this.elapsed(r), r.setbackTimes.size, this.config, r.boostTimes.size);
      r.lastDisplayed = to;
      if (this.phase === 'running' || this.phase === 'cashing') {
        this.view.setback(formatMultiplier(from), formatMultiplier(to), formatMoney(optimisticPayout(r.betMinor, to, this.config), this.currency()));
        this.audio?.playSfx('setback');
        this.audio?.duckMusic(300);
        this.audio?.setToneMultiplier(to);
      }
      return;
    }
    if (e.type === 'BOOST') {
      if (r.boostTimes.has(e.time)) return;
      r.boostTimes.add(e.time);
      const to = displayMultiplier(this.elapsed(r), r.setbackTimes.size, this.config, r.boostTimes.size);
      r.lastDisplayed = to;
      if (this.phase === 'running' || this.phase === 'cashing') {
        this.view.boost(Math.round((e.factor - 1) * 100), formatMultiplier(to), formatMoney(optimisticPayout(r.betMinor, to, this.config), this.currency()));
        this.audio?.playSfx('boost');
        this.audio?.setToneMultiplier(to);
      }
      return;
    }
    // Paper throws only exist in partial cash-out games; Whack rounds never send them.
    if (e.type === 'PART_SETTLED') return;
    this.onTerminal(r, e);
  }

  private onTerminal(r: ActiveRound, e: TerminalEvent) {
    this.balanceMinor = e.balanceMinor;
    const settlement: Settlement =
      e.type === 'VOID'
        ? { status: 'void', reason: 'system_failure', time: 0, multiplier: 1, payoutMinor: e.refundMinor, crashTime: -1 }
        : e.type === 'CASHED_OUT'
          ? { status: 'won', reason: e.reason, time: e.time, multiplier: e.multiplier, payoutMinor: e.payoutMinor, crashTime: e.crashTime }
          : { status: 'lost', reason: 'crash', time: e.time, multiplier: e.multiplier, payoutMinor: 0, crashTime: e.crashTime };
    this.resolve(r, settlement);
  }

  private attachHandle(handle: RoundHandle) {
    const r = this.round;
    if (!r) return;
    r.handle = handle;
    void handle.ended.then((terminal) => {
      if (!terminal && !r.resolved) void this.recover(r);
    });
  }

  /** Reconnects after a dropped stream or failed request: fetch the round, then re-attach if still running. */
  private async recover(r: ActiveRound) {
    for (let attempt = 0; !r.resolved && this.round === r; attempt++) {
      try {
        const snap = await this.service.getRound(r.id);
        if (snap.settlement) {
          await this.refreshSession();
          this.resolve(r, snap.settlement);
          return;
        }
        snap.setbacks.forEach((time) => {
          if (!r.setbackTimes.has(time)) this.onEvent({ type: 'SETBACK', roundId: r.id, time, factor: this.config.setbackFactor });
        });
        snap.boosts.forEach((time) => {
          if (!r.boostTimes.has(time)) this.onEvent({ type: 'BOOST', roundId: r.id, time, factor: this.config.boostFactor });
        });
        if (!r.cashRequested) {
          const handle = await this.service.watchRound(r.id, (e) => this.onEvent(e));
          this.attachHandle(handle);
          return;
        }
      } catch {
        this.view.toast('Reconnecting…');
      }
      await new Promise((res) => setTimeout(res, Math.min(4000, 500 * 2 ** attempt)));
    }
  }

  private resolve(r: ActiveRound, s: Settlement) {
    if (r.resolved) return;
    r.resolved = true;
    this.inputGuardUntil = performance.now() + RESULT_INPUT_GUARD_MS;
    r.handle?.close();
    this.audio?.stopTone();
    // Round music stops as it always did; the lobby bed takes over between rounds.
    this.audio?.stopMusic();
    this.audio?.startLobby();
    this.renderBalance();
    if (s.status === 'void') {
      // System failure: the stake came back; no result to celebrate or mourn.
      this.view.toast('Round voided · stake refunded');
      this.toBetting();
      return;
    }
    this.view.history.push(s.multiplier);
    if (s.status === 'won') {
      this.phase = 'won';
      const big = s.multiplier >= 10;
      this.view.showWin(formatMultiplier(s.multiplier), formatMoney(s.payoutMinor, this.currency()), big);
      this.audio?.playSfx(big ? 'bigwin' : 'win');
    } else {
      this.phase = 'lost';
      this.view.showCrash(formatMultiplier(s.multiplier), `-${formatMoney(r.betMinor, this.currency())}`, s.crashTime === 0);
      this.audio?.playSfx('crash');
    }
    this.renderBetUi();
  }

  // ---------- per frame ----------

  private tick() {
    const r = this.round;
    if (!r || r.resolved || (this.phase !== 'running' && this.phase !== 'cashing')) return;
    if (this.phase === 'cashing') return;
    const t = this.elapsed(r);
    const m = displayMultiplier(t, r.setbackTimes.size, this.config, r.boostTimes.size);
    const floor = Math.max(r.lastDisplayed, r.checkpoint);
    const milestone = crossedCheckpoint(floor, m);
    if (milestone) {
      r.checkpoint = milestone;
      this.view.checkpoint(milestone, `x${milestone}`);
      this.audio?.playSfx('tick', { volume: 1.4 });
    }
    const mini = crossedMini(Math.max(floor, r.mini), m);
    if (mini && mini !== milestone) {
      r.mini = mini;
      this.view.miniCheckpoint(formatMultiplier(mini));
    }
    r.lastDisplayed = m;
    const level = intensity10(t, this.config);
    this.view.frame(
      formatMultiplier(m),
      formatMoney(optimisticPayout(r.betMinor, m, this.config), this.currency()),
      level,
      intensityName(level),
      pace(t, this.config),
    );
    this.audio?.setToneMultiplier(m);
    this.audio?.setIntensity(intensityAudioLevel(level));
  }

  private elapsed(r: ActiveRound): number {
    return Math.max(0, (Date.now() + r.clockOffset - r.startedAt) / 1000);
  }

  // ---------- rendering helpers ----------

  private currency() {
    if (!this.session) throw new Error('not initialised');
    return this.session.currency;
  }

  private renderBalance() {
    if (!this.session) return;
    this.view.setBalance(formatMoney(this.balanceMinor, this.currency()), this.currency().code);
    // Minimal operator bridge: the embedding page can mirror the balance.
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'triptown:balance', balanceMinor: this.balanceMinor, currency: this.currency().code }, '*');
    }
  }

  private betBlockReason(): string | null {
    if (!this.session) return 'LOADING';
    if (this.betMinor > this.balanceMinor) return 'INSUFFICIENT BALANCE';
    return null;
  }

  private renderBetUi() {
    if (!this.session) return;
    const locked = !(this.phase === 'betting' || this.phase === 'won' || this.phase === 'lost');
    const reason = this.betBlockReason();
    this.view.setBetUi({
      bet: formatMoney(this.betMinor, this.currency()),
      betMinor: this.betMinor,
      autoOn: this.autoOn,
      auto: formatMultiplier(this.autoTarget),
      canBet: !reason,
      reason,
      locked,
    });
  }
}
