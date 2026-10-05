import { Howler } from 'howler';
import type { AudioManager } from '@triptown/engine';
import { strideCadence } from '../game/flock';

/**
 * Flock's hooves (scripts/build-audio.mjs): the hero's own gallop, then layers of more and more rams'
 * hooves, mixed in as rams join on screen, so the sound grows from one ram to a herd's rumble. All layers
 * play together at one rate that follows the legs on screen (`strideCadence`), and fade out as the run
 * pulls up.
 *
 * It hears only what the stage draws: how many rams are running (from the multiplier on screen) and how
 * fast (from elapsed time). Never the crash time. It plays into Howler's master gain at the effects
 * volume, so the player's mute and the page-hidden suspend apply to it.
 */
export interface HoofLayer {
  src: string[];
  /** Rams on screen at which the layer starts to come in, and at which it is full. */
  from: number;
  full: number;
}
export interface HoovesManifest {
  /** Strides per second the loops were rendered at. */
  cadence: number;
  layers: HoofLayer[];
}

/** How much of a layer plays with `rams` running beside the hero: 0 below `from`, 1 from `full`. */
export function layerGain(rams: number, layer: Pick<HoofLayer, 'from' | 'full'>): number {
  if (layer.full <= layer.from) return rams >= layer.from ? 1 : 0;
  return Math.max(0, Math.min(1, (rams - layer.from) / (layer.full - layer.from)));
}

/** The playback rate that puts the loops in step with the legs, kept where hooves still sound like hooves. */
export function strideRate(speed: number, renderedCadence: number): number {
  return Math.max(0.6, Math.min(1.8, strideCadence(speed) / renderedCadence));
}

/** All hooves fade with the run itself: silent standing, full once he is properly moving. */
export function runGain(speed: number): number {
  return Math.max(0, Math.min(1, (speed - 10) / 70));
}

const HOOF_GAIN = 0.55;
const SMOOTH = 0.08;

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class HoovesPlayer {
  private buffers: AudioBuffer[] = [];
  private bus: GainNode | null = null;
  private voices: Voice[] = [];
  private offChange: (() => void) | null = null;

  constructor(
    private readonly manifest: HoovesManifest,
    private readonly resolve: (path: string) => string,
    private readonly audio: AudioManager,
  ) {}

  private get ctx(): AudioContext | null {
    return (Howler.ctx as AudioContext | undefined) ?? null;
  }

  /** Fetches and decodes every layer. Called after the first frame. */
  async load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const opus =
      typeof Audio !== 'undefined' && new Audio().canPlayType('audio/webm; codecs="opus"') !== '';
    try {
      this.buffers = await Promise.all(
        this.manifest.layers.map(async (l) => {
          const path = l.src[opus ? 0 : 1] ?? l.src[0]!;
          const data = await fetch(this.resolve(path)).then((r) => r.arrayBuffer());
          return ctx.decodeAudioData(data);
        }),
      );
    } catch (err) {
      // The game stays fully playable without them.
      console.warn('[flock] hooves unavailable', err);
      this.buffers = [];
    }
  }

  private volume(): number {
    return this.audio.current.sfx * HOOF_GAIN;
  }

  /** The run started: every layer starts together, in step, silent until the stage says otherwise. */
  start(): void {
    const ctx = this.ctx;
    if (!ctx || this.buffers.length === 0) return;
    this.stop(0);
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect((Howler.masterGain as GainNode | undefined) ?? ctx.destination);
    this.bus = bus;
    this.offChange = this.audio.onChange(() => this.set(this.lastRams, this.lastSpeed));
    const at = ctx.currentTime + 0.02;
    this.voices = this.buffers.map((buf) => {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(bus);
      source.start(at);
      return { source, gain };
    });
  }

  private lastRams = 0;
  private lastSpeed = 0;

  /** Every frame, from the stage: rams running on screen and the run speed. */
  set(rams: number, speed: number): void {
    this.lastRams = rams;
    this.lastSpeed = speed;
    const ctx = this.ctx;
    if (!ctx || !this.bus) return;
    const now = ctx.currentTime;
    this.bus.gain.setTargetAtTime(this.volume() * runGain(speed), now, SMOOTH);
    const rate = strideRate(speed, this.manifest.cadence);
    this.voices.forEach((v, i) => {
      v.gain.gain.setTargetAtTime(layerGain(rams, this.manifest.layers[i]!), now, SMOOTH);
      v.source.playbackRate.setTargetAtTime(rate, now, SMOOTH);
    });
  }

  /** The wolf, or a new screen: fade out and stop. */
  stop(fadeMs = 250): void {
    const ctx = this.ctx;
    this.offChange?.();
    this.offChange = null;
    const bus = this.bus;
    const voices = this.voices;
    this.bus = null;
    this.voices = [];
    if (!ctx || !bus) return;
    const end = ctx.currentTime + fadeMs / 1000;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0, end);
    for (const v of voices) {
      try {
        v.source.stop(end + 0.05);
      } catch {
        // already stopped
      }
    }
    setTimeout(() => bus.disconnect(), fadeMs + 100);
  }

  /** For demo-build checks: each layer's level now, and the rate, or null when silent. */
  get state(): { layers: number[]; rate: number } | null {
    if (!this.bus) return null;
    return {
      layers: this.manifest.layers.map((l) => Number(layerGain(this.lastRams, l).toFixed(2))),
      rate: Number(strideRate(this.lastSpeed, this.manifest.cadence).toFixed(2)),
    };
  }
}
