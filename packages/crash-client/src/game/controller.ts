import { effectiveReveal, practiceAllowed, resultKind, type Settlement, type TerminalEvent } from '@triptown/core';
import { t } from '../i18n';
import { OperatorBridge, type AudioManager, type GameApp } from '@triptown/engine';
import type { GameConfig } from '@triptown/fairness';
import {
  RoundServiceError,
  type RoundEvent,
  type RoundHandle,
  type RoundService,
  type SessionInfo,
} from '@triptown/rgs-client';
import {
  clampBet,
  displayMultiplier,
  formatMoney,
  formatMultiplier,
  chanceTable,
  type RideResult,
  formatRevealChance,
  HEADING_HOME_MS,
  crossedCheckpoint,
  crossedMini,
  intensity10,
  intensityAudioLevel,
  pace,
  intensityName,
  nextAutoPreset,
  optimisticPayout,
  stepBet,
} from '..';

import type { CrashView, CrashViewFactory, Frames, Phase } from './view-contract';

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
  /** Deferred reveal (gate-odds-mvp): the result is only made known at the player's reveal. */
  deferred: boolean;
  /** Deferred reveal: client time of the collect press, which starts the fixed heading-home state. */
  pressedAt: number | null;
  /** Deferred reveal: a settlement arrived during heading home and waits for it to finish. */
  revealPending: boolean;
  /** Deferred reveal: the balance from that settlement, held back so it cannot show the result early. */
  heldBalanceMinor: number | null;
  /** Deferred reveal: the settlement waiting for heading home to finish. */
  pendingSettlement?: Settlement;
}

export interface ControllerHooks {
  /**
   * The registered game id. With it the client can tell, before any round, whether THIS game's rounds
   * reveal at collect (effectiveReveal, the same call the server makes at START) and show the chance table
   * on the betting screen. The market flag alone would only say what the market allows.
   */
  game?: string;
  onFairness?: () => void;
  onRules?: () => void;
  onHistory?: () => void;
  /** Player-protection prompts, rendered as DOM overlays by main.ts. */
  onPause?: (message?: string) => void;
  onOverlayClose?: () => void;
  onClosed?: () => void;
  onOperatorMessage?: (text: string) => void;
  onIdlePrompt?: (done: () => void) => void;
  /** Sound effect key for the collect action. Each game names its own; defaults to `collect`. */
  collectSfx?: string;
  /** Build version reported to the operator bridge. Apps inject it; the shared client cannot read
   *  a per-app Vite define. */
  clientVersion?: string;
  /**
   * Starting stake, in minor units. Demo builds only, so the compliance checks can play a round at
   * the market's minimum: whether a return lands at or below the stake is a rounding question, and
   * rounding only bites at the smallest stake (AGENTS hard rule 9). At 10.00 an even return needs
   * the settled multiplier inside +/-0.05% of x1.00, which no real cash-out round trip can hit, so
   * the even case was silently never exercised. It is still clamped to the session's currency.
   */
  initialBetMinor?: number;
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
  readonly view: CrashView;
  private session: SessionInfo | null = null;
  /** Player's own "reduce effects" choice, on top of the profile's `intensityEffects`. */
  private reduceEffectsChoice = false;
  private phase: Phase = 'betting';
  private betMinor: number;
  private autoOn = false;
  private autoTarget = 5;
  private round: ActiveRound | null = null;
  private balanceMinor = 0;
  private inputGuardUntil = 0;
  /** Client clock of the last round start, for the local minimum-cycle countdown. */
  private lastStartAt = 0;
  /** Operator bridge, created once the profile's allowed origins are known. */
  private bridge: OperatorBridge | null = null;
  /** Player-protection state driven by the operator and the profile. */
  private paused = false;
  private closed = false;
  private stakeLimitMinor: number | null = null;
  private lossLimitMinor: number | null = null;
  private idleSince = performance.now();
  private idlePromptOpen = false;
  /** Smoothed round-trip time, and whether the slow-connection notice is showing (design D20). */
  private rttMs = 0;
  private slowShown = false;
  /**
   * This session's settled deferred rides, for a game that shows the player their own record beside the
   * chance. It is a record of what happened, never a prediction: every ride is settled on its own seeds.
   */
  private deferredRides: RideResult[] = [];
  /** Round start times (client clock) for the automated timing check. */
  private readonly startLog: number[] = [];
  /** True while a stake-free practice round is running or showing its result (practice-rounds). */
  private practiceRound = false;
  /**
   * Every money string handed to the view during the current round. The compliance check cannot read
   * text drawn into the canvas, so a DOM scan for a currency symbol silently proves nothing; this
   * records what was actually passed, which is the decision the rule is about.
   */
  private moneyShown: string[] = [];
  /** What the last settled round was presented as, for the presentation check. */
  private lastResultKind: 'win' | 'even' | 'loss' | 'void' | null = null;
  private lastCelebrated = false;

  constructor(
    private readonly game: GameApp,
    frames: Frames,
    private readonly service: RoundService,
    private readonly audio: AudioManager | null,
    createView: CrashViewFactory,
    private readonly hooks: ControllerHooks = {},
  ) {
    this.betMinor = hooks.initialBetMinor ?? 10_00;
    this.view = createView(game, frames, {
      onBigButton: () => this.onBigButton(),
      onPractice: () => this.onPractice(),
      onCollect: () => this.collect(),
      onCountdownDone: () => this.renderBetUi(),
      onStepBet: (dir) => this.editBet(() => stepBet(this.betMinor, dir, this.currency())),
      onChip: (minor) => this.editBet(() => minor),
      onToggleAuto: () => this.autoOffered() && this.editBet(() => ((this.autoOn = !this.autoOn), this.betMinor)),
      onCycleAuto: () =>
        this.autoOffered() && this.editBet(() => ((this.autoTarget = nextAutoPreset(this.autoTarget)), (this.autoOn = true), this.betMinor)),
      onSound: () => {
        if (!this.audio) return;
        this.audio.unlock();
        this.audio.setMuted(!this.audio.current.muted);
      },
      onFairness: () => this.hooks.onFairness?.(),
      onRules: () => this.hooks.onRules?.(),
      onHistory: () => this.hooks.onHistory?.(),
      onEditBet: () => {
        if (this.phase === 'won' || this.phase === 'lost') this.toBetting();
      },
    });
    this.view.setDemo(service.mode === 'demo');
    this.view.setAudioAvailable?.(audio !== null);
    if (audio) {
      this.view.setMuted(audio.current.muted);
      audio.onChange((s) => this.view.setMuted(s.muted));
      game.onVisibility((visible) => audio.setVisible(visible));
      // Any first touch unlocks audio (browsers block it until a gesture) and starts the lobby bed.
      // Listen on the document in the capture phase, not just the canvas: a tap that lands on a DOM
      // panel or the accessibility layer is still the gesture iOS wants, and missing it leaves the
      // context suspended for the rest of the session.
      const onGesture = () => {
        audio.unlock();
        audio.loadMusic();
        // Not while heading home either: a cue with no reason to play there is easiest kept silent.
        if (this.phase !== 'running' && this.phase !== 'cashing') audio.startLobby();
      };
      for (const type of ['pointerdown', 'touchend', 'click'] as const) {
        document.addEventListener(type, onGesture, { capture: true, passive: true });
      }
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

  /** Measures the round trip every 10 s while the page is visible, plus on every cash-out. */
  private startLatencyProbe() {
    const probe = async () => {
      const started = performance.now();
      try {
        await this.service.ping();
        this.noteRtt(performance.now() - started);
      } catch {
        // A failed probe says nothing about latency; the reconnect path handles real outages.
      }
    };
    void probe();
    setInterval(() => {
      if (!document.hidden) void probe();
    }, 10_000);
  }

  private noteRtt(sample: number) {
    // EWMA: recent samples dominate without a single spike flipping the notice.
    this.rttMs = this.rttMs === 0 ? sample : this.rttMs * 0.7 + sample * 0.3;
    const slow = this.rttMs > 300;
    if (slow !== this.slowShown) {
      this.slowShown = slow;
      if (slow) this.view.toast(t('error.slowConnection'));
    }
  }

  /**
   * The one place a session is adopted. Assigning `this.session` directly anywhere else skips the
   * bet clamp, and the first bet of the session is then refused — which is exactly what happened
   * when the clamp lived in `refreshSession()` alone and `init()` assigned around it.
   */
  private adoptSession(session: SessionInfo): SessionInfo {
    this.session = session;
    // A session may be in a currency whose minimum is far above the client's default bet.
    const clamped = clampBet(this.betMinor, session.currency);
    if (clamped !== this.betMinor) this.betMinor = clamped;
    return session;
  }

  async init() {
    this.balanceMinor = this.adoptSession(await this.service.getSession()).balanceMinor;
    this.applyProfile();
    this.openBridge();
    this.renderBalance();
    this.renderSessionHud();
    const past = await this.service.history(20).catch(() => []);
    // Earlier deferred rides in this session seed the player's own record, oldest first.
    this.deferredRides = past
      .filter((r) => r.reveal === 'onCollect' && r.settlement && r.status !== 'void')
      .map((r) => ({ multiplier: r.settlement!.multiplier, won: r.status === 'won' }))
      .reverse();
    this.view.history.setAll(
      past
        .filter((r) => r.settlement)
        .map((r) => ({
          multiplier: r.settlement!.multiplier,
          kind: r.status === 'void' ? ('void' as const) : resultKind(r.betMinor, r.returnMinor ?? 0),
        })),
    );
    this.renderChanceTable();
    this.startLatencyProbe();
    this.toBetting();
  }

  /** Opens the operator bridge against the profile's allowed origins, and announces the game. */
  private openBridge() {
    const p = this.session?.profile;
    if (!p || this.bridge) return;
    this.bridge = new OperatorBridge({
      allowedOrigins: p.operatorOrigins,
      handlers: {
        // A reality check may never interrupt a running round; it applies from the next bet.
        pause: ({ message }) => this.applyPause(message),
        resume: () => {
          this.paused = false;
          this.hooks.onOverlayClose?.();
          this.renderBetUi();
        },
        closeGame: () => {
          this.closed = true;
          this.renderBetUi();
          if (this.phase !== 'running' && this.phase !== 'cashing') this.showClosed();
        },
        setLimits: ({ stakeLimitMinor, lossLimitMinor }) => {
          if (stakeLimitMinor !== undefined) this.stakeLimitMinor = stakeLimitMinor;
          if (lossLimitMinor !== undefined) this.lossLimitMinor = lossLimitMinor;
          this.renderBetUi();
        },
        showMessage: ({ text }) => this.hooks.onOperatorMessage?.(text),
      },
    });
    this.bridge.gameReady(this.hooks.clientVersion ?? 'dev', this.config.id, p.name);
  }

  /** Pushes the market profile's presentation rules into the view and the audio defaults. */
  private applyProfile() {
    const p = this.session?.profile;
    if (!p) return;
    this.view.setDisclosures?.({ withholdingNotice: p.withholdingNotice });
    this.view.setPresentation({
      quickReplay: p.quickReplay,
      intensityEffects: p.intensityEffects && !this.reduceEffectsChoice,
      setbacks: this.config.lambda > 0,
      boosts: this.config.boostRate > 0,
      practiceRounds: p.practiceRounds === true,
    });
    // Sound default is per market; a player's own choice, once made, is kept by the audio settings.
    // Applied both ways until the player chooses: a market default saved in the browser (e.g. muted by an
    // earlier profile) would otherwise outlive a market that now defaults to sound on.
    if (this.audio && !this.audio.current.touched) this.audio.setMuted(p.soundDefault === 'muted', false);
  }

  /** The bound session, for panels that render the config and profile actually in play. */
  get currentSession(): SessionInfo | null {
    return this.session;
  }

  /** The stake currently selected, e.g. for the rules screen's chance table. */
  get stakeMinor(): number {
    return this.betMinor;
  }

  get reduceEffects() {
    return this.reduceEffectsChoice;
  }

  setReduceEffects(on: boolean) {
    this.reduceEffectsChoice = on;
    this.applyProfile();
  }

  async refreshSession() {
    const before = this.betMinor;
    const session = this.adoptSession(await this.service.getSession());
    if (this.betMinor !== before) this.renderBetUi();
    this.applyProfile();
    // An unrevealed deferred round may already be settled on the server; the session's balance and net
    // position would show its result before the reveal. Hold them until the round resolves.
    const r = this.round;
    if (r && r.deferred && !r.resolved) {
      r.heldBalanceMinor = session.balanceMinor;
      return;
    }
    this.renderSessionHud();
    this.balanceMinor = session.balanceMinor;
    this.renderBalance();
  }

  // ---------- actions ----------

  /**
   * The chance table for the betting screen and between rounds, with the player's own record so far. Sent
   * only when this game's rounds actually reveal at collect.
   */
  private renderChanceTable(): void {
    const profile = this.session?.profile;
    const deferred = !!this.hooks.game && !!profile && effectiveReveal(this.hooks.game, profile, this.config) === 'onCollect';
    this.view.setChanceTable?.(deferred ? chanceTable(this.config, this.deferredRides) : null);
  }

  /** A game without an auto control never sends a target, whatever state the toggle was left in. */
  private autoOffered(): boolean {
    return this.view.offersAutoCashout !== false;
  }

  /** The secondary result-screen action: start a round with no stake. */
  private onPractice() {
    if (performance.now() < this.inputGuardUntil) return;
    if (!this.view.isArmed) return;
    if (this.session?.profile?.practiceRounds !== true) return;
    if (this.phase !== 'won' && this.phase !== 'lost' && this.phase !== 'betting') return;
    void this.bet({ practice: true });
  }

  private onBigButton() {
    // A late second tap on the collect button must not become a new bet on the result screen.
    if (performance.now() < this.inputGuardUntil) return;
    // The control must have been released since the last round started (RTS 14G).
    if (this.phase !== 'running' && !this.view.isArmed) return;
    if (this.phase === 'running') this.collect();
    else if (this.phase === 'won' || this.phase === 'lost') {
      // Markets without quick replay go back to the betting screen first (one deliberate bet each round).
      if (this.session?.profile?.quickReplay === false) this.toBetting();
      else void this.bet();
    } else if (this.phase === 'betting') void this.bet();
  }

  private editBet(change: () => number) {
    if (this.phase !== 'betting' && this.phase !== 'won' && this.phase !== 'lost') return;
    this.betMinor = change();
    this.audio?.playSfx('tick');
    this.renderBetUi();
  }

  /** Called on every player action; the idle prompt only fires after real inactivity. */
  markActivity() {
    this.idleSince = performance.now();
  }

  /** Runs each frame: prompts the player after the profile's idle time with no bet. */
  private checkIdle() {
    const ms = this.session?.profile?.idlePromptMs ?? null;
    if (!ms || this.idlePromptOpen || this.phase === 'running' || this.phase === 'cashing' || this.closed) return;
    if (performance.now() - this.idleSince < ms) return;
    this.idlePromptOpen = true;
    this.renderBetUi();
    this.hooks.onIdlePrompt?.(() => {
      this.idlePromptOpen = false;
      this.markActivity();
      this.renderBetUi();
    });
  }

  private toBetting() {
    this.phase = 'betting';
    this.view.showBetting();
    this.renderBetUi();
  }

  async bet(opts: { practice?: boolean } = {}) {
    if (!this.session) return;
    const practice = opts.practice === true;
    this.markActivity();
    const reason = this.betBlockReason(practice);
    if (reason) {
      if (this.phase !== 'betting') this.toBetting();
      return;
    }
    this.audio?.unlock();
    this.audio?.loadMusic();
    this.audio?.playSfx('bet');
    this.phase = 'starting';
    this.view.disarm();
    const attemptedAt = performance.now();
    this.view.showStarting();
    // A practice round shares this path exactly, so the startLog push below — the evidence the timing
    // check reads — cannot diverge between the two (practice-rounds D9).
    this.practiceRound = practice;
    this.moneyShown = [];
    const betMinor = practice ? 0 : this.betMinor;
    try {
      const handle = await this.service.startRound(
        {
          betMinor,
          autoCashout: practice || !this.autoOffered() ? null : this.autoOn ? this.autoTarget : null,
          ...(practice && { practice: true as const }),
        },
        (e) => this.onEvent(e),
      );
      // Recorded only once the host accepted. A refused bet is not a round start: counting it would
      // make the player wait out a cycle gap the server never imposed, and would put a phantom entry
      // in the log the timing check reads as evidence (UK RTS 14G, AGCO 2.18).
      this.lastStartAt = attemptedAt;
      this.startLog.push(Math.round(attemptedAt));
      if (this.startLog.length > 100) this.startLog.shift();
      if (this.round && this.round.id === handle.roundId) this.attachHandle(handle);
    } catch (err) {
      const code = err instanceof RoundServiceError ? err.code : 'network';
      // The server is the authority on pacing; mirror its wait on the button.
      const retry = err instanceof RoundServiceError ? Number(err.details?.retryAfterMs ?? 0) : 0;
      if (retry > 0) this.view.setBetCountdown(retry);
      this.view.toast(ERROR_TEXT[code] ?? 'Could not start round');
      this.practiceRound = false;
      await this.refreshSession().catch(() => {});
      this.toBetting();
    }
  }

  collect() {
    this.markActivity();
    const r = this.round;
    if (this.phase !== 'running' || !r || r.cashRequested || r.resolved) return;
    r.cashRequested = true;
    this.phase = 'cashing';
    const m = r.lastDisplayed;
    const payout = formatMoney(optimisticPayout(r.betMinor, m, this.config), this.currency());
    if (r.deferred && this.view.showHeadingHome) {
      // The value locks and heading home starts on the press, identically for every outcome.
      r.pressedAt = performance.now();
      this.view.showHeadingHome(formatMultiplier(m), payout);
    } else {
      this.view.showCashing(payout);
    }
    this.audio?.playSfx(this.hooks.collectSfx ?? 'collect');
    this.service
      .cashout(r.id)
      .then((res) => {
        this.setBalanceFor(r, res.balanceMinor);
        this.resolve(r, res.settlement);
      })
      .catch((err: unknown) => {
        const code = err instanceof RoundServiceError ? err.code : 'unknown';
        // A refused cash-out leaves the round running, so the button has to come back.
        if (code === 'below_min_cashout' && !r.resolved && this.round === r) {
          r.cashRequested = false;
          r.pressedAt = null;
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

  /** Snapshot for the automated compliance checks (demo builds only). */
  debugState() {
    const r = this.round;
    return {
      phase: this.phase,
      resultKind: this.lastResultKind,
      confetti: this.lastCelebrated,
      shakes: this.view.shakesShown ?? 0,
      practice: this.practiceRound,
      moneyShown: [...this.moneyShown],
      deferred: r?.deferred ?? false,
      headingHome: !!r && r.pressedAt !== null && !r.resolved,
      betMinor: r?.betMinor ?? this.betMinor,
      starts: [...this.startLog],
      boxes: this.view.layoutBoxes?.() ?? [],
      multiplier: r?.lastDisplayed ?? 0,
      setbacks: r?.setbackTimes.size ?? 0,
      boosts: r?.boostTimes.size ?? 0,
      // Enough for a check to work out which outcomes this profile can actually produce, instead of
      // forcing a scenario that cannot happen and reading the timeout as a failure.
      profile: this.session
        ? {
            name: this.session.profile.name,
            // The config this game plays, not the market flag: a rising engine has no setbacks whatever the profile says.
            setbacks: this.config.lambda > 0,
            minCashout: this.session.profile.minCashout,
            minCycleMs: this.session.profile.minCycleMs,
            skin: this.session.profile.skin,
            crashReveal: this.session.profile.crashReveal ?? 'live',
            // What the market permits, from the same predicate the server refuses a practice round by.
            practiceRounds: practiceAllowed(this.session.profile),
          }
        : null,
    };
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
        deferred: e.reveal === 'onCollect',
        pressedAt: null,
        revealPending: false,
        heldBalanceMinor: null,
      };
      this.view.setRevealMode?.(e.reveal ?? 'live');
      this.view.setRevealOdds?.(e.reveal === 'onCollect' ? formatRevealChance(this.config.rtp, 1) : null);
      this.view.setChanceTable?.(e.reveal === 'onCollect' ? chanceTable(this.config, this.deferredRides) : null);
      this.balanceMinor -= e.betMinor;
      this.renderBalance();
      this.phase = 'running';
      this.bridge?.roundStarted(e.roundId, e.betMinor);
      this.view.showRunning(this.money(this.practiceRound ? '' : formatMoney(e.betMinor, this.currency())));
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
    // Part settlements only exist in split-stake games; single-bet rounds never send them.
    if (e.type === 'PART_SETTLED') return;
    this.onTerminal(r, e);
  }

  private onTerminal(r: ActiveRound, e: TerminalEvent) {
    this.setBalanceFor(r, e.balanceMinor);
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

  /** A deferred round's balance waits until its reveal is shown; anything else applies at once. */
  private setBalanceFor(r: ActiveRound, balanceMinor: number) {
    if (r.deferred && !r.resolved) r.heldBalanceMinor = balanceMinor;
    else this.balanceMinor = balanceMinor;
  }

  private resolve(r: ActiveRound, s: Settlement) {
    if (r.resolved) return;
    // Deferred reveal: the result waits for the heading-home state to run its fixed length from the
    // press, so the reveal time is max(press + fixed, settlement received), never earlier for one
    // outcome than the other (gate-odds-mvp D6).
    if (r.deferred && r.pressedAt !== null) {
      const wait = r.pressedAt + HEADING_HOME_MS - performance.now();
      if (wait > 0) {
        if (!r.revealPending) {
          r.revealPending = true;
          r.pendingSettlement = s;
          setTimeout(() => {
            r.revealPending = false;
            this.resolve(r, s);
          }, wait);
        } else if (r.pendingSettlement && (r.pendingSettlement.status !== s.status || r.pendingSettlement.payoutMinor !== s.payoutMinor)) {
          // The cash-out response and the stream must agree; if they ever don't, say so rather than
          // silently showing whichever arrived first.
          console.error('[crash-client] settlements disagree during heading home', r.id, r.pendingSettlement, s);
        }
        return;
      }
    }
    r.resolved = true;
    if (r.heldBalanceMinor !== null) this.balanceMinor = r.heldBalanceMinor;
    this.inputGuardUntil = performance.now() + RESULT_INPUT_GUARD_MS;
    r.handle?.close();
    this.audio?.stopTone();
    // Round music stops as it always did; the lobby bed takes over between rounds.
    this.audio?.stopMusic();
    this.audio?.startLobby();
    this.renderBalance();
    this.view.setRevealOdds?.(null);
    if (s.status === 'void') {
      // System failure: the stake came back; no result to celebrate or mourn.
      this.view.toast('Round voided · stake refunded');
      this.toBetting();
      return;
    }
    // Void rounds return early above, so this is only a settled win or loss.
    // A deferred ride joins the player's own record at the value they went in at, staked rounds only.
    if (r.deferred && !this.practiceRound) {
      this.deferredRides.push({ multiplier: s.multiplier, won: s.status === 'won' });
      this.renderChanceTable();
    }
    this.bridge?.roundEnded(r.id, r.betMinor, s.status === 'lost' ? 0 : s.payoutMinor);
    void this.refreshSession().catch(() => {});
    this.view.history.push({
      multiplier: s.multiplier,
      kind: this.practiceRound ? 'even' : resultKind(r.betMinor, s.status === 'lost' ? 0 : s.payoutMinor),
    });
    if (s.status === 'won') {
      this.phase = 'won';
      // Practice is decided before resultKind, not after: resultKind(0, 0) is 'even', which would tell
      // the player they broke even on a bet they never placed (practice-rounds D3).
      const kind = this.practiceRound ? ('even' as const) : resultKind(r.betMinor, s.payoutMinor);
      this.lastResultKind = kind;
      this.lastCelebrated = !this.practiceRound && kind === 'win';
      const big = !this.practiceRound && kind === 'win' && s.multiplier >= 10;
      const netMinor = Math.abs(s.payoutMinor - r.betMinor);
      this.view.showWin(
        formatMultiplier(s.multiplier),
        this.money(this.practiceRound ? '' : formatMoney(s.payoutMinor, this.currency())),
        big,
        kind,
        this.money(this.practiceRound ? '' : formatMoney(netMinor, this.currency())),
      );
      // Nothing was staked, so nothing was won: a practice round gets the neutral chime either way.
      this.audio?.playSfx(!this.practiceRound && kind === 'win' ? (big ? 'bigwin' : 'win') : 'return');
    } else {
      this.lastResultKind = 'loss';
      this.lastCelebrated = false;
      this.phase = 'lost';
      this.view.showCrash(formatMultiplier(s.multiplier), this.money(this.practiceRound ? '' : `-${formatMoney(r.betMinor, this.currency())}`), s.crashTime === 0);
      this.audio?.playSfx('crash');
    }
    this.renderBetUi();
    // A pause or close asked for mid-round applies now that the round has settled.
    if (this.closed) this.showClosed();
    else if (this.paused) this.hooks.onPause?.();
  }

  // ---------- per frame ----------

  private tick() {
    this.checkIdle();
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
    if (r.deferred) this.view.setRevealOdds?.(formatRevealChance(this.config.rtp, m));
    const level = intensity10(t, this.config);
    // A practice round is fed no money at all rather than being trusted to hide it: a display that
    // receives nothing cannot leak anything (practice-rounds D5).
    this.view.frame(
      formatMultiplier(m),
      this.money(this.practiceRound ? '' : formatMoney(optimisticPayout(r.betMinor, m, this.config), this.currency())),
      level,
      intensityName(level),
      pace(t, this.config),
      this.practiceRound ? false : optimisticPayout(r.betMinor, m, this.config) < r.betMinor,
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
    // Versioned, origin-pinned operator bridge. Never posts to '*' (own hard rule 7, GLI-19 §3).
    this.bridge?.balance(this.balanceMinor, this.currency().code);
  }

  /** Session clock and net position for the HUD (UK RTS 7/8, AGCO 2.07-2.10). */
  private renderSessionHud() {
    const s = this.session;
    if (!s) return;
    const p = s.profile;
    this.view.setSessionHud({
      showClock: p.showSessionClock,
      showNet: p.showNetPosition,
      startedAt: s.sessionStartedAt,
      netMinor: s.returnedMinor - s.stakedMinor,
      currency: this.currency(),
    });
  }

  /** Shows the operator's reality-check pause, after the current round if one is running. */
  private applyPause(message?: string) {
    this.paused = true;
    this.renderBetUi();
    if (this.phase === 'running' || this.phase === 'cashing') return;
    this.hooks.onPause?.(message);
  }

  private showClosed() {
    this.hooks.onClosed?.();
  }

  /** Session net position, used for the operator's loss limit. */
  private sessionNetMinor(): number {
    const s = this.session;
    return s ? s.returnedMinor - s.stakedMinor : 0;
  }

  /** Records a money string on its way to the view, so a check can see what the player was shown. */
  private money(value: string): string {
    if (value) this.moneyShown.push(value);
    return value;
  }

  private betBlockReason(practice = false): string | null {
    if (!this.session) return t('bet.loading');
    if (this.closed) return t('bet.gameClosed');
    if (this.paused || this.idlePromptOpen) return t('bet.paused');
    // A practice round stakes nothing, so no stake, loss or balance limit can apply to it. The gates
    // above still do: a paused or closed game is paused and closed for practice too.
    if (practice) return null;
    if (this.stakeLimitMinor !== null && this.betMinor > this.stakeLimitMinor) return t('bet.stakeLimit');
    // The loss limit counts this session's net, so a bet that could pass it is refused before the debit.
    if (this.lossLimitMinor !== null && -this.sessionNetMinor() + this.betMinor > this.lossLimitMinor) {
      this.bridge?.error('loss_limit', 'Session loss limit reached');
      return t('bet.lossLimit');
    }
    if (this.betMinor > this.balanceMinor) return t('bet.insufficient');
    return null;
  }

  private renderBetUi() {
    if (!this.session) return;
    // Mirror the market's minimum gap locally so the button shows the wait before the server refuses.
    const minCycleMs = this.session.profile?.minCycleMs ?? 0;
    const since = performance.now() - this.lastStartAt;
    if (minCycleMs > 0 && this.lastStartAt > 0 && since < minCycleMs) this.view.setBetCountdown(minCycleMs - since);
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
