import { describe, it, expect } from 'vitest';
import { createGame } from './game.js';
import type { LevelDef } from './level.js';

const balanceLevel: LevelDef = {
  id: 'test',
  mode: 'puzzle',
  title: 'Test',
  objective: { kind: 'balance' },
  initial: { left: ['rabbit'], right: [] },
  tray: ['rabbit', 'cat'],
};

/** Same layout but unwinnable, so placements can be observed without ending the level. */
const openLevel: LevelDef = { ...balanceLevel, objective: { kind: 'tilt', target: 99 } };

describe('createGame', () => {
  it('starts with the initial animals placed and nothing won', () => {
    const game = createGame(balanceLevel);
    expect(game.state.placed).toHaveLength(1);
    expect(game.state.status).toBe('playing');
    expect(game.state.stage).toBe(0);
    expect(game.state.tray.map((item) => item.used)).toEqual([false, false]);
  });

  it('emits placed and marks the tray item used', () => {
    const game = createGame(openLevel);
    const events = game.place(0, 'right');
    expect(events).toContainEqual(expect.objectContaining({ type: 'placed' }));
    expect(game.state.tray[0]!.used).toBe(true);
    expect(game.snapshot().rightWeight).toBe(1);
  });

  it('emits perfectBalance exactly once on entering equality', () => {
    const game = createGame(openLevel);
    const first = game.place(0, 'right');
    expect(first.filter((event) => event.type === 'perfectBalance')).toHaveLength(1);
    const second = game.place(1, 'right');
    expect(second.some((event) => event.type === 'perfectBalance')).toBe(false);
  });

  it('re-emits perfectBalance when equality is re-entered', () => {
    const game = createGame(openLevel);
    game.place(0, 'right');
    game.place(1, 'right');
    const events = game.takeBack(game.state.placed.at(-1)!.uid);
    expect(events.filter((event) => event.type === 'perfectBalance')).toHaveLength(1);
  });

  it('never emits perfectBalance for an empty seesaw', () => {
    const empty: LevelDef = { ...openLevel, initial: { left: [], right: [] } };
    const game = createGame(empty);
    const events = game.place(0, 'left');
    expect(events.some((event) => event.type === 'perfectBalance')).toBe(false);
  });

  it('emits levelCleared when the objective is met', () => {
    const game = createGame(balanceLevel);
    const events = game.place(0, 'right');
    expect(events.some((event) => event.type === 'levelCleared')).toBe(true);
    expect(game.state.status).toBe('won');
  });

  it('ignores placement after the level is won', () => {
    const game = createGame(balanceLevel);
    game.place(0, 'right');
    expect(game.place(1, 'left')).toEqual([]);
  });

  it('ignores placement from a used tray slot', () => {
    const game = createGame(openLevel);
    game.place(0, 'right');
    expect(game.place(0, 'left')).toEqual([]);
  });

  it('ignores placement from a slot that does not exist', () => {
    expect(createGame(openLevel).place(9, 'left')).toEqual([]);
  });

  it('returns an animal to the tray on take-back', () => {
    const game = createGame(openLevel);
    game.place(0, 'right');
    const events = game.takeBack(game.state.placed.at(-1)!.uid);
    expect(events).toContainEqual(expect.objectContaining({ type: 'takenBack' }));
    expect(game.state.tray[0]!.used).toBe(false);
    expect(game.state.placed).toHaveLength(1);
  });

  it('cannot take back an animal from the initial layout', () => {
    const game = createGame(openLevel);
    expect(game.takeBack(game.state.placed[0]!.uid)).toEqual([]);
    expect(game.state.placed).toHaveLength(1);
  });

  it('ignores take-back of an unknown animal', () => {
    expect(createGame(openLevel).takeBack('nope')).toEqual([]);
  });

  it('emits zoneChanged only on transitions', () => {
    const level: LevelDef = { ...openLevel, initial: { left: [], right: [] }, tray: ['bear', 'rabbit'] };
    const game = createGame(level);
    const first = game.place(0, 'left');
    expect(first).toContainEqual({ type: 'zoneChanged', from: 'green', to: 'red' });
    const second = game.place(1, 'left');
    expect(second.some((event) => event.type === 'zoneChanged')).toBe(false);
  });

  it('advances stages through a sequence', () => {
    const sequenceLevel: LevelDef = {
      ...balanceLevel,
      objective: { kind: 'sequence', challenges: [{ kind: 'balance' }, { kind: 'sideDown', side: 'right' }] },
    };
    const game = createGame(sequenceLevel);
    const first = game.place(0, 'right');
    expect(first).toContainEqual({ type: 'stageCleared', stage: 0 });
    expect(first.some((event) => event.type === 'levelCleared')).toBe(false);
    expect(game.state.stage).toBe(1);

    const second = game.place(1, 'right');
    expect(second).toContainEqual({ type: 'stageCleared', stage: 1 });
    expect(second.some((event) => event.type === 'levelCleared')).toBe(true);
    expect(game.state.status).toBe('won');
  });

  it('reset restores the initial layout and the full tray', () => {
    const game = createGame(balanceLevel);
    game.place(0, 'right');
    const events = game.reset();
    expect(events).toContainEqual({ type: 'reset' });
    expect(game.state.placed).toHaveLength(1);
    expect(game.state.tray.every((item) => !item.used)).toBe(true);
    expect(game.state.status).toBe('playing');
    expect(game.state.stage).toBe(0);
  });

  it('applies the level balance configuration', () => {
    const level: LevelDef = { ...openLevel, tray: ['dog'], balance: { green: 5, yellow: 6 } };
    const game = createGame(level);
    game.place(0, 'left');
    expect(game.snapshot().zone).toBe('green');
  });
});
