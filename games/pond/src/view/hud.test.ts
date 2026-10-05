import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { BOARDS } from '../logic/boards.data.js';
import { drawEndCard, drawMatchLine, drawPicker, drawTopBar } from './hud.js';

describe('the hud', () => {
  it('names the board and the stars, and offers the picker', () => {
    const { ctx, texts } = recordingContext();
    drawTopBar(ctx, { title: '4 × 4', totalStars: 7 });
    expect(texts).toEqual(expect.arrayContaining(['4 × 4', '★ 7', 'Boards']));
    expect(depthOf(ctx)).toBe(0);
  });

  it('writes the match out', () => {
    const { ctx, texts } = recordingContext();
    drawMatchLine(ctx, '3 + 4 = 7 = 9 − 2', 0.5);
    expect(texts).toContain('3 + 4 = 7 = 9 − 2');
  });

  it('ends a board with the misses, the pairs and where to go next', () => {
    const next = recordingContext();
    drawEndCard(next.ctx, { stars: 2, progress: 3, misses: 9, pairs: 8, last: false });
    expect(next.texts).toEqual(expect.arrayContaining(['Pond cleared!', 'Pairs   8', 'Misses   9', 'Tap for the next board']));
    const last = recordingContext();
    drawEndCard(last.ctx, { stars: 3, progress: 3, misses: 20, pairs: 40, last: true });
    expect(last.texts).toContain('Tap to play again');
    expect(depthOf(last.ctx)).toBe(0);
  });

  it('shows every board in the picker, with stars or a lock', () => {
    const { ctx, texts } = recordingContext();
    drawPicker(ctx, { boards: BOARDS, book: { 'board-2': 3 }, open: [true, true, false, false, false, false, false, false], current: 1 });
    expect(texts).toEqual(expect.arrayContaining(['2 × 2', '9 × 9', '★★★', 'locked']));
    expect(depthOf(ctx)).toBe(0);
  });
});
