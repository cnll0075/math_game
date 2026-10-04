import { describe, it, expect } from 'vitest';
import { createDriver, type Driver } from './driver.js';
import { valueAt } from './logic/game.js';
import { TIMING } from './view/timing.js';

const FRAME = 1 / 60;

/** Two face-down pads of the same value, and two of different values. */
const findPair = (driver: Driver, equal: boolean): [number, number] => {
  const pads = driver.game.state.pads;
  for (let a = 0; a < pads.length; a += 1) {
    for (let b = a + 1; b < pads.length; b += 1) {
      if (pads[a]!.up || pads[b]!.up) continue;
      if ((valueAt(driver.game.state, a) === valueAt(driver.game.state, b)) === equal) return [a, b];
    }
  }
  throw new Error('no such pair');
};

const clear = (driver: Driver) => {
  while (!driver.game.state.cleared) {
    const [a, b] = findPair(driver, true);
    driver.act({ kind: 'flip', index: a });
    driver.act({ kind: 'flip', index: b });
  }
};

const wait = (driver: Driver, seconds: number) => {
  const events = [];
  for (let t = 0; t < seconds; t += FRAME) events.push(...driver.step(FRAME));
  return events;
};

describe('the driver', () => {
  it('opens a new player on the first board and announces it', () => {
    const driver = createDriver({ book: {}, seed: 1 });
    expect(driver.model().board.id).toBe('board-2');
    expect(driver.step(FRAME)).toEqual([{ type: 'board', board: expect.objectContaining({ id: 'board-2' }) }]);
  });

  it('holds a missed pair up, then puts it back by itself', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 2 });
    const [a, b] = findPair(driver, false);
    driver.act({ kind: 'flip', index: a });
    driver.act({ kind: 'flip', index: b });
    expect(driver.holding).toBe(true);
    expect(wait(driver, TIMING.missHold * 0.5)).not.toContainEqual(expect.objectContaining({ type: 'hidden' }));
    expect(wait(driver, TIMING.missHold)).toContainEqual({ type: 'hidden', a, b });
    expect(driver.holding).toBe(false);
  });

  it('lets a tap during the hold put the pair back at once', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 3 });
    const [a, b] = findPair(driver, false);
    driver.act({ kind: 'flip', index: a });
    driver.act({ kind: 'flip', index: b });
    const other = driver.game.state.pads.findIndex((pad, index) => !pad.up && index !== a && index !== b);
    expect(driver.act({ kind: 'flip', index: other })).toEqual([
      { type: 'hidden', a, b },
      { type: 'flipped', index: other },
    ]);
    expect(driver.holding).toBe(false);
  });

  it('scores a cleared board, and keeps the next board shut until the stars have been shown', () => {
    const driver = createDriver({ book: {}, seed: 4 });
    clear(driver);
    expect(driver.phase).toBe('cleared');
    expect(driver.earned).toBe(3);
    expect(driver.book).toEqual({ 'board-2': 3 });
    expect(driver.act({ kind: 'next' })).toEqual([]);
    wait(driver, TIMING.starsDelaySeconds + 3 * TIMING.starSeconds + 0.1);
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'board', board: expect.objectContaining({ id: 'board-3' }) }]);
    expect(driver.phase).toBe('playing');
  });

  it('plays the summit again rather than running off the end', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-9', seed: 5 });
    clear(driver);
    wait(driver, 3);
    driver.act({ kind: 'next' });
    expect(driver.model().board.id).toBe('board-9');
    expect(driver.game.state.cleared).toBe(false);
  });

  it('opens the picker over a board and closes it again without touching the board', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 6 });
    const [a, b] = findPair(driver, false);
    driver.act({ kind: 'flip', index: a });
    driver.act({ kind: 'flip', index: b });
    const game = driver.game;
    expect(driver.act({ kind: 'picker' })).toEqual([{ type: 'picker' }]);
    expect(driver.phase).toBe('picking');
    expect(driver.act({ kind: 'flip', index: 0 })).toEqual([]);
    driver.act({ kind: 'close' });
    expect(driver.phase).toBe('playing');
    expect(driver.game).toBe(game);
    expect(driver.game.state.misses).toBe(1);
  });

  it('picks an open board, and refuses a locked one', () => {
    const driver = createDriver({ book: { 'board-2': 1 }, seed: 7 });
    driver.act({ kind: 'picker' });
    expect(driver.act({ kind: 'pick', index: 5 })).toEqual([]);
    expect(driver.act({ kind: 'pick', index: 0 })).toEqual([{ type: 'board', board: expect.objectContaining({ id: 'board-2' }) }]);
    expect(driver.phase).toBe('playing');
  });

  it('deals the same boards from the same seed', () => {
    const texts = (seed: number) => createDriver({ book: {}, startLevel: 'board-5', seed }).game.state.pads.map((pad) => pad.card.sum?.value);
    expect(texts(9)).toEqual(texts(9));
  });
});
