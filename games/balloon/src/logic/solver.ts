import { hooksOf, tiedOf, weightsOf, type RescueDef } from './rescue-def.js';

/** One way through a rescue: tray balloons for each kit, and tied ones to pop. */
export interface Answer {
  clip: number[];
  friend: number[];
  pop: number[];
}

/** Every subset of `0..size-1`, smallest masks first. Trays are small enough for this. */
export function subsetsOf(size: number): number[][] {
  const subsets: number[][] = [];
  for (let mask = 0; mask < 1 << size; mask += 1) {
    const subset: number[] = [];
    for (let index = 0; index < size; index += 1) if (mask & (1 << index)) subset.push(index);
    subsets.push(subset);
  }
  return subsets;
}

export const totalAt = (values: readonly number[], indices: readonly number[]): number =>
  indices.reduce((sum, index) => sum + (values[index] ?? 0), 0);

/**
 * Brute force: every tray balloon stays in the tray or goes to one of the kits,
 * every tied balloon is popped or not. Proof, not play: the tests use it to show
 * every rescue is answerable and to check what each chapter is for.
 */
export function solve(def: RescueDef): Answer[] {
  const tied = tiedOf(def);
  const weights = weightsOf(def);
  const choices = weights.length + 1;
  const tiedTotal = totalAt(tied, tied.map((_, index) => index));
  const answers: Answer[] = [];
  for (const pop of subsetsOf(tied.length)) {
    const base = tiedTotal - totalAt(tied, pop);
    for (let code = 0; code < choices ** def.tray.length; code += 1) {
      const clip: number[] = [];
      const friend: number[] = [];
      let rest = code;
      for (let index = 0; index < def.tray.length; index += 1) {
        const choice = rest % choices;
        rest = (rest - choice) / choices;
        if (choice === 1) clip.push(index);
        else if (choice === 2) friend.push(index);
      }
      if (tied.length + clip.length > hooksOf(def) || friend.length > hooksOf(def)) continue;
      if (base + totalAt(def.tray, clip) !== weights[0]) continue;
      if (weights.length > 1 && totalAt(def.tray, friend) !== weights[1]) continue;
      answers.push({ clip, friend, pop });
    }
  }
  return answers;
}

/** Answerable, and only by popping something. */
export const needsPop = (def: RescueDef): boolean => {
  const answers = solve(def);
  return answers.length > 0 && answers.every((answer) => answer.pop.length > 0);
};
