import type { Intent } from './intent.js';
import { createRun, type Run, type RunEvent, type RunState } from './logic/run.js';
import { bandAt, bandById, type Band } from './logic/tempo.js';
import { TIMING } from './view/timing.js';

/**
 * `playing` — the yard runs.
 * `paused` — everything that counts stands still; a tap carries on.
 * `over` — the queue reached the marker; the summary, then a tap starts again.
 */
export type Phase = 'playing' | 'paused' | 'over';

export type DriverEvent = RunEvent | { type: 'start'; band: Band } | { type: 'paused' } | { type: 'resumed' };

export interface Summary {
  sent: number;
  /** Seconds the run lasted. */
  seconds: number;
  best: number;
  beatenBest: boolean;
}

/** Everything the scene draws from. */
export interface SceneModel {
  run: RunState;
  phase: Phase;
  /** Seconds in this phase. */
  since: number;
  /** Seconds this run has lasted, for the clock. */
  seconds: number;
  summary: Summary | null;
  /** Whether the line along the bottom says how to play. */
  coach: boolean;
}

export interface DriverOptions {
  /** The most trains sent in one run so far. */
  best: number;
  /** A band id from the URL. Anything unrecognised opens at the beginning. */
  startBand?: string;
  /** Seeds each run, so tests can replay one. Random when absent. */
  seed?: () => number;
}

export interface Driver {
  readonly phase: Phase;
  readonly run: Run;
  readonly summary: Summary | null;
  readonly readyForNext: boolean;
  step(dt: number): DriverEvent[];
  act(intent: Intent): DriverEvent[];
  model(): SceneModel;
}

export function createDriver(options: DriverOptions): Driver {
  const seed = options.seed ?? (() => Math.floor(Math.random() * 2 ** 31));
  const startBand = bandById(options.startBand)?.id;
  let best = options.best;
  let run: Run = createRun({ seed: seed(), startBand });
  let opened = run.state.elapsed;
  let phase: Phase = 'playing';
  let since = 0;
  let summary: Summary | null = null;
  let pending: DriverEvent[] = [{ type: 'start', band: bandAt(run.state.elapsed) }];

  const begin = (): DriverEvent[] => {
    run = createRun({ seed: seed(), startBand });
    opened = run.state.elapsed;
    phase = 'playing';
    since = 0;
    summary = null;
    return [{ type: 'start', band: bandAt(run.state.elapsed) }];
  };

  const settle = (events: RunEvent[]): DriverEvent[] => {
    if (!run.state.over || phase !== 'playing') return events;
    const sent = run.state.sent;
    summary = { sent, seconds: run.state.elapsed - opened, best: Math.max(best, sent), beatenBest: sent > best };
    best = Math.max(best, sent);
    phase = 'over';
    since = 0;
    return events;
  };

  return {
    get phase() {
      return phase;
    },
    get run() {
      return run;
    },
    get summary() {
      return summary;
    },
    get readyForNext() {
      return phase === 'paused' || (phase === 'over' && since >= TIMING.overHoldSeconds);
    },

    step(dt) {
      const events: DriverEvent[] = pending;
      pending = [];
      since += dt;
      if (phase !== 'playing') return events;
      return [...events, ...settle(run.step(dt))];
    },

    act(intent) {
      switch (intent.kind) {
        case 'load':
          return phase === 'playing' ? settle(run.load(intent.crate, intent.track)) : [];
        case 'pause':
          if (phase !== 'playing') return [];
          phase = 'paused';
          since = 0;
          return [{ type: 'paused' }];
        case 'next':
          if (phase === 'paused') {
            phase = 'playing';
            since = 0;
            return [{ type: 'resumed' }];
          }
          return phase === 'over' && since >= TIMING.overHoldSeconds ? begin() : [];
      }
    },

    model: () => ({
      run: run.state,
      phase,
      since,
      seconds: run.state.elapsed - opened,
      summary,
      coach: run.state.loaded === 0 && run.state.elapsed - opened < TIMING.coachSeconds,
    }),
  };
}
