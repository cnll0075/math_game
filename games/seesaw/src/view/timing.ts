/**
 * How the game feels, in one place. Swapping the art or the sounds should not
 * require touching choreography, and retuning choreography should not require
 * hunting through the renderer.
 */
export const TIMING = {
  /** Roughly how long the plank takes to come to rest after a placement. */
  settleSeconds: 0.45,
  /** Beat between the plank settling and the bell, so the DING lands cleanly. */
  dingDelaySeconds: 0.12,
  /** Hop from the tray onto the platform. */
  hopSeconds: 0.35,
  /** Gate opening after the last challenge. */
  gateSeconds: 1.2,
  /** Danger flag raising and lowering. */
  flagRaiseSeconds: 0.3,
  /** How long the celebration sparkle lingers. */
  celebrateSeconds: 1.1,
} as const;
