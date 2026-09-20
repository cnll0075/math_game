export type BandId = 'easy' | 'over-ten' | 'take-aways';

/**
 * One stretch of the curriculum. A band decides two separate things: which
 * numbers planes may wear, and how a sum for one of those numbers is written.
 */
export interface Band {
  id: BandId;
  /** Written for a six-year-old rather than for a spreadsheet. */
  title: string;
  /** Seconds into a run when this band takes over. */
  from: number;
  /** The numbers planes may wear while it is live. */
  answers: { from: number; to: number };
  /**
   * Chance a plane's number is drawn from 2..10 instead of the band's own range,
   * so crossing ten arrives as a change of gear rather than a wall.
   */
  easyMix: number;
  /**
   * Chance a sum is written as an addition. Below 1 it means take-aways are
   * live, and addition stays in the mix so that the *sign* is something worth
   * reading rather than a constant to ignore.
   */
  addMix: number;
}

export const BANDS: readonly Band[] = [
  { id: 'easy', title: 'Easy Sums', from: 0, answers: { from: 2, to: 10 }, easyMix: 1, addMix: 1 },
  { id: 'over-ten', title: 'Over Ten', from: 45, answers: { from: 11, to: 20 }, easyMix: 0.3, addMix: 1 },
  { id: 'take-aways', title: 'Take-Aways', from: 120, answers: { from: 1, to: 20 }, easyMix: 0, addMix: 0.4 },
];

export const bandAt = (elapsed: number): Band => {
  let current = BANDS[0]!;
  for (const band of BANDS) if (elapsed >= band.from) current = band;
  return current;
};

export const bandById = (id: string): Band | undefined => BANDS.find((band) => band.id === id);

/**
 * Every number a plane may wear while this band is live. The spawner draws from
 * it, which is what makes "every plane is shootable" a structural fact: a plane
 * cannot wear a number no sum of this band could produce.
 */
export const answerSet = (band: Band): readonly number[] => {
  const numbers = new Set<number>();
  for (let n = band.answers.from; n <= band.answers.to; n += 1) numbers.add(n);
  if (band.easyMix > 0) for (let n = 2; n <= 10; n += 1) numbers.add(n);
  return [...numbers].sort((a, b) => a - b);
};
