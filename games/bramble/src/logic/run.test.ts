import { describe, it, expect } from 'vitest';
import {
  createRun,
  currentRow,
  BERRY_GIVES,
  MAX_HEALTH,
  MISS_COST,
  type Run,
  type RunEvent,
} from './run.js';
import { laneCentre } from './lanes.js';
import type { Row } from './row.js';

const FRAME = 1 / 60;

const run = (game: Run, seconds: number): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let t = 0; t < seconds; t += FRAME) events.push(...game.step(FRAME));
  return events;
};

/** Runs until the next row is met, steering into whichever lane is chosen. */
const meetNextRow = (game: Run, lane: (row: Row) => number): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let i = 0; i < 60 * 30; i += 1) {
    const row = currentRow(game.state);
    if (row) game.steer(laneCentre(lane(row)));
    const batch = game.step(FRAME);
    events.push(...batch);
    if (batch.some((event) => event.type === 'burst' || event.type === 'thump')) break;
  }
  return events;
};

describe('a run opening', () => {
  it('starts full, running, and with a sum to read', () => {
    const game = createRun({ seed: 1 });
    run(game, 1);
    expect(game.state.health).toBe(MAX_HEALTH);
    expect(game.state.status).toBe('running');
    expect(currentRow(game.state)).toBeDefined();
    expect(game.state.band.id).toBe('easy');
  });

  it('can open at a band, for ?game=bramble&level=take-aways', () => {
    const game = createRun({ seed: 2, startBand: 'take-aways' });
    run(game, 1);
    expect(game.state.band.id).toBe('take-aways');
  });

  it('keeps more than one row on the path once it is going', () => {
    const game = createRun({ seed: 3, health: 9999 });
    run(game, 12);
    expect(game.state.rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('meeting a row', () => {
  it('bursts the right one, scores, and moves on to the next sum', () => {
    const game = createRun({ seed: 4 });
    run(game, 1);
    const asked = currentRow(game.state)!.sum;
    const events = meetNextRow(game, (row) => row.answerLane);
    expect(events.some((event) => event.type === 'burst')).toBe(true);
    expect(game.state.score).toBe(1);
    expect(game.state.streak).toBe(1);
    expect(game.state.health).toBe(MAX_HEALTH);
    expect(currentRow(game.state)!.sum).not.toBe(asked);
  });

  it('thumps a wrong one, costs exactly a tenth, and stumbles', () => {
    const game = createRun({ seed: 5 });
    run(game, 1);
    const events = meetNextRow(game, (row) => (row.answerLane + 1) % 3);
    expect(events.some((event) => event.type === 'thump')).toBe(true);
    expect(game.state.health).toBe(MAX_HEALTH - MISS_COST);
    expect(game.state.score).toBe(0);
    expect(game.state.streak).toBe(0);
    expect(game.state.stumble).toBeGreaterThan(0);
    // The sum that was missed is held, so the loss can be explained.
    expect(game.state.missed).not.toBeNull();
  });

  it('resolves each row exactly once', () => {
    const game = createRun({ seed: 6, health: 9999 });
    const events = run(game, 40);
    const uids = events
      .filter((event) => event.type === 'burst' || event.type === 'thump')
      .map((event) => (event.type === 'burst' || event.type === 'thump' ? event.row.uid : ''));
    expect(uids.length).toBeGreaterThan(5);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('meets every row: standing still is a choice like any other', () => {
    const game = createRun({ seed: 7, health: 9999 });
    const events = run(game, 40);
    expect(events.some((event) => event.type === 'thump')).toBe(true);
  });
});

describe('berries', () => {
  /**
   * Someone who wants the berry and the answer both: they go for the berry
   * while the next row is still far off, and are back in the answer's lane by
   * the time it lands. The berry rule exists so this is always possible.
   */
  const playGreedily = (game: Run, seconds: number): { berries: number; thumps: number } => {
    let berries = 0;
    let thumps = 0;
    for (let t = 0; t < seconds; t += FRAME) {
      const row = currentRow(game.state);
      const berry = game.state.berries.find((entry) => !entry.taken && entry.progress < 1);
      if (berry && (!row || row.progress < 0.7)) game.steer(laneCentre(berry.lane));
      else if (row) game.steer(laneCentre(row.answerLane));
      for (const event of game.step(FRAME)) {
        if (event.type === 'berry') berries += 1;
        if (event.type === 'thump') thumps += 1;
      }
      if (game.state.status === 'over') break;
    }
    return { berries, thumps };
  };

  it('gives back exactly a tenth when one is collected', () => {
    const game = createRun({ seed: 8 });
    game.state.health = 50;
    let seen = 0;
    for (let t = 0; t < 200; t += FRAME) {
      const row = currentRow(game.state);
      const berry = game.state.berries.find((entry) => !entry.taken && entry.progress < 1);
      if (berry && (!row || row.progress < 0.7)) game.steer(laneCentre(berry.lane));
      else if (row) game.steer(laneCentre(row.answerLane));
      for (const event of game.step(FRAME)) {
        if (event.type !== 'berry') continue;
        expect(event.health).toBe(Math.min(100, 50 + BERRY_GIVES * (seen + 1)));
        seen += 1;
      }
      if (seen > 0) break;
    }
    expect(seen, 'no berry was ever collected').toBe(1);
  });

  it('never costs fuel to take: a berry and the answer are always both reachable', () => {
    for (const seed of [8, 9, 10, 21]) {
      const game = createRun({ seed });
      const { berries, thumps } = playGreedily(game, 180);
      expect(berries, `seed ${seed} never offered a berry`).toBeGreaterThan(3);
      // This is the whole point of the rule: wanting the berry never costs you
      // the row. A reward that could cost 10% is a trap wearing a berry's face.
      expect(thumps, `seed ${seed} was made to choose`).toBe(0);
    }
  });

  it('never tops the tank past full', () => {
    const game = createRun({ seed: 9 });
    playGreedily(game, 180);
    expect(game.state.health).toBeLessThanOrEqual(100);
  });
});

describe('the run ending', () => {
  it('ends when the tank is empty, and stops dead', () => {
    const game = createRun({ seed: 11, health: MISS_COST });
    for (let i = 0; i < 60 * 60 && game.state.status === 'running'; i += 1) {
      const row = currentRow(game.state);
      if (row) game.steer(laneCentre((row.answerLane + 1) % 3));
      game.step(FRAME);
    }
    expect(game.state.status).toBe('over');
    expect(game.state.health).toBe(0);
    expect(run(game, 5)).toHaveLength(0);
  });

  it('counts the distance run, for the card', () => {
    const game = createRun({ seed: 12, health: 9999 });
    run(game, 30);
    expect(game.state.distance).toBeGreaterThan(0);
  });
});

describe('the clock', () => {
  it('announces a band change once', () => {
    const game = createRun({ seed: 13, health: 9999 });
    run(game, 44);
    expect(run(game, 3).filter((event) => event.type === 'band')).toHaveLength(1);
  });
});

describe('steering', () => {
  it('runs to the finger rather than jumping there', () => {
    const game = createRun({ seed: 14 });
    game.steer(1);
    game.step(FRAME);
    expect(game.state.rabbitX).toBeGreaterThan(0.5);
    expect(game.state.rabbitX).toBeLessThan(1);
    for (let i = 0; i < 60; i += 1) game.step(FRAME);
    expect(game.state.rabbitX).toBeCloseTo(1, 2);
  });

  it('never leaves the path', () => {
    const game = createRun({ seed: 15 });
    game.steer(5);
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    expect(game.state.rabbitX).toBeLessThanOrEqual(1);
    game.steer(-5);
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    expect(game.state.rabbitX).toBeGreaterThanOrEqual(0);
  });
});
