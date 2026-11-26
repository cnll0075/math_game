import { courseOf, preview, type Table } from './table.js';

/**
 * Players for the tests. `best` reads every number: the dial straight to the
 * answer, the right friends invited, cuts through the middle. `ones` shares one at a
 * time, which always works and is slow.
 */
export type Policy = 'best' | 'ones';

/** Play the round to its end. */
export function playRound(table: Table, policy: Policy): void {
  const state = table.state;
  for (let move = 0; move < 500 && state.phase !== 'done'; move += 1) {
    const course = courseOf(state);
    if (state.phase === 'between') {
      table.nextCourse();
    } else if (state.phase === 'inviting') {
      // Ask friends in one at a time until the treats share with none over.
      if (preview(state).fits) table.share();
      else table.invite(state.seated.length);
    } else if (state.phase === 'cutting') {
      const across = state.cuts.length === 0;
      table.cut(across ? { x: -1.3, y: 0 } : { x: 0, y: -1.3 }, across ? { x: 1.3, y: 0 } : { x: 0, y: 1.3 });
    } else if (course.kind === 'share' && course.mode === 'tap') {
      table.tap(state.plates.indexOf(Math.min(...state.plates)));
    } else {
      const want = policy === 'best' ? Math.floor(state.basket / state.seated.length) : 1;
      if (state.dial < want) table.turnDial(1);
      else if (state.dial > want) table.turnDial(-1);
      else table.share();
    }
  }
}
