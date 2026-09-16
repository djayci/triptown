// Fence Run round flow on StepRoundService (design D1, D8). The server decides every fence; the client
// plays the same jump until the answer arrives, then shows it.
import { prefersReducedMotion, type AudioManager, type GameApp } from '@triptown/engine';
import { StepServiceError, type StepActionResult, type StepRoundService, type StepRoundSnapshot, type StepSessionInfo } from '@triptown/rgs-client/steps';
import { t } from '../i18n/en';
import { ChaseScene, FENCE_SPACING, fencePosition, standPosition } from '../scene/chase-scene';
import type { HorsePose } from '../scene/horse';
import { RulesDialog } from '../ui/rules-dialog';
import { Hud, type Difficulty, type LadderChip } from '../ui/hud';
import { ActionGate } from './action-gate';
import { JumpSequence } from './jump-sequence';

const STAKES_MAJOR = [1, 2, 5, 10, 20, 50, 100];
const RESULT_MS = 2600;
const SYMBOLS: Record<string, string> = { NGN: '₦', GHS: 'GH₵', USD: '$', EUR: '€', GBP: '£' };

type Phase = 'loading' | 'betting' | 'starting' | 'waiting' | 'jumping' | 'collecting' | 'result';

interface CheckLog {
  frames: { t: number; phase: string; offset: number; lift: number; tilt: number }[];
  effects: { t: number; kind: string }[];
}

export class GameController {
  private readonly scene = new ChaseScene();
  private readonly hud: Hud;
  private readonly rules: RulesDialog;
  private readonly gate = new ActionGate();
  private readonly seq = new JumpSequence();
  private readonly status: HTMLDivElement;
  private session: StepSessionInfo | null = null;
  private phase: Phase = 'loading';
  private round: StepRoundSnapshot | null = null;
  private difficulty: Difficulty = 'medium';
  private stakeIndex = 2;
  /** Fence being jumped (1-based) while a sequence plays. */
  private jumpFence = 1;
  /** Result waiting for the sequence to finish playing. */
  private pending: StepActionResult | null = null;
  private resultApplied = false;
  private course = 0;
  private resultAt = 0;
  private nextStartAt = 0;
  private roundNo = 0;
  private refusedFence: number | null = null;
  private finishRun: { from: number; startedAt: number } | null = null;
  private punch = 0;
  readonly check: CheckLog | null;

  constructor(
    private readonly game: GameApp,
    private readonly service: StepRoundService,
    demo: boolean,
    private readonly audio: AudioManager | null = null,
  ) {
    this.check = new URLSearchParams(location.search).has('check') ? { frames: [], effects: [] } : null;
    this.hud = new Hud(
      {
        onRules: () => this.openRules(),
        onStake: (d) => this.changeStake(d),
        onDifficulty: (d) => this.setDifficulty(d),
        onBet: () => void this.bet(),
        onJump: () => void this.jump(),
        onCollect: () => void this.collect(),
      },
      demo,
    );
    this.rules = new RulesDialog();
    this.status = document.createElement('div');
    this.status.setAttribute('aria-live', 'polite');
    this.status.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
    document.body.appendChild(this.status);
    game.app.stage.addChild(this.scene.view, this.hud.view);
    game.onResize((v) => {
      this.scene.layout(v.width, v.height);
      this.hud.layout(v.width, v.height);
    });
    game.app.ticker.add((ticker) => this.frame(ticker.deltaMS / 1000));
  }

  get currentPhase() {
    return this.phase;
  }

  async init() {
    await this.refreshSession();
    const active = await this.service.activeStepRound();
    if (active) {
      this.round = active;
      this.difficulty = active.difficulty;
      this.course = standPosition(active.cleared + 1);
      this.phase = 'waiting';
    } else {
      this.phase = 'betting';
    }
    this.render();
  }

  async refreshSession() {
    this.session = await this.service.getSession();
  }

  openRules() {
    if (!this.session) return;
    this.rules.open({ configs: this.session.configs, abandonAfterMs: this.session.abandonAfterMs, minCycleMs: this.session.profile.minCycleMs });
  }

  // ---------- input ----------

  private changeStake(delta: -1 | 1) {
    if (this.phase !== 'betting') return;
    this.stakeIndex = Math.max(0, Math.min(STAKES_MAJOR.length - 1, this.stakeIndex + delta));
    this.render();
  }

  private setDifficulty(d: Difficulty) {
    if (this.phase !== 'betting') return;
    this.difficulty = d;
    this.render();
  }

  async bet() {
    if (this.phase !== 'betting' || Date.now() < this.nextStartAt) return;
    this.audio?.unlock();
    await this.gate.run(async () => {
      this.phase = 'starting';
      this.render();
      try {
        const res = await this.service.startStepRound({ stakeMinor: this.stakeMinor, difficulty: this.difficulty });
        this.round = res.round;
        this.roundNo += 1;
        this.nextStartAt = Date.now() + (this.session?.profile.minCycleMs ?? 0);
        this.course = standPosition(1);
        this.refusedFence = null;
        this.finishRun = null;
        this.phase = 'waiting';
        this.hud.setBanner(null);
        this.audio?.playSfx('bet');
        this.audio?.stopLobby(200);
        this.audio?.startMusic();
        this.audio?.setIntensity(0);
        void this.refreshSession().then(() => this.render());
      } catch (err) {
        const retry = err instanceof StepServiceError ? err.details?.retryAfterMs : undefined;
        if (typeof retry === 'number') this.nextStartAt = Date.now() + retry;
        this.phase = 'betting';
      }
      this.render();
    });
  }

  async jump() {
    const r = this.round;
    if (this.phase !== 'waiting' || !r) return;
    await this.gate.run(async () => {
      this.jumpFence = r.cleared + 1;
      this.pending = null;
      this.resultApplied = false;
      this.seq.start(performance.now());
      // The same take-off sound for every jump: the result is not known yet.
      this.audio?.playSfx('jump');
      this.phase = 'jumping';
      this.render();
      try {
        const res = await this.service.jump(r.id);
        this.pending = res;
        const result = res.action?.result === 'refused' ? 'refused' : res.round.status === 'finished' ? 'finished' : 'cleared';
        this.seq.resolve(result, performance.now());
        this.effect(`response:${result}`);
      } catch (err) {
        this.recover(err);
      }
    });
  }

  async collect() {
    const r = this.round;
    if (this.phase !== 'waiting' || !r || r.cleared === 0) return;
    await this.gate.run(async () => {
      this.phase = 'collecting';
      this.render();
      try {
        const res = await this.service.collect(r.id);
        this.round = res.round;
        this.showSettlement(res.round);
      } catch (err) {
        this.recover(err);
      }
    });
  }

  private recover(err: unknown) {
    // A round settled elsewhere (abandoned, or another tab) comes back with the error; show its result.
    const round = err instanceof StepServiceError ? (err.details?.round as StepRoundSnapshot | undefined) : undefined;
    this.seq.reset();
    if (round) {
      this.round = round;
      this.showSettlement(round);
      return;
    }
    this.phase = this.round?.status === 'running' ? 'waiting' : 'betting';
    this.render();
  }

  // ---------- results ----------

  private showSettlement(round: StepRoundSnapshot) {
    const s = round.settlement;
    if (!s) return;
    const reduced = prefersReducedMotion();
    const net = this.money(s.netMinor, true);
    if (s.status === 'lost') {
      this.hud.setBanner({ title: t('refused'), sub: t('refusedSub', { fence: s.cleared + 1, stake: this.money(round.stakeMinor), net }), win: false });
      this.effect('refused');
    } else if (s.status === 'void') {
      this.hud.setBanner({ title: t('returned', { amount: this.money(s.payoutMinor) }), sub: t('returnedSub'), win: false });
    } else {
      const win = s.payoutMinor > round.stakeMinor;
      const title = s.status === 'finished' ? t('finishWin', { amount: this.money(s.payoutMinor) }) : win ? t('win', { amount: this.money(s.payoutMinor) }) : t('returned', { amount: this.money(s.payoutMinor) });
      const sub = s.status === 'finished' ? t('finishSub', { value: (s.multiplier ?? 0).toFixed(2), net }) : t('winSub', { fence: s.cleared, net });
      this.hud.setBanner({ title, sub, win });
      // Win effects only when the return beats the stake (AGENTS compliance rule 1).
      if (win) {
        this.scene.winFlash(reduced);
        this.effect('win_flash');
        this.audio?.playSfx(s.status === 'finished' ? 'finish' : 'win');
      } else {
        this.audio?.playSfx('collect');
      }
    }
    this.phase = 'result';
    this.resultAt = Date.now();
    this.audio?.stopMusic(400);
    setTimeout(() => this.audio?.startLobby(), 900);
    void this.refreshSession().then(() => this.render());
    this.render();
  }

  private effect(kind: string) {
    this.check?.effects.push({ t: performance.now(), kind });
  }

  // ---------- frame ----------

  private frame(dt: number) {
    const now = performance.now();
    const reduced = prefersReducedMotion();
    let speed = this.phase === 'betting' || this.phase === 'starting' ? 40 : 0;
    let lift = 0;
    let tilt = 0;
    let pose: HorsePose = 'upright';

    if (this.phase === 'jumping') {
      const f = this.seq.frame(now);
      this.check?.frames.push({ t: now, phase: f.phase, offset: Math.round(f.offset * 100) / 100, lift: Math.round(f.lift * 100) / 100, tilt: Math.round(f.tilt * 1000) / 1000 });
      this.course = standPosition(this.jumpFence) + f.offset;
      speed = f.speed;
      lift = f.lift;
      tilt = f.tilt;
      pose = f.phase === 'refuse' ? 'easing' : 'running';
      if (f.phase === 'refuse' && this.refusedFence === null) {
        this.refusedFence = this.jumpFence;
        this.scene.refused();
        this.audio?.playSfx('refuse');
      }
      if (f.done && this.pending && !this.resultApplied) this.applyJumpResult(this.pending);
    } else if (this.finishRun) {
      const u = Math.min(1, (now - this.finishRun.startedAt) / 800);
      const target = fencePosition(this.round?.fences ?? 10) + FENCE_SPACING * 0.6 + 40;
      this.course = this.finishRun.from + (target - this.finishRun.from) * u;
      speed = u < 1 ? 380 : 60;
      pose = 'running';
      if (u >= 1 && this.phase !== 'result' && this.round) {
        this.finishRun = { ...this.finishRun, startedAt: -Infinity };
        this.showSettlement(this.round);
      }
    } else if (this.phase === 'result' && this.round?.status !== 'lost') {
      speed = 50;
      this.course += 50 * dt;
    }

    if (this.phase === 'result' && Date.now() >= Math.max(this.resultAt + RESULT_MS, this.nextStartAt - 1500)) {
      this.phase = 'betting';
      this.round = null;
      this.course = 0;
      this.refusedFence = null;
      this.finishRun = null;
      this.hud.setBanner(null);
    }

    this.punch = Math.max(0, this.punch - dt * 2.5);
    this.scene.update(dt, {
      course: this.course,
      lift,
      tilt,
      speed,
      pose,
      paytable: this.round?.paytable ?? this.session?.configs.find((c) => c.difficulty === this.difficulty)?.paytable ?? [],
      cleared: this.round?.cleared ?? 0,
      refusedFence: this.refusedFence,
      reducedMotion: reduced,
    });
    this.render();
  }

  private applyJumpResult(res: StepActionResult) {
    this.resultApplied = true;
    this.round = res.round;
    this.seq.reset();
    if (res.action?.result === 'refused') {
      this.showSettlement(res.round);
      return;
    }
    this.scene.landed(prefersReducedMotion());
    this.audio?.playSfx('land');
    // Music builds only with the value reached (fences cleared), never with anything about the next fence.
    this.audio?.setIntensity(res.round.cleared >= 6 ? 2 : res.round.cleared >= 2 ? 1 : 0);
    this.punch = 1;
    this.effect('landed');
    this.course = standPosition(this.jumpFence + 1);
    if (res.round.status === 'finished') {
      this.finishRun = { from: this.course, startedAt: performance.now() };
      this.phase = 'collecting';
    } else {
      this.phase = 'waiting';
    }
  }

  // ---------- view ----------

  private get currencyCode() {
    return this.session?.currency.code ?? 'USD';
  }

  private money(minor: number, signed = false): string {
    const decimals = this.session?.currency.decimals ?? 2;
    const abs = Math.abs(minor) / 10 ** decimals;
    const body = abs.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const sign = signed ? (minor > 0 ? '+' : minor < 0 ? '−' : '') : minor < 0 ? '−' : '';
    return `${sign}${SYMBOLS[this.currencyCode] ?? `${this.currencyCode} `}${body}`;
  }

  private get stakeMinor() {
    const c = this.session?.currency;
    const raw = (STAKES_MAJOR[this.stakeIndex] ?? 1) * 10 ** (c?.decimals ?? 2);
    return c ? Math.min(c.maxBetMinor, Math.max(c.minBetMinor, raw)) : raw;
  }

  private render() {
    const s = this.session;
    if (s) {
      const secs = Math.floor((Date.now() - s.sessionStartedAt) / 1000);
      const clock = [Math.floor(secs / 3600), Math.floor(secs / 60) % 60, secs % 60].map((n) => String(n).padStart(2, '0')).join(':');
      this.hud.setSession(clock, this.money(s.returnedMinor - s.stakedMinor, true));
    }
    const r = this.round;
    const paytable = r?.paytable ?? s?.configs.find((c) => c.difficulty === this.difficulty)?.paytable ?? [];
    const cleared = r?.cleared ?? 0;
    const current = cleared > 0 ? paytable[cleared - 1]! : 1;
    const next = paytable[cleared];
    this.hud.setMultiplier(current.toFixed(2), !r, this.punch);
    const inRound = !!r && this.phase !== 'betting';
    this.hud.setChyron(
      `${t('title').toUpperCase()} · ${t('roundLabel', { n: this.roundNo + (inRound ? 0 : 1) })}${inRound && next ? ` · ${t('nextValue', { value: next.toFixed(2) })}` : ''}`,
    );
    const waitMs = this.nextStartAt - Date.now();
    const ladder: LadderChip[] = [];
    const start = Math.max(0, Math.min(paytable.length - 5, cleared - 1));
    for (let i = start; i < Math.min(paytable.length, start + 5); i++) {
      ladder.push({ label: i === paytable.length - 1 ? t('finish') : `F${i + 1}`, value: `x${paytable[i]!.toFixed(2)}`, state: i < cleared ? 'done' : i === cleared ? 'next' : 'todo' });
    }
    const deciding = this.phase === 'waiting';
    this.hud.setPanel({
      mode: inRound ? 'round' : 'betting',
      stake: this.money(this.stakeMinor),
      difficulty: this.difficulty,
      betTop: t('bet', { stake: this.money(this.stakeMinor) }),
      betSub: waitMs > 0 ? t('nextRoundIn', { seconds: Math.ceil(waitMs / 1000) }) : '',
      betEnabled: this.phase === 'betting' && waitMs <= 0,
      jumpTop: next === undefined ? t('finish') : t('jump'),
      jumpSub: next === undefined ? '' : t('jumpTo', { value: next.toFixed(2) }),
      jumpEnabled: deciding && !this.gate.inFlight,
      collectSub: r && cleared > 0 ? this.money(Math.floor(r.stakeMinor * current + 0.5)) : '—',
      collectEnabled: deciding && cleared > 0 && !this.gate.inFlight,
      ladder,
      statusLeft: inRound ? (cleared >= paytable.length ? t('finish') : t('fenceOf', { n: cleared + 1, total: paytable.length })) : t('readyLabel', { total: paytable.length, difficulty: t(this.difficulty).toUpperCase() }),
      statusRight: `${t('stake')} ${this.money(r?.stakeMinor ?? this.stakeMinor)}`,
    });
    const statusText = !inRound ? t('statusBetting') : this.phase === 'jumping' ? t('statusJumping', { n: this.jumpFence }) : next ? t('statusWaiting', { n: cleared + 1, value: next.toFixed(2) }) : '';
    if (this.status.textContent !== statusText) this.status.textContent = statusText;
  }
}
