import { describe, it, expect } from 'vitest';
import type { Course, LevelDef } from './levels.data.js';
import { createTable, preview, type Table, type TableEvent } from './table.js';

const round = (courses: Course[], friends: LevelDef['friends'] = ['teddy', 'bunny', 'fox']): LevelDef => ({
  id: 'test',
  title: 'Test',
  line: '',
  friends,
  courses,
});

const types = (events: readonly TableEvent[]) => events.map((event) => event.type);

/** Turn the dial towards a value, as far as it will go. */
const turnTo = (table: Table, value: number) => {
  for (let turn = 0; turn < 20 && table.state.dial < value; turn += 1) table.turnDial(1);
  for (let turn = 0; turn < 20 && table.state.dial > value; turn += 1) table.turnDial(-1);
};

describe('sharing by tapping plates', () => {
  const tapRound = (count: number, friends: LevelDef['friends'] = ['teddy', 'bunny']) =>
    createTable(round([{ kind: 'share', treat: 'cookie', count, mode: 'tap' }], friends));

  it('gives the friend one treat from the basket', () => {
    const table = tapRound(6);
    expect(table.tap(1)).toEqual([{ type: 'gave', plate: 1 }]);
    expect(table.state.plates).toEqual([0, 1]);
    expect(table.state.basket).toBe(5);
  });

  it('will not give a friend more than anyone else has', () => {
    const table = tapRound(6);
    table.tap(0);
    expect(table.tap(0)).toEqual([{ type: 'refused', plate: 0 }]);
    expect(table.state.plates).toEqual([1, 0]);
    expect(table.tap(7)).toEqual([]);
  });

  it('ends the course when everyone has the same and the basket is empty', () => {
    const table = tapRound(6);
    const events: TableEvent[] = [];
    for (let lap = 0; lap < 3; lap += 1) events.push(...table.tap(0), ...table.tap(1));
    expect(types(events).slice(-2)).toEqual(['course', 'done']);
    expect(events).toContainEqual({ type: 'course', summary: { item: 'cookie', count: 6, friends: 2, each: 3, leftover: 0 } });
    expect(table.state.phase).toBe('done');
  });

  it('gives what cannot go round to Biscuit, always fewer than the friends', () => {
    const table = tapRound(7);
    const events: TableEvent[] = [];
    for (let lap = 0; lap < 3; lap += 1) events.push(...table.tap(0), ...table.tap(1));
    expect(events).toContainEqual({ type: 'leftover', count: 1 });
    expect(table.state.biscuit).toBe(1);
    expect(table.state.phase).toBe('done');
  });

  it('changes nothing once the round is done', () => {
    const table = tapRound(2);
    table.tap(0);
    table.tap(1);
    expect(table.tap(0)).toEqual([]);
    expect(table.share()).toEqual([]);
  });
});

describe('sharing with the dial', () => {
  const dialRound = (count: number) => createTable(round([{ kind: 'share', treat: 'strawberry', count, mode: 'dial' }]));

  it('starts at 1, and turns between 1 and 10', () => {
    const table = dialRound(12);
    expect(table.state.dial).toBe(1);
    table.turnDial(-1);
    expect(table.state.dial).toBe(1);
    turnTo(table, 15);
    expect(table.state.dial).toBe(10);
  });

  it('shares the dial\'s number to every plate at once, as one share', () => {
    const table = dialRound(12);
    turnTo(table, 4);
    expect(table.share()).toEqual([
      { type: 'shared', each: 4 },
      { type: 'course', summary: { item: 'strawberry', count: 12, friends: 3, each: 4, leftover: 0 } },
      { type: 'done' },
    ]);
    expect(table.state.plates).toEqual([4, 4, 4]);
    expect(table.state.shares).toBe(1);
  });

  it('will not share more than the basket holds, and says so', () => {
    const table = dialRound(12);
    turnTo(table, 5);
    expect(preview(table.state)).toEqual({ each: 5, fits: false, leftover: 0 });
    expect(table.share()).toEqual([{ type: 'short', need: 15, have: 12 }]);
    expect(table.state.plates).toEqual([0, 0, 0]);
    expect(table.state.shares).toBe(0);
  });

  it('lets the dial change between shares', () => {
    const table = dialRound(12);
    turnTo(table, 3);
    table.share();
    expect(table.state.basket).toBe(3);
    turnTo(table, 1);
    expect(types(table.share())).toEqual(['shared', 'course', 'done']);
    expect(table.state.plates).toEqual([4, 4, 4]);
    expect(table.state.shares).toBe(2);
  });

  it('previews the next share', () => {
    const table = dialRound(14);
    turnTo(table, 4);
    expect(preview(table.state)).toEqual({ each: 4, fits: true, leftover: 2 });
  });

  it('gives the remainder to Biscuit after the last share that fits', () => {
    const table = dialRound(14);
    turnTo(table, 4);
    const events = table.share();
    expect(events).toContainEqual({ type: 'leftover', count: 2 });
    expect(events).toContainEqual({ type: 'course', summary: { item: 'strawberry', count: 14, friends: 3, each: 4, leftover: 2 } });
  });
});

describe('a round of several courses', () => {
  it('waits between courses, then starts the next with fresh plates', () => {
    const table = createTable(
      round([
        { kind: 'share', treat: 'cookie', count: 6, mode: 'dial' },
        { kind: 'share', treat: 'strawberry', count: 9, mode: 'dial' },
      ]),
    );
    turnTo(table, 2);
    expect(types(table.share())).toEqual(['shared', 'course']);
    expect(table.state.phase).toBe('between');
    expect(table.share()).toEqual([]);
    expect(table.nextCourse()).toEqual([{ type: 'next', course: 1 }]);
    expect(table.state).toMatchObject({ phase: 'sharing', course: 1, plates: [0, 0, 0], basket: 9, dial: 1 });
    turnTo(table, 3);
    expect(types(table.share())).toEqual(['shared', 'course', 'done']);
    expect(table.state.summaries.map((summary) => summary.item)).toEqual(['cookie', 'strawberry']);
    expect(table.state.shares).toBe(2);
  });
});
