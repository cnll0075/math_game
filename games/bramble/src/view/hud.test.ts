import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawHud, drawSolved, drawSummary, drawThump } from './hud.js';

describe('the top bar', () => {
  it('shows the fuel and the score', () => {
    const { ctx, texts } = recordingContext();
    drawHud(ctx, { health: 70, score: 12, streak: 0, flash: 0 });
    expect(texts).toContain('70%');
    expect(texts).toContain('12');
    expect(depthOf(ctx)).toBe(0);
  });

  it('names a streak only once it is one', () => {
    const quiet = recordingContext();
    drawHud(quiet.ctx, { health: 100, score: 2, streak: 1, flash: 0 });
    expect(quiet.texts.some((text) => text.includes('in a row'))).toBe(false);
    const hot = recordingContext();
    drawHud(hot.ctx, { health: 100, score: 9, streak: 4, flash: 0 });
    expect(hot.texts.some((text) => text.includes('4 in a row'))).toBe(true);
  });
});

describe('explaining a row', () => {
  it('writes the whole sum where the obstacle burst', () => {
    const { ctx, texts } = recordingContext();
    drawSolved(ctx, { x: 400, y: 400 }, '6 + 9 = 15', 0.2);
    expect(texts).toContain('6 + 9 = 15');
    expect(depthOf(ctx)).toBe(0);
  });

  it('says what was missed, in the middle of the screen', () => {
    const { ctx, texts } = recordingContext();
    drawThump(ctx, '6 + 9 = 15', 0.2);
    expect(texts).toContain('6 + 9 = 15');
    expect(texts.join(' ')).toContain('Bumped');
    expect(depthOf(ctx)).toBe(0);
  });
});

describe('the summary card', () => {
  it('reads as how far you ran, and says how to go again', () => {
    const { ctx, texts } = recordingContext();
    drawSummary(ctx, { score: 30, bestStreak: 11, seconds: 95, distance: 570, best: 20, beatenBest: true });
    const all = texts.join(' ');
    expect(all).toContain('30');
    expect(all).toContain('570');
    expect(all.toLowerCase()).toContain('tap');
    expect(all.toLowerCase()).not.toContain('fail');
  });
});
