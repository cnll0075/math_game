import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import {
  balloonColour,
  drawBalloon,
  drawBreeze,
  drawButton,
  drawCliff,
  drawFox,
  drawGround,
  drawParachute,
  drawPopBurst,
  drawRope,
  drawSky,
  drawString,
  drawTrayShelf,
  drawResetButton,
  drawSelectRing,
} from './art.js';

const bounds = { left: -100, top: 0, right: 1252, bottom: 768 };

describe('the art', () => {
  it('draws every piece with its saves and restores balanced', () => {
    const { ctx } = recordingContext();
    drawSky(ctx, bounds);
    drawGround(ctx, bounds);
    drawCliff(ctx, bounds, 'left', 220);
    drawCliff(ctx, bounds, 'right', 800);
    drawBreeze(ctx, bounds, 1.5);
    drawResetButton(ctx, true);
    drawResetButton(ctx, false);
    drawSelectRing(ctx, { x: 300, y: 560 });
    drawCliff(ctx, bounds, 'right', 780, 370);
    drawRope(ctx, { x: 300, y: 560 });
    drawString(ctx, { x: 300, y: 440 }, { x: 330, y: 300 });
    drawBalloon(ctx, { x: 300, y: 300 }, 7, { glow: 0.5 });
    drawBalloon(ctx, { x: 300, y: 300 }, 7, { limp: true });
    for (const mood of ['calm', 'strain', 'wheee', 'happy'] as const) drawFox(ctx, { x: 300, y: 560 }, { weight: 8, mood, bob: 0.3 });
    drawParachute(ctx, { x: 300, y: 560 });
    drawButton(ctx, true);
    drawButton(ctx, false);
    drawTrayShelf(ctx);
    drawPopBurst(ctx, { x: 300, y: 300 }, 5, 0.5);
    expect(depthOf(ctx)).toBe(0);
  });

  it('writes the number on a balloon and the kit\'s weight tag', () => {
    const { ctx, texts } = recordingContext();
    drawBalloon(ctx, { x: 0, y: 0 }, 7);
    drawFox(ctx, { x: 0, y: 0 }, { weight: 12, mood: 'calm', bob: 0 });
    expect(texts).toEqual(expect.arrayContaining(['7', '12']));
  });

  it('shows no number on a popped balloon, which no longer lifts anything', () => {
    const { ctx, texts } = recordingContext();
    drawBalloon(ctx, { x: 0, y: 0 }, 4, { limp: true });
    expect(texts).not.toContain('4');
  });

  it('marks the start-over button with its arrow', () => {
    const { ctx, texts } = recordingContext();
    drawResetButton(ctx, true);
    expect(texts).toContain('↺');
  });

  it('gives each value its own colour', () => {
    const colours = new Set(Array.from({ length: 10 }, (_, index) => balloonColour(index + 1)));
    expect(colours.size).toBe(10);
  });
});
