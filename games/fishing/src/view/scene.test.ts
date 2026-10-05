import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { botTurn } from '../logic/bot.js';
import { coachLine, createScene } from './scene.js';
import { lostLines, sumLine } from './hud.js';
import { NO_SPRITES } from './sprites.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const render = (driver: Driver, seconds = FRAME, bot = false) => {
  const scene = createScene(NO_SPRITES);
  for (let t = 0; t < seconds; t += FRAME) {
    if (bot && driver.phase === 'fishing') botTurn(driver.world, 'biggest');
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
  }
  const recording = recordingContext();
  scene.render(recording.ctx, SCREEN);
  return recording;
};

describe('the scene', () => {
  it('draws the bucket as a count, the clock, every fish number and the gap', () => {
    const driver = createDriver({ book: {}, startLevel: 'big-ones', seed: () => 1 });
    const { ctx, texts } = render(driver);
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('0/10');
    expect(texts).toContain('1:00');
    expect(texts).toContain('10 more!');
    for (const weight of ['1', '2', '5']) expect(texts).toContain(weight);
  });

  it('leaves the gap for the child to work out after the first levels', () => {
    const driver = createDriver({ book: {}, startLevel: 'speed-potion', seed: () => 1 });
    const { texts } = render(driver);
    expect(texts.some((text) => text.endsWith('more!'))).toBe(false);
  });

  it('writes the sum when the bucket is full', () => {
    const driver = createDriver({ book: {}, startLevel: 'first-catch', seed: () => 2 });
    const { ctx, texts } = render(driver, 40, true);
    expect(driver.phase).toBe('won');
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('Full to the top!');
    expect(texts).toContain(sumLine(driver.world.state.bucket));
  });

  it('coaches the two verbs on the first level, in order', () => {
    const driver = createDriver({ book: {}, startLevel: 'first-catch', seed: () => 1 });
    expect(coachLine(driver.model())).toBe('Tap the water to move the boat');
    driver.act({ kind: 'sail', x: 600 });
    expect(coachLine(driver.model())).toBe('Now tap the yellow hook button!');
    driver.act({ kind: 'cast' });
    expect(coachLine(driver.model())).toBe('Fill the bucket to 3');
  });

  it('draws a capsize through to its card without unbalancing the canvas', () => {
    const driver = createDriver({ book: {}, startLevel: 'just-right', seed: () => 1 });
    const scene = createScene(NO_SPRITES);
    driver.act({ kind: 'sail', x: 600 });
    driver.world.state.bucket.push(4, 3);
    driver.world.state.outcome = 'capsized';
    for (let t = 0; t < 3; t += FRAME) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    const recording = recordingContext();
    scene.render(recording.ctx, SCREEN);
    expect(depthOf(recording.ctx)).toBe(0);
    expect(recording.texts).toContain('Too heavy! Splash!');
    expect(recording.texts).toContain('7 is more than 6');
  });
});

describe('the words for an ending', () => {
  it('say what happened, with the numbers', () => {
    expect(lostLines('capsized', [5, 3], 7, -1)).toEqual(['Too heavy! Splash!', '5 + 3 = 8', '8 is more than 7']);
    expect(lostLines('timeout', [5], 7, 2)).toEqual(['Out of time!', '5 in the bucket', 'It needed 2 more']);
    expect(lostLines('stuck', [5, 3], 9, 1)[0]).toBe('Nothing here weighs 1!');
  });
});
