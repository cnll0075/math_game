import { describe, it, expect } from 'vitest';
import { createRng, type Point } from '@bundle/core';
import { createFrog, FROG, type Frog, type FrogEvent } from './frog.js';

const FRAME = 1 / 60;
const SPOTS: Point[] = [
  { x: 100, y: 300 },
  { x: 400, y: 320 },
  { x: 900, y: 300 },
  { x: 500, y: 700 },
];

const until = (frog: Frog, done: (events: FrogEvent[]) => boolean, limit = 60, spots: readonly Point[] = SPOTS): number => {
  let t = 0;
  while (t < limit) {
    const events = frog.step(FRAME, spots);
    t += FRAME;
    if (done(events)) return t;
  }
  throw new Error('never happened');
};
const run = (frog: Frog, seconds: number, spots: readonly Point[] = SPOTS): FrogEvent[] => {
  const events: FrogEvent[] = [];
  for (let t = 0; t < seconds; t += FRAME) events.push(...frog.step(FRAME, spots));
  return events;
};
const has = (type: FrogEvent['type']) => (events: FrogEvent[]) => events.some((event) => event.type === type);
const isSpot = (point: Point) => SPOTS.some((spot) => spot.x === point.x && spot.y === point.y);
/** Where to tap the frog right now: the middle of its body. */
const middle = (frog: Frog): Point => {
  const pose = frog.pose()!;
  return { x: pose.at.x, y: pose.at.y - FROG.height / 2 };
};

describe('the frog', () => {
  it('stays under at first, then leaps out of the water at an open spot', () => {
    const frog = createFrog(createRng(1));
    expect(run(frog, FROG.firstMin - 0.1)).toEqual([]);
    expect(frog.pose()).toBeNull();
    const events = run(frog, FROG.firstMax - FROG.firstMin + 0.2);
    const out = events.find((event) => event.type === 'emerged');
    expect(out && out.type === 'emerged' && isSpot(out.at)).toBe(true);
  });

  it('never stops on the screen: every leap goes straight back into the water at another open spot', () => {
    const frog = createFrog(createRng(2));
    until(frog, has('emerged'));
    let airborne = 0;
    let landed: FrogEvent | undefined;
    for (let t = 0; t < 30 && !landed; t += FRAME) {
      const events = frog.step(FRAME, SPOTS);
      if (frog.pose()) airborne += FRAME;
      landed = events.find((event) => event.type === 'dived');
    }
    expect(airborne).toBeLessThanOrEqual(FROG.leapSeconds + 2 * FRAME);
    expect(landed?.type === 'dived' && isSpot(landed.at)).toBe(true);
  });

  it('leaps one to three times a visit, a short beat underwater between, then stays under a while', () => {
    const frog = createFrog(createRng(3));
    until(frog, has('emerged'));
    let leaps = 1;
    let under = 0;
    for (let visit = 0; visit < 10; visit += 1) {
      until(frog, has('dived'));
      let gap = 0;
      const back = (() => {
        for (; gap < FROG.hiddenMax + 1; gap += FRAME) if (has('emerged')(frog.step(FRAME, SPOTS))) return true;
        return false;
      })();
      if (!back || gap > FROG.underMax + FRAME) {
        under = gap;
        break;
      }
      expect(gap).toBeGreaterThanOrEqual(FROG.underMin - FRAME);
      leaps += 1;
    }
    expect(leaps).toBeGreaterThanOrEqual(FROG.leapsMin);
    expect(leaps).toBeLessThanOrEqual(FROG.leapsMax);
    expect(under).toBeGreaterThanOrEqual(FROG.hiddenMin - FRAME);
  });

  it('stays under a different length of time each visit', () => {
    const frog = createFrog(createRng(4));
    const visitGap = (): number => {
      // Out, through every leap of the visit, then time the long wait.
      until(frog, has('emerged'), 120);
      for (let leap = 0; leap < 10; leap += 1) {
        until(frog, has('dived'));
        let gap = 0;
        for (; gap < FROG.hiddenMax + 1; gap += FRAME) if (has('emerged')(frog.step(FRAME, SPOTS))) break;
        if (gap > FROG.underMax + FRAME) return gap;
      }
      throw new Error('the visit never ended');
    };
    const first = visitGap();
    const second = visitGap();
    expect(first).not.toBeCloseTo(second, 2);
  });

  it('never comes out where there is no open water', () => {
    const frog = createFrog(createRng(5));
    expect(run(frog, 30, [])).toEqual([]);
    expect(frog.pose()).toBeNull();
  });

  it('cheers when tapped in the air, keeps leaping, and cannot be tapped under the water', () => {
    const frog = createFrog(createRng(6));
    expect(frog.tap({ x: 100, y: 250 })).toEqual([]);
    until(frog, has('emerged'));
    run(frog, FROG.leapSeconds * 0.4);
    const at = middle(frog);
    expect(frog.tap({ x: at.x + 300, y: at.y })).toEqual([]);
    expect(frog.tap(at)).toEqual([{ type: 'cheered' }]);
    expect(frog.pose()!.cheer).toBeGreaterThanOrEqual(0);
    expect(frog.tap(middle(frog))).toEqual([]); // already cheering
    run(frog, FROG.leapSeconds * 0.3);
    expect(frog.pose()!.spin).toBeGreaterThan(0);
    expect(frog.pose()!.at).not.toEqual(at); // still on its way
  });

  it('finishes its leap and goes under when the board changes', () => {
    const frog = createFrog(createRng(7));
    until(frog, has('emerged'));
    frog.scatter();
    until(frog, has('dived'));
    expect(run(frog, FROG.underMax + 0.1)).not.toContainEqual(expect.objectContaining({ type: 'emerged' }));
    expect(frog.pose()).toBeNull();
  });
});
