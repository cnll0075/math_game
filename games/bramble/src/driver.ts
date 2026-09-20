import { bandById, sumText, type BandId } from '@bundle/math';
import { createRun, currentRow, type Run, type RunEvent, type RunState } from './logic/run.js';
import type { Summary } from './view/hud.js';
import type { SceneModel } from './view/scene.js';

export interface DriverOptions {
  /** The best score so far, for the card. */
  best: number;
  /** A band id from the URL. Anything unrecognised opens at the beginning. */
  startBand?: string;
  seed?: number;
  health?: number;
}

/**
 * Everything around the rules — scene, sound, input, the frame loop — talks to
 * the run through this, so none of them need to know how a run is built or when
 * a new one begins.
 */
export interface Driver {
  readonly state: RunState;
  step(dt: number): readonly RunEvent[];
  steer(x: number): void;
  restart(): void;
  model(): SceneModel;
  readonly summary: Summary | null;
}

export function createDriver(options: DriverOptions): Driver {
  const asBand = (id: string | undefined): BandId | undefined => (id ? bandById(id)?.id : undefined);

  const start = (): Run =>
    createRun({
      seed: options.seed ?? Math.floor(Date.now() % 100000),
      health: options.health,
      startBand: asBand(options.startBand),
    });

  let run = start();
  let best = options.best;
  let summary: Summary | null = null;
  /** Where the clock stood when the run opened, so "time running" is honest. */
  let opened = run.state.elapsed;

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
          distance: run.state.distance,
          best: Math.max(best, score),
          beatenBest: score > best,
        };
        best = Math.max(best, score);
      }
      return events;
    },

    steer: (x) => run.steer(x),

    restart() {
      run = start();
      opened = run.state.elapsed;
      summary = null;
    },

    model: () => {
      const row = currentRow(run.state);
      return {
        run: run.state,
        // Through the stumble the sign keeps the sum that was missed, finished,
        // so the fuel and the question are one event rather than two.
        sumText: run.state.missed
          ? `${sumText(run.state.missed)} = ${run.state.missed.answer}`
          : row
            ? sumText(row.sum)
            : '',
        stumbling: run.state.stumble > 0,
        summary,
      };
    },
  };
}
