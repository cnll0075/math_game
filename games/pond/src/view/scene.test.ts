import { describe, it, expect } from 'vitest';
import { createRng, DESIGN, depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { valueAt } from '../logic/game.js';
import { sumText } from '../logic/sums.js';
import { createScene } from './scene.js';
import { TIMING } from './timing.js';
import { FROG } from './frog.js';
import { frogSpots } from './geometry.js';

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

  it('paints the pond, the pads and the frog from the painting once loaded', () => {
    const picture = (width: number, height: number) => ({ width, height }) as unknown as HTMLImageElement;
    const scene = createScene({ sprites: { pond: picture(1536, 1024), pad: picture(235, 113), frog: picture(175, 183) } });
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 7 });
    scene.update(FRAME, driver.model());
    const { calls } = draw(scene);
    expect(calls.filter((call) => call === 'drawImage').length).toBeGreaterThanOrEqual(1 + 16);
  });

  it('brings the frog out onto an open spot, where a tap cheers it and leaves the board alone', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 8 });
    const scene = createScene({ rng: createRng(8) });
    let emerged = false;
    for (let t = 0; t < FROG.firstMax + 1 && !emerged; t += FRAME) {
      emerged = scene.update(FRAME, driver.model()).some((event) => event.type === 'emerged');
    }
    expect(emerged).toBe(true);
    for (let t = 0; t <= FROG.emergeSeconds; t += FRAME) scene.update(FRAME, driver.model());
    const spot = scene.frogSpot()!;
    expect(frogSpots(4)).toContainEqual(spot);
    const before = JSON.stringify(driver.game.state);
    const on = { x: spot.x, y: spot.y - FROG.height / 2 };
    expect(scene.frogAt(on)).toBe(true);
    expect(scene.pokeFrog(on)).toEqual([{ type: 'cheered' }]);
    expect(JSON.stringify(driver.game.state)).toBe(before);
    scene.update(FRAME, driver.model());
    expect(draw(scene).texts).toContain('Ribbit!');
  });

  it('sends the frog under when a new board opens', () => {
    const driver = createDriver({ book: { 'board-2': 3 }, startLevel: 'board-2', seed: 9 });
    const scene = createScene({ rng: createRng(9) });
    for (let t = 0; t < FROG.firstMax + FROG.emergeSeconds + 0.2; t += FRAME) scene.update(FRAME, driver.model());
    expect(scene.frogSpot()).not.toBeNull();
    driver.act({ kind: 'picker' });
    scene.observe(driver.act({ kind: 'pick', index: 1 }));
    expect(scene.frogAt({ x: scene.frogSpot()?.x ?? 0, y: (scene.frogSpot()?.y ?? 0) - FROG.height / 2 })).toBe(false);
  });
});
