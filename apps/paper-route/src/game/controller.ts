import { multiplierAt, resultKind, type JurisdictionProfile, type RoundEvent, type SessionInfo, type TerminalEvent, type ThrowOutcome } from '@triptown/core';
import type { GameConfig } from '@triptown/fairness';
import { OperatorBridge, type BridgeWindow } from '@triptown/engine/bridge';
import { newThrowId, RoundServiceError, type RoundHandle, type RoundService } from '@triptown/rgs-client';
import * as THREE from 'three';
import type { Hud, HudPaper, HudState } from '../hud/hud';
import { CRATE_OFFSET, type Courier } from '../scene/courier';
import type { Fx } from '../scene/fx';
import { QualityGovernor } from '../scene/quality';
import type { Street } from '../scene/street';
import type { World } from '../scene/world';
import { allowsWinPresentation, liveLabel, ridingSpeed, shownMinor } from './display';
import { InputArm, nextAutoCashout } from './input';

// Round state machine for Paper Route: betting → riding → result → betting.
// Every outcome shown comes from server events or throw results; the client never predicts a setback or crash.

export interface Sounds {
  play(name: 'bet' | 'throw' | 'land' | 'win' | 'return' | 'wipeout' | 'splash' | 'tick'): void;
  /** Riding loop: starts with the round, follows the multiplier (when allowed), stops at the end. */
  startRide?(): void;
  rideMultiplier?(multiplier: number): void;
  stopRide?(): void;
}

export interface Notice {
  title: string;
  text: string;
  /** `continue` dismisses; `exit` closes the game. Absent while the operator holds the pause. */
  actions: ('continue' | 'exit')[];
}

export interface ControllerDeps {
  service: RoundService;
  world: World;
  street: Street;
  courier: Courier;
  fx: Fx;
  hud: Hud;
  sounds?: Sounds;
  /** Test hook: a fake window for the operator bridge. */
  bridgeWindow?: BridgeWindow;
  /** Client build id reported to the operator. */
  version?: string;
  reducedMotion: boolean;
  isTouch: boolean;
  demo: boolean;
}

type Phase = 'betting' | 'riding' | 'result';

interface PaperView {
  state: HudPaper['state'];
  throwId?: string;
  multiplier?: number;
  exactMinor?: number;
}

interface ActiveRound {
  id: string;
  handle: RoundHandle | null;
  startedAt: number;
  clockOffset: number;
  stakeMinor: number;
  paperMinor: number;
  setbacks: number[];
  papers: PaperView[];
  previousMultiplier: number | null;
  markerUntil: number;
  ended: boolean;
}

const STAKE_STEPS_PAPERS = [1, 2, 5, 10, 25, 50, 100, 250, 500];

export class Controller {
  private phase: Phase = 'betting';
  private session!: SessionInfo;
  private profile!: JurisdictionProfile;
  private config!: GameConfig;
  private round: ActiveRound | null = null;
  private stakeIndex = 2;
  private autoCashout: number | null = null;
  private lastStartAt = 0;
  private distance = 0;
  private lastFrame = 0;
  private sessionStartedAt = Date.now();
  private result: HudState['result'] = null;
  private resultPapers: PaperView[] = [];
  private blockedReason: string | null = null;
  /** Stream state; the HUD shows a notice while reconnecting. */
  connection: 'online' | 'reconnecting' = 'online';
  private bridge: OperatorBridge | null = null;
  /** Operator reality check: blocks new bets (never a running round) until the operator resumes. */
  private operatorPaused: { message?: string } | null = null;
  private closed = false;
  private limits: { stakeLimitMinor?: number; lossLimitMinor?: number } = {};
  private operatorMessage: string | null = null;
  private idleSince = Date.now();
  private idlePrompt = false;
  /** Player's "Reduce effects" choice, on top of the system reduced-motion setting. */
  private reduceEffects = false;
  private readonly betArm = new InputArm();
  private readonly throwArm = new InputArm();
  /** Exposed for the automated performance check; never used by gameplay. */
  readonly governor: QualityGovernor;
  /** Frames rendered while riding, for automated checks. */
  readonly stats = { frames: 0, multiplierUpdates: 0, lastMultiplier: 0, speeds: [] as number[] };

  constructor(private readonly d: ControllerDeps) {
    this.governor = new QualityGovernor(d.isTouch ? 'medium' : 'high', (tier) => {
      d.world.setTier(tier);
      d.street.setNearSideDetail(d.world.settings.nearSideDetail);
    });
  }

  async start(): Promise<void> {
    this.session = await this.d.service.getSession();
    this.profile = this.session.profile;
    this.config = this.session.config;
    this.sessionStartedAt = this.session.sessionStartedAt;
    this.d.fx.setOptions({ reducedMotion: this.motionReduced });
    this.d.world.setDepthEffects(!this.motionReduced);
    this.d.street.setNearSideDetail(this.d.world.settings.nearSideDetail);
    this.connectBridge();
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Connects the operator bridge for this session's profile and reports the game ready. */
  connectBridge(): void {
    this.bridge = new OperatorBridge({
      allowedOrigins: this.profile.operatorOrigins,
      ...(this.d.bridgeWindow && { win: this.d.bridgeWindow }),
      handlers: {
        pause: (p) => (this.operatorPaused = p),
        resume: () => (this.operatorPaused = null),
        closeGame: () => (this.closed = true),
        setLimits: (l) => (this.limits = { ...this.limits, ...l }),
        showMessage: (m) => (this.operatorMessage = m.text),
      },
    });
    this.bridge.gameReady(this.d.version ?? 'dev', this.config.id, this.profile.name);
    this.bridge.balance(this.session.balanceMinor, this.session.currency.code);
  }

  // ---------- intents ----------

  private get papersPerRound(): number {
    return this.profile.partialCashout === 'papers' ? this.config.papers : 1;
  }

  private get stakeMinor(): number {
    const min = this.session.currency.minBetMinor;
    const step = STAKE_STEPS_PAPERS[this.stakeIndex] ?? 5;
    return this.papersPerRound > 1 ? step * min * this.papersPerRound : step * min;
  }

  changeBet(direction: -1 | 1): void {
    if (this.phase !== 'betting') return;
    this.stakeIndex = Math.min(STAKE_STEPS_PAPERS.length - 1, Math.max(0, this.stakeIndex + direction));
    this.d.sounds?.play('tick');
  }

  changeAutoCashout(direction: -1 | 1): void {
    if (this.phase !== 'betting') return;
    this.autoCashout = nextAutoCashout(this.autoCashout, direction, this.profile.minCashout);
    this.d.sounds?.play('tick');
  }

  /** BET from a pointer or key press; `fresh` is false for held keys (never starts a round). */
  async bet(fresh = true): Promise<void> {
    if (!fresh || this.phase !== 'betting' || this.cycleRemainingMs() > 0) return;
    this.idleSince = Date.now();
    if (this.closed || this.operatorPaused || this.idlePrompt || this.operatorMessage) return;
    const stake = this.stakeMinor;
    if (stake > this.session.balanceMinor) {
      this.blockedReason = 'Insufficient balance for this stake';
      this.bridge?.error('insufficient_funds');
      return;
    }
    if (this.limits.stakeLimitMinor !== undefined && stake > this.limits.stakeLimitMinor) {
      this.blockedReason = 'This stake is above your stake limit';
      this.bridge?.error('stake_limit');
      return;
    }
    const sessionNet = this.session.returnedMinor - this.session.stakedMinor;
    if (this.limits.lossLimitMinor !== undefined && -(sessionNet - stake) > this.limits.lossLimitMinor) {
      this.blockedReason = 'This stake would take you past your loss limit';
      this.bridge?.error('loss_limit');
      return;
    }
    this.blockedReason = null;
    this.d.sounds?.play('bet');
    try {
      const handle = await this.d.service.startRound({ betMinor: stake, autoCashout: this.autoCashout }, (e) => this.onEvent(e));
      this.follow(handle);
    } catch (err) {
      this.blockedReason = err instanceof RoundServiceError ? err.message : 'Could not start the round';
      if (err instanceof RoundServiceError && err.code === 'cycle_too_soon') this.lastStartAt = Date.now();
      this.bridge?.error(err instanceof RoundServiceError ? err.code : 'unknown');
      return;
    }
  }

  /** Follows a round's stream; if it drops before the round ends, reconnects and restores from the server. */
  private follow(handle: RoundHandle): void {
    if (this.round && this.round.id === handle.roundId) this.round.handle = handle;
    void handle.ended.then((terminal) => {
      if (terminal) this.onTerminal(terminal);
      else void this.reconnect(handle.roundId);
    });
  }

  /** Re-attaches after a drop, with backoff. The server replays START, past setbacks, throws and the result. */
  private async reconnect(roundId: string): Promise<void> {
    this.connection = 'reconnecting';
    for (let attempt = 0; this.round?.id === roundId && !this.round.ended; attempt++) {
      try {
        const handle = await this.d.service.watchRound(roundId, (e) => this.onEvent(e));
        this.connection = 'online';
        this.follow(handle);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** attempt)));
      }
    }
    this.connection = 'online';
  }

  /** Simulates a dropped connection (dev tooling and automated checks). */
  dropConnection(): void {
    this.round?.handle?.close();
  }

  throwOne(): void {
    this.throwPapers(1);
  }

  throwAll(): void {
    this.throwPapers('all');
  }

  get effectsReduced(): boolean {
    return this.reduceEffects;
  }

  setReduceEffects(on: boolean): void {
    this.reduceEffects = on;
    this.d.fx.setOptions({ reducedMotion: this.motionReduced });
    this.d.world.setDepthEffects(!this.motionReduced);
  }

  private get motionReduced(): boolean {
    return this.d.reducedMotion || this.reduceEffects || !this.profile.intensityEffects;
  }

  /** Dismisses an operator message or the idle prompt. An operator pause can only be lifted by the operator. */
  dismissNotice(): void {
    this.operatorMessage = null;
    this.idlePrompt = false;
    this.idleSince = Date.now();
  }

  /** Player exit: closes the game once the round (if any) has settled. */
  exit(): void {
    this.closed = true;
    this.idlePrompt = false;
    if (this.phase === 'result') this.continue();
  }

  continue(): void {
    if (this.phase !== 'result') return;
    this.idleSince = Date.now();
    this.phase = 'betting';
    this.result = null;
    this.d.courier.setPose('ride');
    this.d.courier.setRolls(this.papersPerRound);
  }

  // ---------- throws ----------

  private throwPapers(count: 1 | 'all'): void {
    const r = this.round;
    if (!r || this.phase !== 'riding' || r.ended) return;
    const riding = r.papers.filter((p) => p.state === 'riding');
    if (riding.length === 0) return;
    // Reserve papers locally so rapid taps never send more throws than papers left.
    const reserved = count === 'all' ? riding : [riding[0]!];
    const throwId = newThrowId();
    for (const p of reserved) {
      p.state = 'pending';
      p.throwId = throwId;
    }
    this.d.sounds?.play('throw');
    const from = this.d.courier.group.position.clone().add(CRATE_OFFSET);
    const porch = this.d.street.porchAlongside(this.distance) ?? new THREE.Vector3(7.6, 0.45, -2.2);
    this.d.fx.throwPaper(from, porch, () => this.d.sounds?.play('land'));
    this.d.courier.setRolls(r.papers.filter((p) => p.state === 'riding').length);
    this.d.service
      .throwPapers(r.id, { count, throwId }, { clientTapAt: Date.now() + r.clockOffset })
      .then((out) => this.onThrowResult(r, throwId, out))
      .catch((err: unknown) => {
        // Refused (e.g. below the minimum cash-out): the papers go back into the bag.
        for (const p of r.papers) if (p.throwId === throwId && p.state === 'pending') p.state = 'riding';
        delete reserved[0]?.throwId;
        if (err instanceof RoundServiceError && err.code !== 'below_min_cashout') console.warn('[throw]', err.code);
        this.d.courier.setRolls(r.papers.filter((p) => p.state === 'riding').length);
      });
  }

  private onThrowResult(r: ActiveRound, throwId: string, out: ThrowOutcome): void {
    const pending = r.papers.filter((p) => p.throwId === throwId && p.state === 'pending');
    if ((out.result === 'thrown' || out.result === 'cashed_out' || out.result === 'duplicate') && out.throw) {
      const each = out.throw.exactMinor / out.throw.papers;
      for (const p of pending) Object.assign(p, { state: 'thrown', multiplier: out.throw.multiplier, exactMinor: each });
    } else if (out.result === 'crashed' || out.result === 'already_settled') {
      for (const p of pending) p.state = 'riding';
    }
    this.session.balanceMinor = out.balanceMinor;
    this.bridge?.balance(out.balanceMinor, this.session.currency.code);
  }

  // ---------- server events ----------

  private onEvent(e: RoundEvent): void {
    if (e.type === 'START') {
      if (this.round?.id === e.roundId) {
        // Replayed on reconnect: keep what we know, only refresh the clock offset.
        this.round.clockOffset = e.serverNow - Date.now();
        return;
      }
      const papers = e.papers ?? 1;
      this.round = {
        id: e.roundId,
        handle: null,
        startedAt: e.startedAt,
        clockOffset: e.serverNow - Date.now(),
        stakeMinor: e.betMinor,
        paperMinor: e.paperMinor ?? e.betMinor,
        setbacks: [],
        papers: Array.from({ length: papers }, () => ({ state: 'riding' as const })),
        previousMultiplier: null,
        markerUntil: 0,
        ended: false,
      };
      this.lastStartAt = Date.now();
      this.phase = 'riding';
      this.session.balanceMinor -= e.betMinor;
      this.session.stakedMinor += e.betMinor;
      this.d.courier.setPose('ride');
      this.d.courier.setRolls(papers);
      this.d.sounds?.startRide?.();
      this.bridge?.roundStarted(e.roundId, e.betMinor);
      this.bridge?.balance(this.session.balanceMinor, this.session.currency.code);
      return;
    }
    const r = this.round;
    if (!r || r.id !== e.roundId) return;
    if (e.type === 'BAD_MOLE') {
      if (r.setbacks.includes(e.time)) return;
      r.previousMultiplier = this.multiplierFor(r, e.time - 1e-6);
      r.setbacks.push(e.time);
      r.markerUntil = performance.now() + 1500;
      this.d.fx.splash(this.d.courier.group.position.clone().add(new THREE.Vector3(0, 0, 0.6)));
      if (!this.motionReduced) this.d.courier.wobble();
      this.d.sounds?.play('splash');
      return;
    }
    if (e.type === 'THROWN') {
      // Reconcile throws made from another tab or before a reconnect; ours are already marked.
      if (r.papers.some((p) => p.throwId === e.throwId && p.state === 'thrown')) return;
      const target = r.papers.filter((p) => p.state === 'riding' || (p.state === 'pending' && p.throwId === e.throwId)).slice(0, e.papers);
      for (const p of target) Object.assign(p, { state: 'thrown', throwId: e.throwId, multiplier: e.multiplier, exactMinor: e.exactMinor / e.papers });
      this.d.courier.setRolls(r.papers.filter((p) => p.state === 'riding').length);
      return;
    }
    if (e.type === 'CASHED_OUT' || e.type === 'CRASH' || e.type === 'VOID') this.onTerminal(e);
  }

  private onTerminal(e: TerminalEvent): void {
    const r = this.round;
    if (!r || r.id !== e.roundId || r.ended) return;
    r.ended = true;
    const returnMinor = e.type === 'VOID' ? e.refundMinor : e.type === 'CASHED_OUT' ? e.payoutMinor : (e.returnMinor ?? 0);
    this.session.balanceMinor = e.balanceMinor;
    // Win or loss copy comes from return against stake, never from the round status (compliance rule 1).
    const win = e.type !== 'VOID' && resultKind(r.stakeMinor, returnMinor) === 'win' && allowsWinPresentation(r.stakeMinor, returnMinor);
    for (const p of r.papers) if (p.state !== 'thrown') p.state = e.type === 'CASHED_OUT' ? 'thrown' : 'lost';
    if (e.type === 'CASHED_OUT') {
      // Automatic settlement of the remaining papers (auto target, cap, duration, disconnect).
      for (const p of r.papers) if (p.multiplier === undefined) Object.assign(p, { multiplier: e.multiplier, exactMinor: r.paperMinor * e.multiplier });
    }
    const thrown = r.papers.filter((p) => p.state === 'thrown').length;
    const lost = r.papers.length - thrown;
    const all = r.papers.length;
    const note =
      e.type === 'VOID'
        ? 'The round was voided and your stake refunded'
        : e.type === 'CRASH' && e.crashTime === 0
          ? 'Instant wipeout · the round ended at x1.00'
          : all === 1
            ? e.type === 'CRASH' ? 'Wipeout' : 'Delivered'
            : thrown === 0
              ? `Wipeout · all ${all} papers lost`
              : `${thrown} ${thrown === 1 ? 'paper' : 'papers'} delivered${lost ? ` · ${lost} lost at wipeout` : ''}`;
    this.result = { win, returnedMinor: returnMinor, netMinor: returnMinor - r.stakeMinor, note };
    this.resultPapers = r.papers.map((p) => ({ ...p }));
    this.d.sounds?.stopRide?.();
    if (e.type === 'CRASH') {
      this.d.courier.setPose('fallen');
      this.d.sounds?.play('wipeout');
    }
    this.d.sounds?.play(win ? 'win' : 'return');
    this.bridge?.roundEnded(r.id, r.stakeMinor, returnMinor);
    this.bridge?.balance(e.balanceMinor, this.session.currency.code);
    this.session.returnedMinor += e.type === 'VOID' ? 0 : returnMinor;
    if (e.type === 'VOID') this.session.stakedMinor -= r.stakeMinor;
    this.phase = 'result';
  }

  // ---------- frame loop ----------

  private multiplierFor(r: ActiveRound, t: number): number {
    return Math.min(multiplierAt(Math.max(0, t), r.setbacks, this.config), this.config.maxWinMultiplier);
  }

  private elapsed(r: ActiveRound): number {
    return (Date.now() + r.clockOffset - r.startedAt) / 1000;
  }

  private cycleRemainingMs(): number {
    return Math.max(0, this.lastStartAt + this.profile.minCycleMs - Date.now());
  }

  private frame(now: number): void {
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 1 / 60;
    if (this.lastFrame) this.governor.frame(now, now - this.lastFrame);
    this.lastFrame = now;
    const r = this.round;
    let speed = 0;
    let multiplier = 1;
    if (r && this.phase === 'riding') {
      const t = this.elapsed(r);
      multiplier = this.multiplierFor(r, t);
      speed = ridingSpeed(t, this.config, this.profile.intensityEffects && !this.d.reducedMotion && !this.reduceEffects);
      this.d.sounds?.rideMultiplier?.(multiplier);
      this.stats.frames++;
      if (multiplier !== this.stats.lastMultiplier) this.stats.multiplierUpdates++;
      this.stats.lastMultiplier = multiplier;
      if (this.stats.frames % 30 === 0) this.stats.speeds.push(speed);
    } else if (this.phase === 'result' || this.phase === 'betting') {
      speed = this.phase === 'betting' ? 0 : this.d.courier.group.children[0]?.visible ? 6 : 0;
    }
    this.distance += speed * dt;
    this.d.street.update(this.distance, this.d.world.settings.drawDistance);
    this.d.courier.update(dt, speed);
    this.d.fx.update(dt, speed);
    const shake = this.d.fx.cameraShake(now / 1000);
    this.d.world.setShake(shake.x, shake.y);
    this.d.world.render();
    const idleMs = this.profile.idlePromptMs;
    if (idleMs !== null && this.phase === 'betting' && !this.idlePrompt && Date.now() - this.idleSince > idleMs) this.idlePrompt = true;
    this.d.hud.render(this.hudState(r, multiplier));
    requestAnimationFrame((t) => this.frame(t));
  }

  private hudState(r: ActiveRound | null, multiplier: number): HudState {
    const papers: PaperView[] =
      this.phase === 'result' ? this.resultPapers : r && this.phase === 'riding' ? r.papers : Array.from({ length: this.papersPerRound }, () => ({ state: 'riding' }));
    const paperMinor = r && this.phase !== 'betting' ? r.paperMinor : this.stakeMinor / this.papersPerRound;
    const banked = papers.reduce((n, p) => n + (p.state === 'thrown' ? (p.exactMinor ?? 0) : 0), 0);
    const ridingCount = papers.filter((p) => p.state === 'riding').length;
    const ridingExact = paperMinor * ridingCount * multiplier;
    const stake = r && this.phase !== 'betting' ? r.stakeMinor : this.stakeMinor;
    return {
      phase: this.phase,
      decimals: this.session.currency.decimals,
      balanceMinor: this.session.balanceMinor,
      profileName: this.profile.name,
      showSessionClock: this.profile.showSessionClock,
      showNetPosition: this.profile.showNetPosition,
      partialCashout: this.papersPerRound > 1,
      sessionSeconds: Math.max(0, (Date.now() - this.sessionStartedAt) / 1000),
      sessionNetMinor: this.session.returnedMinor - this.session.stakedMinor,
      betMinor: stake,
      paperMinor,
      papers: papers.map((p) => ({ state: p.state, multiplier: p.multiplier, returnMinor: p.exactMinor === undefined ? undefined : shownMinor(p.exactMinor) })),
      autoCashout: this.autoCashout,
      betBlockedReason: this.blockedReason ?? (this.stakeMinor > this.session.balanceMinor ? 'Insufficient balance for this stake' : null),
      cycleRemainingMs: this.cycleRemainingMs(),
      multiplier,
      previousMultiplier: r && performance.now() < r.markerUntil ? r.previousMultiplier : null,
      setbackMarker: Boolean(r && performance.now() < r.markerUntil),
      liveLabel: liveLabel(stake, banked, ridingExact),
      ridingMinor: shownMinor(ridingExact),
      // After settlement the panel shows the settled total, which includes the one half-up rounding.
      returnedSoFarMinor: this.phase === 'result' && this.result ? this.result.returnedMinor : shownMinor(banked),
      result: this.result,
      demo: this.d.demo,
      notice: this.notice(),
    };
  }

  /** What blocks play between rounds, most important first. Never shown over a running round. */
  notice(): Notice | null {
    if (this.phase === 'riding') return null;
    if (this.closed) return { title: 'Game closed', text: 'Your session has ended. You can close this window.', actions: [] };
    if (this.operatorPaused) return { title: 'Reality check', text: this.operatorPaused.message ?? 'Play is paused by the operator.', actions: [] };
    if (this.idlePrompt) return { title: 'Still there?', text: 'Choose Continue to keep playing, or Exit to leave.', actions: ['continue', 'exit'] };
    if (this.operatorMessage) return { title: 'Message', text: this.operatorMessage, actions: ['continue'] };
    return null;
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (!down) {
      this.betArm.release();
      this.throwArm.release();
      return;
    }
    if (this.phase === 'betting') {
      if (this.betArm.press(e.repeat)) void this.bet();
    } else if (this.phase === 'riding') {
      if (this.throwArm.press(e.repeat)) this.throwOne();
    }
  }
}
