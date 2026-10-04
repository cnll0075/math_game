export type Verdict = 'short' | 'exact' | 'over';

/** What letting go did for one kit. */
export interface Outcome {
  verdict: Verdict;
  have: number;
  need: number;
}

export const verdictOf = (have: number, need: number): Verdict =>
  have < need ? 'short' : have > need ? 'over' : 'exact';

export const judge = (lift: number, weight: number): Outcome => ({ verdict: verdictOf(lift, weight), have: lift, need: weight });

/** The gap in words: the teaching half of a wrong try. */
export function feedbackLine(outcome: Outcome): string {
  if (outcome.verdict === 'exact') return 'Just right!';
  const gap = Math.abs(outcome.need - outcome.have);
  return outcome.verdict === 'short' ? `${gap} more!` : `${gap} too many!`;
}

export const gaugeText = (outcome: Outcome): string => `${outcome.have} / ${outcome.need}`;
