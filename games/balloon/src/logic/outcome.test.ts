import { describe, it, expect } from 'vitest';
import { feedbackLine, gaugeText, judge, verdictOf } from './outcome.js';

describe('letting go', () => {
  it('is short, exact or over by the sign of the difference', () => {
    expect(verdictOf(6, 8)).toBe('short');
    expect(verdictOf(8, 8)).toBe('exact');
    expect(verdictOf(11, 8)).toBe('over');
  });

  it('judges up before across', () => {
    expect(judge(6, 8, { have: 7, need: 7 })).toEqual({ verdict: 'short', axis: 'up', have: 6, need: 8 });
    expect(judge(8, 8, { have: 5, need: 7 })).toEqual({ verdict: 'short', axis: 'across', have: 5, need: 7 });
    expect(judge(8, 8, { have: 7, need: 7 }).verdict).toBe('exact');
    expect(judge(8, 8).axis).toBe('up');
  });

  it('says how far off it was, in the words the child reads', () => {
    expect(feedbackLine(judge(6, 8))).toBe('2 more!');
    expect(feedbackLine(judge(11, 8))).toBe('3 too many!');
    expect(feedbackLine(judge(8, 8, { have: 6, need: 7 }))).toBe('1 more puff!');
    expect(feedbackLine(judge(8, 8, { have: 4, need: 7 }))).toBe('3 more puffs!');
    expect(feedbackLine(judge(8, 8, { have: 9, need: 7 }))).toBe('2 puffs too many!');
    expect(feedbackLine(judge(8, 8))).toBe('Just right!');
  });

  it('writes the gauge as what you had over what you needed', () => {
    expect(gaugeText(judge(6, 8))).toBe('6 / 8');
  });
});
