import { describe, expect, it } from 'vitest';
import { cappedResolution } from './app';
import {
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  safeStorage,
  saveAudioSettings,
  toneRate,
  type StorageLike,
} from './audio-settings';

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('audio settings', () => {
  it('defaults to sound on, music 60%, effects 90%', () => {
    expect(loadAudioSettings(null)).toEqual({ muted: false, music: 0.6, sfx: 0.9 });
  });

  it('round-trips through storage (mute remembered)', () => {
    const s = memory();
    saveAudioSettings(s, { muted: true, music: 0, sfx: 0.5 });
    expect(loadAudioSettings(s)).toEqual({ muted: true, music: 0, sfx: 0.5 });
  });

  it('falls back to defaults when storage throws or holds garbage', () => {
    expect(safeStorage(() => { throw new Error('SecurityError'); })).toBeNull();
    const broken: StorageLike = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(safeStorage(() => broken)).toBeNull();
    expect(loadAudioSettings(broken)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(() => saveAudioSettings(broken, DEFAULT_AUDIO_SETTINGS)).not.toThrow();
    const s = memory();
    s.setItem('triptown.audio.v1', '{nope');
    expect(loadAudioSettings(s)).toEqual(DEFAULT_AUDIO_SETTINGS);
    s.setItem('triptown.audio.v1', JSON.stringify({ muted: 'yes', music: 7, sfx: -1 }));
    expect(loadAudioSettings(s)).toEqual({ muted: false, music: 1, sfx: 0 });
  });

  it('maps multiplier to tone rate clamp(1 + 0.25*log2(m), 1, 2)', () => {
    expect(toneRate(1)).toBe(1);
    expect(toneRate(2)).toBe(1.25);
    expect(toneRate(16)).toBe(2);
    expect(toneRate(1000)).toBe(2);
    expect(toneRate(0.5)).toBe(1);
  });
});

describe('resolution', () => {
  it('caps DPR at 2', () => {
    expect(cappedResolution(3)).toBe(2);
    expect(cappedResolution(1.5)).toBe(1.5);
    expect(cappedResolution(0)).toBe(1);
  });
});
