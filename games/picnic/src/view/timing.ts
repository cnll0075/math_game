/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** The round's title arrives and settles before play. */
  introSeconds: 2.2,
  introSettleFraction: 0.3,
  /** A finished course stays on the table this long before the next comes out. */
  courseSeconds: 2.2,
  /** Everyone eats together, and the card arrives, before a tap moves on. */
  doneHoldSeconds: 2.4,
  /** The card waits this long after the round ends, for the eating to be seen. */
  cardDelaySeconds: 1.2,
  starSeconds: 0.35,
  /** Words over the table rise and fade in this long. */
  floatSeconds: 1.2,
} as const;
