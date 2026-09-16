import { cappedConfigId, resolveConfigId, type GameConfig } from '@triptown/fairness';

// Jurisdiction profiles: per-market settings the server binds to a session. Values come from the
// 2026-09-15 compliance research (docs/compliance/) and need legal review before production use.

export type SetbacksMode = 'off' | 'halve';
/** Boosts: 'off' plays the unboosted config, 'boost' the boosted one (good-mole D7). */
export type BoostsMode = 'off' | 'boost';
export type Skin = 'candy' | 'adult';
export type DisconnectPolicy = 'lose' | 'cashout-at-disconnect';
export type PartialCashout = 'off' | 'parts';
/**
 * A game's id. Open on purpose: a new game is a skin on an already-certified engine, so adding one
 * must not mean editing a type in `core`. Games register at startup; an unregistered id is refused
 * before a session can use it, which is the check the old closed union was really providing.
 */
export type GameId = string;

/**
 * Each registered game maps to the engine whose certified configs it plays. A game that names another
 * game's engine ships with no maths of its own: same config ids, same committed RTP reports, nothing to
 * recertify. That is what makes a new game a skin rather than a new product.
 */
const REGISTERED_GAMES = new Map<GameId, GameId>([['whack-crash', 'whack-crash']]);

/**
 * Registers a game so profiles may bind to it. `engine` names the game whose configs it plays, and
 * defaults to the game itself (a game bringing its own maths). Idempotent for the same engine.
 */
export function registerGame(game: GameId, engine: GameId = game): void {
  if (!game || game.includes('/')) throw new Error(`Invalid game id: ${JSON.stringify(game)}`);
  if (!engine || engine.includes('/')) throw new Error(`Invalid engine id: ${JSON.stringify(engine)}`);
  const existing = REGISTERED_GAMES.get(game);
  if (existing && existing !== engine) {
    throw new Error(`${game} is already registered on engine ${existing}, not ${engine}`);
  }
  REGISTERED_GAMES.set(game, engine);
}

/** Games currently registered, in registration order. */
export function registeredGames(): GameId[] {
  return [...REGISTERED_GAMES.keys()];
}

export function isRegisteredGame(game: GameId): boolean {
  return REGISTERED_GAMES.has(game);
}

/** The engine a game plays: its own id unless it was registered on another game's engine. */
export function engineOf(game: GameId): GameId {
  const engine = REGISTERED_GAMES.get(game);
  if (!engine) throw new Error(`Unregistered game: ${game}`);
  return engine;
}

export interface JurisdictionProfile {
  name: string;
  /** Draft profiles are refused unless a dev override is enabled. */
  status: 'active' | 'draft';
  /** Regulated profiles must be embedded by known operator origins. */
  regulated: boolean;
  /** True only after counsel has confirmed the values. */
  reviewed: boolean;
  /** Where the values come from. */
  sources: string[];
  /** Minimum ms from one round start until the next can start. */
  minCycleMs: number;
  /** Offer a one-tap same-stake bet on the result screen. */
  quickReplay: boolean;
  setbacksMode: SetbacksMode;
  boostsMode: BoostsMode;
  /** Partial cash-out: the stake splits into parts collected separately. Portugal's Reg. 308/2023 only provides for a single withdrawal. */
  partialCashout: PartialCashout;
  /** Cap on the multiplier; below the config cap it derives a `+capN` config. */
  maxMultiplier: number;
  /** Lowest multiplier a manual cash-out is accepted at; 0 means no floor, so a player can always bail. */
  minCashout: number;
  skin: Skin;
  soundDefault: 'on' | 'muted';
  intensityEffects: boolean;
  showRtpInGame: boolean;
  showSessionClock: boolean;
  showNetPosition: boolean;
  idlePromptMs: number | null;
  disconnectPolicy: DisconnectPolicy;
  language: string;
  operatorOrigins: string[];
}

type ProfileTemplate = Omit<JurisdictionProfile, 'operatorOrigins'>;

const base = {
  status: 'active',
  reviewed: false,
  maxMultiplier: 10_000,
  minCashout: 1.01,
  idlePromptMs: null,
  disconnectPolicy: 'lose',
  language: 'en',
  showRtpInGame: false,
  partialCashout: 'parts',
  // Regulated templates stay on the certified unboosted maths until a lab accepts the boosted ids (D7).
  boostsMode: 'off',
} as const;

export const PROFILE_TEMPLATES: Readonly<Record<string, ProfileTemplate>> = Object.freeze({
  light: {
    ...base,
    name: 'light',
    regulated: false,
    sources: ['docs/compliance/whack-crash-2026-09-15.md §5 (aggregator / lighter markets)'],
    minCycleMs: 2500,
    quickReplay: true,
    setbacksMode: 'halve',
    boostsMode: 'boost',
    // Bad moles can push the value under x1.00, and a player must always be able to take what is left.
    minCashout: 0,
    skin: 'candy',
    soundDefault: 'on',
    intensityEffects: true,
    showSessionClock: false,
    showNetPosition: false,
  },
  'regulated-uk': {
    ...base,
    name: 'regulated-uk',
    regulated: true,
    sources: ['UKGC RTS 14F/14G, 8, 2E, 13A-C, 3, 4 (2025-01-17 extension to casino games)', 'CAP 16.3.12'],
    minCycleMs: 5000,
    quickReplay: false,
    setbacksMode: 'off',
    skin: 'adult',
    soundDefault: 'muted',
    intensityEffects: false,
    showSessionClock: true,
    showNetPosition: true,
  },
  'regulated-on': {
    ...base,
    name: 'regulated-on',
    regulated: true,
    sources: ['AGCO Registrar Standards 2.15-2.22, 2.03, 4.05-4.06'],
    minCycleMs: 2500,
    quickReplay: false,
    setbacksMode: 'off',
    skin: 'adult',
    soundDefault: 'muted',
    intensityEffects: false,
    showSessionClock: true,
    showNetPosition: true,
  },
  'regulated-br': {
    ...base,
    name: 'regulated-br',
    regulated: true,
    sources: ['Portaria SPA/MF 1.207/2024 Annex I items 14, 28-29', 'Planned design portaria (5 s, no turbo) - not yet published'],
    minCycleMs: 5000,
    quickReplay: false,
    setbacksMode: 'off',
    skin: 'adult',
    soundDefault: 'muted',
    intensityEffects: false,
    showRtpInGame: true,
    showSessionClock: false,
    showNetPosition: true,
  },
  'pt-draft': {
    ...base,
    name: 'pt-draft',
    status: 'draft',
    regulated: true,
    sources: ['Portugal Regulamento 308/2023 R17, R19, R33, R35, R38-43'],
    minCycleMs: 5000,
    quickReplay: false,
    setbacksMode: 'off',
    maxMultiplier: 100,
    skin: 'adult',
    soundDefault: 'muted',
    intensityEffects: false,
    showSessionClock: true,
    showNetPosition: true,
    idlePromptMs: 180_000,
    disconnectPolicy: 'cashout-at-disconnect',
    language: 'pt-PT',
    partialCashout: 'off',
  },
});

export function profileFromTemplate(name: string, operatorOrigins: string[] = []): JurisdictionProfile {
  const template = PROFILE_TEMPLATES[name];
  if (!template) throw new Error(`Unknown profile: ${name}`);
  return { ...template, operatorOrigins: [...operatorOrigins] };
}

/** Base config id for a game under a setbacks mode. */
export function baseConfigId(game: GameId, mode: SetbacksMode, boosts: BoostsMode = 'off'): string {
  // Config ids belong to the engine, not the game, so a skin plays the certified ids unchanged.
  const engine = isRegisteredGame(game) ? engineOf(game) : game;
  // Two axes, four ids (good-mole D6): v1 is unboosted, v2 boosted; `-rising` means no setbacks.
  const suffix = mode === 'off' ? '-rising' : '';
  // An engine with no boosted config plays the unboosted maths, whatever the profile asks for.
  if (boosts === 'boost' && resolveConfigId(`${engine}/v2${suffix}`)) return `${engine}/v2${suffix}`;
  return `${engine}/v1${suffix}`;
}

/** The exact math config a round uses for this game and profile. */
export function effectiveConfig(game: GameId, profile: JurisdictionProfile): GameConfig {
  if (!isRegisteredGame(game)) throw new Error(`Unregistered game: ${game}`);
  const baseId = baseConfigId(game, profile.setbacksMode, profile.boostsMode);
  const baseConfig = resolveConfigId(baseId);
  if (!baseConfig) throw new Error(`No config registered for ${baseId}`);
  if (profile.maxMultiplier >= baseConfig.maxWinMultiplier) return baseConfig;
  const capped = resolveConfigId(cappedConfigId(baseId, profile.maxMultiplier));
  if (!capped) throw new Error(`Cannot derive cap ${profile.maxMultiplier} for ${baseId}`);
  return capped;
}

/** Report index entry written by the RTP simulator. */
export interface ReportIndexEntry {
  pass: boolean;
  rounds: number;
  date: string;
}

export type ReportIndex = Readonly<Record<string, ReportIndexEntry>>;

/** Reports used to gate profiles must simulate at least this many rounds. */
export const MIN_REPORT_ROUNDS = 10_000_000;

export interface ProfileValidationOptions {
  /** Require operator origins for regulated profiles (off when checking bare templates). */
  requireOrigins?: boolean;
  /** When given, every effective config id must have a passing report. */
  reportIndex?: ReportIndex;
  games?: GameId[];
}

export type ProfileValidation = { ok: true } | { ok: false; errors: string[] };

const SETBACK_MODES: SetbacksMode[] = ['off', 'halve'];
const BOOST_MODES: BoostsMode[] = ['off', 'boost'];
const SKINS: Skin[] = ['candy', 'adult'];
const DISCONNECT: DisconnectPolicy[] = ['lose', 'cashout-at-disconnect'];
const PARTIAL: PartialCashout[] = ['off', 'parts'];

export function validateProfile(p: JurisdictionProfile, opts: ProfileValidationOptions = {}): ProfileValidation {
  const errors: string[] = [];
  const at = (field: string, msg: string) => errors.push(`${p.name || '(unnamed)'}.${field}: ${msg}`);
  if (!p.name) at('name', 'is required');
  if (!(Number.isFinite(p.minCycleMs) && p.minCycleMs >= 0)) at('minCycleMs', 'must be 0 or more');
  // 0 means "no floor"; any other value under 1.00 would be a floor the value passes on its way up.
  if (!(Number.isFinite(p.minCashout) && (p.minCashout === 0 || p.minCashout >= 1))) {
    at('minCashout', 'must be 0 (no minimum) or at least 1.00');
  }
  if (!(Number.isFinite(p.maxMultiplier) && p.maxMultiplier > p.minCashout)) at('maxMultiplier', 'must be greater than minCashout');
  if (!SETBACK_MODES.includes(p.setbacksMode)) at('setbacksMode', `must be one of ${SETBACK_MODES.join(', ')}`);
  if (!BOOST_MODES.includes(p.boostsMode)) at('boostsMode', `must be one of ${BOOST_MODES.join(', ')}`);
  if (!SKINS.includes(p.skin)) at('skin', `must be one of ${SKINS.join(', ')}`);
  if (!PARTIAL.includes(p.partialCashout)) at('partialCashout', `must be one of ${PARTIAL.join(', ')}`);
  if (!DISCONNECT.includes(p.disconnectPolicy)) at('disconnectPolicy', `must be one of ${DISCONNECT.join(', ')}`);
  if (p.idlePromptMs !== null && !(Number.isFinite(p.idlePromptMs) && p.idlePromptMs > 0)) at('idlePromptMs', 'must be null or positive');
  if (!p.language) at('language', 'is required');
  if ((opts.requireOrigins ?? true) && p.regulated && p.operatorOrigins.length === 0) {
    at('operatorOrigins', 'regulated profiles need at least one operator origin');
  }
  if (opts.reportIndex && errors.length === 0) {
    for (const game of opts.games ?? registeredGames()) {
      let id: string;
      try {
        id = effectiveConfig(game, p).id;
      } catch (err) {
        at('maxMultiplier', (err as Error).message);
        continue;
      }
      const entry = opts.reportIndex[id];
      if (!entry?.pass) at('config', `${id} has no passing RTP report`);
      else if (entry.rounds < MIN_REPORT_ROUNDS) at('config', `${id} report has fewer than ${MIN_REPORT_ROUNDS} rounds`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertValidProfile(p: JurisdictionProfile, opts?: ProfileValidationOptions): JurisdictionProfile {
  const result = validateProfile(p, opts);
  if (!result.ok) throw new Error(`Invalid profile: ${result.errors.join('; ')}`);
  return p;
}
