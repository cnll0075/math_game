import { describe, it, expect, vi } from 'vitest';
import * as art from './art.js';
import { createRng, DESIGN, depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { valueAt } from '../logic/game.js';
import { sumText } from '../logic/sums.js';
import { createScene } from './scene.js';
import { TIMING } from './timing.js';
import { FROG } from './frog.js';
import { frogSpots, padRect } from './geometry.js';

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
    const scene = createScene({ sprites: { pond: picture(1536, 1024), pad: picture(235, 113), frog: picture(175, 183), sitting: picture(419, 450) } });
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 7 });
    scene.update(FRAME, driver.model());
    const { calls } = draw(scene);
    expect(calls.filter((call) => call === 'drawImage').length).toBeGreaterThanOrEqual(1 + 16);
  });

  it('sits the front-facing frog on the free pad and coaches with it, never the leaping one', () => {
    const picture = (width: number, height: number) => ({ width, height }) as unknown as HTMLImageElement;
    const sprites = { pond: null, pad: picture(235, 113), frog: picture(175, 183), sitting: picture(419, 450) };
    const images = (startLevel: string) => {
      const scene = createScene({ sprites });
      scene.update(FRAME, createDriver({ book: {}, startLevel, seed: 7 }).model());
      const drawn: unknown[] = [];
      const { ctx } = recordingContext();
      const spy = new Proxy(ctx, {
        get: (target, property) =>
          property === 'drawImage' ? (image: unknown) => void drawn.push(image) : Reflect.get(target, property),
      });
      scene.render(spy, SCREEN);
      return drawn;
    };
    for (const level of ['board-3', 'board-2']) {
      expect(images(level), level).toContain(sprites.sitting);
      expect(images(level), level).not.toContain(sprites.frog);
    }
  });

  it('brings the frog leaping out of open water, where a tap cheers it and leaves the board alone', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 8 });
    const scene = createScene({ rng: createRng(8) });
    let launch: { x: number; y: number } | null = null;
    for (let t = 0; t < FROG.firstMax + 1 && !launch; t += FRAME) {
      const out = scene.update(FRAME, driver.model()).find((event) => event.type === 'emerged');
      if (out && out.type === 'emerged') launch = out.at;
    }
    expect(frogSpots(4)).toContainEqual(launch);
    for (let t = 0; t < FROG.leapSeconds * 0.4; t += FRAME) scene.update(FRAME, driver.model());
    const on = scene.frogPoint()!;
    const before = JSON.stringify(driver.game.state);
    expect(scene.frogAt(on)).toBe(true);
    expect(scene.pokeFrog(on)).toEqual([{ type: 'cheered' }]);
    expect(JSON.stringify(driver.game.state)).toBe(before);
    scene.update(FRAME, driver.model());
    expect(draw(scene).texts).toContain('Ribbit!');
  });

  it('lets the frog finish its leap and stay under when a new board opens', () => {
    const driver = createDriver({ book: { 'board-2': 3 }, startLevel: 'board-2', seed: 9 });
    const scene = createScene({ rng: createRng(9) });
    let out = false;
    for (let t = 0; t < FROG.firstMax + 1 && !out; t += FRAME) out = scene.update(FRAME, driver.model()).some((event) => event.type === 'emerged');
    driver.act({ kind: 'picker' });
    scene.observe(driver.act({ kind: 'pick', index: 1 }));
    for (let t = 0; t < FROG.leapSeconds + FROG.underMax + 0.1; t += FRAME) scene.update(FRAME, driver.model());
    expect(scene.frogPoint()).toBeNull();
  });

  it('keeps the frog under while the picker is open, so nothing splashes behind it', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-2', seed: 10 });
    const scene = createScene({ rng: createRng(10) });
    driver.act({ kind: 'picker' });
    const events = [];
    for (let t = 0; t < 30; t += FRAME) events.push(...scene.update(FRAME, driver.model()));
    expect(events).toEqual([]);
  });

  it('coaches on the first board: what to tap, then what to look for', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-2', seed: 11 });
    const scene = play(driver, FRAME);
    expect(draw(scene).texts).toEqual(expect.arrayContaining(['Tap a lily pad to turn it over!', '👇']));
    scene.observe(driver.act({ kind: 'flip', index: 0 }));
    scene.update(FRAME, driver.model());
    const after = draw(scene).texts;
    expect(after.join(' ')).toContain('same amount');
    expect(after).not.toContain('👇');
  });

  it('does not coach on any other board', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-3', seed: 12 });
    expect(draw(play(driver, FRAME)).texts.join(' ')).not.toContain('Tap a lily pad');
  });

  it('keeps the leaping frog under while the coach is talking, so there is one frog at a time', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-2', seed: 13 });
    const scene = createScene({ rng: createRng(13) });
    const events = [];
    for (let t = 0; t < 30; t += FRAME) events.push(...scene.update(FRAME, driver.model()));
    expect(events).toEqual([]);
  });

  it('gives each matched pair its own colour of lily', () => {
    const looks: Array<{ index: number; flower: string; bloom: number }> = [];
    const spy = vi.spyOn(art, 'drawPad').mockImplementation((_ctx, rect, look) => {
      const index = [...Array(16).keys()].find((each) => {
        const pad = padRect(4, each);
        return pad.x === rect.x && pad.y === rect.y;
      })!;
      looks.push({ index, flower: look.flower, bloom: look.bloom });
    });
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 14 });
    const scene = play(driver, FRAME);
    const matched: Array<[number, number]> = [];
    for (let pair = 0; pair < 2; pair += 1) {
      const [a, b] = equalPair(driver);
      scene.observe(driver.act({ kind: 'flip', index: a }));
      scene.observe(driver.act({ kind: 'flip', index: b }));
      matched.push([a, b]);
    }
    scene.update(1, driver.model());
    draw(scene);
    const colourOf = (index: number) => looks.filter((look) => look.index === index && look.bloom > 0).at(-1)!.flower;
    expect(colourOf(matched[0]![0])).toBe(colourOf(matched[0]![1]));
    expect(colourOf(matched[1]![0])).toBe(colourOf(matched[1]![1]));
    expect(colourOf(matched[0]![0])).not.toBe(colourOf(matched[1]![0]));
    spy.mockRestore();
  });

  it('coaches again when the first board is played again', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-2', seed: 15 });
    const scene = play(driver, FRAME);
    while (!driver.game.state.cleared) {
      const [a, b] = equalPair(driver);
      scene.observe(driver.act({ kind: 'flip', index: a }));
      scene.observe(driver.act({ kind: 'flip', index: b }));
    }
    driver.act({ kind: 'picker' });
    scene.observe(driver.act({ kind: 'pick', index: 0 }));
    scene.update(FRAME, driver.model());
    expect(draw(scene).texts).toContain('Tap a lily pad to turn it over!');
  });
});
