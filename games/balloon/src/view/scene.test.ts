import { describe, it, expect } from 'vitest';
import { DESIGN, depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { createScene } from './scene.js';
import { HOME } from './geometry.js';

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

  it('lets the balloons float away once the kit is safe, so they never sit on the top bar', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 }); // 4
    driver.act({ kind: 'tray', index: 2 }); // 3
    driver.act({ kind: 'letGo' });
    const scene = createScene();
    for (let i = 0; i < 60 * 8; i += 1) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    expect(driver.phase).toBe('rescued');
    const recording = recordingContext();
    scene.render(recording.ctx, SCREEN);
    // The tray still holds the 6 and the 1; the 4 and the 3 have floated off.
    expect(recording.texts).not.toContain('4');
    expect(recording.texts).not.toContain('3');
  });

  it('shows a small harness\'s free hooks as empty clips, and a roomy one\'s not at all', () => {
    const tiny = createDriver({ book: {}, startLevel: 'tiny-harness-1' });
    tiny.act({ kind: 'tray', index: 3 }); // one of the two hooks used
    expect(render(tiny).calls.filter((call) => call === 'setLineDash').length).toBeGreaterThanOrEqual(1);
    const roomy = createDriver({ book: {}, startLevel: 'whoosh-1' });
    expect(render(roomy).calls).not.toContain('setLineDash');
  });

  it('draws both kits in Two at Once, and gives each its own gauge', () => {
    const driver = createDriver({ book: {}, startLevel: 'two-at-once-1' });
    driver.act({ kind: 'tray', index: 0 }); // 3 on the 4
    driver.act({ kind: 'select', kit: 1 });
    driver.act({ kind: 'tray', index: 3 }); // 3 on the 5
    driver.act({ kind: 'letGo' });
    while (driver.phase === 'flying') driver.step(FRAME);
    const { texts } = render(driver);
    expect(texts).toEqual(expect.arrayContaining(['4', '5', '3 / 4', '1 more!', '3 / 5', '2 more!']));
  });

  it('lifts the kit as the count climbs towards its weight', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 }); // 4
    driver.act({ kind: 'tray', index: 2 }); // 3: 7, the weight
    driver.act({ kind: 'letGo' });
    const count = driver.flight!.count;
    const scene = createScene();
    while (driver.flight && driver.flight.t < count * 0.9) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    const recording = recordingContext();
    scene.render(recording.ctx, SCREEN);
    expect(recording.translations.some((at) => at.x === HOME.x && at.y < HOME.y - 30)).toBe(true);
  });

  it('draws the start-over button', () => {
    expect(render(createDriver({ book: {}, startLevel: 'whoosh-1' })).texts).toContain('↺');
  });

  it('shows a popped balloon without its number', () => {
    const driver = createDriver({ book: {}, startLevel: 'pop-1' });
    driver.act({ kind: 'tied', index: 1 }); // the 3
    expect(render(driver).texts).not.toContain('3');
  });

  it('draws a dragged balloon under the finger, and not in its old place', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    const scene = createScene();
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
    scene.setDrag({ from: { kind: 'tray', index: 0 }, value: 6, at: { x: 500, y: 300 } });
    const recording = recordingContext();
    scene.render(recording.ctx, SCREEN);
    expect(recording.translations).toContainEqual({ x: 500, y: 300 });
    expect(recording.texts.filter((text) => text === '6')).toHaveLength(1);
    scene.setDrag(null);
    const after = recordingContext();
    scene.render(after.ctx, SCREEN);
    expect(after.translations).not.toContainEqual({ x: 500, y: 300 });
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
