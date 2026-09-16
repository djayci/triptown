export interface AudioSettings {
  muted: boolean;
  /** 0..1 */
  music: number;
  /** 0..1 */
  sfx: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = Object.freeze({ muted: false, music: 0.6, sfx: 0.9 });

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'triptown.audio.v1';
const clamp01 = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Resolves the storage lazily; some sandboxed iframes throw on access. */
export function safeStorage(get: () => StorageLike | undefined): StorageLike | null {
  try {
    const s = get();
    if (!s) return null;
    const probe = '__triptown_probe__';
    s.setItem(probe, '1');
    return s;
  } catch {
    return null;
  }
}

export function loadAudioSettings(storage: StorageLike | null): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_AUDIO_SETTINGS.muted,
      music: clamp01(parsed.music, DEFAULT_AUDIO_SETTINGS.music),
      sfx: clamp01(parsed.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(storage: StorageLike | null, settings: AudioSettings): void {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: settings simply don't persist.
  }
}

/** Rising tone playback rate from the design: clamp(1 + 0.25 * log2(m), 1, 2). */
export function toneRate(multiplier: number): number {
  if (!(multiplier > 0)) return 1;
  return Math.min(2, Math.max(1, 1 + 0.25 * Math.log2(multiplier)));
}
