import { describe, it, expect } from 'vitest';
import {
  answerLines,
  canLetGo,
  createRescue,
  hooksUsed,
  liftedSlots,
  liftOf,
  trayTaken,
} from './rescue.js';
import type { RescueDef } from './rescue-def.js';

const eight: RescueDef = { id: 'eight', line: '', weight: 8, tray: [5, 3, 6, 2] };

describe('a rescue', () => {
  it('clips a tray balloon to the harness and adds its lift', () => {
    const rescue = createRescue(eight);
    expect(rescue.clip(0)).toEqual([{ type: 'clipped', value: 5 }]);
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
    expect(rescue.unclip(0)).toEqual([{ type: 'unclipped', value: 6 }]);
    expect(trayTaken(rescue.state, 2)).toBe(false);
    expect(rescue.state.clipped).toEqual([{ value: 5, from: 0 }]);
  });

  it('ignores slots and tray places that do not exist', () => {
    const rescue = createRescue(eight);
    expect(rescue.clip(9)).toEqual([]);
    expect(rescue.clip(-1)).toEqual([]);
    expect(rescue.unclip(0)).toEqual([]);
    expect(rescue.unclip(-1)).toEqual([]);
    expect(rescue.togglePop(0)).toEqual([]);
    expect(rescue.puff(0)).toEqual([]);
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
    expect(liftOf(rescue.state)).toBe(10);
  });

  it('does nothing on "Let go!" with nothing on the harness', () => {
    const rescue = createRescue(eight);
    expect(canLetGo(rescue.state)).toBe(false);
    expect(rescue.letGo()).toEqual([]);
    expect(rescue.state.tries).toBe(0);
  });

  it('counts a wrong try and leaves the bunch exactly as it was', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(2);
    const [event] = rescue.letGo();
    expect(event).toEqual({ type: 'released', outcome: { verdict: 'over', axis: 'up', have: 11, need: 8 }, tries: 1 });
    expect(rescue.state.clipped).toEqual([{ value: 5, from: 0 }, { value: 6, from: 2 }]);
    expect(rescue.state.rescued).toBe(false);
  });

  it('is rescued by an exact lift, and then will not change', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(1);
    const [event] = rescue.letGo();
    expect(event?.type === 'released' && event.outcome.verdict).toBe('exact');
    expect(rescue.state.rescued).toBe(true);
    expect(rescue.clip(3)).toEqual([]);
    expect(rescue.unclip(0)).toEqual([]);
    expect(rescue.letGo()).toEqual([]);
  });

  it('judges the wind: its push plus the puffs must reach the ledge', () => {
    const def: RescueDef = { id: 'w', line: '', weight: 4, tray: [], tied: [3, 1], wind: { ledge: 7, wind: 3, puffs: [5, 4, 2] } };
    const short = createRescue(def);
    short.puff(2);
    expect(short.letGo()[0]).toEqual({ type: 'released', outcome: { verdict: 'short', axis: 'across', have: 5, need: 7 }, tries: 1 });

    const right = createRescue(def);
    right.puff(1);
    expect(right.letGo()[0]).toMatchObject({ outcome: { verdict: 'exact' } });
  });

  it('knows which bunch slots are still lifting', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3, 1] });
    rescue.togglePop(1);
    rescue.clip(0);
    expect(liftedSlots(rescue.state)).toEqual([0, 2, 3]);
  });
});

describe('the finished sum', () => {
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

  it('writes the sideways sum with the wind in it, either way it blows', () => {
    const helping = createRescue({ id: 'w', line: '', weight: 4, tray: [], tied: [3, 1], wind: { ledge: 7, wind: 3, puffs: [4] } });
    helping.puff(0);
    expect(answerLines(helping.state)).toEqual(['3 + 1 = 4', '3 + 4 = 7']);

    const against = createRescue({ id: 'w', line: '', weight: 6, tray: [], tied: [3, 3], wind: { ledge: 5, wind: -2, puffs: [5, 2] } });
    against.puff(0);
    against.puff(1);
    expect(answerLines(against.state)[1]).toBe('5 + 2 − 2 = 5');
  });

  it('says just the number when one balloon did it', () => {
    const rescue = createRescue({ id: 'one', line: '', weight: 3, tray: [3, 5] });
    rescue.clip(0);
    expect(answerLines(rescue.state)).toEqual(['3']);
  });
});
