import { describe, it, expect } from 'vitest';
import { createRng, type Point } from '@bundle/core';
import { createFrog, FROG, type Frog, type FrogEvent } from './frog.js';

const FRAME = 1 / 60;
const SPOTS: Point[] = [
  { x: 100, y: 300 },
  { x: 900, y: 300 },
  { x: 500, y: 700 },
];

const run = (frog: Frog, seconds: number, spots: readonly Point[] = SPOTS): FrogEvent[] => {
  const events: FrogEvent[] = [];
  for (let t = 0; t < seconds; t += FRAME) events.push(...frog.step(FRAME, spots));
  return events;
};

const until = (frog: Frog, done: (events: FrogEvent[]) => boolean, limit = 60, spots: readonly Point[] = SPOTS): number => {
  let t = 0;
  while (t < limit) {
    const events = frog.step(FRAME, spots);
    t += FRAME;
    if (done(events)) return t;
  }
  throw new Error('never happened');
};

const isOneOf = (spot: Point | null) => SPOTS.some((each) => spot && each.x === spot.x && each.y === spot.y);
const centre = (spot: Point): Point => ({ x: spot.x, y: spot.y - FROG.height / 2 });

describe('the frog', () => {
  it('stays hidden at first, then leaps out at one of the open spots', () => {
    const frog = createFrog(createRng(1));
    expect(run(frog, FROG.firstMin - 0.1)).toEqual([]);
    expect(frog.pose()).toBeNull();
    const events = run(frog, FROG.firstMax - FROG.firstMin + 0.2);
    expect(events.map((event) => event.type)).toContain('emerged');
    expect(isOneOf(frog.spot)).toBe(true);
  });

  it('sits, hops to a different spot at least once, and dives back in', () => {
    const frog = createFrog(createRng(2));
    until(frog, (events) => events.some((event) => event.type === 'emerged'));
    const visited = new Set<string>();
    until(frog, (events) => {
      if (frog.spot) visited.add(`${frog.spot.x},${frog.spot.y}`);
      return events.some((event) => event.type === 'dived');
    });
    expect(visited.size).toBeGreaterThanOrEqual(2);
    for (const key of visited) expect(SPOTS.map((spot) => `${spot.x},${spot.y}`)).toContain(key);
    expect(frog.phase).toBe('hidden');
  });

  it('stays underwater a different length of time each time, within its window', () => {
    const frog = createFrog(createRng(3));
    const gaps: number[] = [];
    until(frog, (events) => events.some((event) => event.type === 'dived'), 120);
    for (let round = 0; round < 2; round += 1) {
      gaps.push(until(frog, (events) => events.some((event) => event.type === 'emerged'), 120));
      until(frog, (events) => events.some((event) => event.type === 'dived'), 120);
    }
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(FROG.hiddenMin - FRAME);
      expect(gap).toBeLessThanOrEqual(FROG.hiddenMax + FRAME);
    }
    expect(gaps[0]).not.toBeCloseTo(gaps[1]!, 2);
  });

  it('never comes out where there is no room for it', () => {
    const frog = createFrog(createRng(4));
    expect(run(frog, 30, [])).toEqual([]);
    expect(frog.pose()).toBeNull();
  });

  it('cheers when tapped while sitting, and only then', () => {
    const frog = createFrog(createRng(5));
    expect(frog.tap({ x: 100, y: 260 })).toEqual([]);
    until(frog, (events) => events.some((event) => event.type === 'emerged'));
    expect(frog.tap(centre(frog.spot!))).toEqual([]); // still in the air
    run(frog, FROG.emergeSeconds);
    expect(frog.phase).toBe('sitting');
    expect(frog.tap({ x: frog.spot!.x + 300, y: frog.spot!.y })).toEqual([]);
    expect(frog.tap(centre(frog.spot!))).toEqual([{ type: 'cheered' }]);
    expect(frog.phase).toBe('cheering');
    expect(frog.pose()!.spin).toBeGreaterThanOrEqual(0);
    expect(frog.tap(centre(frog.spot!))).toEqual([]);
    run(frog, FROG.cheerSeconds + 0.1);
    expect(frog.phase).toBe('sitting');
  });

  it('knows when a point is on it', () => {
    const frog = createFrog(createRng(6));
    until(frog, (events) => events.some((event) => event.type === 'emerged'));
    run(frog, FROG.emergeSeconds);
    expect(frog.hit(centre(frog.spot!))).toBe(true);
    expect(frog.hit({ x: frog.spot!.x, y: frog.spot!.y - 400 })).toBe(false);
  });

  it('dives when the board changes under it', () => {
    const frog = createFrog(createRng(7));
    until(frog, (events) => events.some((event) => event.type === 'emerged'));
    run(frog, FROG.emergeSeconds);
    frog.scatter();
    expect(frog.phase).toBe('diving');
    expect(until(frog, (events) => events.some((event) => event.type === 'dived'))).toBeLessThanOrEqual(FROG.diveSeconds + FRAME);
  });
});
