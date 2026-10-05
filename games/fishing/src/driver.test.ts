import { describe, it, expect } from 'vitest';
import { createDriver, type Driver, type DriverEvent } from './driver.js';
import { botTurn } from './logic/bot.js';
import { LEVELS } from './logic/levels.data.js';
import { TIMING } from './view/timing.js';

const FRAME = 1 / 60;
const seeded = () => {
  let seed = 0;
  return () => (seed += 1);
};

const run = (driver: Driver, seconds: number, bot = false): DriverEvent[] => {
  const events: DriverEvent[] = [];
  for (let t = 0; t < seconds; t += FRAME) {
    if (bot && driver.phase === 'fishing') botTurn(driver.world, 'biggest');
    events.push(...driver.step(FRAME));
  }
  return events;
};

/** Fill the bucket, however long it takes. */
const fill = (driver: Driver): DriverEvent[] => {
  const events: DriverEvent[] = [];
  for (let t = 0; t < 200 && driver.phase !== 'won'; t += FRAME) {
    if (driver.phase === 'fishing') botTurn(driver.world, 'biggest');
    events.push(...driver.step(FRAME));
  }
  return events;
};

describe('the driver', () => {
  it('announces the level and holds the clock while it does', () => {
    const driver = createDriver({ book: {}, seed: seeded() });
    expect(driver.step(FRAME)).toContainEqual({ type: 'level', level: LEVELS[0], retry: false });
    expect(driver.phase).toBe('intro');
    run(driver, 1);
    expect(driver.world.state.timeLeft).toBe(LEVELS[0]!.seconds);
    run(driver, TIMING.introSeconds);
    expect(driver.phase).toBe('fishing');
    expect(driver.world.state.timeLeft).toBeLessThan(LEVELS[0]!.seconds);
  });

  it('starts at once when the child taps during the title', () => {
    const driver = createDriver({ book: {}, seed: seeded() });
    driver.act({ kind: 'sail', x: 700 });
    expect(driver.phase).toBe('fishing');
    expect(driver.world.state.boat.target).toBe(700);
  });

  it('gives stars for a full bucket, then moves on once they have been shown', () => {
    const driver = createDriver({ book: {}, seed: seeded() });
    const events = fill(driver);
    const won = events.find((event) => event.type === 'won');
    expect(won).toMatchObject({ type: 'won', id: 'first-catch' });
    expect(driver.book['first-catch']).toBeGreaterThanOrEqual(1);
    expect(driver.act({ kind: 'next' })).toEqual([]);
    run(driver, 3);
    expect(driver.act({ kind: 'next' })).toContainEqual({ type: 'level', level: LEVELS[1], retry: false });
  });

  it('starts the same level again after the boat tips over, on a tap or by itself', () => {
    const driver = createDriver({ book: {}, startLevel: 'just-right', seed: seeded() });
    run(driver, TIMING.introSeconds + 0.1);
    driver.world.state.bucket.push(5);
    driver.world.state.bucket.push(5);
    // Force the ending the simulation would reach on landing.
    driver.world.state.outcome = 'capsized';
    run(driver, FRAME);
    expect(driver.phase).toBe('lost');
    expect(driver.act({ kind: 'next' })).toEqual([]);
    const events = run(driver, TIMING.lostAutoSeconds + 0.1);
    expect(events).toContainEqual({ type: 'level', level: LEVELS[1], retry: true });
    expect(driver.world.state.bucket).toEqual([]);
  });

  it('runs out of time into another go, not a failure', () => {
    const driver = createDriver({ book: {}, startLevel: 'first-catch', seed: seeded() });
    run(driver, TIMING.introSeconds + LEVELS[0]!.seconds + 0.2);
    expect(driver.phase).toBe('lost');
    expect(driver.model().outcome).toBe('timeout');
    run(driver, TIMING.lostHoldSeconds);
    expect(driver.act({ kind: 'next' })).toContainEqual({ type: 'level', level: LEVELS[0], retry: true });
  });

  it('finishes after the last level, and a tap starts from the first', () => {
    const last = LEVELS[LEVELS.length - 1]!;
    const driver = createDriver({ book: {}, startLevel: last.id, seed: seeded() });
    fill(driver);
    run(driver, 3);
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'finished' }]);
    expect(driver.phase).toBe('finished');
    expect(driver.act({ kind: 'next' })).toContainEqual({ type: 'level', level: LEVELS[0], retry: false });
  });

  it('nudges the boat with the arrow keys', () => {
    const driver = createDriver({ book: {}, seed: seeded() });
    const before = driver.world.state.boat.target;
    driver.act({ kind: 'nudge', dir: 1 });
    expect(driver.world.state.boat.target).toBeGreaterThan(before);
  });
});
