/**
 * Which music stems play as a Whack Crash round climbs. The shared default follows the on-screen
 * SLOW/MEDIUM/FAST caption (drums at level 4, lead at 8), which was tuned against the fast config
 * family's 12 s ramp. The slow family doubled the ramp to 24 s but the median round only grew to
 * 7.2 s, so those thresholds landed at 8.4 s and 18.0 s: the drums missed 59% of rounds and the lead
 * reached 3.4% of them. A layer most players never hear is not a layer.
 *
 * Measured against the committed `whack-crash/v3` report (4M rounds, median 7.2 s):
 *
 *   drums  level >= 2   t >= 3.6 s   ~x1.39   78% of rounds
 *   lead   level >= 6   t >= 13.2 s  ~x9.96   15% of rounds
 *
 * So a typical round fills out to two stems, and the third marks a run to x10 rather than being
 * effectively dead. Level 3 (x1.96) was tried and the drums read as arriving late; this is the chosen
 * mix (user, 5 Oct 2026). This reads the intensity it is handed and returns which stems play, so it
 * learns nothing about the crash (hard rule 3).
 */
export function whackAudioLevel(level10: number): 0 | 1 | 2 {
  if (level10 >= 6) return 2;
  return level10 >= 2 ? 1 : 0;
}
