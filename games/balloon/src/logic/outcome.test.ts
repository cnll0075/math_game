import { describe, it, expect } from 'vitest';
import { feedbackLine, gaugeText, judge, verdictOf } from './outcome.js';

describe('letting go', () => {
  it('is short, exact or over by the sign of the difference', () => {
    expect(verdictOf(6, 8)).toBe('short');
    expect(verdictOf(8, 8)).toBe('exact');
    expect(verdictOf(11, 8)).toBe('over');
  });

  it('asks for the weight, plus the layers when the ledge is up in the wind', () => {
    expect(judge(8, 8)).toEqual({ verdict: 'exact', have: 8, need: 8, weight: 8, layer: 0 });
    expect(judge(10, 7, 3)).toEqual({ verdict: 'exact', have: 10, need: 10, weight: 7, layer: 3 });
    expect(judge(7, 7, 3).verdict).toBe('short');
  });

  it('says how far off it was, in the words the child reads', () => {
    expect(feedbackLine(judge(6, 8))).toBe('2 more!');
    expect(feedbackLine(judge(11, 8))).toBe('3 too many!');
    expect(feedbackLine(judge(9, 7, 3))).toBe('1 more!');
    expect(feedbackLine(judge(8, 8))).toBe('Just right!');
  });

  it('writes the gauge as what you had over what you needed, the layers as a sum', () => {
    expect(gaugeText(judge(6, 8))).toBe('6 / 8');
    expect(gaugeText(judge(9, 7, 3))).toBe('9 / 7 + 3');
  });
});
