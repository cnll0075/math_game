export type Verdict = 'short' | 'exact' | 'over';

/**
 * What letting go did. The weight and layers are kept beside the target so the
 * gauge can write it as the sum it is, and the flight can tell how high the kit
 * rose: lift minus weight.
 */
export interface Outcome {
  verdict: Verdict;
  have: number;
  need: number;
  weight: number;
  layer: number;
}

export const verdictOf = (have: number, need: number): Verdict =>
  have < need ? 'short' : have > need ? 'over' : 'exact';

export function judge(lift: number, weight: number, layer = 0): Outcome {
  const need = weight + layer;
  return { verdict: verdictOf(lift, need), have: lift, need, weight, layer };
}

/** The gap in words: the teaching half of a wrong try. */
export function feedbackLine(outcome: Outcome): string {
  if (outcome.verdict === 'exact') return 'Just right!';
  const gap = Math.abs(outcome.need - outcome.have);
  return outcome.verdict === 'short' ? `${gap} more!` : `${gap} too many!`;
}

export const gaugeText = (outcome: Outcome): string =>
  outcome.layer > 0
    ? `${outcome.have} / ${outcome.weight} + ${outcome.layer}`
    : `${outcome.have} / ${outcome.need}`;
