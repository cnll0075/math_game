import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { judge } from '../logic/outcome.js';
import { drawCount, drawFinished, drawGauge, drawSolved, drawStars, drawTopBar } from './hud.js';

describe('the hud', () => {
  it('names the chapter, the rescue\'s place in it, the story and the stars', () => {
    const { ctx, texts } = recordingContext();
    drawTopBar(ctx, { title: 'Pop!', number: 2, count: 5, line: 'Pop one to float just right', totalStars: 14 });
    expect(texts).toEqual(expect.arrayContaining(['Pop!', '2 of 5', 'Pop one to float just right', '★ 14']));
    expect(depthOf(ctx)).toBe(0);
  });

  it('shows the gauge and the gap in words', () => {
    const { ctx, texts } = recordingContext();
    drawGauge(ctx, judge(6, 8));
    expect(texts).toEqual(expect.arrayContaining(['6 / 8', '2 more!']));
    expect(depthOf(ctx)).toBe(0);
  });

  it('draws the count, the finished sum, the stars and the last card without leaking state', () => {
    const { ctx, texts } = recordingContext();
    drawCount(ctx, '8!', { x: 300, y: 200 });
    drawSolved(ctx, ['5 + 3 = 8'], 0.5);
    drawStars(ctx, 2, 1);
    drawFinished(ctx, 90, 117);
    expect(texts).toEqual(expect.arrayContaining(['8!', '5 + 3 = 8', 'Tap for the next rescue']));
    expect(depthOf(ctx)).toBe(0);
  });
});
