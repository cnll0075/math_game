import { bandById, type BandId } from './logic/bands.data.js';
import { sumText } from './logic/equation.js';
import { createRun, type Run, type RunEvent, type RunState } from './logic/run.js';
import { remaining } from './logic/sky-state.js';
import type { Summary } from './view/hud.js';
import type { SceneModel } from './view/scene.js';

export interface DriverOptions {
  /** The best score so far, for the summary card. */
  best: number;
  /** A band id from the URL. Anything unrecognised opens at the beginning. */
  startBand?: string;
  seed?: number;
  hearts?: number;
}

/**
 * Everything around the rules — scene, sound, input, the frame loop — talks to
 * the run through this, so none of them need to know how a run is built or when
 * a new one begins.
 */
export interface Driver {
  readonly state: RunState;
  step(dt: number): readonly RunEvent[];
  aim(lane: number): void;
  fire(): void;
  restart(): void;
  model(): SceneModel;
  readonly summary: Summary | null;
}

export function createDriver(options: DriverOptions): Driver {
  const asBand = (id: string | undefined): BandId | undefined => (id ? bandById(id)?.id : undefined);

  const start = (): Run =>
    createRun({
      seed: options.seed ?? Math.floor(Date.now() % 100000),
      hearts: options.hearts,
      startBand: asBand(options.startBand),
    });

  let run = start();
  let best = options.best;
  let summary: Summary | null = null;
  /** Where the run's clock stood when it opened, so "time flown" is honest. */
  let opened = run.state.elapsed;

  /**
   * How close the plane being asked about is to getting away, 0 to 1. The
   * fighter's plaque warms with it, which is a way of saying hurry without
   * saying which plane — naming the plane would hand over the answer.
   */
  const urgencyNow = (): number => {
    const target = run.state.aloft.find((plane) => plane.uid === run.state.targetUid);
    if (!target) return 0;
    const warnFrom = Math.min(3, run.state.tempo.thinkSeconds);
    return Math.min(1, Math.max(0, 1 - remaining(target) / warnFrom));
  };

  return {
    get state() {
      return run.state;
    },
    get summary() {
      return summary;
    },

    step(dt) {
      const events = run.step(dt);
      if (events.some((event) => event.type === 'ended')) {
        const score = run.state.score;
        summary = {
          score,
          bestStreak: run.state.bestStreak,
          seconds: run.state.elapsed - opened,
          best: Math.max(best, score),
          beatenBest: score > best,
        };
        best = Math.max(best, score);
      }
      return events;
    },

    aim: (lane) => run.aim(lane),
    fire: () => run.fire(),

    restart() {
      run = start();
      opened = run.state.elapsed;
      summary = null;
    },

    model: () => ({
      run: run.state,
      // Through the beat after a loss the plaque keeps showing the question
      // that got away, finished, in red — so the heart and the sum are the
      // same event rather than two unrelated things happening at once.
      sumText: run.state.missed
        ? `${sumText(run.state.missed)} = ${run.state.missed.answer}`
        : run.state.sum
          ? sumText(run.state.sum)
          : '',
      mourning: run.state.mourning > 0,
      urgency: urgencyNow(),
      heartOnOffer: run.state.hearts < run.state.maxHearts,
      summary,
    }),
  };
}
