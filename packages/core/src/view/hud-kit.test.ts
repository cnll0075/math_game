import { describe, it, expect } from 'vitest';
import { recordingContext, depthOf } from './recording-context.js';
import { drawArrivingBanner, drawFuelBar, drawSummaryCard, label } from './hud-kit.js';

describe('the fuel bar', () => {
  it('writes how much is left', () => {
    const { ctx, texts } = recordingContext();
    drawFuelBar(ctx, 80, 30, { health: 65, flash: 0 }, 20);
    expect(texts).toContain('65%');
    expect(depthOf(ctx)).toBe(0);
  });

  it('draws at any level without leaving the context saved', () => {
    for (const health of [0, 5, 50, 100]) {
      const { ctx } = recordingContext();
      drawFuelBar(ctx, 80, 30, { health, flash: 0.5 }, 20);
      expect(depthOf(ctx)).toBe(0);
    }
  });

  it('prices a mistake with its notches, however big a reward is', () => {
    const coarse = recordingContext();
    drawFuelBar(coarse.ctx, 80, 30, { health: 100, flash: 0 }, 50);
    const fine = recordingContext();
    drawFuelBar(fine.ctx, 80, 30, { health: 100, flash: 0 }, 10);
    expect(fine.calls.filter((call) => call === 'stroke').length).toBeGreaterThan(
      coarse.calls.filter((call) => call === 'stroke').length,
    );
  });
});

describe('an arriving banner', () => {
  it('writes its title and travels towards its home', () => {
    const early = recordingContext();
    drawArrivingBanner(early.ctx, 'Over Ten', 0.05, 0.26, 46);
    expect(early.texts).toContain('Over Ten');
    const late = recordingContext();
    drawArrivingBanner(late.ctx, 'Over Ten', 0.95, 0.26, 46);
    expect(late.translations[0]!.y).toBeLessThan(early.translations[0]!.y);
  });
});

describe('the summary card', () => {
  it('reads as an achievement and says how to go again', () => {
    const { ctx, texts } = recordingContext();
    drawSummaryCard(ctx, {
      score: 24,
      bestStreak: 9,
      seconds: 132,
      best: 20,
      beatenBest: true,
      headline: 'A new best!',
      lines: ['Planes down   24', 'Longest streak   9'],
    });
    const all = texts.join(' ');
    expect(all).toContain('A new best!');
    expect(all).toContain('Planes down   24');
    expect(all.toLowerCase()).toContain('tap');
    expect(all.toLowerCase()).not.toContain('fail');
    expect(depthOf(ctx)).toBe(0);
  });

  it('fits however many lines a game gives it', () => {
    const { ctx, texts } = recordingContext();
    drawSummaryCard(ctx, {
      score: 1, bestStreak: 1, seconds: 1, best: 1, beatenBest: false,
      headline: 'Good running!',
      lines: ['a', 'b', 'c', 'd', 'e'],
    });
    for (const line of ['a', 'b', 'c', 'd', 'e']) expect(texts).toContain(line);
  });
});

describe('lettering', () => {
  it('writes text with a rim under it', () => {
    const { ctx, calls, texts } = recordingContext();
    label(ctx, 'hello', 10, 10, 20, 'center');
    expect(texts).toContain('hello');
    expect(calls).toContain('strokeText');
  });
});
