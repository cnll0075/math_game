import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawPad, drawPond, type PadLook } from './art.js';

const rect = { x: 100, y: 100, w: 200, h: 120 };
const look = (overrides: Partial<PadLook>): PadLook => ({ face: 'down', text: '3 + 4', font: 40, turn: 1, bloom: 0, cursor: false, ...overrides });

describe('the art', () => {
  it('draws the pond and every kind of pad with saves and restores balanced', () => {
    const { ctx } = recordingContext();
    drawPond(ctx, { left: -100, top: 0, right: 1252, bottom: 768 }, 1.2);
    for (const face of ['down', 'up', 'star'] as const) drawPad(ctx, rect, look({ face, bloom: 0.5, cursor: true, turn: 0.4 }));
    expect(depthOf(ctx)).toBe(0);
  });

  it('never writes the sum on a face-down pad', () => {
    const { ctx, texts } = recordingContext();
    drawPad(ctx, rect, look({ face: 'down' }));
    expect(texts).not.toContain('3 + 4');
  });

  it('writes the sum on a face-up pad, and a star on the free one', () => {
    const up = recordingContext();
    drawPad(up.ctx, rect, look({ face: 'up' }));
    expect(up.texts).toContain('3 + 4');
    const star = recordingContext();
    drawPad(star.ctx, rect, look({ face: 'star', text: '' }));
    expect(star.texts).toContain('★');
  });
});
