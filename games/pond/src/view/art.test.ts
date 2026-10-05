import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawFrog, drawPad, drawPond, drawSplash, fitFont, type PadLook } from './art.js';

const rect = { x: 100, y: 100, w: 200, h: 120 };
const look = (overrides: Partial<PadLook>): PadLook => ({ face: 'down', text: '3 + 4', font: 40, turn: 1, bloom: 0, cursor: false, image: null, ...overrides });
/** Stands in for a loaded picture: the recording context only notes that it was drawn. */
const picture = (width: number, height: number) => ({ width, height }) as unknown as HTMLImageElement;

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

  it('shrinks the lettering of a sum too wide for its pad, and leaves a short one alone', () => {
    expect(fitFont(55, 190, 176)).toBeCloseTo(55 * (176 / 190), 5);
    expect(fitFont(55, 120, 176)).toBe(55);
  });

  it('paints the pond picture when it has loaded, and the drawn water until then', () => {
    const painted = recordingContext();
    drawPond(painted.ctx, { left: -100, top: 0, right: 1252, bottom: 768 }, 0, picture(1536, 1024));
    expect(painted.calls).toContain('drawImage');
    const drawn = recordingContext();
    drawPond(drawn.ctx, { left: -100, top: 0, right: 1252, bottom: 768 }, 0, null);
    expect(drawn.calls).not.toContain('drawImage');
    expect(depthOf(painted.ctx) + depthOf(drawn.ctx)).toBe(0);
  });

  it('uses the painted lily pad for every face, and never writes a face-down sum', () => {
    for (const face of ['down', 'up', 'star'] as const) {
      const { ctx, calls, texts } = recordingContext();
      drawPad(ctx, rect, look({ face, image: picture(235, 113) }));
      expect(calls, face).toContain('drawImage');
      if (face === 'down') expect(texts).not.toContain('3 + 4');
      expect(depthOf(ctx)).toBe(0);
    }
  });

  it('letters a sum in white with a dark green outline, like the painting', () => {
    const { ctx, calls, texts } = recordingContext();
    drawPad(ctx, rect, look({ face: 'up', image: picture(235, 113) }));
    expect(texts).toContain('3 + 4');
    expect(calls).toContain('strokeText');
  });

  it('draws the frog, and its "Ribbit!" while it cheers', () => {
    const pose = { at: { x: 300, y: 300 }, facing: -1 as const, scale: 1, spin: 1, cheer: 0.5, airborne: false };
    const painted = recordingContext();
    drawFrog(painted.ctx, pose, picture(175, 183));
    expect(painted.calls).toContain('drawImage');
    expect(painted.texts).toContain('Ribbit!');
    const drawn = recordingContext();
    drawFrog(drawn.ctx, { ...pose, cheer: 0 }, null);
    expect(drawn.calls).not.toContain('drawImage');
    expect(drawn.texts).not.toContain('Ribbit!');
    expect(depthOf(painted.ctx) + depthOf(drawn.ctx)).toBe(0);
  });

  it('draws a splash with its saves and restores balanced', () => {
    const { ctx } = recordingContext();
    drawSplash(ctx, { x: 200, y: 400 }, 0.4);
    expect(depthOf(ctx)).toBe(0);
  });
});
