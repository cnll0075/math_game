import { describe, it, expect } from 'vitest';
import { DESIGN, depthOf, recordingContext } from '@bundle/core';
import { sumText } from '@bundle/math';
import { createRun, currentRow } from '../logic/run.js';
import { createScene, type SceneModel } from './scene.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const modelOf = (game: ReturnType<typeof createRun>, overrides: Partial<SceneModel> = {}): SceneModel => {
  const row = currentRow(game.state);
  return {
    run: game.state,
    sumText: row ? sumText(row.sum) : '',
    stumbling: game.state.stumble > 0,
    summary: null,
    ...overrides,
  };
};

describe('the scene', () => {
  it('draws the path, every number on it, and the sum on the rabbit', () => {
    const game = createRun({ seed: 1 });
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    const scene = createScene();
    scene.update(FRAME, modelOf(game));
    const { ctx, texts } = recordingContext();
    scene.render(ctx, SCREEN);
    expect(depthOf(ctx)).toBe(0);
    for (const row of game.state.rows) {
      if (row.resolved) continue;
      for (const number of row.numbers) expect(texts).toContain(String(number));
    }
    expect(texts).toContain(sumText(currentRow(game.state)!.sum));
  });

  it('explains a thump in the middle of the screen, then lets it go', () => {
    const game = createRun({ seed: 2 });
    game.step(FRAME);
    const row = currentRow(game.state)!;
    const scene = createScene();
    scene.observe([{ type: 'thump', row, lane: 0, sum: row.sum, health: 90 }]);
    scene.update(FRAME, modelOf(game));
    const during = recordingContext();
    scene.render(during.ctx, SCREEN);
    expect(during.texts.join(' ')).toContain('Bumped it!');

    for (let i = 0; i < 180; i += 1) scene.update(FRAME, modelOf(game));
    const after = recordingContext();
    scene.render(after.ctx, SCREEN);
    expect(after.texts.join(' ')).not.toContain('Bumped it!');
  });

  it('shows the finished sum where an obstacle burst', () => {
    const game = createRun({ seed: 3 });
    game.step(FRAME);
    const row = currentRow(game.state)!;
    const scene = createScene();
    scene.observe([{ type: 'burst', row, lane: row.answerLane, sum: row.sum }]);
    scene.update(FRAME, modelOf(game));
    const { ctx, texts } = recordingContext();
    scene.render(ctx, SCREEN);
    expect(texts.some((text) => text.includes('='))).toBe(true);
  });

  it('paints past the design rect, so an odd-shaped screen has no bars', () => {
    const game = createRun({ seed: 4 });
    const scene = createScene();
    scene.update(FRAME, modelOf(game));
    const { ctx, calls } = recordingContext();
    scene.render(ctx, { width: 2600, height: 1200 });
    expect(calls).toContain('fillRect');
    expect(depthOf(ctx)).toBe(0);
  });

  it('round-trips a screen point into the design space', () => {
    const scene = createScene();
    const point = scene.toDesign({ x: 1152, y: 768 }, { width: 2304, height: 1536 });
    expect(point.x).toBeCloseTo(DESIGN.width / 2, 5);
    expect(point.y).toBeCloseTo(DESIGN.height / 2, 5);
  });

  it('draws nothing at all before it has been given a model', () => {
    const { ctx, calls } = recordingContext();
    createScene().render(ctx, SCREEN);
    expect(calls).toHaveLength(0);
  });
});
