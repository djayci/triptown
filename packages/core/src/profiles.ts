import { cappedConfigId, resolveConfigId, type GameConfig } from '@triptown/fairness';
import type { RevealMode } from './events';

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
/** Reveal modes a game can present. Every game supports `live`; deferred reveal is opt-in (gate-odds-mvp D4). */
const GAME_REVEALS = new Map<GameId, readonly RevealMode[]>();

/**
 * Registers a game so profiles may bind to it. `engine` names the game whose configs it plays, and
 * defaults to the game itself (a game bringing its own maths). Idempotent for the same engine.
 */
export function registerGame(game: GameId, engine: GameId = game, opts: { reveal?: readonly RevealMode[] } = {}): void {
  if (!game || game.includes('/')) throw new Error(`Invalid game id: ${JSON.stringify(game)}`);
  if (!engine || engine.includes('/')) throw new Error(`Invalid engine id: ${JSON.stringify(engine)}`);
  const existing = REGISTERED_GAMES.get(game);
  if (existing && existing !== engine) {
    throw new Error(`${game} is already registered on engine ${existing}, not ${engine}`);
  }
  REGISTERED_GAMES.set(game, engine);
  if (opts.reveal) GAME_REVEALS.set(game, [...new Set<RevealMode>(['live', ...opts.reveal])]);
}

/** Reveal modes the game declared; `live` only unless it opted into more. */
export function revealModesOf(game: GameId): readonly RevealMode[] {
  return GAME_REVEALS.get(game) ?? ['live'];
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
  // ---- Market flags (beat-the-gate-mvp market-profile-flags). Optional; absent means no effect. ----
  /** ISO 3166-1 alpha-2 country the profile licenses, e.g. "NG". */
  marketCountry?: string;
  /** Player regions refused at session creation (ISO 3166-2, e.g. "NG-KN"). Non-empty requires the operator to send the region. */
  blockedRegions?: string[];
  /** Deployment regions this profile may run in; empty or absent means any. */
  hostingRegions?: string[];
  /** Legal basis for moving players' personal data out of the market, when hosting is outside it. */
  dataTransferBasis?: string | null;
  /** Rules and results say winnings may be subject to withholding tax applied by the operator. */
  withholdingNotice?: boolean;
  /** Show other players' activity. No profile enables it (no fake or social-pressure feeds). */
  liveBetsFeed?: boolean;
  /**
   * When the player learns a crash (gate-odds-mvp). `onCollect` hides it until the player's reveal and is
   * only valid with setbacks and boosts off, where the chance of reaching a value is exactly RTP ÷ value.
   * Absent means `live`.
   */
  crashReveal?: RevealMode;
  /**
   * Whether a player may run a round with no stake (practice-rounds). Absent means off, so a new profile
   * offers none until it says otherwise. Free play is treated as advertising in several markets (UK CAP,
   * Brazil 1.231), which brings age-gating and content rules a gameplay flag cannot answer, so enabling
   * it for a market is a legal decision rather than a config change.
   */
  practiceRounds?: boolean;
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
    // Unregulated markets only. Regulated templates leave this absent, because free play is advertising
    // there (UK CAP, Brazil 1.231) and carries obligations a gameplay flag cannot answer.
    practiceRounds: true,
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
  'ng-draft': {
    ...base,
    name: 'ng-draft',
    status: 'draft',
    regulated: true,
    sources: [
      'docs/compliance/night-meet-2026-09-16.md (Lagos LSLGA Law 2021, RG Regs reg.7, ARCON, NDPA 2023 s.41)',
    ],
    minCycleMs: 5000,
    quickReplay: false,
    setbacksMode: 'off',
    skin: 'adult',
    // Sound on by default (user decision, 17 Sep 2026); no Nigerian or Ghanaian rule found requiring muted.
    soundDefault: 'on',
    intensityEffects: true,
    showSessionClock: true,
    showNetPosition: true,
    marketCountry: 'NG',
    // States that apply Sharia criminal law and ban gambling (research M); operators geo-block by state.
    blockedRegions: ['NG-BA', 'NG-BO', 'NG-GO', 'NG-JI', 'NG-KD', 'NG-KN', 'NG-KT', 'NG-KE', 'NG-NI', 'NG-SO', 'NG-YO', 'NG-ZA'],
    hostingRegions: [],
    dataTransferBasis: 'operator-dpa-scc',
    withholdingNotice: true,
    liveBetsFeed: false,
    // Gate Rush markets: the crash is revealed at the player's IN! (gate-odds-mvp D4). Only games that
    // opt in play it; every other game on this profile stays live.
    crashReveal: 'onCollect',
  },
  'gh-draft': {
    ...base,
    name: 'gh-draft',
    status: 'draft',
    regulated: true,
    sources: ['docs/compliance/night-meet-2026-09-16.md (Gaming Act 2006, GCG advertising guidelines, Act 843, Act 1129)'],
    minCycleMs: 5000,
    quickReplay: false,
    setbacksMode: 'off',
    skin: 'adult',
    // Sound on by default (user decision, 17 Sep 2026); no Nigerian or Ghanaian rule found requiring muted.
    soundDefault: 'on',
    intensityEffects: true,
    showSessionClock: true,
    showNetPosition: true,
    marketCountry: 'GH',
    blockedRegions: [],
    hostingRegions: [],
    dataTransferBasis: 'operator-dpa',
    // Ghana repealed the 10% withholding tax on winnings from 2 Apr 2025 (Act 1129).
    withholdingNotice: false,
    liveBetsFeed: false,
    crashReveal: 'onCollect',
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
  // Two axes, four ids (good-mole D6): v3 is unboosted, v4 boosted; `-rising` means no setbacks.
  // v3/v4 are the slow-pace family (median round 8.4 s). v1/v2 stay registered so rounds settled under
  // them still verify, but no new round starts on one.
  const suffix = mode === 'off' ? '-rising' : '';
  // An engine with no boosted config plays the unboosted maths, whatever the profile asks for.
  if (boosts === 'boost' && resolveConfigId(`${engine}/v4${suffix}`)) return `${engine}/v4${suffix}`;
  if (resolveConfigId(`${engine}/v3${suffix}`)) return `${engine}/v3${suffix}`;
  if (boosts === 'boost' && resolveConfigId(`${engine}/v2${suffix}`)) return `${engine}/v2${suffix}`;
  return `${engine}/v1${suffix}`;
}

/**
 * The reveal mode a round plays: deferred only when the game supports it, the profile enables it, and the
 * config has no setbacks, no boosts and a single stake part. Anything else plays live.
 */
/** Whether this profile offers stake-free practice rounds. Absent means off (practice-rounds D4). */
export function practiceAllowed(profile: Pick<JurisdictionProfile, 'practiceRounds'>): boolean {
  return profile.practiceRounds === true;
}

export function effectiveReveal(game: GameId, profile: Pick<JurisdictionProfile, 'crashReveal'>, config: GameConfig): RevealMode {
  if (profile.crashReveal !== 'onCollect' || !revealModesOf(game).includes('onCollect')) return 'live';
  const exact = config.lambda === 0 && config.boostRate === 0 && config.stakeParts === 1;
  return exact ? 'onCollect' : 'live';
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
  if (p.marketCountry !== undefined && !/^[A-Z]{2}$/.test(p.marketCountry)) at('marketCountry', 'must be an ISO 3166-1 alpha-2 code');
  if (p.blockedRegions?.some((r) => !/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(r))) at('blockedRegions', 'must be ISO 3166-2 codes such as NG-KN');
  if (p.hostingRegions?.some((r) => !r.trim())) at('hostingRegions', 'must not contain empty region names');
  if (p.liveBetsFeed === true) at('liveBetsFeed', 'no profile may enable a live bets feed');
  if (p.crashReveal !== undefined && p.crashReveal !== 'live' && p.crashReveal !== 'onCollect') at('crashReveal', "must be 'live' or 'onCollect'");
  if (p.practiceRounds !== undefined && typeof p.practiceRounds !== 'boolean') at('practiceRounds', 'must be true or false');
  if (p.crashReveal === 'onCollect' && (p.setbacksMode !== 'off' || p.boostsMode !== 'off')) {
    at('crashReveal', 'onCollect needs setbacks and boosts off, or the odds shown would not be exact');
  }
  // An active profile for a market whose hosting sits outside that market needs a recorded transfer basis (NDPA s.41).
  if (p.status === 'active' && p.marketCountry && p.hostingRegions?.length) {
    const inMarket = p.hostingRegions.some((r) => r.toUpperCase().startsWith(`${p.marketCountry}-`) || r.toUpperCase() === p.marketCountry);
    if (!inMarket && !p.dataTransferBasis) at('dataTransferBasis', `hosting outside ${p.marketCountry} needs a data transfer basis`);
  }
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

export type RegionCheck = { ok: true } | { ok: false; code: 'region_blocked' | 'region_required' | 'profile_unavailable'; message: string };

/**
 * Session gate for market flags: refuses players from blocked regions (or with no region when a list exists),
 * and profiles whose allowed hosting regions exclude this deployment.
 */
export function checkSessionRegion(p: JurisdictionProfile, playerRegion: string | undefined, deploymentRegion: string | undefined): RegionCheck {
  if (p.hostingRegions?.length && (!deploymentRegion || !p.hostingRegions.includes(deploymentRegion))) {
    return { ok: false, code: 'profile_unavailable', message: `Profile ${p.name} is not available in this deployment region` };
  }
  if (p.blockedRegions?.length) {
    if (!playerRegion) return { ok: false, code: 'region_required', message: 'The operator must send the player region for this market' };
    if (p.blockedRegions.includes(playerRegion.toUpperCase())) return { ok: false, code: 'region_blocked', message: 'This game is not available in the player region' };
  }
  return { ok: true };
}
