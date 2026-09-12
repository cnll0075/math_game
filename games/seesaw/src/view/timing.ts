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
  /** How long the animals dance after a level is finished. */
  danceSeconds: 2.2,
  /** Gap between one animal starting its hop and the next. */
  danceStaggerSeconds: 0.14,
  /** Danger flag raising and lowering. */
  flagRaiseSeconds: 0.3,
  /** How long the perfect-balance sparkle lingers. */
  celebrateSeconds: 1.1,
  /** Beat after the dance before the next level opens. */
  levelChangeSeconds: 0.8,
  /** Pause after a lost arcade round before it starts again. */
  retrySeconds: 2.2,
} as const;
