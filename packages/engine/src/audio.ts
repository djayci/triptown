import { Howl, Howler } from 'howler';
import {
  loadAudioSettings,
  safeStorage,
  saveAudioSettings,
  toneRate,
  type AudioSettings,
  type StorageLike,
} from './audio-settings';

/** A file whose [startMs, durationMs] region loops seamlessly (kept away from encoder padding at the edges). */
export interface LoopAsset {
  src: string[];
  loop: [number, number];
}

export interface AudioManifest {
  /** Effects sprite: one file, named [offsetMs, durationMs] regions. */
  sfx: { src: string[]; sprite: Record<string, [number, number]> };
  /** Music stems of identical length and tempo, started together. */
  stems: { base: LoopAsset; drums: LoopAsset; lead: LoopAsset };
  /** Soft between-rounds bed, unrelated to the round stems. */
  lobby?: LoopAsset;
  /** Short seamless loop whose rate follows the multiplier. */
  tone: LoopAsset;
}

/** The lobby bed sits under the game, well below the round mix. */
const LOBBY_GAIN = 0.7;

const loopHowl = (asset: LoopAsset) =>
  new Howl({ src: asset.src, sprite: { loop: [asset.loop[0], asset.loop[1], true] }, volume: 0, preload: true });

export type IntensityLevel = 0 | 1 | 2;

const LAYER_FADE_MS = 400;

/**
 * Game audio: sfx sprite, layered music, pitch-following tone, persisted mute and volumes,
 * suspended while hidden. Every method is safe to call when audio is unavailable.
 */
export class AudioManager {
  private settings: AudioSettings;
  private readonly storage: StorageLike | null;
  private sfx: Howl | null = null;
  private stems: { base: Howl; drums: Howl; lead: Howl } | null = null;
  private tone: Howl | null = null;
  private toneId: number | null = null;
  private musicPlaying = false;
  private intensity: IntensityLevel = 0;
  private lobby: Howl | null = null;
  private lobbyId: number | null = null;
  private ducked = false;
  private interacted = false;
  private readonly listeners = new Set<(s: AudioSettings) => void>();
  /** Recent audio actions, newest last. For debugging and automated checks. */
  readonly log: string[] = [];

  constructor(
    private readonly manifest: AudioManifest,
    storage: StorageLike | null = safeStorage(() => globalThis.localStorage),
  ) {
    this.storage = storage;
    this.settings = loadAudioSettings(storage);
    Howler.autoUnlock = true;
    Howler.mute(this.settings.muted);
  }

  get current(): AudioSettings {
    return { ...this.settings };
  }

  /** True once the player has interacted, which is when browsers allow audio. */
  get unlocked(): boolean {
    return this.interacted;
  }

  onChange(listener: (s: AudioSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Loads the effects sprite now. Call after the first frame. */
  loadEffects() {
    if (this.sfx) return;
    this.sfx = this.safe(() => new Howl({ src: this.manifest.sfx.src, sprite: this.manifest.sfx.sprite, volume: this.settings.sfx, preload: true }));
    this.tone = this.safe(() => loopHowl(this.manifest.tone));
  }

  /** Loads music stems. Separate so music never delays startup. */
  loadMusic() {
    if (this.stems) return;
    const { base, drums, lead } = this.manifest.stems;
    this.stems = this.safe(() => ({ base: loopHowl(base), drums: loopHowl(drums), lead: loopHowl(lead) }));
    if (this.manifest.lobby) this.lobby = this.safe(() => loopHowl(this.manifest.lobby!));
  }

  /** Call from the first user gesture (the BET tap). */
  unlock() {
    this.interacted = true;
    this.safe(() => {
      const ctx = Howler.ctx as AudioContext | undefined;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    });
  }

  /** `byPlayer` marks the choice as the player's, so a profile default never overrides it later. */
  setMuted(muted: boolean, byPlayer = true) {
    this.update(byPlayer ? { muted, touched: true } : { muted });
    this.safe(() => Howler.mute(muted));
  }

  setMusicVolume(music: number) {
    this.update({ music });
    this.applyLayerVolumes(0);
  }

  setSfxVolume(sfx: number) {
    this.update({ sfx });
    this.safe(() => this.sfx?.volume(sfx));
  }

  playSfx(name: string, opts: { volume?: number } = {}) {
    if (!this.interacted) return;
    this.record(`sfx:${name}`);
    this.safe(() => {
      if (!this.sfx || !(name in this.manifest.sfx.sprite)) return;
      const id = this.sfx.play(name);
      if (opts.volume !== undefined) this.sfx.volume(this.settings.sfx * opts.volume, id);
    });
  }

  startMusic() {
    if (!this.interacted || !this.stems || this.musicPlaying) return;
    this.musicPlaying = true;
    this.record('music:start');
    this.intensity = 0;
    this.ducked = false;
    this.safe(() => {
      const { base, drums, lead } = this.stems!;
      // Same instant for all stems keeps them on the beat.
      [base, drums, lead].forEach((h) => {
        h.stop();
        h.volume(0);
        h.play('loop');
      });
      this.applyLayerVolumes(150);
    });
  }

  /** Starts the between-rounds bed. Separate track from the round stems, and quieter. */
  startLobby() {
    if (!this.interacted || !this.lobby || this.lobbyId !== null) return;
    this.record('lobby:start');
    this.safe(() => {
      this.lobbyId = this.lobby!.play('loop');
      this.lobby!.volume(0, this.lobbyId);
      this.lobby!.fade(0, this.settings.music * LOBBY_GAIN, 600, this.lobbyId);
    });
  }

  stopLobby(fadeMs = 250) {
    if (!this.lobby || this.lobbyId === null) return;
    const id = this.lobbyId;
    this.lobbyId = null;
    this.record('lobby:stop');
    this.safe(() => {
      this.lobby!.fade(Number(this.lobby!.volume(id)) || 0, 0, fadeMs, id);
      setTimeout(() => this.safe(() => this.lobby?.stop(id)), fadeMs + 40);
    });
  }

  setIntensity(level: IntensityLevel) {
    if (level === this.intensity) return;
    this.intensity = level;
    this.record(`music:intensity:${level}`);
    this.applyLayerVolumes(LAYER_FADE_MS);
  }

  /** Cuts the music briefly (setback sting). */
  duckMusic(ms = 300) {
    if (!this.musicPlaying) return;
    this.record('music:duck');
    this.ducked = true;
    this.applyLayerVolumes(60);
    setTimeout(() => {
      this.ducked = false;
      this.applyLayerVolumes(200);
    }, ms);
  }

  stopMusic(fadeMs = 250) {
    if (!this.stems || !this.musicPlaying) return;
    this.musicPlaying = false;
    this.record('music:stop');
    this.safe(() => {
      Object.values(this.stems!).forEach((h) => {
        h.fade(h.volume(), 0, fadeMs);
        setTimeout(() => h.stop(), fadeMs + 20);
      });
    });
  }

  startTone() {
    if (!this.interacted || !this.tone || this.toneId !== null) return;
    this.record('tone:start');
    this.safe(() => {
      this.toneId = this.tone!.play('loop');
      this.tone!.volume(this.settings.sfx * 0.35, this.toneId);
      this.tone!.rate(1, this.toneId);
    });
  }

  /** Last applied tone playback rate, for checks. */
  toneRateValue = 1;

  setToneMultiplier(multiplier: number) {
    if (this.toneId === null) return;
    this.toneRateValue = toneRate(multiplier);
    this.safe(() => this.tone!.rate(toneRate(multiplier), this.toneId!));
  }

  stopTone() {
    if (this.toneId === null) return;
    const id = this.toneId;
    this.toneId = null;
    this.record('tone:stop');
    this.safe(() => this.tone!.stop(id));
  }

  /** Suspends all audio while hidden and resumes in place, so stems stay in sync. */
  setVisible(visible: boolean) {
    this.record(visible ? 'ctx:resume' : 'ctx:suspend');
    this.safe(() => {
      const ctx = Howler.ctx as AudioContext | undefined;
      if (!ctx) return;
      if (visible && this.interacted) void ctx.resume();
      else if (!visible) void ctx.suspend();
    });
  }

  get musicLayerTargets(): { base: number; drums: number; lead: number } {
    const m = this.ducked ? Math.min(0.08, this.settings.music) : this.settings.music;
    return {
      base: m,
      drums: this.intensity >= 1 ? m : 0,
      lead: this.intensity >= 2 ? m : 0,
    };
  }

  private applyLayerVolumes(fadeMs: number) {
    if (!this.stems || !this.musicPlaying) return;
    const targets = this.musicLayerTargets;
    this.safe(() => {
      (Object.keys(targets) as (keyof typeof targets)[]).forEach((k) => {
        const h = this.stems![k];
        if (fadeMs > 0) h.fade(h.volume(), targets[k], fadeMs);
        else h.volume(targets[k]);
      });
    });
  }

  private record(entry: string) {
    this.log.push(entry);
    if (this.log.length > 200) this.log.shift();
  }

  private update(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch };
    saveAudioSettings(this.storage, this.settings);
    this.listeners.forEach((l) => l(this.current));
  }

  private safe<T>(fn: () => T): T | null {
    try {
      return fn();
    } catch (err) {
      console.warn('[audio]', err);
      return null;
    }
  }
}
