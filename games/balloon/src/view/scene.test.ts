import { describe, it, expect } from 'vitest';
import { DESIGN, depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { createScene } from './scene.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const render = (driver: Driver, frames = 1) => {
  const scene = createScene();
  for (let i = 0; i < frames; i += 1) {
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
  }
  const recording = recordingContext();
  scene.render(recording.ctx, SCREEN);
  return recording;
};

describe('the scene', () => {
  it('draws the weight, every tray balloon and the story line', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    const { ctx, texts } = render(driver);
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('7');
    for (const value of [6, 4, 3, 1]) expect(texts).toContain(String(value));
    expect(texts).toContain('Careful, not too high!');
  });

  it('never shows a running total while building', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 }); // 4
    driver.act({ kind: 'tray', index: 2 }); // 3
    const { texts } = render(driver);
    expect(texts.some((text) => text.includes('/'))).toBe(false);
    expect(texts.filter((text) => text === '7')).toHaveLength(1); // the weight tag, and nothing else
  });

  it('counts on after "Let go!"', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'tray', index: 2 });
    driver.act({ kind: 'letGo' });
    const { texts } = render(driver, 2);
    expect(texts).toContain('4…');
    const later = render(driver, 30);
    expect(later.texts).toContain('7!');
  });

  it('shows the gauge after a wrong try', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'letGo' });
    while (driver.phase === 'flying') driver.step(FRAME);
    const { texts } = render(driver);
    expect(texts).toEqual(expect.arrayContaining(['10 / 7', '3 too many!']));
  });

  it('writes the finished sum and the stars once rescued', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'tray', index: 2 });
    driver.act({ kind: 'letGo' });
    const scene = createScene();
    for (let i = 0; i < 60 * 8; i += 1) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    const recording = recordingContext();
    scene.render(recording.ctx, SCREEN);
    expect(recording.texts).toContain('4 + 3 = 7');
    expect(recording.texts).toContain('Tap for the next rescue');
  });

  it('draws the wind, the steps and the puffs in Windy Ridge', () => {
    const driver = createDriver({ book: {}, startLevel: 'windy-ridge-1' });
    const { texts } = render(driver);
    expect(texts).toContain('3 →');
    for (const value of [5, 4, 2]) expect(texts).toContain(String(value));
  });

  it('paints past the design rect, so an odd-shaped screen has no bars', () => {
    const driver = createDriver({ book: {} });
    const scene = createScene();
    scene.update(FRAME, driver.model());
    const { ctx, calls } = recordingContext();
    scene.render(ctx, { width: 2600, height: 1200 });
    expect(calls).toContain('fillRect');
    expect(depthOf(ctx)).toBe(0);
  });

  it('round-trips a screen point into the design space', () => {
    const point = createScene().toDesign({ x: 1152, y: 768 }, { width: 2304, height: 1536 });
    expect(point.x).toBeCloseTo(DESIGN.width / 2, 5);
    expect(point.y).toBeCloseTo(DESIGN.height / 2, 5);
  });

  it('draws nothing at all before it has been given a model', () => {
    const { ctx, calls } = recordingContext();
    createScene().render(ctx, SCREEN);
    expect(calls).toHaveLength(0);
  });
});
