import type { Outcome } from '../logic/outcome.js';

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
    /** Up to the ledge, carried onto it by the breeze. */
    exact: 2.8,
    /** Up past the ledge, a cloud, and the parachute down. */
    over: 3.8,
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

/** The longest of every kit's flight, so the last to land decides when the next try can start. */
export const flySeconds = (outcomes: readonly Outcome[]): number =>
  Math.max(0, ...outcomes.map((outcome) => TIMING.flight[outcome.verdict]));
