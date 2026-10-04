/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** A pad turning over. */
  flipSeconds: 0.24,
  /** How long a missed pair stays up before it turns back. */
  missHold: 1.3,
  /** How long the finished match — `3 + 4 = 7 = 9 − 2` — floats over the pond. */
  matchLineSeconds: 1.8,
  /** A matched pad's flower opening. */
  bloomSeconds: 0.5,
  /** Before the stars arrive on the end card, and between each. */
  starsDelaySeconds: 0.8,
  starSeconds: 0.35,
  /** A board's name, large, before it flies to the top bar. */
  boardAnnounceSeconds: 2.0,
  boardSettleFraction: 0.26,
} as const;
