import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawBerry, drawBurst, drawObstacle, drawPath, drawRabbit } from './art.js';

describe('drawing an obstacle', () => {
  it('writes its number on it, whatever kind it is', () => {
    for (const kind of ['rock', 'bear', 'log'] as const) {
      const { ctx, texts } = recordingContext();
      drawObstacle(ctx, { x: 400, y: 300 }, kind, 15);
      expect(texts).toContain('15');
      expect(depthOf(ctx)).toBe(0);
    }
  });

  it('draws the three kinds differently, so the path is not a row of clones', () => {
    const shapes = (['rock', 'bear', 'log'] as const).map((kind) => {
      const { ctx, calls } = recordingContext();
      drawObstacle(ctx, { x: 400, y: 300 }, kind, 9);
      return calls.join(',');
    });
    expect(new Set(shapes).size).toBe(3);
  });
});

describe('drawing the rabbit', () => {
  it('carries the sum on a sign clear of its body', () => {
    const { ctx, texts } = recordingContext();
    drawRabbit(ctx, 0.5, { sum: '6 + 9', stumbling: false, bob: 0 });
    expect(texts).toContain('6 + 9');
    expect(depthOf(ctx)).toBe(0);
  });

  it('looks different mid-tumble', () => {
    const upright = recordingContext();
    drawRabbit(upright.ctx, 0.5, { sum: '6 + 9', stumbling: false, bob: 0.3 });
    const tumbling = recordingContext();
    drawRabbit(tumbling.ctx, 0.5, { sum: '6 + 9', stumbling: true, bob: 0.3 });
    expect(tumbling.calls).toContain('rotate');
    expect(upright.calls).not.toContain('rotate');
  });
});

describe('the rest of the scenery', () => {
  it('draws the path, a berry and a burst without leaving the context saved', () => {
    const { ctx, calls } = recordingContext();
    drawPath(ctx, 0.4);
    drawBerry(ctx, { x: 300, y: 300 });
    drawBurst(ctx, { x: 300, y: 300 }, 0.5);
    expect(calls).toContain('fill');
    expect(depthOf(ctx)).toBe(0);
  });
});
