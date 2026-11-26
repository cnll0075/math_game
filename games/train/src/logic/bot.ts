import { createRng, type Rng } from '@bundle/core';
import { gapOf, type Run, type RunState } from './run.js';

/**
 * Players for the tests. `careful` reads every number: a star train first,
 * then a crate that fills a gap exactly, then the biggest crate that fits, and
 * never one that is too heavy. `random` loads without reading. `idle` freezes.
 */
export type Policy = 'careful' | 'random' | 'idle';

export interface Move {
  crate: number;
  track: number;
}

export function chooseMove(state: RunState, policy: Policy, rng: Rng): Move | null {
  if (policy === 'idle' || state.queue.length === 0) return null;
  const waiting = state.tracks.flatMap((track, index) => (track.phase === 'waiting' ? [{ track, index }] : []));
  if (waiting.length === 0) return null;
  if (policy === 'random') return { crate: rng.pick(state.queue).id, track: rng.pick(waiting).index };

  const moves = waiting.flatMap(({ track, index }) =>
    state.queue.filter((crate) => crate.weight <= gapOf(track)).map((crate) => ({ crate, track, index })),
  );
  if (moves.length === 0) return null;
  const score = ({ crate, track }: (typeof moves)[number]): number =>
    (track.star > 0 ? 1000 : 0) + (crate.weight === gapOf(track) ? 100 : 0) + crate.weight;
  const best = moves.reduce((top, move) => (score(move) > score(top) ? move : top));
  return { crate: best.crate.id, track: best.index };
}

export interface PlayOptions {
  /** Seconds between moves: a child's pace, not a bot's. */
  every?: number;
  seed?: number;
  maxSeconds?: number;
}

/** Play a run out with a policy. Returns how long it lasted, and what happened. */
export function playOut(run: Run, policy: Policy, options: PlayOptions = {}): { seconds: number; sent: number; broken: number } {
  const every = options.every ?? 1.2;
  const rng = createRng(options.seed ?? 1);
  const opened = run.state.elapsed;
  const dt = 1 / 60;
  let wait = every;
  for (let t = 0; t < (options.maxSeconds ?? 900) && !run.state.over; t += dt) {
    wait -= dt;
    if (wait <= 0) {
      const move = chooseMove(run.state, policy, rng);
      if (move) {
        run.load(move.crate, move.track);
        wait = every;
      }
    }
    run.step(dt);
  }
  return { seconds: run.state.elapsed - opened, sent: run.state.sent, broken: run.state.broken };
}
