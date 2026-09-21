import { describe, expect, it } from 'vitest';
import { OperatorBridge, resolveParentOrigin, type BridgeWindow } from './bridge';

const OPERATOR = 'https://casino.example';

function fakeWindow(parentOrigin: string | null, opts: { ancestor?: boolean } = {}) {
  const posted: { message: unknown; targetOrigin: string }[] = [];
  const listeners: ((e: MessageEvent) => void)[] = [];
  const parent = { postMessage: (message: unknown, targetOrigin: string) => posted.push({ message, targetOrigin }) };
  const win: BridgeWindow = {
    parent,
    location: { ancestorOrigins: opts.ancestor === false || !parentOrigin ? undefined : [parentOrigin] },
    document: { referrer: parentOrigin ? `${parentOrigin}/lobby/game?id=1` : '' },
    addEventListener: (_t, l) => listeners.push(l),
    removeEventListener: (_t, l) => listeners.splice(listeners.indexOf(l), 1),
  };
  const deliver = (data: unknown, origin = parentOrigin ?? '', source: unknown = parent) =>
    listeners.forEach((l) => l({ data, origin, source } as unknown as MessageEvent));
  return { win, posted, deliver, listeners };
}

describe('OperatorBridge', () => {
  it('sends lifecycle events in order to the pinned origin with the correct net', () => {
    const { win, posted } = fakeWindow(OPERATOR);
    const bridge = new OperatorBridge({ allowedOrigins: [OPERATOR], win });
    bridge.gameReady('1.0.0+abc', 'paper-route/v1-rising', 'ng-draft');
    bridge.roundStarted('r1', 10_00);
    bridge.roundEnded('r1', 10_00, 24_00);
    bridge.balance(114_00, 'USD');
    bridge.roundEnded('r2', 10_00, 6_00);
    bridge.roundEnded('r3', 10_00, 10_00);
    expect(posted.every((p) => p.targetOrigin === OPERATOR)).toBe(true);
    expect(posted.map((p) => (p.message as { type: string }).type)).toEqual(['gameReady', 'roundStarted', 'roundEnded', 'balance', 'roundEnded', 'roundEnded']);
    expect(posted[2]!.message).toEqual({ protocol: 'triptown', version: 1, type: 'roundEnded', payload: { roundId: 'r1', stakeMinor: 1000, returnMinor: 2400, netMinor: 1400, kind: 'win' } });
    expect((posted[4]!.message as { payload: unknown }).payload).toMatchObject({ netMinor: -400, kind: 'loss' });
    expect((posted[5]!.message as { payload: unknown }).payload).toMatchObject({ netMinor: 0, kind: 'even' });
  });

  it('posts nothing and ignores commands when the parent origin is not listed', () => {
    const { win, posted, deliver, listeners } = fakeWindow('https://evil.example');
    let paused = false;
    const bridge = new OperatorBridge({ allowedOrigins: [OPERATOR], win, handlers: { pause: () => (paused = true) } });
    bridge.roundStarted('r1', 100);
    deliver({ protocol: 'triptown', version: 1, type: 'pause', payload: {} });
    expect(bridge.active).toBe(false);
    expect(posted).toEqual([]);
    expect(listeners).toEqual([]);
    expect(paused).toBe(false);
  });

  it('accepts commands only from the parent window at the pinned origin, with a valid envelope', () => {
    const { win, deliver } = fakeWindow(OPERATOR);
    const calls: string[] = [];
    new OperatorBridge({
      allowedOrigins: [OPERATOR],
      win,
      handlers: {
        pause: (p) => calls.push(`pause:${p.message ?? ''}`),
        resume: () => calls.push('resume'),
        closeGame: () => calls.push('close'),
        setLimits: (p) => calls.push(`limits:${p.stakeLimitMinor}:${p.lossLimitMinor}`),
        showMessage: (p) => calls.push(`msg:${p.text}`),
      },
    });
    const env = (type: string, payload: unknown = {}) => ({ protocol: 'triptown', version: 1, type, payload });
    deliver(env('pause', { message: 'Reality check' }));
    deliver(env('resume'));
    deliver(env('setLimits', { stakeLimitMinor: 500, lossLimitMinor: 5000 }));
    deliver(env('showMessage', { text: 'Hi' }));
    deliver(env('closeGame'));
    deliver(env('pause'), 'https://evil.example'); // wrong origin
    deliver(env('pause'), OPERATOR, {}); // not from the parent window
    deliver({ ...env('pause'), version: 2 }); // unknown protocol version
    deliver(env('setLimits', { stakeLimitMinor: 'lots' }));
    expect(calls).toEqual(['pause:Reality check', 'resume', 'limits:500:5000', 'msg:Hi', 'close', 'limits:undefined:undefined']);
  });

  it('stays silent when the game is opened directly (not embedded)', () => {
    const { win, posted } = fakeWindow(null);
    (win as { parent: unknown }).parent = win;
    const bridge = new OperatorBridge({ allowedOrigins: [OPERATOR], win });
    bridge.gameReady('1', 'c', 'light');
    expect(bridge.targetOrigin).toBeNull();
    expect(posted).toEqual([]);
  });

  it('falls back to the referrer origin when ancestorOrigins is unavailable', () => {
    const { win } = fakeWindow(OPERATOR, { ancestor: false });
    expect(resolveParentOrigin(win, [OPERATOR])).toBe(OPERATOR);
  });
});
