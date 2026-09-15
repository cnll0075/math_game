import { describe, it, expect } from 'vitest';
import { createGame } from './game.js';
import type { LevelDef } from './level.js';

const question = (overrides: Partial<LevelDef> = {}): LevelDef => ({
  id: 'test',
  section: 'same',
  objective: { kind: 'balance' },
  initial: { left: ['chicken'], right: [] },
  tray: ['chicken', 'cat'],
  ...overrides,
});

/** Same question, but unwinnable, so placements can be watched without it ending. */
const open = (overrides: Partial<LevelDef> = {}) =>
  question({ objective: { kind: 'tilt', target: 99 }, ...overrides });

describe('createGame', () => {
  it('lays the question out with nothing won', () => {
    const game = createGame(question());
    expect(game.state.placed).toHaveLength(1);
    expect(game.state.status).toBe('playing');
    expect(game.state.tray.map((item) => item.used)).toEqual([false, false]);
  });

  it('emits placed and marks the tray item used', () => {
    const game = createGame(open());
    const events = game.place(0, 'right');
    expect(events).toContainEqual(expect.objectContaining({ type: 'placed' }));
    expect(game.state.tray[0]!.used).toBe(true);
    expect(game.snapshot().rightWeight).toBe(1);
  });

  it('emits perfectBalance exactly once on entering equality', () => {
    const game = createGame(open());
    const first = game.place(0, 'right');
    expect(first.filter((event) => event.type === 'perfectBalance')).toHaveLength(1);
    const second = game.place(1, 'right');
    expect(second.some((event) => event.type === 'perfectBalance')).toBe(false);
  });

  it('re-emits perfectBalance when equality is re-entered', () => {
    const game = createGame(open());
    game.place(0, 'right');
    game.place(1, 'right');
    const events = game.takeBack(game.state.placed.at(-1)!.uid);
    expect(events.filter((event) => event.type === 'perfectBalance')).toHaveLength(1);
  });

  it('never emits perfectBalance for an empty seesaw', () => {
    const game = createGame(open({ initial: { left: [], right: [] } }));
    expect(game.place(0, 'left').some((event) => event.type === 'perfectBalance')).toBe(false);
  });

  it('is won when the question is answered', () => {
    const game = createGame(question());
    const events = game.place(0, 'right');
    expect(events.some((event) => event.type === 'levelCleared')).toBe(true);
    expect(game.state.status).toBe('won');
  });

  it('ignores placement after the level is won', () => {
    const game = createGame(question());
    game.place(0, 'right');
    expect(game.place(1, 'left')).toEqual([]);
  });

  it('ignores placement from a used tray slot, or one that does not exist', () => {
    const game = createGame(open());
    game.place(0, 'right');
    expect(game.place(0, 'left')).toEqual([]);
    expect(game.place(9, 'left')).toEqual([]);
  });

  it('returns an animal to the tray on take-back', () => {
    const game = createGame(open());
    game.place(0, 'right');
    const events = game.takeBack(game.state.placed.at(-1)!.uid);
    expect(events).toContainEqual(expect.objectContaining({ type: 'takenBack' }));
    expect(game.state.tray[0]!.used).toBe(false);
    expect(game.state.placed).toHaveLength(1);
  });

  it('refuses to lift an animal the level started with', () => {
    const game = createGame(open());
    expect(game.takeBack(game.state.placed[0]!.uid)).toEqual([]);
    expect(game.state.placed).toHaveLength(1);
  });

  it('allows it when the level is built around taking animals off', () => {
    const game = createGame(open({ allowRemoval: true, initial: { left: ['cat', 'dog'], right: [] } }));
    const events = game.takeBack(game.state.placed[0]!.uid);
    expect(events).toContainEqual(expect.objectContaining({ type: 'takenBack' }));
    // Only the one that was tapped: the others a level starts with stay put.
    expect(game.state.placed.map((animal) => animal.species)).toEqual(['dog']);
  });

  it('ignores take-back of an unknown animal', () => {
    expect(createGame(open()).takeBack('nope')).toEqual([]);
  });

  it('emits zoneChanged only on transitions', () => {
    const game = createGame(open({ initial: { left: [], right: [] }, tray: ['bear', 'chicken'] }));
    expect(game.place(0, 'left')).toContainEqual({ type: 'zoneChanged', from: 'green', to: 'red' });
    expect(game.place(1, 'left').some((event) => event.type === 'zoneChanged')).toBe(false);
  });

  it('reset lays the question out again', () => {
    const game = createGame(open());
    game.place(0, 'right');
    expect(game.reset()).toContainEqual({ type: 'reset' });
    expect(game.state.placed).toHaveLength(1);
    expect(game.state.tray.every((item) => !item.used)).toBe(true);
  });
});

describe('groups in the tray', () => {
  const withGroup = (count: number, overrides: Partial<LevelDef> = {}) =>
    question({
      objective: { kind: 'tilt', target: 99 },
      initial: { left: [], right: [] },
      tray: [{ of: 'cat', count }],
      ...overrides,
    });

  it('is picked up and placed as one thing', () => {
    const game = createGame(withGroup(3));
    const events = game.place(0, 'left');
    // Three cats land, from one tap.
    expect(events.filter((event) => event.type === 'placed')).toHaveLength(3);
    expect(game.snapshot().leftWeight).toBe(6);
    expect(game.state.tray[0]!.used).toBe(true);
  });

  it('goes back as one thing', () => {
    const game = createGame(withGroup(3));
    game.place(0, 'left');
    const events = game.takeBack(game.state.placed[1]!.uid);
    expect(events.filter((event) => event.type === 'takenBack')).toHaveLength(3);
    expect(game.state.placed).toHaveLength(0);
    expect(game.state.tray[0]!.used).toBe(false);
  });

  it('weighs its members together', () => {
    const game = createGame(
      question({ initial: { left: ['dog', 'dog'], right: [] }, tray: [{ of: 'cat', count: 3 }] }),
    );
    game.place(0, 'right');
    expect(game.state.status).toBe('won');
  });
});

describe('sharing the whole pile', () => {
  const share = (): LevelDef =>
    question({
      requireEmptyTray: true,
      initial: { left: [], right: [] },
      tray: ['cat', 'cat', 'chicken', 'chicken'],
    });

  it('is not answered while animals are still waiting', () => {
    const game = createGame(share());
    game.place(0, 'left');
    game.place(1, 'right');
    expect(game.snapshot().isPerfectlyBalanced).toBe(true);
    expect(game.state.status).toBe('playing');
  });

  it('is answered once everyone is seated evenly', () => {
    const game = createGame(share());
    game.place(0, 'left');
    game.place(1, 'right');
    game.place(2, 'left');
    game.place(3, 'right');
    expect(game.state.status).toBe('won');
  });
});

describe('taking an animal off the seesaw', () => {
  const removable = (): LevelDef => ({
    id: 'bed',
    section: 'takeoff',
    objective: { kind: 'balance' },
    allowRemoval: true,
    initial: { left: ['bear', 'cat', 'chicken'], right: ['dog', 'dog'] },
    tray: [],
  });

  it('puts it in the tray rather than making it vanish', () => {
    const game = createGame(removable());
    game.takeBack('init-left-0');
    expect(game.state.tray.map((item) => item.species)).toEqual(['bear']);
    expect(game.state.tray[0]!.used).toBe(false);
  });

  it('lets a wrong answer be undone, so a question is never a dead end', () => {
    const game = createGame(removable());
    // Lifting the bear is wrong: 3 against 6.
    game.takeBack('init-left-0');
    expect(game.state.status).toBe('playing');

    // It can go straight back where it was, and the right one taken off instead.
    game.place(0, 'left');
    expect(game.snapshot().leftWeight).toBe(8);
    game.takeBack('init-left-1');
    expect(game.state.status).toBe('won');
  });

  it('lets a lifted animal go back on either side', () => {
    const game = createGame(removable());
    game.takeBack('init-left-2');
    game.place(0, 'right');
    // The chicken moved across rather than leaving the game.
    expect(game.snapshot().rightWeight).toBe(7);
  });
});
