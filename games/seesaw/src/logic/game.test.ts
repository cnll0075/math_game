import { describe, it, expect } from 'vitest';
import { createGame } from './game.js';
import type { LevelDef } from './level.js';

const oneRound = (overrides: Partial<LevelDef> = {}): LevelDef => ({
  id: 'test',
  title: 'Test',
  objective: { kind: 'balance' },
  rounds: [{ initial: { left: ['chicken'], right: [] }, tray: ['chicken', 'cat'] }],
  ...overrides,
});

/** Same round, but unwinnable, so placements can be watched without it ending. */
const openRound = () => oneRound({ objective: { kind: 'tilt', target: 99 } });

describe('createGame', () => {
  it('starts with the round laid out and nothing won', () => {
    const game = createGame(oneRound());
    expect(game.state.placed).toHaveLength(1);
    expect(game.state.status).toBe('playing');
    expect(game.state.round).toBe(0);
    expect(game.state.tray.map((item) => item.used)).toEqual([false, false]);
  });

  it('emits placed and marks the tray item used', () => {
    const game = createGame(openRound());
    const events = game.place(0, 'right');
    expect(events).toContainEqual(expect.objectContaining({ type: 'placed' }));
    expect(game.state.tray[0]!.used).toBe(true);
    expect(game.snapshot().rightWeight).toBe(1);
  });

  it('emits perfectBalance exactly once on entering equality', () => {
    const game = createGame(openRound());
    const first = game.place(0, 'right');
    expect(first.filter((event) => event.type === 'perfectBalance')).toHaveLength(1);
    const second = game.place(1, 'right');
    expect(second.some((event) => event.type === 'perfectBalance')).toBe(false);
  });

  it('re-emits perfectBalance when equality is re-entered', () => {
    const game = createGame(openRound());
    game.place(0, 'right');
    game.place(1, 'right');
    const events = game.takeBack(game.state.placed.at(-1)!.uid);
    expect(events.filter((event) => event.type === 'perfectBalance')).toHaveLength(1);
  });

  it('never emits perfectBalance for an empty seesaw', () => {
    const empty = oneRound({
      objective: { kind: 'tilt', target: 99 },
      rounds: [{ initial: { left: [], right: [] }, tray: ['chicken', 'cat'] }],
    });
    const game = createGame(empty);
    expect(game.place(0, 'left').some((event) => event.type === 'perfectBalance')).toBe(false);
  });

  it('clears the round and the level when the goal is met', () => {
    const game = createGame(oneRound());
    const events = game.place(0, 'right');
    expect(events).toContainEqual({ type: 'roundCleared', round: 0 });
    expect(events.some((event) => event.type === 'levelCleared')).toBe(true);
    expect(game.state.status).toBe('won');
  });

  it('ignores placement after the level is won', () => {
    const game = createGame(oneRound());
    game.place(0, 'right');
    expect(game.place(1, 'left')).toEqual([]);
  });

  it('ignores placement from a used tray slot, or one that does not exist', () => {
    const game = createGame(openRound());
    game.place(0, 'right');
    expect(game.place(0, 'left')).toEqual([]);
    expect(game.place(9, 'left')).toEqual([]);
  });

  it('returns an animal to the tray on take-back', () => {
    const game = createGame(openRound());
    game.place(0, 'right');
    const events = game.takeBack(game.state.placed.at(-1)!.uid);
    expect(events).toContainEqual(expect.objectContaining({ type: 'takenBack' }));
    expect(game.state.tray[0]!.used).toBe(false);
    expect(game.state.placed).toHaveLength(1);
  });

  it('refuses to lift an animal the round started with', () => {
    const game = createGame(openRound());
    expect(game.takeBack(game.state.placed[0]!.uid)).toEqual([]);
    expect(game.state.placed).toHaveLength(1);
  });

  it('allows it when the level is built around taking animals off', () => {
    const game = createGame(oneRound({ allowRemoval: true, objective: { kind: 'tilt', target: 99 } }));
    const events = game.takeBack(game.state.placed[0]!.uid);
    expect(events).toContainEqual(expect.objectContaining({ type: 'takenBack' }));
    expect(game.state.placed).toHaveLength(0);
  });

  it('ignores take-back of an unknown animal', () => {
    expect(createGame(openRound()).takeBack('nope')).toEqual([]);
  });

  it('emits zoneChanged only on transitions', () => {
    const level = oneRound({
      objective: { kind: 'tilt', target: 99 },
      rounds: [{ initial: { left: [], right: [] }, tray: ['bear', 'chicken'] }],
    });
    const game = createGame(level);
    expect(game.place(0, 'left')).toContainEqual({ type: 'zoneChanged', from: 'green', to: 'red' });
    expect(game.place(1, 'left').some((event) => event.type === 'zoneChanged')).toBe(false);
  });
});

describe('levels made of several rounds', () => {
  const threeRounds = (): LevelDef => ({
    id: 'three',
    title: 'Three',
    objective: { kind: 'balance' },
    rounds: [
      { initial: { left: ['chicken'], right: [] }, tray: ['chicken'] },
      { initial: { left: ['cat'], right: [] }, tray: ['cat'] },
      { initial: { left: ['dog'], right: [] }, tray: ['dog'] },
    ],
  });

  it('moves to the next round and lays it out fresh', () => {
    const game = createGame(threeRounds());
    const events = game.place(0, 'right');
    expect(events).toContainEqual({ type: 'roundCleared', round: 0 });
    expect(events.some((event) => event.type === 'levelCleared')).toBe(false);
    expect(game.state.round).toBe(1);
    // The second round's animals, not the first round's leftovers.
    expect(game.state.placed.map((animal) => animal.species)).toEqual(['cat']);
    expect(game.state.tray.every((item) => !item.used)).toBe(true);
  });

  it('is won only after the last round', () => {
    const game = createGame(threeRounds());
    game.place(0, 'right');
    game.place(0, 'right');
    expect(game.state.status).toBe('playing');
    const last = game.place(0, 'right');
    expect(last.some((event) => event.type === 'levelCleared')).toBe(true);
    expect(game.state.status).toBe('won');
  });

  it('lets a round carry its own goal', () => {
    const mixed: LevelDef = {
      id: 'mixed',
      title: 'Mixed',
      objective: { kind: 'balance' },
      rounds: [
        { initial: { left: ['cat'], right: [] }, tray: ['cat'] },
        { initial: { left: ['cat'], right: [] }, tray: ['dog'], objective: { kind: 'sideDown', side: 'right' } },
      ],
    };
    const game = createGame(mixed);
    game.place(0, 'right');
    expect(game.state.round).toBe(1);
    // Balance would not clear this round; making the right side heavier does.
    const events = game.place(0, 'right');
    expect(events.some((event) => event.type === 'levelCleared')).toBe(true);
  });

  it('needs the whole tray seated when the level says so', () => {
    const share: LevelDef = {
      id: 'share',
      title: 'Share',
      objective: { kind: 'balance' },
      requireEmptyTray: true,
      rounds: [{ initial: { left: [], right: [] }, tray: ['cat', 'cat', 'chicken', 'chicken'] }],
    };
    const game = createGame(share);
    game.place(0, 'left');
    game.place(1, 'right');
    // Level with two chickens still in the tray: balanced, but not shared.
    expect(game.snapshot().isPerfectlyBalanced).toBe(true);
    expect(game.state.status).toBe('playing');
    game.place(2, 'left');
    game.place(3, 'right');
    expect(game.state.status).toBe('won');
  });

  it('reset goes back to the first round', () => {
    const game = createGame(threeRounds());
    game.place(0, 'right');
    expect(game.state.round).toBe(1);
    expect(game.reset()).toContainEqual({ type: 'reset' });
    expect(game.state.round).toBe(0);
    expect(game.state.status).toBe('playing');
  });
});
