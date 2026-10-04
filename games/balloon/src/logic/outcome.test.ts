import { describe, it, expect } from 'vitest';
import { feedbackLine, gaugeText, judge, verdictOf } from './outcome.js';

describe('letting go', () => {
  it('is short, exact or over by the sign of the difference', () => {
    expect(verdictOf(6, 8)).toBe('short');
    expect(verdictOf(8, 8)).toBe('exact');
    expect(verdictOf(11, 8)).toBe('over');
  });

  it('weighs the lift against the weight', () => {
    expect(judge(6, 8)).toEqual({ verdict: 'short', have: 6, need: 8 });
    expect(judge(8, 8)).toEqual({ verdict: 'exact', have: 8, need: 8 });
  });

  it('says how far off it was, in the words the child reads', () => {
    expect(feedbackLine(judge(6, 8))).toBe('2 more!');
    expect(feedbackLine(judge(11, 8))).toBe('3 too many!');
    expect(feedbackLine(judge(8, 8))).toBe('Just right!');
  });

  it('writes the gauge as what you had over what you needed', () => {
    expect(gaugeText(judge(6, 8))).toBe('6 / 8');
  });
});
