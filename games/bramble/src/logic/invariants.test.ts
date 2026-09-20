import { describe, it, expect } from 'vitest';
import { answerSet, BANDS, isTrapFor } from '@bundle/math';
import { laneCentre, LANES } from './lanes.js';
import { createRun, currentRow, MAX_HEALTH, type Run } from './run.js';

const FRAME = 1 / 60;
const SEEDS = [1, 2, 3, 5, 8];
const EVERY_ALLOWED_NUMBER = new Set(BANDS.flatMap((band) => [...answerSet(band)]));

describe('a long run never breaks its promises', () => {
  it('never puts a number on the path that no sum could produce', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, health: 99999 });
      for (let i = 0; i < 60 * 60 * 4; i += 1) {
        game.step(FRAME);
        for (const row of game.state.rows) {
          for (const number of row.numbers) expect(EVERY_ALLOWED_NUMBER.has(number)).toBe(true);
        }
      }
    }
  });

  it('always puts the answer in exactly one lane', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, health: 99999 });
      for (let i = 0; i < 60 * 60 * 4; i += 1) {
        game.step(FRAME);
        for (const row of game.state.rows) {
          const answering = row.numbers.filter((number) => number === row.sum.answer);
          expect(answering, `${row.numbers.join(',')} for ${row.sum.answer}`).toHaveLength(1);
        }
      }
    }
  });

  it('always makes both wrong lanes plausible', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, health: 99999 });
      for (let i = 0; i < 60 * 60 * 3; i += 1) {
        game.step(FRAME);
        for (const row of game.state.rows) {
          row.numbers.forEach((number, lane) => {
            if (lane === row.answerLane) return;
            expect(isTrapFor(row.sum, number), `${number} against ${row.sum.answer}`).toBe(true);
          });
        }
      }
    }
  });

  it('fills every lane of every row, so there is never a safe one', () => {
    const game = createRun({ seed: 20, health: 99999 });
    for (let i = 0; i < 60 * 60 * 3; i += 1) {
      game.step(FRAME);
      for (const row of game.state.rows) expect(row.numbers).toHaveLength(LANES);
    }
  });

  it('never leaves the rabbit without a sum to read', () => {
    const game = createRun({ seed: 21, health: 99999 });
    for (let i = 0; i < 60 * 60 * 6; i += 1) {
      game.step(FRAME);
      expect(currentRow(game.state)).toBeDefined();
    }
  });

  it('never sends a berry so late that taking it strands the rabbit', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, health: 99999 });
      for (let i = 0; i < 60 * 60 * 3; i += 1) {
        for (const event of game.step(FRAME)) {
          if (event.type !== 'berryArrived') continue;
          expect(event.gapLeft).toBeGreaterThanOrEqual(game.state.tempo.rowEvery * 0.5 - 0.05);
        }
      }
    }
  });
});

describe('the maths is load-bearing', () => {
  /** A player who reads the sum and runs into the lane wearing its answer. */
  const playWell = (game: Run, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      const row = currentRow(game.state);
      if (row) game.steer(laneCentre(row.answerLane));
      game.step(FRAME);
    }
  };

  /**
   * A player who never reads, and picks a lane at random for each row. Played
   * as well as that strategy can be played: the choice is made once per row and
   * committed to, so it fails for being wrong rather than for dithering.
   */
  const playBlind = (game: Run, seconds: number, seed: number): void => {
    let choice = 1;
    let lastUid = '';
    let roll = seed;
    for (let t = 0; t < seconds; t += FRAME) {
      const row = currentRow(game.state);
      if (row && row.uid !== lastUid) {
        lastUid = row.uid;
        roll = (roll * 1103515245 + 12345) % 2147483648;
        choice = Math.abs(roll) % LANES;
      }
      game.steer(laneCentre(choice));
      game.step(FRAME);
      if (game.state.status === 'over') return;
    }
  };

  /** A player who simply never steers. */
  const playStill = (game: Run, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      game.step(FRAME);
      if (game.state.status === 'over') return;
    }
  };

  it('is winnable: reading the sums keeps the tank full for five minutes', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed });
      playWell(game, 300);
      expect(game.state.status, `seed ${seed}`).toBe('running');
      expect(game.state.health, `seed ${seed}`).toBe(MAX_HEALTH);
      expect(game.state.score, `seed ${seed}`).toBeGreaterThan(80);
    }
  });

  /**
   * The test this design exists to pass. Three lanes means guessing is right one
   * time in three and pays 10% on the other two, so a guesser should be finished
   * inside a minute and a half. If this ever passes the game, the arithmetic has
   * stopped mattering — fix the game, never the test.
   */
  it('cannot be guessed: picking lanes at random empties the tank inside ninety seconds', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed });
      playBlind(game, 90, seed);
      expect(game.state.status, `seed ${seed} guessed its way through`).toBe('over');
    }
  });

  it('cannot be ignored: never steering empties it too', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed });
      playStill(game, 90);
      expect(game.state.status, `seed ${seed} survived without steering`).toBe('over');
    }
  });
});
