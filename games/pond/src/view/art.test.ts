import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { FROG } from './frog.js';
import { padRect } from './geometry.js';
import { bubbleSide, COACH_AT, COACH_BUBBLE, drawCoach, drawFrog, drawHand, drawPad, LILY_COLOURS, lilyColour, drawPond, drawSplash, fitFont, type PadLook } from './art.js';

const rect = { x: 100, y: 100, w: 200, h: 120 };
const look = (overrides: Partial<PadLook>): PadLook => ({ face: 'down', text: '3 + 4', font: 40, turn: 1, bloom: 0, cursor: false, image: null, frog: null, flower: '#ffffff', ...overrides });
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
    const pose = { at: { x: 300, y: 300 }, facing: -1 as const, scale: 1, tilt: 0.2, spin: 1, cheer: 0.5 };
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

  it('puts the "Ribbit!" bubble on the side of the frog with room for it', () => {
    expect(bubbleSide(1100)).toBe(-1);
    expect(bubbleSide(60)).toBe(1);
  });

  it('gives each pair its own lily colour, never the same as the pair before', () => {
    expect(new Set(LILY_COLOURS).size).toBeGreaterThanOrEqual(6);
    for (let order = 0; order < 40; order += 1) expect(lilyColour(order)).not.toBe(lilyColour(order + 1));
  });

  it('sits the frog on the free pad once its picture has loaded, and shows a star until then', () => {
    const painted = recordingContext();
    drawPad(painted.ctx, rect, look({ face: 'star', image: picture(235, 113), frog: picture(175, 183) }));
    expect(painted.calls.filter((call) => call === 'drawImage')).toHaveLength(2);
    expect(painted.texts).not.toContain('★');
    const drawn = recordingContext();
    drawPad(drawn.ctx, rect, look({ face: 'star', image: picture(235, 113) }));
    expect(drawn.texts).toContain('★');
    expect(depthOf(painted.ctx) + depthOf(drawn.ctx)).toBe(0);
  });

  it('draws the coach frog with what it is saying, and a hand pointing', () => {
    const { ctx, texts } = recordingContext();
    drawCoach(ctx, 'Tap a lily pad to turn it over!', picture(175, 183), 0.5);
    drawHand(ctx, { x: 400, y: 300 }, 0.5);
    expect(texts).toEqual(expect.arrayContaining(['Tap a lily pad to turn it over!', '👇']));
    expect(depthOf(ctx)).toBe(0);
  });

  it('keeps the coach and its widest bubble off every pad of the first board', () => {
    const left = COACH_BUBBLE.right - COACH_BUBBLE.maxWidth;
    const frogLeft = COACH_AT.x - FROG.reach * 1.1;
    for (let index = 0; index < 4; index += 1) {
      const pad = padRect(2, index);
      expect(left, `bubble over pad ${index}`).toBeGreaterThan(pad.x + pad.w);
      expect(frogLeft, `coach over pad ${index}`).toBeGreaterThan(pad.x + pad.w);
    }
  });
});
