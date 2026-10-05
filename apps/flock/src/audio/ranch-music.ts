import { Howler } from 'howler';
import type { AudioManager } from '@triptown/engine';

/**
 * Flock's round music (scripts/music.mjs): one fiddle hook rendered at four rising tempos, each tier
 * adding to the band. As the round's elapsed time passes each threshold, the music steps
 * up a tier on the next bar line and carries on from the same bar. Each tier is rendered at its own
 * speed, so the band gets faster while the pitch stays fixed (the user, 4 Oct 2026).
 *
 * It plays on the shared audio context, into Howler's master gain, so the player's mute and the
 * page-hidden suspend apply to it exactly as to every other sound, and it follows the shared music
 * volume. It knows the round only through the shared `pace` (elapsed time), never the crash time.
 */
export interface RanchTier {
  src: string[];
  bpm: number;
  loopMs: number;
}
export interface RanchManifest {
  /** The shared pace (0..1, elapsed time) at which each tier begins. */
  pace: number[];
  bars: number;
  tiers: RanchTier[];
}

/** The highest tier whose threshold the pace has reached. */
export function tierFor(pace: number, thresholds: readonly number[]): number {
  let tier = 0;
  thresholds.forEach((th, i) => {
    if (pace >= th) tier = i;
  });
  return tier;
}

/**
 * When to step from the playing tier to the next, and where to start in it: on the next bar line, at
 * the same bar of the tune, so the song carries on and only the tempo lifts. `startedAt` is the context
 * time at which the playing tier's bar 0 began.
 */
export function planSwitch(
  now: number,
  startedAt: number,
  fromBpm: number,
  toBpm: number,
  bars: number,
  minLead = 0.03,
): { at: number; offset: number; bar: number } {
  const barLen = 240 / fromBpm;
  const loopLen = bars * barLen;
  const pos = (((now - startedAt) % loopLen) + loopLen) % loopLen;
  let next = Math.floor(pos / barLen) + 1;
  if (next * barLen - pos < minLead) next += 1;
  const bar = next % bars;
  return { at: now + (next * barLen - pos), offset: bar * (240 / toBpm), bar };
}

const MUSIC_GAIN = 0.85;

interface Playing {
  source: AudioBufferSourceNode;
  gain: GainNode;
  tier: number;
  /** Context time at which this tier's bar 0 began (or would have). */
  startedAt: number;
}

export class RanchMusic {
  private buffers: AudioBuffer[] = [];
  private bus: GainNode | null = null;
  private playing: Playing | null = null;
  private pendingUntil = 0;
  private offChange: (() => void) | null = null;

  constructor(
    private readonly manifest: RanchManifest,
    private readonly resolve: (path: string) => string,
    private readonly audio: AudioManager,
  ) {}

  private get ctx(): AudioContext | null {
    return (Howler.ctx as AudioContext | undefined) ?? null;
  }

  /** Fetches and decodes every tier. Called after the first frame, so music never delays startup. */
  async load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const opus =
      typeof Audio !== 'undefined' && new Audio().canPlayType('audio/webm; codecs="opus"') !== '';
    try {
      this.buffers = await Promise.all(
        this.manifest.tiers.map(async (t) => {
          const path = t.src[opus ? 0 : 1] ?? t.src[0]!;
          const data = await fetch(this.resolve(path)).then((r) => r.arrayBuffer());
          return ctx.decodeAudioData(data);
        }),
      );
    } catch (err) {
      // The game stays fully playable without music.
      console.warn('[flock] music unavailable', err);
      this.buffers = [];
    }
  }

  private volume(): number {
    return this.audio.current.music * MUSIC_GAIN;
  }

  /** The round started: tier 1 from the top. */
  start(): void {
    const ctx = this.ctx;
    if (!ctx || this.buffers.length === 0) return;
    this.stop(0);
    const bus = ctx.createGain();
    bus.gain.value = this.volume();
    bus.connect((Howler.masterGain as GainNode | undefined) ?? ctx.destination);
    this.bus = bus;
    this.offChange = this.audio.onChange(() => {
      if (this.bus && this.ctx)
        this.bus.gain.setTargetAtTime(this.volume(), this.ctx.currentTime, 0.05);
    });
    this.playing = this.play(0, ctx.currentTime + 0.03, 0);
  }

  /** The shared pace, every frame. Steps up one tier at a time on a bar line, never down within a round. */
  setPace(pace: number): void {
    const ctx = this.ctx;
    const p = this.playing;
    if (!ctx || !p || ctx.currentTime < this.pendingUntil) return;
    const target = tierFor(pace, this.manifest.pace);
    if (target <= p.tier || p.tier + 1 >= this.buffers.length) return;
    const next = p.tier + 1;
    const from = this.manifest.tiers[p.tier]!;
    const to = this.manifest.tiers[next]!;
    const { at, offset } = planSwitch(
      ctx.currentTime,
      p.startedAt,
      from.bpm,
      to.bpm,
      this.manifest.bars,
    );
    // A 30 ms crossfade on the bar line.
    p.gain.gain.setValueAtTime(1, at);
    p.gain.gain.linearRampToValueAtTime(0, at + 0.03);
    p.source.stop(at + 0.05);
    this.playing = this.play(next, at, offset);
    this.pendingUntil = at + 0.05;
  }

  /** The round is over (or the screen changed): fade out and stop. */
  stop(fadeMs = 250): void {
    const ctx = this.ctx;
    this.offChange?.();
    this.offChange = null;
    const bus = this.bus;
    const p = this.playing;
    this.playing = null;
    this.bus = null;
    this.pendingUntil = 0;
    if (!ctx || !bus) return;
    const end = ctx.currentTime + fadeMs / 1000;
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0, end);
    try {
      p?.source.stop(end + 0.05);
    } catch {
      // already stopped
    }
    setTimeout(() => bus.disconnect(), fadeMs + 100);
  }

  /** For demo-build checks: the tier now playing and its tempo, or null when silent. */
  get state(): { tier: number; bpm: number } | null {
    const p = this.playing;
    return p ? { tier: p.tier, bpm: this.manifest.tiers[p.tier]!.bpm } : null;
  }

  private play(tier: number, at: number, offset: number): Playing {
    const ctx = this.ctx!;
    const buf = this.buffers[tier]!;
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.min(buf.duration, this.manifest.tiers[tier]!.loopMs / 1000);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + 0.02);
    source.connect(gain).connect(this.bus!);
    source.start(at, offset);
    // `offset` seconds into the tier is where its bar 0 would have begun.
    return { source, gain, tier, startedAt: at - offset };
  }
}
