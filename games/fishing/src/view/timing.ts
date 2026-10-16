/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** The level's title arrives and settles before the clock starts. */
  introSeconds: 2.2,
  introSettleFraction: 0.3,
  /** After a capsize, the time-out or a dead end: the reason holds this long before a tap is taken. */
  lostHoldSeconds: 1.4,
  /** And it starts again by itself after this, so a child is never left looking at it. */
  lostAutoSeconds: 6,
  /** The boat rolls over in this long. */
  capsizeSeconds: 1.3,
  solvedSeconds: 0.8,
  starsDelaySeconds: 1.0,
  starSeconds: 0.35,
  /** A "+5" over the boat rises and fades in this long. */
  floatSeconds: 1.2,
  splashSeconds: 0.7,
} as const;
