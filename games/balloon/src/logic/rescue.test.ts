import { describe, it, expect } from 'vitest';
import {
  answerLines,
  canLetGo,
  canStartOver,
  clippedOn,
  createRescue,
  hooksUsed,
  liftedSlots,
  liftOf,
  trayTaken,
} from './rescue.js';
import type { RescueDef } from './rescue-def.js';

const eight: RescueDef = { id: 'eight', line: '', weight: 8, tray: [5, 3, 6, 2] };
const pair: RescueDef = { id: 'pair', line: '', weight: 4, friend: 5, tray: [3, 1, 2, 3] };

describe('a rescue', () => {
  it('clips a tray balloon to the left kit and adds its lift', () => {
    const rescue = createRescue(eight);
    expect(rescue.clip(0)).toEqual([{ type: 'clipped', value: 5, kit: 0 }]);
    expect(liftOf(rescue.state)).toBe(5);
    expect(trayTaken(rescue.state, 0)).toBe(true);
  });

  it('will not clip the same tray balloon twice', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    expect(rescue.clip(0)).toEqual([]);
    expect(liftOf(rescue.state)).toBe(5);
  });

  it('sends a clipped balloon back to its own place in the tray', () => {
    const rescue = createRescue(eight);
    rescue.clip(2);
    rescue.clip(0);
    expect(rescue.unclip(0, 0)).toEqual([{ type: 'unclipped', value: 6 }]);
    expect(trayTaken(rescue.state, 2)).toBe(false);
    expect(clippedOn(rescue.state, 0)).toEqual([{ value: 5, from: 0, kit: 0 }]);
  });

  it('ignores slots, tray places and kits that do not exist', () => {
    const rescue = createRescue(eight);
    expect(rescue.clip(9)).toEqual([]);
    expect(rescue.clip(-1)).toEqual([]);
    expect(rescue.clip(0, 1)).toEqual([]);
    expect(rescue.unclip(0, 0)).toEqual([]);
    expect(rescue.unclip(0, -1)).toEqual([]);
    expect(rescue.togglePop(0)).toEqual([]);
  });

  it('refuses a clip once every hook is used', () => {
    const rescue = createRescue({ ...eight, hooks: 2 });
    rescue.clip(0);
    rescue.clip(1);
    expect(rescue.clip(2)).toEqual([{ type: 'full' }]);
    expect(hooksUsed(rescue.state)).toBe(2);
  });

  it('counts tied balloons against the hooks, popped or not', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3], hooks: 2 });
    rescue.togglePop(1);
    expect(rescue.clip(0)).toEqual([{ type: 'full' }]);
  });

  it('pops a tied balloon, and puts it back on a second tap', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [], tied: [6, 3, 1] });
    expect(liftOf(rescue.state)).toBe(10);
    expect(rescue.togglePop(1)).toEqual([{ type: 'popped', index: 1, value: 3 }]);
    expect(liftOf(rescue.state)).toBe(7);
    expect(rescue.togglePop(1)).toEqual([{ type: 'reinflated', index: 1, value: 3 }]);
  });

  it('does nothing on "Let go!" with nothing on any harness', () => {
    const rescue = createRescue(eight);
    expect(canLetGo(rescue.state)).toBe(false);
    expect(rescue.letGo()).toEqual([]);
    expect(rescue.state.tries).toBe(0);
  });

  it('counts a wrong try and leaves the bunch exactly as it was', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(2);
    expect(rescue.letGo()).toEqual([{ type: 'released', outcomes: [{ verdict: 'over', have: 11, need: 8 }], tries: 1 }]);
    expect(clippedOn(rescue.state, 0)).toEqual([
      { value: 5, from: 0, kit: 0 },
      { value: 6, from: 2, kit: 0 },
    ]);
    expect(rescue.state.rescued).toBe(false);
  });

  it('is rescued by an exact lift, and then will not change', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(1);
    rescue.letGo();
    expect(rescue.state.rescued).toBe(true);
    expect(rescue.clip(3)).toEqual([]);
    expect(rescue.unclip(0, 0)).toEqual([]);
    expect(rescue.startOver()).toEqual([]);
    expect(rescue.letGo()).toEqual([]);
  });

  it('knows which bunch slots are still lifting', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3, 1] });
    rescue.togglePop(1);
    rescue.clip(0);
    expect(liftedSlots(rescue.state)).toEqual([0, 2, 3]);
  });
});

describe('two kits', () => {
  it('clips to either kit, and keeps their lifts apart', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 0);
    expect(rescue.clip(2, 1)).toEqual([{ type: 'clipped', value: 2, kit: 1 }]);
    rescue.clip(3, 1);
    expect(liftOf(rescue.state, 0)).toBe(3);
    expect(liftOf(rescue.state, 1)).toBe(5);
    expect(liftedSlots(rescue.state, 1)).toEqual([0, 1]);
  });

  it('judges each kit on its own, and rescues only when both are exact', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 0);
    rescue.clip(2, 1);
    rescue.clip(3, 1);
    expect(rescue.letGo()).toEqual([
      { type: 'released', outcomes: [{ verdict: 'short', have: 3, need: 4 }, { verdict: 'exact', have: 5, need: 5 }], tries: 1 },
    ]);
    expect(rescue.state.rescued).toBe(false);
    rescue.clip(1, 0);
    rescue.letGo();
    expect(rescue.state.rescued).toBe(true);
  });

  it('applies the hook limit to each kit', () => {
    const rescue = createRescue({ ...pair, hooks: 1 });
    rescue.clip(0, 0);
    expect(rescue.clip(1, 0)).toEqual([{ type: 'full' }]);
    expect(rescue.clip(1, 1)).toEqual([{ type: 'clipped', value: 1, kit: 1 }]);
  });

  it('takes a balloon off the kit it is on', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 0);
    rescue.clip(2, 1);
    expect(rescue.unclip(1, 0)).toEqual([{ type: 'unclipped', value: 2 }]);
    expect(clippedOn(rescue.state, 0)).toHaveLength(1);
    expect(clippedOn(rescue.state, 1)).toHaveLength(0);
  });
});

describe('starting over', () => {
  it('blows every pop back up and sends every balloon back, keeping the tries', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 10, tray: [2], tied: [9, 5, 3] });
    rescue.togglePop(1);
    rescue.clip(0);
    rescue.letGo();
    expect(canStartOver(rescue.state)).toBe(true);
    expect(rescue.startOver()).toEqual([{ type: 'reset' }]);
    expect(rescue.state.tied.every((balloon) => !balloon.popped)).toBe(true);
    expect(rescue.state.clipped).toEqual([]);
    expect(rescue.state.tries).toBe(1);
  });

  it('does nothing when there is nothing to undo', () => {
    const rescue = createRescue(eight);
    expect(canStartOver(rescue.state)).toBe(false);
    expect(rescue.startOver()).toEqual([]);
  });
});

describe('the finished sums', () => {
  it('adds up what lifted', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(1);
    expect(answerLines(rescue.state)).toEqual(['5 + 3 = 8']);
  });

  it('takes away what was popped', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 10, tray: [2], tied: [9, 5, 3] });
    rescue.togglePop(0);
    rescue.clip(0);
    expect(answerLines(rescue.state)).toEqual(['17 − 9 + 2 = 10']);
  });

  it('says just the number when one balloon did it', () => {
    const rescue = createRescue({ id: 'one', line: '', weight: 3, tray: [3, 5] });
    rescue.clip(0);
    expect(answerLines(rescue.state)).toEqual(['3']);
  });

  it('writes one sum per kit', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 0);
    rescue.clip(1, 0);
    rescue.clip(2, 1);
    rescue.clip(3, 1);
    expect(answerLines(rescue.state)).toEqual(['3 + 1 = 4', '2 + 3 = 5']);
  });
});
