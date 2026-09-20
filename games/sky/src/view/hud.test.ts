import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawBanner, drawHud, drawSolved, drawSummary } from './hud.js';

describe('the top bar', () => {
  it('shows how much fuel is left, and the score', () => {
    const { ctx, texts } = recordingContext();
    drawHud(ctx, { health: 65, score: 17, streak: 4, crack: 0 });
    expect(texts).toContain('17');
    // The number on the bar, so what is left is readable and not just a length.
    expect(texts).toContain('65%');
    expect(depthOf(ctx)).toBe(0);
  });

  it('draws the bar shorter as the run goes badly', () => {
    const full = recordingContext();
    drawHud(full.ctx, { health: 100, score: 0, streak: 0, crack: 0 });
    expect(full.texts).toContain('100%');
    const nearly = recordingContext();
    drawHud(nearly.ctx, { health: 5, score: 0, streak: 0, crack: 0 });
    expect(nearly.texts).toContain('5%');
  });

  it('draws nothing coloured in when the tank is empty', () => {
    const { ctx, texts } = recordingContext();
    drawHud(ctx, { health: 0, score: 3, streak: 0, crack: 0 });
    expect(texts).toContain('0%');
    expect(depthOf(ctx)).toBe(0);
  });

  it('shows a streak only once it is worth showing', () => {
    const quiet = recordingContext();
    drawHud(quiet.ctx, { health: 100, score: 3, streak: 1, crack: 0 });
    expect(quiet.texts.some((text) => text.includes('in a row'))).toBe(false);
    const hot = recordingContext();
    drawHud(hot.ctx, { health: 100, score: 9, streak: 3, crack: 0 });
    expect(hot.texts.some((text) => text.includes('3 in a row'))).toBe(true);
  });

  it('draws without leaving the context saved, whatever the state', () => {
    for (const health of [0, 5, 50, 100]) {
      const { ctx } = recordingContext();
      drawHud(ctx, { health, score: 0, streak: 0, crack: 0.5 });
      expect(depthOf(ctx)).toBe(0);
    }
  });
});

describe('the band banner', () => {
  it('writes the band name', () => {
    const { ctx, texts } = recordingContext();
    drawBanner(ctx, 'Take-Aways', 0.1);
    expect(texts).toContain('Take-Aways');
    expect(depthOf(ctx)).toBe(0);
  });

  it('is on its way to the top bar by the end of its life', () => {
    const early = recordingContext();
    drawBanner(early.ctx, 'Over Ten', 0.05);
    const late = recordingContext();
    drawBanner(late.ctx, 'Over Ten', 0.95);
    expect(late.translations[0]!.y).toBeLessThan(early.translations[0]!.y);
  });
});

describe('the solved sum', () => {
  it('writes the whole equation, answer and all — the teaching beat', () => {
    const { ctx, texts } = recordingContext();
    drawSolved(ctx, { x: 500, y: 300 }, '7 + 8 = 15', 0.2);
    expect(texts).toContain('7 + 8 = 15');
    expect(depthOf(ctx)).toBe(0);
  });
});

describe('the summary card', () => {
  it('reads as how far you flew, not as a failure', () => {
    const { ctx, texts } = recordingContext();
    drawSummary(ctx, { score: 24, bestStreak: 9, seconds: 132, best: 20, beatenBest: true });
    const all = texts.join(' ');
    expect(all).toContain('24');
    expect(all).toContain('9');
    expect(all.toLowerCase()).not.toContain('fail');
    expect(all.toLowerCase()).toContain('best');
    expect(depthOf(ctx)).toBe(0);
  });

  it('tells the player how to go again', () => {
    const { ctx, texts } = recordingContext();
    drawSummary(ctx, { score: 4, bestStreak: 2, seconds: 30, best: 20, beatenBest: false });
    expect(texts.join(' ').toLowerCase()).toContain('tap');
  });

  it('shows the time flown in minutes and seconds', () => {
    const { ctx, texts } = recordingContext();
    drawSummary(ctx, { score: 4, bestStreak: 2, seconds: 132, best: 20, beatenBest: false });
    expect(texts.join(' ')).toContain('2:12');
  });
});
