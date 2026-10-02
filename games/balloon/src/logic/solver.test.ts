import { describe, it, expect } from 'vitest';
import { createRescue } from './rescue.js';
import { needsPop, solve, subsetsOf, totalAt } from './solver.js';
import type { RescueDef } from './rescue-def.js';

describe('the solver', () => {
  it('lists every subset once', () => {
    expect(subsetsOf(0)).toEqual([[]]);
    expect(subsetsOf(3)).toHaveLength(8);
  });

  it('finds every bunch that makes the weight', () => {
    const answers = solve({ id: 'a', line: '', weight: 7, tray: [6, 4, 3, 1] });
    expect(answers.map((answer) => answer.clip)).toEqual(
      expect.arrayContaining([
        [0, 3],
        [1, 2],
      ]),
    );
    expect(answers).toHaveLength(2);
  });

  it('respects the hook limit', () => {
    const def: RescueDef = { id: 'h', line: '', weight: 12, hooks: 2, tray: [4, 4, 4, 8] };
    expect(solve(def).every((answer) => answer.clip.length <= 2)).toBe(true);
    expect(solve({ ...def, tray: [4, 4, 4] })).toEqual([]);
  });

  it('pops tied balloons when it must', () => {
    const def: RescueDef = { id: 'p', line: '', weight: 7, tray: [], tied: [6, 3, 1] };
    expect(solve(def)).toEqual([{ clip: [], pop: [1] }]);
    expect(needsPop(def)).toBe(true);
    expect(needsPop({ id: 'n', line: '', weight: 3, tray: [3] })).toBe(false);
  });

  it('aims at weight plus layers', () => {
    const def: RescueDef = { id: 'w', line: '', weight: 7, tray: [5, 4, 3, 2], layer: 3 };
    const answers = solve(def);
    expect(answers.length).toBeGreaterThan(0);
    for (const answer of answers) expect(totalAt(def.tray, answer.clip)).toBe(10);
  });

  it('gives answers that really do rescue', () => {
    const def: RescueDef = { id: 'x', line: '', weight: 10, tray: [2], tied: [9, 5, 3] };
    for (const answer of solve(def)) {
      const rescue = createRescue(def);
      answer.pop.forEach((index) => rescue.togglePop(index));
      answer.clip.forEach((index) => rescue.clip(index));
      rescue.letGo();
      expect(rescue.state.rescued).toBe(true);
    }
  });
});
