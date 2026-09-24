import type { GameStage } from '@triptown/crash-client';
import type { GameConfig } from '@triptown/fairness';
import type { RevealMode } from './stage';

/**
 * What GateView asks of a scene, so a look can bring its own: the side-on field (GateStage) or the
 * top-down track (TrackStage). Every call says what already happened; none carries the result, and the
 * party is only called after the base's celebrate decision.
 */
export interface GateScene extends GameStage {
  setRevealMode(mode: RevealMode): void;
  /** Round start, or a refused RIDE HOME putting the horse back out. */
  rideOut(): void;
  /** Gate Rush: RIDE HOME pressed, result unknown. The same for every outcome. */
  headHome(): void;
  /** Gate Rush: settled as won. */
  revealOpen(): void;
  /** Live (Beat the Gate): a confirmed cash-out. */
  rideHome(onDone?: () => void): void;
  /** A milestone reached: driven by the multiplier only. */
  kick(size?: number): void;
  /** A celebrated win, after the base's decision. */
  celebrate(big: boolean): void;
  debugScene(): { tileW: number; crowdX: number; flashes: number[] };
  /** A scene that paints the values (and in Gate Rush their chances) into itself takes the round's configuration here. */
  setLadder?(config: GameConfig, chances: boolean): void;
}
