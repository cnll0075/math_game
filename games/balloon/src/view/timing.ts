import type { Outcome } from '../logic/outcome.js';
import { LAYERS } from '../logic/rescue-def.js';

/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** Each lifting balloon lights in turn as the gauge counts on. The teaching beat. */
  countPerBalloon: 0.42,
  /** However big the bunch, the count never keeps a child waiting longer than this. */
  countMax: 2.6,
  flight: {
    /** A strain and a hop. */
    short: 1.5,
    /** Up to the ledge and a step onto it. */
    exact: 2.8,
    /** Up past the ledge, a cloud, and the parachute down. */
    over: 3.8,
    /** Up to the layer it reached, blown the wrong way, and the parachute down. */
    blown: 4.0,
  },
  chapterAnnounceSeconds: 2.3,
  chapterSettleFraction: 0.26,
  popSeconds: 0.4,
  solvedSeconds: 1.2,
  starsDelaySeconds: 0.9,
  starSeconds: 0.35,
  /** How fast a released bunch rises off the ledge, in design pixels per second. */
  releaseRise: 420,
  /** How far it rises before it is off the top and no longer drawn. */
  releaseGone: 560,
} as const;

export const countSeconds = (balloons: number): number =>
  Math.min(TIMING.countMax, balloons * TIMING.countPerBalloon);

export const flySeconds = (outcome: Outcome): number => {
  if (outcome.verdict === 'exact') return TIMING.flight.exact;
  const rise = outcome.have - outcome.weight;
  if (outcome.layer > 0 && rise >= 1 && rise <= LAYERS) return TIMING.flight.blown;
  return outcome.verdict === 'short' ? TIMING.flight.short : TIMING.flight.over;
};
