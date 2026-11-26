import { describe, it, expect } from 'vitest';
import { createDriver, type DriverEvent } from './driver.js';
import { gapOf } from './logic/run.js';
import { TIMING } from './view/timing.js';

const FRAME = 1 / 60;
const steps = (driver: ReturnType<typeof createDriver>, seconds: number): DriverEvent[] => {
  const events: DriverEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += FRAME) events.push(...driver.step(FRAME));
  return events;
};

describe('the driver', () => {
  it('opens with the band banner, and loads what it is told', () => {
    const driver = createDriver({ best: 0, seed: () => 4 });
    const events = steps(driver, 3);
    expect(events[0]).toMatchObject({ type: 'start', band: { id: 'little' } });
    const state = driver.run.state;
    const index = state.tracks.findIndex((track) => track.target === state.queue[0]!.weight + state.queue[1]!.weight);
    driver.act({ kind: 'load', crate: state.queue[0]!.id, track: index });
    const sent = driver.act({ kind: 'load', crate: state.queue[0]!.id, track: index });
    expect(sent.map((event) => event.type)).toContain('sent');
  });

  it('opens in the band from the URL, and at the beginning for anything else', () => {
    expect(createDriver({ best: 0, startBand: 'heavy', seed: () => 1 }).run.state.band).toBe('heavy');
    expect(createDriver({ best: 0, startBand: 'nope', seed: () => 1 }).run.state.band).toBe('little');
  });

  it('pauses everything that counts, and the clock does not jump on resuming', () => {
    const driver = createDriver({ best: 0, seed: () => 4 });
    steps(driver, 1);
    driver.act({ kind: 'pause' });
    const before = { elapsed: driver.run.state.elapsed, queue: driver.run.state.queue.length, until: driver.run.state.untilCrate };
    expect(steps(driver, 10)).toEqual([]);
    expect(driver.run.state.elapsed).toBe(before.elapsed);
    expect(driver.run.state.queue.length).toBe(before.queue);
    expect(driver.act({ kind: 'load', crate: driver.run.state.queue[0]!.id, track: 0 })).toEqual([]);
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'resumed' }]);
    expect(driver.phase).toBe('playing');
    driver.step(FRAME);
    expect(driver.run.state.elapsed).toBeCloseTo(before.elapsed + FRAME);
  });

  it('ends with a summary, keeps the best, and a tap after a beat starts again', () => {
    const driver = createDriver({ best: 2, seed: () => 4 });
    steps(driver, 3);
    // Send one train, then let the queue overflow.
    const state = driver.run.state;
    const track = state.tracks.find((entry) => entry.phase === 'waiting')!;
    state.queue.unshift({ id: 999, weight: gapOf(track) });
    driver.act({ kind: 'load', crate: 999, track: state.tracks.indexOf(track) });
    for (let frame = 0; frame < 60 * 60 && driver.phase !== 'over'; frame += 1) driver.step(FRAME);
    expect(driver.phase).toBe('over');
    expect(driver.summary).toMatchObject({ sent: 1, best: 2, beatenBest: false });
    expect(driver.act({ kind: 'next' })).toEqual([]);
    steps(driver, TIMING.overHoldSeconds);
    expect(driver.readyForNext).toBe(true);
    const again = driver.act({ kind: 'next' });
    expect(again[0]).toMatchObject({ type: 'start' });
    expect(driver.phase).toBe('playing');
    expect(driver.run.state.sent).toBe(0);
  });

  it('coaches until the first crate is loaded, and not for ever', () => {
    const driver = createDriver({ best: 0, seed: () => 4 });
    steps(driver, 1);
    expect(driver.model().coach).toBe(true);
    steps(driver, TIMING.coachSeconds);
    expect(driver.model().coach).toBe(false);
  });
});
