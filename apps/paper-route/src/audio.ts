import { AudioManager, type AudioManifest } from '@triptown/engine/audio';
import { safeStorage, type StorageLike } from '@triptown/engine/audio-settings';
import type { Sounds } from './game/controller';

// Paper Route audio on top of the engine AudioManager: one effects sprite and a moped engine loop used as the
// rate-following "tone". Paper Route has no music stems, so music is never loaded or started.

interface PaperRouteManifest {
  sfx: AudioManifest['sfx'];
  engine: AudioManifest['tone'];
}

const SETTINGS_KEY = 'triptown.audio.v1';

export class PaperRouteAudio implements Sounds {
  private constructor(
    readonly manager: AudioManager,
    private readonly intensityEffects: () => boolean,
  ) {}

  /** Loads the manifest; resolves null when audio is unavailable, so the game plays silently. */
  static async load(opts: { soundDefault: 'on' | 'muted'; intensityEffects: () => boolean; base?: string; storage?: StorageLike | null }): Promise<PaperRouteAudio | null> {
    const base = opts.base ?? 'assets/';
    try {
      const res = await fetch(`${base}audio/audio.json`);
      if (!res.ok) return null;
      const m = (await res.json()) as PaperRouteManifest;
      const prefix = (src: string[]) => src.map((s) => `${base}${s}`);
      const engine = { src: prefix(m.engine.src), loop: m.engine.loop };
      const storage = opts.storage === undefined ? safeStorage(() => globalThis.localStorage) : opts.storage;
      // Stems are required by the manager's type but never loaded: loadMusic() is not called for this game.
      const manager = new AudioManager({ sfx: { src: prefix(m.sfx.src), sprite: m.sfx.sprite }, tone: engine, stems: { base: engine, drums: engine, lead: engine } }, storage);
      // First visit follows the profile default (regulated profiles start muted); later visits keep the player's choice.
      let stored = false;
      try {
        stored = storage?.getItem(SETTINGS_KEY) !== null && storage?.getItem(SETTINGS_KEY) !== undefined;
      } catch {
        stored = false;
      }
      if (!stored && opts.soundDefault === 'muted') manager.setMuted(true);
      return new PaperRouteAudio(manager, opts.intensityEffects);
    } catch {
      return null;
    }
  }

  play(name: Parameters<Sounds['play']>[0]): void {
    this.manager.playSfx(name);
  }

  startRide(): void {
    this.manager.startTone();
    this.manager.setToneMultiplier(1);
  }

  /** The engine pitch rises with the multiplier only when intensity effects are on for the profile. */
  rideMultiplier(multiplier: number): void {
    this.manager.setToneMultiplier(this.intensityEffects() ? multiplier : 1);
  }

  stopRide(): void {
    this.manager.stopTone();
  }
}
