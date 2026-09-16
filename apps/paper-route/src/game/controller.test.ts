import { profileFromTemplate, DEFAULT_CURRENCY, type RoundEvent, type SessionInfo, type StartEvent, type TerminalEvent } from '@triptown/core';
import { PAPER_ROUTE_CONFIG } from '@triptown/fairness';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BridgeWindow } from '@triptown/engine/bridge';
import type { HudState } from '../hud/hud';
import { Controller, type ControllerDeps, type Sounds } from './controller';

// Presentation rules on round end (paper-route-mvp 8.4 / 8.6), with fake scene, HUD and audio.

function makeController(profileName = 'regulated-uk', bridgeWindow?: BridgeWindow) {
  const played: string[] = [];
  const renders: HudState[] = [];
  const poses: string[] = [];
  const sounds: Sounds = { play: (n) => played.push(n) };
  const deps = {
    service: {} as ControllerDeps['service'],
    world: { settings: { drawDistance: 150, nearSideDetail: true }, setShake() {}, setDepthEffects() {}, render() {}, setTier() {}, camera: new THREE.OrthographicCamera() },
    street: { update() {}, setNearSideDetail() {}, porchAlongside: () => new THREE.Vector3(7.6, 0.45, -2) },
    courier: { group: new THREE.Group(), setPose: (p: string) => poses.push(p), setRolls() {}, update() {}, wobble() {} },
    fx: { setOptions() {}, throwPaper() {}, splash() {}, update() {}, cameraShake: () => new THREE.Vector3() },
    hud: { render: (s: HudState) => renders.push(s) },
    sounds,
    reducedMotion: false,
    isTouch: false,
    demo: true,
    bridgeWindow,
    version: 'test@1',
  } as unknown as ControllerDeps;
  const c = new Controller(deps) as unknown as {
    session: SessionInfo;
    profile: SessionInfo['profile'];
    config: SessionInfo['config'];
    onEvent(e: RoundEvent): void;
    result: HudState['result'];
    phase: string;
    hudState(r: unknown, m: number): HudState;
    round: unknown;
    connectBridge(): void;
    bet(): Promise<void>;
    continue(): void;
    dismissNotice(): void;
    exit(): void;
    blockedReason: string | null;
    idleSince: number;
    idlePrompt: boolean;
  };
  const profile = profileFromTemplate(profileName, ['https://op.example']);
  c.session = { sessionId: 's', sessionStartedAt: 0, stakedMinor: 0, returnedMinor: 0, balanceMinor: 100_00, currency: DEFAULT_CURRENCY, commit: 'c', clientSeed: 'k', nonce: 0, config: PAPER_ROUTE_CONFIG, profile };
  c.profile = profile;
  c.config = PAPER_ROUTE_CONFIG;
  return { c, played, renders, poses };
}

const start = (roundId = 'r1'): StartEvent => ({ type: 'START', roundId, startedAt: Date.now(), serverNow: Date.now(), betMinor: 10_00, currency: 'USD', autoCashout: null, commit: 'c', clientSeed: 'k', nonce: 0, configId: 'paper-route/v1-rising', papers: 5, paperMinor: 2_00 });

describe('round-level result presentation', () => {
  it.each<[string, TerminalEvent, boolean, string]>([
    ['wipeout returning 6.00', { type: 'CRASH', roundId: 'r1', time: 3, multiplier: 2.4, crashTime: 3, balanceMinor: 96_00, returnMinor: 6_00, papersThrown: 2, papersLost: 3 }, false, 'return'],
    ['all delivered returning exactly 10.00', { type: 'CASHED_OUT', roundId: 'r1', reason: 'manual', time: 1, multiplier: 1, payoutMinor: 10_00, crashTime: 9, balanceMinor: 100_00, papersThrown: 5, papersLost: 0 }, false, 'return'],
    ['all delivered returning 24.00', { type: 'CASHED_OUT', roundId: 'r1', reason: 'manual', time: 4, multiplier: 2.4, payoutMinor: 24_00, crashTime: 9, balanceMinor: 114_00, papersThrown: 5, papersLost: 0 }, true, 'win'],
  ])('%s', (_name, terminal, win, sound) => {
    const { c, played, poses } = makeController();
    c.onEvent(start());
    c.onEvent(terminal);
    expect(c.phase).toBe('result');
    expect(c.result).toMatchObject({ win, returnedMinor: terminal.type === 'CRASH' ? 6_00 : (terminal as { payoutMinor: number }).payoutMinor });
    expect(played.includes('win')).toBe(win);
    expect(played.at(-1)).toBe(sound);
    expect(c.result!.netMinor).toBe(c.result!.returnedMinor - 10_00);
    if (terminal.type === 'CRASH') expect(poses.at(-1)).toBe('fallen');
    // Nothing on the result mentions the crash point or what unthrown papers would have paid.
    expect(JSON.stringify(c.result)).not.toMatch(/crash|would/i);
  });

  it('shows papers lost at wipeout and the settled total in the panel', () => {
    const { c } = makeController();
    c.onEvent(start());
    c.onEvent({ type: 'THROWN', roundId: 'r1', throwId: 'a', papers: 1, reason: 'manual', time: 1, multiplier: 1.6, exactMinor: 320, creditedMinor: 320, remaining: 4, balanceMinor: 93_20 });
    c.onEvent({ type: 'CRASH', roundId: 'r1', time: 3, multiplier: 2.4, crashTime: 3, balanceMinor: 93_20, returnMinor: 3_20, papersThrown: 1, papersLost: 4 });
    const hud = c.hudState(c.round, 1);
    expect(hud.papers.map((p) => p.state)).toEqual(['thrown', 'lost', 'lost', 'lost', 'lost']);
    expect(hud.returnedSoFarMinor).toBe(3_20);
    expect(hud.result).toMatchObject({ win: false, netMinor: -6_80, note: '1 paper delivered · 4 lost at wipeout' });
  });

  it('shows the setback moment only once its event arrives: crossed-out value, marker, halved riding value', () => {
    const { c, played } = makeController('light');
    c.config = { ...PAPER_ROUTE_CONFIG, lambda: 0.12 };
    const t0 = Date.now() - 2000;
    c.onEvent({ ...start(), startedAt: t0, serverNow: Date.now() });
    const before = c.hudState(c.round, 2.4);
    expect(before.setbackMarker).toBe(false);
    expect(before.previousMultiplier).toBeNull();
    expect(played).not.toContain('splash');
    c.onEvent({ type: 'BAD_MOLE', roundId: 'r1', time: 1.9, factor: 0.5 });
    const after = c.hudState(c.round, 1.2);
    expect(after.setbackMarker).toBe(true);
    expect(after.previousMultiplier).toBeGreaterThan(1);
    expect(after.ridingMinor).toBe(Math.floor(2_00 * 5 * 1.2 + 1e-7));
    expect(played).toContain('splash');
  });

  it('labels an instant bust distinctly', () => {
    const { c } = makeController();
    c.onEvent(start());
    c.onEvent({ type: 'CRASH', roundId: 'r1', time: 0, multiplier: 1, crashTime: 0, balanceMinor: 90_00, returnMinor: 0, papersThrown: 0, papersLost: 5 });
    expect(c.result).toMatchObject({ win: false, returnedMinor: 0, netMinor: -10_00, note: 'Instant wipeout · the round ended at x1.00' });
  });

  it('treats a void round as a neutral refund', () => {
    const { c, played } = makeController();
    c.onEvent(start());
    c.onEvent({ type: 'VOID', roundId: 'r1', reason: 'system_failure', refundMinor: 10_00, balanceMinor: 100_00 });
    expect(c.result).toMatchObject({ win: false, returnedMinor: 10_00, netMinor: 0 });
    expect(played).not.toContain('win');
  });
});

const OPERATOR = 'https://casino.example';
function operatorWindow() {
  const posted: { type: string; payload: Record<string, unknown> }[] = [];
  const listeners: ((e: MessageEvent) => void)[] = [];
  const parent = { postMessage: (m: { type: string; payload: Record<string, unknown> }, origin: string) => origin === OPERATOR && posted.push(m) };
  const win = {
    parent,
    location: { ancestorOrigins: [OPERATOR] },
    document: { referrer: OPERATOR },
    addEventListener: (_t: string, l: (e: MessageEvent) => void) => listeners.push(l),
    removeEventListener() {},
  } as unknown as BridgeWindow;
  const command = (type: string, payload: unknown = {}) =>
    listeners.forEach((l) => l({ data: { protocol: 'triptown', version: 1, type, payload }, origin: OPERATOR, source: parent } as unknown as MessageEvent));
  return { win, posted, command };
}

describe('operator bridge (8.2) and protections (8.9)', () => {
  it('reports ready, round lifecycle and balance to the operator in order, with net and kind', () => {
    const op = operatorWindow();
    const { c } = makeController('regulated-uk');
    c.profile = { ...c.profile, operatorOrigins: [OPERATOR] };
    (c as unknown as { d: { bridgeWindow: BridgeWindow } }).d.bridgeWindow = op.win;
    c.connectBridge();
    c.onEvent(start());
    c.onEvent({ type: 'CASHED_OUT', roundId: 'r1', reason: 'manual', time: 2, multiplier: 2.4, payoutMinor: 24_00, crashTime: 9, balanceMinor: 114_00, papersThrown: 5, papersLost: 0 });
    expect(op.posted.map((m) => m.type)).toEqual(['gameReady', 'balance', 'roundStarted', 'balance', 'roundEnded', 'balance']);
    expect(op.posted[0]!.payload).toEqual({ version: 'test@1', configId: 'paper-route/v1', profile: 'regulated-uk' });
    expect(op.posted.find((m) => m.type === 'roundEnded')!.payload).toEqual({ roundId: 'r1', stakeMinor: 1000, returnMinor: 2400, netMinor: 1400, kind: 'win' });
  });

  it('applies an operator pause only between rounds and blocks the next bet until resumed', async () => {
    const op = operatorWindow();
    const { c } = makeController('regulated-uk');
    c.profile = { ...c.profile, operatorOrigins: [OPERATOR] };
    (c as unknown as { d: { bridgeWindow: BridgeWindow } }).d.bridgeWindow = op.win;
    let starts = 0;
    (c as unknown as { d: { service: unknown } }).d.service = { startRound: async () => { starts++; return { roundId: 'x', ended: new Promise(() => {}), close() {} }; } };
    c.connectBridge();
    c.onEvent(start());
    op.command('pause', { message: 'You have played for 60 minutes' });
    expect(c.hudState(c.round, 1.5).notice).toBeNull(); // the running round is never interrupted
    c.onEvent({ type: 'CRASH', roundId: 'r1', time: 3, multiplier: 2, crashTime: 3, balanceMinor: 90_00, returnMinor: 0, papersThrown: 0, papersLost: 5 });
    c.continue();
    // Pacing is tested elsewhere; clear the 5 s cycle so only the pause can block the bet.
    (c as unknown as { lastStartAt: number }).lastStartAt = 0;
    expect(c.hudState(null, 1).notice).toMatchObject({ title: 'Reality check', text: 'You have played for 60 minutes', actions: [] });
    await c.bet();
    expect(starts).toBe(0);
    op.command('resume');
    await c.bet();
    expect(starts).toBe(1);
  });

  it('enforces operator loss and stake limits before a bet, reporting the error', async () => {
    const op = operatorWindow();
    const { c } = makeController('regulated-uk');
    c.profile = { ...c.profile, operatorOrigins: [OPERATOR] };
    (c as unknown as { d: { bridgeWindow: BridgeWindow } }).d.bridgeWindow = op.win;
    (c as unknown as { d: { service: unknown } }).d.service = { startRound: async () => { throw new Error('should not start'); } };
    c.connectBridge();
    c.session = { ...c.session, stakedMinor: 48_00, returnedMinor: 0 };
    op.command('setLimits', { lossLimitMinor: 50_00 });
    await c.bet();
    expect(c.blockedReason).toMatch(/loss limit/);
    expect(op.posted.at(-1)).toMatchObject({ type: 'error', payload: { code: 'loss_limit' } });
    op.command('setLimits', { stakeLimitMinor: 2_00, lossLimitMinor: 1_000_00 });
    await c.bet();
    expect(op.posted.at(-1)).toMatchObject({ type: 'error', payload: { code: 'stake_limit' } });
  });

  it('closes the game on closeGame and shows the idle prompt after the profile idle time', async () => {
    const op = operatorWindow();
    const { c } = makeController('pt-draft');
    c.profile = { ...c.profile, operatorOrigins: [OPERATOR], idlePromptMs: 1000 };
    (c as unknown as { d: { bridgeWindow: BridgeWindow } }).d.bridgeWindow = op.win;
    c.connectBridge();
    c.idleSince = Date.now() - 5000;
    (c as unknown as { frame(t: number): void }).frame = () => {};
    c.idlePrompt = true; // what the frame loop sets once idleSince is older than idlePromptMs
    expect(c.hudState(null, 1).notice).toMatchObject({ title: 'Still there?', actions: ['continue', 'exit'] });
    c.dismissNotice();
    expect(c.hudState(null, 1).notice).toBeNull();
    op.command('closeGame');
    expect(c.hudState(null, 1).notice).toMatchObject({ title: 'Game closed' });
  });
});
