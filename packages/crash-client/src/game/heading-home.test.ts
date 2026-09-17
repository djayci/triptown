import { profileFromTemplate, registerGame } from '@triptown/core';
import { MockRoundService } from '@triptown/rgs-client/mock';
import { beforeAll, describe, expect, it } from 'vitest';
import { GameController } from './controller';
import { HEADING_HOME_MS, formatRevealChance } from './display';
import type { CrashView, CrashViewCallbacks } from './view-contract';

// gate-odds-mvp D6: on a deferred-reveal round, collect starts a heading-home state on the PRESS that
// lasts at least HEADING_HOME_MS for every outcome. The result shows at max(press + fixed, settlement),
// nothing observable differs between a win and a loss before then, and the balance waits too.

registerGame('deferred-probe', 'whack-crash', { reveal: ['onCollect'] });

const deferredProfile = {
  ...profileFromTemplate('regulated-uk', ['https://op.example']),
  name: 'deferred-test',
  minCycleMs: 0,
  crashReveal: 'onCollect' as const,
};

type Call = { name: string; at: number; args: unknown[] };

function recordingView(calls: Call[]): (game: unknown, frames: unknown, cb: CrashViewCallbacks) => CrashView {
  return () => {
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        calls.push({ name, at: performance.now(), args });
      };
    return new Proxy({ isArmed: true, history: { setAll() {}, push: record('history.push') } } as unknown as CrashView, {
      get(target, prop: string) {
        if (prop in target) return (target as unknown as Record<string, unknown>)[prop];
        return record(prop);
      },
    });
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function playDeferred(force: 'longRound' | 'quickCrash', pressAfterMs: number, latencyMs = 0) {
  const calls: Call[] = [];
  const ticks: (() => void)[] = [];
  const game = { app: { ticker: { add: (fn: () => void) => ticks.push(fn) } }, onVisibility() {}, onResize() {} };
  const service = new MockRoundService({ initialBalanceMinor: 500_00, profiles: { defaultProfile: deferredProfile }, game: 'deferred-probe' });
  const controller = new GameController(game as never, (() => null) as never, service, null, recordingView(calls) as never);
  const ticker = setInterval(() => ticks.forEach((fn) => fn()), 16);
  try {
    await controller.init();
    service.forceNext(force);
    await controller.bet();
    await wait(pressAfterMs);
    // Settlement can be slowed after the round started, to test both orders of press + fixed and settlement.
    (service as unknown as { latencyMs: number }).latencyMs = latencyMs;
    const pressedAt = performance.now();
    controller.collect();
    await wait(HEADING_HOME_MS + latencyMs + 800);
    return { calls, pressedAt, state: controller.debugState() };
  } finally {
    clearInterval(ticker);
  }
}

beforeAll(() => {
  // The controller's latency probe reads document.hidden; the bridge only exists in a browser.
  (globalThis as Record<string, unknown>).document ??= { hidden: false, addEventListener() {} };
});

describe('deferred reveal: heading home', () => {
  it('formats the win chance rounded down', () => {
    expect(formatRevealChance(0.97, 3.2)).toBe('30.3%');
    expect(formatRevealChance(0.97, 1)).toBe('97.0%');
    expect(formatRevealChance(0.97, 2)).toBe('48.5%');
    expect(formatRevealChance(0.97, 100)).toBe('0.9%');
    expect(formatRevealChance(0.97, 10_000)).toBe('<0.1%');
  });

  it('shows no result before the fixed heading-home time, and the same calls for a win and a loss', async () => {
    const won = await playDeferred('longRound', 400);
    const lost = await playDeferred('quickCrash', 3200);

    const after = (r: typeof won) => r.calls.filter((c) => c.at >= r.pressedAt);
    const resultAt = (r: typeof won, name: string) => after(r).find((c) => c.name === name)?.at ?? Number.NaN;

    expect(won.state.resultKind).toBe('win');
    expect(lost.state.resultKind).toBe('loss');
    expect(resultAt(won, 'showWin') - won.pressedAt).toBeGreaterThanOrEqual(HEADING_HOME_MS - 20);
    expect(resultAt(lost, 'showCrash') - lost.pressedAt).toBeGreaterThanOrEqual(HEADING_HOME_MS - 20);

    // Everything the view was told between the press and the result, by name, must match.
    const before = (r: typeof won, result: string) => {
      const until = Math.min(resultAt(r, result), r.pressedAt + HEADING_HOME_MS - 20);
      return after(r)
        .filter((c) => c.at < until)
        .map((c) => c.name);
    };
    expect(before(won, 'showWin')).toEqual(before(lost, 'showCrash'));
    expect(before(won, 'showWin')).toContain('showHeadingHome');
    // The balance and the session net update as part of the reveal, never while heading home.
    for (const r of [won, lost]) {
      const early = after(r).filter((c) => (c.name === 'setBalance' || c.name === 'setSessionHud') && c.at - r.pressedAt < HEADING_HOME_MS - 20);
      expect(early).toEqual([]);
    }
  }, 30_000);

  it('waits for a slow settlement, still identically for both outcomes', async () => {
    const won = await playDeferred('longRound', 400, 1700);
    const lost = await playDeferred('quickCrash', 3200, 1700);
    const at = (r: typeof won, name: string) => r.calls.find((c) => c.at >= r.pressedAt && c.name === name)!.at - r.pressedAt;
    expect(at(won, 'showWin')).toBeGreaterThanOrEqual(1700 - 20);
    expect(at(lost, 'showCrash')).toBeGreaterThanOrEqual(1700 - 20);
  }, 30_000);

  it('sets the reveal mode and odds at round start, and clears the odds with the result', async () => {
    const r = await playDeferred('longRound', 400);
    expect(r.calls.find((c) => c.name === 'setRevealMode')?.args).toEqual(['onCollect']);
    expect(r.calls.find((c) => c.name === 'setRevealOdds')?.args).toEqual(['97.0%']);
    const resultIndex = r.calls.findIndex((c) => c.name === 'showWin');
    expect(r.calls.slice(0, resultIndex).reverse().find((c) => c.name === 'setRevealOdds')?.args).toEqual([null]);
  }, 30_000);
});
