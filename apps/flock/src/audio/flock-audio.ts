import { AudioManager, type AudioManifest } from '@triptown/engine';

/**
 * When the lobby starts relative to a result cue's end. Negative: the cue's last part is its reverb tail,
 * and the lobby fades in over 600 ms, so starting it a little before the end lets the howl die away into
 * it. The cue is over before the lobby is heard; a gap after it read as dead air (the user, 5 Oct 2026).
 */
export const LOBBY_GAP_MS = -300;
/** How long a lobby start waits before it looks, so a cue fired in the same moment is seen. */
const SETTLE_MS = 60;

/**
 * When the lobby may start: as every cue still playing ends, offset by the gap. A pure function so
 * the rule is testable without audio.
 */
export function lobbyDelay(now: number, cueEndsAt: number, gapMs = LOBBY_GAP_MS): number {
  return Math.max(0, cueEndsAt + gapMs - now);
}

/**
 * Flock's audio manager: the shared one, except that the lobby bed never starts over a cue. The shared
 * controller starts the lobby as a round settles, in the same moment the crash or win cue plays; Flock's
 * crash cue is long (the band stops, the wolf howls, the flock scatters), and the user wants the result
 * and the lobby to be separate moments (5 Oct 2026). The lobby waits for the cue to end.
 * Only Flock uses this; the shared engine is unchanged.
 */
export class FlockAudio extends AudioManager {
  private cueEndsAt = 0;
  private lobbyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly flockManifest: AudioManifest) {
    super(flockManifest);
  }

  override playSfx(name: string, opts: { volume?: number } = {}): void {
    const region = this.flockManifest.sfx.sprite[name];
    // The countdown tick is not a moment of its own; everything else holds the lobby back.
    if (region && name !== 'tick')
      this.cueEndsAt = Math.max(this.cueEndsAt, performance.now() + region[1]);
    super.playSfx(name, opts);
  }

  override startLobby(): void {
    if (this.lobbyTimer !== null) return;
    const check = (): void => {
      const wait = lobbyDelay(performance.now(), this.cueEndsAt);
      if (wait > 0) {
        this.lobbyTimer = setTimeout(check, wait);
        return;
      }
      this.lobbyTimer = null;
      super.startLobby();
    };
    this.lobbyTimer = setTimeout(check, SETTLE_MS);
  }

  override stopLobby(fadeMs = 250): void {
    if (this.lobbyTimer !== null) clearTimeout(this.lobbyTimer);
    this.lobbyTimer = null;
    super.stopLobby(fadeMs);
  }
}
