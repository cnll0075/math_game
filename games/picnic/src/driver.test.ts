import { describe, it, expect } from 'vitest';
import { createDriver, type Driver, type DriverEvent } from './driver.js';
import { playRound } from './logic/bot.js';
import { LEVELS } from './logic/levels.data.js';
import { TIMING } from './view/timing.js';

const FRAME = 1 / 60;
const steps = (driver: Driver, seconds: number): DriverEvent[] => {
  const events: DriverEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += FRAME) events.push(...driver.step(FRAME));
  return events;
};

describe('the driver', () => {
  it('opens on the first round without stars, announcing it', () => {
    const driver = createDriver({ book: { 'two-friends': 3 } });
    expect(driver.step(FRAME)[0]).toMatchObject({ type: 'level', level: { id: 'strawberry-share' } });
    expect(driver.phase).toBe('intro');
    steps(driver, TIMING.introSeconds);
    expect(driver.phase).toBe('playing');
  });

  it('opens a round from the URL, and where the player left off for an unknown one', () => {
    expect(createDriver({ book: {}, startLevel: 'cake-quarters' }).table.state.def.id).toBe('cake-quarters');
    expect(createDriver({ book: {}, startLevel: 'nope' }).table.state.def.id).toBe('two-friends');
  });

  it('starts at once if a child acts during the title', () => {
    const driver = createDriver({ book: {} });
    expect(driver.act({ kind: 'tap', plate: 0 })).toEqual([{ type: 'gave', plate: 0 }]);
    expect(driver.phase).toBe('playing');
  });

  it('finishes a round with stars kept, holds the celebration, then moves on with a tap', () => {
    const driver = createDriver({ book: {}, startLevel: 'the-dial' });
    driver.act({ kind: 'dial', step: 1 });
    driver.act({ kind: 'dial', step: 1 });
    const events = driver.act({ kind: 'share' });
    expect(events).toContainEqual({ type: 'won', id: 'the-dial', stars: 3, book: { 'the-dial': 3 } });
    expect(driver.phase).toBe('done');
    expect(driver.act({ kind: 'next' })).toEqual([]);
    expect(driver.act({ kind: 'dial', step: 1 })).toEqual([]);
    steps(driver, TIMING.doneHoldSeconds + 0.05);
    expect(driver.act({ kind: 'next' })[0]).toMatchObject({ type: 'level', level: { id: 'three-plates' } });
  });

  it('invites friends, and shares once nothing would be left over', () => {
    const driver = createDriver({ book: {}, startLevel: 'who-can-come' });
    expect(driver.act({ kind: 'invite', friend: 1 })).toEqual([{ type: 'invited', friend: 1, seated: true }]);
    expect(driver.act({ kind: 'share' })).toEqual([{ type: 'uneven', friends: 2, leftover: 1 }]);
    driver.act({ kind: 'invite', friend: 2 });
    expect(driver.act({ kind: 'share' })).toContainEqual(expect.objectContaining({ type: 'won', stars: 3 }));
  });

  it('brings out the next course by itself after a moment', () => {
    const driver = createDriver({ book: {}, startLevel: 'picnic-party' });
    driver.act({ kind: 'dial', step: 1 });
    expect(driver.act({ kind: 'share' }).map((event) => event.type)).toEqual(['shared', 'course']);
    expect(driver.table.state.phase).toBe('between');
    const events = steps(driver, TIMING.courseSeconds + 0.1);
    expect(events).toContainEqual({ type: 'next', course: 1 });
    expect(driver.table.state.phase).toBe('sharing');
  });

  it('finishes after the last round, and a tap starts again from the first', () => {
    const driver = createDriver({ book: {}, startLevel: LEVELS.at(-1)!.id });
    steps(driver, TIMING.introSeconds + 0.05);
    playRound(driver.table, 'best');
    steps(driver, FRAME);
    expect(driver.phase).toBe('done');
    steps(driver, TIMING.doneHoldSeconds + 0.05);
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'finished' }]);
    expect(driver.phase).toBe('finished');
    expect(driver.act({ kind: 'next' })[0]).toMatchObject({ type: 'level', level: { id: 'two-friends' } });
  });
});
