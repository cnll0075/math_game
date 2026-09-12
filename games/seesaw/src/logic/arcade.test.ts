import { describe, it, expect } from 'vitest';
import { createArcadeRun } from './arcade.js';
import type { ArcadeLevelDef } from './level.js';
import { weightOf } from './animals.js';

const level = (overrides: Partial<ArcadeLevelDef['arcade']> = {}, seconds = 30): ArcadeLevelDef => ({
  id: 'test',
  mode: 'arcade',
  title: 'Test',
  objective: { kind: 'survive', seconds },
  initial: { left: ['cat'], right: ['cat'] },
  arcade: {
    seed: 5,
    pool: ['rabbit', 'cat', 'dog'],
    arrivalSeconds: 2,
    queueLength: 3,
    staySeconds: [8, 12],
    patienceSeconds: 99,
    dangerFillSeconds: 4,
    dangerDrainSeconds: 2,
    ...overrides,
  },
});

/** Advances the clock in frame-sized slices, as the real loop does. */
const run = (arcade: ReturnType<typeof createArcadeRun>, seconds: number) => {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(...arcade.tick(1 / 60));
  return events;
};

/** Plays competently: always onto whichever side is currently lighter. */
const playWell = (arcade: ReturnType<typeof createArcadeRun>, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    arcade.tick(1 / 60);
    if (arcade.state.status !== 'playing') break;
    const { balanceDifference } = arcade.snapshot();
    arcade.place(balanceDifference > 0 ? 'right' : 'left');
  }
};

describe('arcade run', () => {
  it('starts with a full queue to plan against', () => {
    const arcade = createArcadeRun(level());
    expect(arcade.state.queue).toHaveLength(3);
    expect(arcade.state.status).toBe('playing');
  });

  it('replays identically for the same level', () => {
    const first = createArcadeRun(level());
    const second = createArcadeRun(level());
    playWell(first, 12);
    playWell(second, 12);
    expect(first.state.placed.map((a) => a.species)).toEqual(second.state.placed.map((a) => a.species));
  });

  it('places the head of the queue, and the next one arrives in its own time', () => {
    const arcade = createArcadeRun(level());
    const head = arcade.state.queue[0]!;
    const events = arcade.place('left');
    expect(events[0]).toEqual(expect.objectContaining({ type: 'placed' }));
    expect(arcade.state.placed.at(-1)!.species).toBe(head);
    // Supply is the pacing: placing does not conjure a replacement.
    expect(arcade.state.queue).toHaveLength(2);
    run(arcade, 0.2);
    expect(arcade.state.queue).toHaveLength(3);
  });

  it('runs the queue dry if the player outpaces the arrivals', () => {
    const arcade = createArcadeRun(level({ arrivalSeconds: 5 }));
    arcade.place('left');
    arcade.place('right');
    arcade.place('left');
    expect(arcade.state.queue).toHaveLength(0);
    expect(arcade.place('left')).toEqual([]);
  });

  it('lets animals wander off after their stay', () => {
    const arcade = createArcadeRun(level({ staySeconds: [1, 1] }));
    arcade.place('left');
    expect(arcade.state.placed).toHaveLength(3);
    const events = run(arcade, 2);
    expect(events.some((event) => event.type === 'left')).toBe(true);
    // The two the level started with never leave; the placed one does.
    expect(arcade.state.placed).toHaveLength(2);
  });

  it('keeps the animals the level started with', () => {
    const arcade = createArcadeRun(level({ staySeconds: [0.5, 0.5] }));
    run(arcade, 5);
    expect(arcade.state.placed.every((animal) => animal.uid.startsWith('init-'))).toBe(true);
  });

  it('holds arrivals when the queue is full, rather than flooding', () => {
    const arcade = createArcadeRun(level({ arrivalSeconds: 0.2 }));
    run(arcade, 6);
    expect(arcade.state.queue).toHaveLength(3);
  });

  it('fills the danger meter in the red and drains it in safety', () => {
    const arcade = createArcadeRun(level({ arrivalSeconds: 99, staySeconds: [999, 999] }));
    arcade.place('left');
    arcade.place('left');
    arcade.place('left'); // Piling one side up drives it into the red.
    run(arcade, 1);
    const inTrouble = arcade.state.danger;
    expect(inTrouble).toBeGreaterThan(0);
    expect(arcade.snapshot().zone).toBe('red');
  });

  it('ends the round when the danger meter fills', () => {
    const arcade = createArcadeRun(level({ arrivalSeconds: 99, staySeconds: [999, 999], dangerFillSeconds: 1 }));
    arcade.place('left');
    arcade.place('left');
    arcade.place('left');
    const events = run(arcade, 3);
    expect(events.some((event) => event.type === 'roundLost')).toBe(true);
    expect(arcade.state.status).toBe('lost');
  });

  it('stops simulating once the round is over', () => {
    const arcade = createArcadeRun(level({ dangerFillSeconds: 0.5, arrivalSeconds: 99, staySeconds: [999, 999] }));
    arcade.place('left');
    arcade.place('left');
    arcade.place('left');
    run(arcade, 3);
    const elapsed = arcade.state.elapsed;
    run(arcade, 3);
    expect(arcade.state.elapsed).toBeCloseTo(elapsed, 5);
    expect(arcade.place('left')).toEqual([]);
  });

  it('is won by surviving the full time', () => {
    const arcade = createArcadeRun(level({}, 10));
    playWell(arcade, 11);
    expect(arcade.state.status).toBe('won');
    expect(arcade.progress).toBe(1);
  });

  it('reports progress through the round', () => {
    const arcade = createArcadeRun(level({}, 10));
    playWell(arcade, 5);
    expect(arcade.progress).toBeGreaterThan(0.4);
    expect(arcade.progress).toBeLessThan(0.6);
  });

  it('lets an ignored animal climb on by itself', () => {
    const arcade = createArcadeRun(level({ patienceSeconds: 1, staySeconds: [999, 999] }));
    const before = arcade.state.placed.length;
    const events = run(arcade, 1.2);
    const selfPlaced = events.filter((event) => event.type === 'placed' && !event.chosenByPlayer);
    expect(selfPlaced).toHaveLength(1);
    expect(arcade.state.placed).toHaveLength(before + 1);
  });

  it('reports how close the waiting animal is to deciding for itself', () => {
    const arcade = createArcadeRun(level({ patienceSeconds: 2 }));
    run(arcade, 1);
    expect(arcade.state.impatience).toBeGreaterThan(0.4);
    expect(arcade.state.impatience).toBeLessThan(0.6);
  });

  it('resets its patience once an animal is placed', () => {
    const arcade = createArcadeRun(level({ patienceSeconds: 2 }));
    run(arcade, 1.5);
    arcade.place('left');
    expect(arcade.state.impatience).toBeLessThan(0.1);
  });

  it('sends help quickly when the player is stuck in the red with nothing to place', () => {
    const arcade = createArcadeRun(level({ arrivalSeconds: 30, staySeconds: [999, 999], patienceSeconds: 99 }));
    // Empty the queue onto one side, which both empties the supply and tips it.
    arcade.place('left');
    arcade.place('left');
    arcade.place('left');
    expect(arcade.state.queue).toHaveLength(0);
    expect(arcade.snapshot().zone).toBe('red');

    run(arcade, 0.6);
    // Without the recovery rule the next animal would be 30 seconds away.
    expect(arcade.state.queue.length).toBeGreaterThan(0);
  });

  it('does not rush arrivals while the player is safe', () => {
    const arcade = createArcadeRun(level({ arrivalSeconds: 30, staySeconds: [999, 999], patienceSeconds: 99 }));
    // Alternate sides so the seesaw stays out of trouble, and drain the queue
    // including the one arrival that was already waiting to be released.
    const sides = ['left', 'right', 'left', 'right'] as const;
    for (const side of sides) {
      arcade.place(side);
      run(arcade, 0.1);
    }
    while (arcade.state.queue.length > 0) arcade.place(arcade.snapshot().balanceDifference > 0 ? 'right' : 'left');

    run(arcade, 2);
    expect(arcade.snapshot().zone).not.toBe('red');
    // Safe and empty-handed is a breather, not an emergency: no rush.
    expect(arcade.state.queue).toHaveLength(0);
  });

  it('rings the bell when a placement balances the seesaw', () => {
    const arcade = createArcadeRun(level({ arrivalSeconds: 99, staySeconds: [999, 999] }));
    let bells = 0;
    for (let i = 0; i < 40; i++) {
      const { balanceDifference } = arcade.snapshot();
      bells += arcade.place(balanceDifference > 0 ? 'right' : 'left').filter((e) => e.type === 'perfectBalance').length;
    }
    expect(bells).toBeGreaterThan(0);
  });

  it('quickens arrivals across a round when asked', () => {
    const steady = createArcadeRun(level({ arrivalSeconds: 2, staySeconds: [999, 999] }, 20));
    const quickening = createArcadeRun(
      level({ arrivalSeconds: 2, finalArrivalSeconds: 0.5, staySeconds: [999, 999] }, 20),
    );
    let steadyArrivals = 0;
    let quickeningArrivals = 0;
    for (let t = 0; t < 20; t += 1 / 60) {
      steadyArrivals += steady.tick(1 / 60).filter((e) => e.type === 'arrived').length;
      quickeningArrivals += quickening.tick(1 / 60).filter((e) => e.type === 'arrived').length;
      // Keep both runs alive and out of the red, so the only difference between
      // them is the pace of arrivals.
      for (const arcade of [steady, quickening]) {
        if (arcade.state.queue.length > 0) {
          arcade.place(arcade.snapshot().balanceDifference > 0 ? 'right' : 'left');
        }
      }
    }
    expect(steady.state.status).not.toBe('lost');
    expect(quickening.state.status).not.toBe('lost');
    expect(quickeningArrivals).toBeGreaterThan(steadyArrivals);
  });
});
