/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** How long the burst of leaves lasts. */
  burstSeconds: 0.5,
  /** How long the solved sum hangs where the obstacle was. The teaching beat. */
  solvedSeconds: 1.0,
  /** How long the centre-screen explanation of a thump stays up. */
  thumpSeconds: 1.4,
  /** How long the fuel bar flashes after it drops. */
  flashSeconds: 0.7,
  /** How long a band's name is shown large before it flies to the top bar. */
  bandAnnounceSeconds: 2.1,
  /** The share of that spent flying up. */
  bandSettleFraction: 0.26,
  /** Beat before the card appears, so the last of the fuel is seen to go. */
  summaryDelaySeconds: 1.2,
  /** How fast the ground texture scrolls, in path-lengths per second. */
  groundScroll: 0.55,
} as const;
