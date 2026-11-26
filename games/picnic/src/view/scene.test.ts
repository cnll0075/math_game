import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { playRound } from '../logic/bot.js';
import { courseLines, createScene } from './scene.js';
import { NO_SPRITES } from './sprites.js';
import { TIMING } from './timing.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const render = (driver: Driver, seconds = FRAME) => {
  const scene = createScene(NO_SPRITES);
  for (let t = 0; t < seconds; t += FRAME) {
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
  }
  const recording = recordingContext();
  scene.render(recording.ctx, SCREEN);
  return recording;
};

describe('the scene', () => {
  it('draws the round\'s line, the progress, what is left to share, and every plate\'s count', () => {
    const driver = createDriver({ book: {}, startLevel: 'two-friends' });
    driver.act({ kind: 'tap', plate: 0 });
    const { ctx, texts } = render(driver, 1);
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('Tap a plate to give a cookie. Everyone the same!');
    expect(texts).toContain('1 of 12');
    expect(texts).toContain('5');
    expect(texts).toContain('1');
    expect(texts).toContain('0');
  });

  it('shows the dial\'s number once the dial has arrived, and not before', () => {
    const tapping = render(createDriver({ book: {}, startLevel: 'two-friends' }));
    expect(tapping.texts).not.toContain('Share');
    const driver = createDriver({ book: {}, startLevel: 'the-dial' });
    driver.act({ kind: 'dial', step: 1 });
    const { texts } = render(driver);
    expect(texts).toContain('2');
    expect(texts).toContain('9');
  });

  it('shows the number of chairs on the dial while choosing them', () => {
    const driver = createDriver({ book: {}, startLevel: 'surprise-guests' });
    driver.act({ kind: 'dial', step: 1 });
    const { ctx, texts } = render(driver);
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('3');
  });

  it('draws a pizza waiting to be cut, and the cut', () => {
    const driver = createDriver({ book: {}, startLevel: 'pizza-halves' });
    driver.act({ kind: 'cut', from: { x: -1.3, y: 0 }, to: { x: 1.3, y: 0 } });
    const { ctx } = render(driver);
    expect(depthOf(ctx)).toBe(0);
  });

  it('says what each course came to, and Biscuit\'s share', () => {
    expect(courseLines({ item: 'cookie', count: 12, friends: 3, each: 4, leftover: 0 })).toEqual(['12 cookies, 3 friends: 4 each!']);
    expect(courseLines({ item: 'cookie', count: 7, friends: 2, each: 3, leftover: 1 })).toEqual(['7 cookies, 2 friends: 3 each!', '1 for Biscuit!']);
    expect(courseLines({ item: 'pizza', count: 1, friends: 2, each: 1, leftover: 0 })).toEqual(['1 pizza, 2 friends: a half each!']);
    expect(courseLines({ item: 'cake', count: 1, friends: 4, each: 1, leftover: 0 })).toEqual(['1 cake, 4 friends: a quarter each!']);
  });

  it('shows the card when the round is done, balanced and readable', () => {
    const driver = createDriver({ book: {}, startLevel: 'one-for-biscuit' });
    playRound(driver.table, 'best');
    const { ctx, texts } = render(driver, TIMING.introSeconds + TIMING.cardDelaySeconds + 0.5);
    expect(driver.phase).toBe('done');
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('7 cookies, 2 friends: 3 each!');
    expect(texts).toContain('1 for Biscuit!');
  });
});
