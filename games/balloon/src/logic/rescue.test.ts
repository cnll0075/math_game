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
    expect(event).toEqual({
      type: 'released',
      outcome: { verdict: 'over', have: 11, need: 8, weight: 8, layer: 0 },
      tries: 1,
    });
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

  it('asks for weight plus layers when the ledge is up in the wind', () => {
    const def: RescueDef = { id: 'w', line: '', weight: 7, tray: [5, 3, 2, 4], layer: 3 };
    const floatsOnly = createRescue(def);
    floatsOnly.clip(0);
    floatsOnly.clip(2); // 5 + 2: exactly the weight, the old habit
    expect(floatsOnly.letGo()[0]).toEqual({
      type: 'released',
      outcome: { verdict: 'short', have: 7, need: 10, weight: 7, layer: 3 },
      tries: 1,
    });

    const right = createRescue(def);
    right.clip(0);
    right.clip(1);
    right.clip(2);
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

  it('writes the bunch, then the weight and the layers, when the ledge is up in the wind', () => {
    const rescue = createRescue({ id: 'w', line: '', weight: 7, tray: [5, 3, 2], layer: 3 });
    rescue.clip(0);
    rescue.clip(1);
    rescue.clip(2);
    expect(answerLines(rescue.state)).toEqual(['5 + 3 + 2 = 10', '7 + 3 = 10']);
  });

  it('says just the number when one balloon did it', () => {
    const rescue = createRescue({ id: 'one', line: '', weight: 3, tray: [3, 5] });
    rescue.clip(0);
    expect(answerLines(rescue.state)).toEqual(['3']);
  });
});
