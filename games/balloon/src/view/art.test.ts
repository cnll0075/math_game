import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import {
  balloonColour,
  drawBalloon,
  drawButton,
  drawCliff,
  drawFox,
  drawGround,
  drawParachute,
  drawPopBurst,
  drawPuff,
  drawRope,
  drawSky,
  drawStepMarks,
  drawString,
  drawTrayShelf,
  drawWindSock,
} from './art.js';

const bounds = { left: -100, top: 0, right: 1252, bottom: 768 };

describe('the art', () => {
  it('draws every piece with its saves and restores balanced', () => {
    const { ctx } = recordingContext();
    drawSky(ctx, bounds);
    drawGround(ctx, bounds);
    drawCliff(ctx, bounds, 'left', 220);
    drawCliff(ctx, bounds, 'right', 800);
    drawStepMarks(ctx, 7);
    drawWindSock(ctx, 3);
    drawWindSock(ctx, -2);
    drawRope(ctx, { x: 300, y: 560 });
    drawString(ctx, { x: 300, y: 440 }, { x: 330, y: 300 });
    drawBalloon(ctx, { x: 300, y: 300 }, 7, { glow: 0.5 });
    drawBalloon(ctx, { x: 300, y: 300 }, 7, { limp: true });
    drawPuff(ctx, { x: 200, y: 500 }, 3);
    for (const mood of ['calm', 'strain', 'wheee', 'happy'] as const) drawFox(ctx, { x: 300, y: 560 }, { weight: 8, mood, bob: 0.3 });
    drawParachute(ctx, { x: 300, y: 560 });
    drawButton(ctx, true);
    drawButton(ctx, false);
    drawTrayShelf(ctx);
    drawPopBurst(ctx, { x: 300, y: 300 }, 5, 0.5);
    expect(depthOf(ctx)).toBe(0);
  });

  it('writes the number on a balloon, a puff and the kit\'s weight tag', () => {
    const { ctx, texts } = recordingContext();
    drawBalloon(ctx, { x: 0, y: 0 }, 7);
    drawPuff(ctx, { x: 0, y: 0 }, 3);
    drawFox(ctx, { x: 0, y: 0 }, { weight: 12, mood: 'calm', bob: 0 });
    expect(texts).toEqual(expect.arrayContaining(['7', '3', '12']));
  });

  it('still shows a popped balloon\'s number, so it can be put back', () => {
    const { ctx, texts } = recordingContext();
    drawBalloon(ctx, { x: 0, y: 0 }, 4, { limp: true });
    expect(texts).toContain('4');
  });

  it('says which way the wind blows, and how hard', () => {
    const helping = recordingContext();
    drawWindSock(helping.ctx, 3);
    expect(helping.texts).toContain('3 →');
    const against = recordingContext();
    drawWindSock(against.ctx, -2);
    expect(against.texts).toContain('← 2');
  });

  it('gives each value its own colour', () => {
    const colours = new Set(Array.from({ length: 10 }, (_, index) => balloonColour(index + 1)));
    expect(colours.size).toBe(10);
  });
});
