export type Verdict = 'short' | 'exact' | 'over';

/**
 * What letting go did. `axis` says which question the verdict answers: up is
 * judged first, and across only once up is right, so the gauge only ever talks
 * about one thing.
 */
export interface Outcome {
  verdict: Verdict;
  axis: 'up' | 'across';
  have: number;
  need: number;
}

export const verdictOf = (have: number, need: number): Verdict =>
  have < need ? 'short' : have > need ? 'over' : 'exact';

export function judge(lift: number, weight: number, across?: { have: number; need: number }): Outcome {
  const up = verdictOf(lift, weight);
  if (up !== 'exact' || !across) return { verdict: up, axis: 'up', have: lift, need: weight };
  return { verdict: verdictOf(across.have, across.need), axis: 'across', have: across.have, need: across.need };
}

/** The gap in words: the teaching half of a wrong try. */
export function feedbackLine(outcome: Outcome): string {
  if (outcome.verdict === 'exact') return 'Just right!';
  const gap = Math.abs(outcome.need - outcome.have);
  if (outcome.axis === 'up') return outcome.verdict === 'short' ? `${gap} more!` : `${gap} too many!`;
  const puffs = gap === 1 ? 'puff' : 'puffs';
  return outcome.verdict === 'short' ? `${gap} more ${puffs}!` : `${gap} ${puffs} too many!`;
}

export const gaugeText = (outcome: Outcome): string => `${outcome.have} / ${outcome.need}`;
