import { DEFAULT_CONFIG, resolveConfigId, validateConfig } from '@triptown/fairness';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_TEMPLATES,
  effectiveConfig,
  isRegisteredGame,
  profileFromTemplate,
  engineOf,
  registerGame,
  registeredGames,
  validateProfile,
  type JurisdictionProfile,
} from './profiles';

// The split-stake code path still ships, but its only config belongs to a retired game. Tests register
// that game explicitly to exercise the path; no shipped profile has it registered (design D1, D2).
registerGame('paper-route');

// Retired game config: resolvable for verification, no longer exported (design D2).
const PAPER_ROUTE_CONFIG = resolveConfigId('paper-route/v1')!;

const uk = () => profileFromTemplate('regulated-uk', ['https://casino.example']);

describe('profile validation (1.1)', () => {
  it('accepts every template when origins are not required', () => {
    for (const name of Object.keys(PROFILE_TEMPLATES)) {
      expect(validateProfile(profileFromTemplate(name), { requireOrigins: false })).toEqual({ ok: true });
    }
  });

  it('requires operator origins for regulated profiles', () => {
    const result = validateProfile(profileFromTemplate('regulated-uk'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/operatorOrigins/);
    expect(validateProfile(uk())).toEqual({ ok: true });
    expect(validateProfile(profileFromTemplate('light'))).toEqual({ ok: true });
  });

  it.each<[string, Partial<JurisdictionProfile>, RegExp]>([
    ['negative minCycleMs', { minCycleMs: -1 }, /minCycleMs/],
    ['minCashout below 1', { minCashout: 0.99 }, /minCashout/],
    ['maxMultiplier at 1', { maxMultiplier: 1 }, /maxMultiplier/],
    ['maxMultiplier equal to minCashout', { maxMultiplier: 1.01 }, /maxMultiplier/],
    ['unknown setbacks mode', { setbacksMode: 'double' as never }, /setbacksMode/],
    ['unknown skin', { skin: 'neon' as never }, /skin/],
    ['unknown disconnect policy', { disconnectPolicy: 'refund' as never }, /disconnectPolicy/],
    ['bad idle prompt', { idlePromptMs: 0 }, /idlePromptMs/],
    ['unknown partial cash-out mode', { partialCashout: 'halves' as never }, /partialCashout/],
  ])('rejects %s and names the field', (_n, patch, field) => {
    const result = validateProfile({ ...uk(), ...patch });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(field);
  });
});

describe('partial cash-out flag', () => {
  it('is off for Portugal and stakeParts elsewhere', () => {
    expect(profileFromTemplate('pt-draft').partialCashout).toBe('off');
    expect(profileFromTemplate('regulated-uk').partialCashout).toBe('parts');
  });
});

describe('effective configs (1.2)', () => {
  it('maps setbacks modes to registered config ids for both games', () => {
    expect(effectiveConfig('whack-crash', uk()).id).toBe('whack-crash/v1-rising');
    // Paper Route has no boosted config, so the boosted light profile is only valid for whack-crash.
    expect(effectiveConfig('paper-route', { ...profileFromTemplate('light'), boostsMode: 'off' }).id).toBe('paper-route/v1');
    expect(effectiveConfig('whack-crash', profileFromTemplate('light')).id).toBe('whack-crash/v2');
    expect(effectiveConfig('whack-crash', { ...profileFromTemplate('light'), boostsMode: 'off' }).id).toBe('whack-crash/v1');
    expect(effectiveConfig('whack-crash', { ...uk(), boostsMode: 'boost' }).id).toBe('whack-crash/v2-rising');
    expect(effectiveConfig('paper-route', uk()).id).toBe('paper-route/v1-rising');
  });

  it('rising configs have no setbacks and otherwise match their base', () => {
    const rising = effectiveConfig('whack-crash', uk());
    expect(rising.lambda).toBe(0);
    expect({ ...rising, id: DEFAULT_CONFIG.id, lambda: DEFAULT_CONFIG.lambda }).toEqual(DEFAULT_CONFIG);
    const paper = effectiveConfig('paper-route', uk());
    expect(paper).toMatchObject({ lambda: 0, stakeParts: PAPER_ROUTE_CONFIG.stakeParts });
    expect(validateConfig(rising)).toEqual({ ok: true });
    expect(validateConfig(paper)).toEqual({ ok: true });
  });

  it('derives +cap ids when the profile caps lower than the config', () => {
    const pt = profileFromTemplate('pt-draft', ['https://pt.example']);
    const cfg = effectiveConfig('whack-crash', pt);
    expect(cfg).toMatchObject({ id: 'whack-crash/v1-rising+cap100', maxWinMultiplier: 100, lambda: 0 });
    expect(resolveConfigId('paper-route/v1-rising+cap100')).toMatchObject({ stakeParts: 5, maxWinMultiplier: 100 });
    expect(resolveConfigId('whack-crash/v1+cap20000')).toBeNull();
    expect(resolveConfigId('nope/v1+cap100')).toBeNull();
  });
});

describe('report gating (1.4)', () => {
  it('fails when an effective config has no passing report', () => {
    const index = { 'whack-crash/v1-rising': { pass: true, rounds: 10_000_000, date: '2026-09-15' } };
    const onlyWhack = validateProfile(uk(), { reportIndex: index, games: ['whack-crash'] });
    expect(onlyWhack).toEqual({ ok: true });
    const both = validateProfile(uk(), { reportIndex: index });
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.errors.join()).toMatch(/paper-route\/v1-rising has no passing RTP report/);
    const failing = validateProfile(uk(), { reportIndex: { 'whack-crash/v1-rising': { pass: false, rounds: 1, date: 'x' } }, games: ['whack-crash'] });
    expect(failing.ok).toBe(false);
  });
});

// The registry is what makes a new game a skin on a certified engine rather than an edit to core.
describe('game registry', () => {
  it('ships whack-crash and nothing this repo deleted', () => {
    expect(isRegisteredGame('whack-crash')).toBe(true);
    expect(isRegisteredGame('not-a-game')).toBe(false);
  });

  // This is the whole point: a new game is a skin on a certified engine, so it plays that engine's
  // config ids and its committed RTP reports. Nothing new to prove, nothing to recertify.
  it('runs a new game on an existing engine, with that engine\'s certified config', () => {
    registerGame('skin-game', 'whack-crash');
    expect(engineOf('skin-game')).toBe('whack-crash');
    const skin = effectiveConfig('skin-game', profileFromTemplate('light'));
    const engine = effectiveConfig('whack-crash', profileFromTemplate('light'));
    expect(skin).toEqual(engine);
    expect(skin.id).toMatch(/^whack-crash\//);
  });

  it('is idempotent, and refuses to move a game to another engine', () => {
    registerGame('skin-game', 'whack-crash');
    expect(registeredGames().filter((g) => g === 'skin-game')).toHaveLength(1);
    expect(() => registerGame('skin-game', 'paper-route')).toThrow(/already registered on engine/);
  });

  it('lets a game bring its own maths by defaulting the engine to itself', () => {
    registerGame('own-maths');
    expect(engineOf('own-maths')).toBe('own-maths');
    expect(() => effectiveConfig('own-maths', profileFromTemplate('light'))).toThrow(/No config registered/);
  });

  it('refuses an unregistered game before a session can use it', () => {
    expect(() => effectiveConfig('not-a-game', profileFromTemplate('light'))).toThrow(/Unregistered game/);
  });

  it('refuses a malformed game or engine id', () => {
    expect(() => registerGame('')).toThrow(/Invalid game id/);
    expect(() => registerGame('whack-crash/v1')).toThrow(/Invalid game id/);
    expect(() => registerGame('ok', 'bad/id')).toThrow(/Invalid engine id/);
  });
});
