import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { chooseMove } from './bot.js';
import { createRun } from './run.js';

const yardWith = (targets: number[], loads: number[][], weights: number[]) => {
  const run = createRun({ seed: 1 });
  run.state.tracks.forEach((track, index) => {
    track.target = targets[index]!;
    track.load = loads[index]!;
  });
  run.state.queue = weights.map((weight, index) => ({ id: index + 1, weight }));
  return run.state;
};

describe('the careful bot', () => {
  it('fills a gap exactly when it can', () => {
    const state = yardWith([9, 10, 12], [[5], [], []], [2, 4, 3]);
    expect(chooseMove(state, 'careful', createRng(1))).toEqual({ crate: 2, track: 0 });
  });

  it('otherwise loads the biggest crate that fits somewhere', () => {
    const state = yardWith([9, 10, 12], [[], [], []], [2, 4, 3]);
    expect(chooseMove(state, 'careful', createRng(1))).toMatchObject({ crate: 2 });
  });

  it('goes for a star train first', () => {
    const state = yardWith([9, 10, 12], [[], [], []], [2, 4, 3, 6]);
    state.tracks[2]!.star = 3;
    state.tracks[2]!.target = 10;
    expect(chooseMove(state, 'careful', createRng(1))).toMatchObject({ track: 2 });
  });

  it('never breaks a train', () => {
    const state = yardWith([5, 6, 7], [[4], [5], [6]], [3, 4]);
    expect(chooseMove(state, 'careful', createRng(1))).toBeNull();
  });
});
