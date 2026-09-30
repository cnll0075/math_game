import { hooksOf, tiedOf, type RescueDef } from './rescue-def.js';

/** One way through a rescue: which tray balloons to clip, tied ones to pop, puffs to add. */
export interface Answer {
  clip: number[];
  pop: number[];
  puffs: number[];
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
 * Brute force over clips, pops and puffs. Proof, not play: the tests use it to
 * show every rescue is answerable and to check what each chapter is for.
 */
export function solve(def: RescueDef): Answer[] {
  const tied = tiedOf(def);
  const tiedTotal = totalAt(tied, tied.map((_, index) => index));
  const wind = def.wind;
  const puffSets = wind
    ? subsetsOf(wind.puffs.length).filter((set) => wind.wind + totalAt(wind.puffs, set) === wind.ledge)
    : [[]];

  const answers: Answer[] = [];
  for (const pop of subsetsOf(tied.length)) {
    for (const clip of subsetsOf(def.tray.length)) {
      if (tied.length + clip.length > hooksOf(def)) continue;
      if (tiedTotal - totalAt(tied, pop) + totalAt(def.tray, clip) !== def.weight) continue;
      for (const puffs of puffSets) answers.push({ clip, pop, puffs });
    }
  }
  return answers;
}

/** Answerable, and only by popping something. */
export const needsPop = (def: RescueDef): boolean => {
  const answers = solve(def);
  return answers.length > 0 && answers.every((answer) => answer.pop.length > 0);
};
