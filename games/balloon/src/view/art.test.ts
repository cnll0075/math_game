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
  drawWindLayers,
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
    drawWindLayers(ctx, bounds, 2, 1.5);
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

  it('numbers the layers, and only the ledge\'s layer blows towards it', () => {
    const { ctx, texts } = recordingContext();
    drawWindLayers(ctx, { left: 0, top: 0, right: 1152, bottom: 768 }, 2, 0);
    expect(texts).toEqual(expect.arrayContaining(['1', '2', '3']));
    expect(texts.filter((text) => text === '→')).toHaveLength(1);
    expect(texts.filter((text) => text === '←')).toHaveLength(2);
  });

  it('gives each value its own colour', () => {
    const colours = new Set(Array.from({ length: 10 }, (_, index) => balloonColour(index + 1)));
    expect(colours.size).toBe(10);
  });
});
