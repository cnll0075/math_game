/**
 * How the game feels, in one place. Retuning the choreography should never mean
 * hunting through the renderer, and swapping the art should never mean retuning
 * the choreography.
 */
export const TIMING = {
  /** How long an explosion lasts. */
  boomSeconds: 0.55,
  /**
   * How long the solved sum hangs in the air where the plane was. This is the
   * actual teaching beat — the child's confirmation they were right — so it is
   * longer than the explosion it follows.
   */
  solvedSeconds: 1.1,
  /** How long a heart shows its crack. */
  heartCrackSeconds: 0.9,
  /** How long a band's name is shown large before it flies into the top bar. */
  bandAnnounceSeconds: 2.1,
  /** The share of that spent flying up to the bar. */
  bandSettleFraction: 0.26,
  /** Beat before the summary card appears, so the last heart is seen to go. */
  summaryDelaySeconds: 1.2,
} as const;
