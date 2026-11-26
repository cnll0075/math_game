/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** A band's banner arrives, holds and settles in this long. */
  bannerSeconds: 2.4,
  bannerSettleFraction: 0.3,
  /** After the run ends, the summary holds this long before a tap is taken. */
  overHoldSeconds: 1.2,
  /** "Train ready!" and the like rise and fade in this long. */
  floatSeconds: 1.2,
  /** The coach line shows until the first crate is loaded, or this long. */
  coachSeconds: 20,
} as const;
