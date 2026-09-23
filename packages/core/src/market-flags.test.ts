import { describe, expect, it } from 'vitest';
import { MemoryRoundStore } from './store';
import { HostError, RoundHost } from './host';
import { GHS_CURRENCY, NGN_CURRENCY, formatMoney, validateBet } from './money';
import { PROFILE_TEMPLATES, checkSessionRegion, profileFromTemplate, validateProfile, type JurisdictionProfile } from './profiles';

const origins = ['https://op.example'];

describe('market profile flags', () => {
  it('ships Nigeria and Ghana drafts with the agreed values', () => {
    const ng = profileFromTemplate('ng-draft', origins);
    const gh = profileFromTemplate('gh-draft', origins);
    for (const p of [ng, gh]) {
      expect(p).toMatchObject({ status: 'draft', minCycleMs: 5000, quickReplay: true, setbacksMode: 'off', skin: 'adult', showSessionClock: false, showNetPosition: false, liveBetsFeed: false });
      expect(validateProfile(p)).toEqual({ ok: true });
      expect(p.dataTransferBasis).toBeTruthy();
    }
    expect(ng.blockedRegions).toEqual(['NG-BA', 'NG-BO', 'NG-GO', 'NG-JI', 'NG-KD', 'NG-KN', 'NG-KT', 'NG-KE', 'NG-NI', 'NG-SO', 'NG-YO', 'NG-ZA']);
    expect(ng.withholdingNotice).toBe(true);
    expect(gh.withholdingNotice).toBe(false);
  });

  it('leaves existing profiles unchanged (no market flags set)', () => {
    for (const name of ['light']) {
      const p = profileFromTemplate(name, origins);
      expect(p.blockedRegions).toBeUndefined();
      expect(p.hostingRegions).toBeUndefined();
      expect(checkSessionRegion(p, undefined, undefined)).toEqual({ ok: true });
    }
  });

  it('enables deferred reveal only in the Nigeria and Ghana drafts', () => {
    const deferred = Object.keys(PROFILE_TEMPLATES).filter((name) => profileFromTemplate(name, origins).crashReveal === 'onCollect');
    expect(deferred.sort()).toEqual(['gh-draft', 'ng-draft']);
    for (const name of deferred) expect(validateProfile(profileFromTemplate(name, origins)).ok).toBe(true);
  });

  it('validates flag values', () => {
    // An active profile with no market flags set: the transfer-basis rule only bites once a profile
    // is active, so a draft template cannot stand in here.
    const flat = {
      ...profileFromTemplate('ng-draft', origins),
      status: 'active' as const,
      crashReveal: undefined,
      marketCountry: undefined,
      blockedRegions: undefined,
      hostingRegions: undefined,
      dataTransferBasis: undefined,
    };
    const bad = (patch: Partial<JurisdictionProfile>) => validateProfile({ ...flat, ...patch });
    expect(bad({ blockedRegions: ['Kano'] }).ok).toBe(false);
    expect(bad({ liveBetsFeed: true }).ok).toBe(false);
    expect(bad({ marketCountry: 'Nigeria' }).ok).toBe(false);
    // Hosting outside the market needs a transfer basis once the profile is active.
    expect(bad({ marketCountry: 'NG', hostingRegions: ['us-east-1'] }).ok).toBe(false);
    expect(bad({ marketCountry: 'NG', hostingRegions: ['us-east-1'], dataTransferBasis: 'operator-dpa-scc' }).ok).toBe(true);
    expect(bad({ marketCountry: 'NG', hostingRegions: ['NG-LA-1'] }).ok).toBe(true);
  });

  it('gates sessions by player and deployment region', () => {
    const ng = profileFromTemplate('ng-draft', origins);
    expect(checkSessionRegion(ng, 'NG-KN', undefined)).toMatchObject({ ok: false, code: 'region_blocked' });
    expect(checkSessionRegion(ng, undefined, undefined)).toMatchObject({ ok: false, code: 'region_required' });
    expect(checkSessionRegion(ng, 'NG-LA', undefined)).toEqual({ ok: true });
    const hosted = { ...ng, hostingRegions: ['af-south-1'] };
    expect(checkSessionRegion(hosted, 'NG-LA', 'us-east-1')).toMatchObject({ ok: false, code: 'profile_unavailable' });
    expect(checkSessionRegion(hosted, 'NG-LA', 'af-south-1')).toEqual({ ok: true });
  });

  it('refuses a crash session from a blocked region before creating anything', async () => {
    const store = new MemoryRoundStore();
    const host = new RoundHost({
      store,
      clock: { now: () => 1 },
      sleep: async () => {},
      profiles: { defaultProfile: profileFromTemplate('light'), allowOverride: true },
    });
    await expect(host.createSession(100, { profile: 'ng-draft', playerRegion: 'NG-KN' })).rejects.toSatisfy((e: unknown) => e instanceof HostError && e.code === 'region_blocked');
    await expect(host.createSession(100, { profile: 'ng-draft', playerRegion: 'NG-LA' })).resolves.toMatchObject({ profile: { name: 'ng-draft' } });
  });
});

describe('naira and cedi', () => {
  it('formats with symbols in integer minor units', () => {
    expect(formatMoney(395_000, NGN_CURRENCY)).toBe('₦3,950.00');
    expect(formatMoney(1_50, GHS_CURRENCY)).toBe('GH₵1.50');
    expect(formatMoney(-500, NGN_CURRENCY)).toBe('-₦5.00');
  });

  it('rejects a stake below the naira minimum', () => {
    expect(validateBet(NGN_CURRENCY.minBetMinor - 1, NGN_CURRENCY)).toMatchObject({ ok: false, code: 'bet_limit' });
    expect(validateBet(NGN_CURRENCY.minBetMinor, NGN_CURRENCY)).toEqual({ ok: true });
  });
});
