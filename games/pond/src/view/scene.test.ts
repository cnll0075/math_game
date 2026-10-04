import { describe, it, expect } from 'vitest';
import { DESIGN, depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { valueAt } from '../logic/game.js';
import { sumText } from '../logic/sums.js';
import { createScene } from './scene.js';
import { TIMING } from './timing.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const play = (driver: Driver, seconds: number) => {
  const scene = createScene();
  for (let t = 0; t <= seconds; t += FRAME) {
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
  }
  return scene;
};
const draw = (scene: ReturnType<typeof createScene>) => {
  const recording = recordingContext();
  scene.render(recording.ctx, SCREEN);
  return recording;
};
const equalPair = (driver: Driver): [number, number] => {
  const pads = driver.game.state.pads;
  for (let a = 0; a < pads.length; a += 1) {
    for (let b = a + 1; b < pads.length; b += 1) {
      if (!pads[a]!.up && !pads[b]!.up && valueAt(driver.game.state, a) === valueAt(driver.game.state, b)) return [a, b];
    }
  }
  throw new Error('no pair');
};

describe('the scene', () => {
  it('draws a fresh pond with every sum hidden', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 1 });
    const { ctx, texts } = draw(play(driver, FRAME));
    expect(depthOf(ctx)).toBe(0);
    for (const pad of driver.game.state.pads) expect(texts).not.toContain(sumText(pad.card.sum!));
  });

  it('shows a pad\'s sum once it has turned over', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 2 });
    const scene = play(driver, FRAME);
    const events = driver.act({ kind: 'flip', index: 0 });
    scene.observe(events);
    for (let t = 0; t <= TIMING.flipSeconds + FRAME; t += FRAME) scene.update(FRAME, driver.model());
    expect(draw(scene).texts).toContain(sumText(driver.game.state.pads[0]!.card.sum!));
  });

  it('writes a match out over the pond', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 3 });
    const scene = play(driver, FRAME);
    const [a, b] = equalPair(driver);
    scene.observe(driver.act({ kind: 'flip', index: a }));
    scene.observe(driver.act({ kind: 'flip', index: b }));
    scene.update(FRAME, driver.model());
    const pads = driver.game.state.pads;
    const line = `${sumText(pads[a]!.card.sum!)} = ${pads[a]!.card.sum!.value} = ${sumText(pads[b]!.card.sum!)}`;
    expect(draw(scene).texts).toContain(line);
  });

  it('shows the end card once the pond is cleared', () => {
    const driver = createDriver({ book: {}, seed: 4 });
    const scene = play(driver, FRAME);
    while (!driver.game.state.cleared) {
      const [a, b] = equalPair(driver);
      scene.observe(driver.act({ kind: 'flip', index: a }));
      scene.observe(driver.act({ kind: 'flip', index: b }));
    }
    for (let t = 0; t < 2; t += FRAME) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    expect(draw(scene).texts).toContain('Pond cleared!');
  });

  it('shows the picker over the pond', () => {
    const driver = createDriver({ book: {}, seed: 5 });
    const scene = play(driver, FRAME);
    scene.observe(driver.act({ kind: 'picker' }));
    scene.update(FRAME, driver.model());
    expect(draw(scene).texts).toContain('locked');
  });

  it('paints past the design rect, so an odd-shaped screen has no bars', () => {
    const driver = createDriver({ book: {}, seed: 6 });
    const scene = play(driver, FRAME);
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
