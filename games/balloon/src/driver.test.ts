import { describe, it, expect } from 'vitest';
import { createDriver, type Driver } from './driver.js';
import { RESCUES } from './logic/levels.data.js';

const FRAME = 1 / 60;

const settle = (driver: Driver) => {
  const events = [];
  for (let i = 0; i < 60 * 12 && driver.phase === 'flying'; i += 1) events.push(...driver.step(FRAME));
  return events;
};

describe('the driver', () => {
  it('announces the chapter it opens in', () => {
    const driver = createDriver({ book: {} });
    expect(driver.step(FRAME)).toEqual([{ type: 'chapter', chapter: expect.objectContaining({ id: 'first-flight' }) }]);
    expect(driver.step(FRAME)).toEqual([]);
  });

  it('flies after "Let go!", then comes back with the gap to fix', () => {
    const driver = createDriver({ book: {} });
    driver.act({ kind: 'tray', index: 1 }); // the 5, for a weight of 3
    driver.act({ kind: 'letGo' });
    expect(driver.phase).toBe('flying');
    const events = settle(driver);
    expect(events).toContainEqual({ type: 'landed', outcome: { verdict: 'over', axis: 'up', have: 5, need: 3 } });
    expect(driver.phase).toBe('building');
    expect(driver.feedback?.verdict).toBe('over');
    expect(driver.rescue.state.clipped).toHaveLength(1);
  });

  it('forgets the old verdict as soon as the bunch changes', () => {
    const driver = createDriver({ book: {} });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'letGo' });
    settle(driver);
    driver.act({ kind: 'clipped', slot: 0 });
    expect(driver.feedback).toBeNull();
  });

  it('ignores every tap while the kit is in the air', () => {
    const driver = createDriver({ book: {} });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'letGo' });
    driver.step(FRAME);
    expect(driver.act({ kind: 'tray', index: 0 })).toEqual([]);
    expect(driver.act({ kind: 'letGo' })).toEqual([]);
    expect(driver.rescue.state.tries).toBe(1);
    expect(driver.rescue.state.clipped).toHaveLength(1);
  });

  it('records stars for a rescue, and moves on when asked', () => {
    const driver = createDriver({ book: {} });
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'letGo' });
    const events = settle(driver);
    expect(events).toContainEqual({ type: 'rescued', id: 'first-flight-1', stars: 3, book: { 'first-flight-1': 3 } });
    expect(driver.phase).toBe('rescued');
    expect(driver.earned).toBe(3);
    expect(driver.act({ kind: 'tray', index: 0 })).toEqual([]);
    driver.act({ kind: 'next' });
    expect(driver.phase).toBe('building');
    expect(driver.rescue.state.def.id).toBe('first-flight-2');
  });

  it('announces a new chapter when one begins', () => {
    const lastOfFirst = RESCUES.findIndex((rescue) => rescue.id === 'first-flight-4');
    const driver = createDriver({ book: {}, startLevel: RESCUES[lastOfFirst]!.id });
    driver.step(FRAME);
    driver.act({ kind: 'tray', index: 0 }); // 4
    driver.act({ kind: 'tray', index: 2 }); // 2
    driver.act({ kind: 'letGo' });
    settle(driver);
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'chapter', chapter: expect.objectContaining({ id: 'whoosh' }) }]);
  });

  it('finishes after the last rescue, and starts over from there', () => {
    const driver = createDriver({ book: {}, startLevel: 'big-rescue-5' });
    // 10 + 7, and 5 + 2 across a wind of −1 to a ledge 6 steps away.
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'tray', index: 3 });
    driver.act({ kind: 'puff', index: 0 });
    driver.act({ kind: 'puff', index: 1 });
    driver.act({ kind: 'letGo' });
    settle(driver);
    expect(driver.phase).toBe('rescued');
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'finished' }]);
    expect(driver.phase).toBe('finished');
    driver.act({ kind: 'next' });
    expect(driver.rescue.state.def.id).toBe('first-flight-1');
  });

  it('counts the balloons before the flight, one beat each', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'tray', index: 2 });
    driver.act({ kind: 'letGo' });
    expect(driver.flight?.lifted).toEqual([4, 3]);
    expect(driver.flight!.count).toBeGreaterThan(0);
  });
});
