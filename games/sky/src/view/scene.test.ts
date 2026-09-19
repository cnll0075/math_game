import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext, DESIGN } from '@bundle/core';
import { createRun } from '../logic/run.js';
import { createScene, type SceneModel } from './scene.js';
import { sumText } from '../logic/equation.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const modelOf = (game: ReturnType<typeof createRun>, overrides: Partial<SceneModel> = {}): SceneModel => ({
  run: game.state,
  sumText: game.state.sum ? sumText(game.state.sum) : '',
  summary: null,
  ...overrides,
});

describe('the scene', () => {
  it('draws a full sky without leaving the context saved', () => {
    const game = createRun({ seed: 1 });
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    const scene = createScene();
    scene.update(FRAME, modelOf(game));
    const { ctx, texts } = recordingContext();
    scene.render(ctx, SCREEN);
    expect(depthOf(ctx)).toBe(0);
    for (const plane of game.state.aloft.filter((entry) => !entry.hidden)) {
      expect(texts).toContain(String(plane.number));
    }
    expect(texts).toContain(sumText(game.state.sum!));
  });

  it('draws the fighter exactly where the run says it is', () => {
    const game = createRun({ seed: 2 });
    game.aim(1);
    for (let i = 0; i < 30; i += 1) game.step(FRAME);
    const scene = createScene();
    scene.update(FRAME, modelOf(game));
    // Not its own eased copy: a shell leaves from the run's position, so the
    // drawn nose and the shell's origin have to be the same number.
    expect(scene.fighterX).toBe(game.state.fighterX);
  });

  it('shows the solved sum where the plane was, then lets it go', () => {
    const game = createRun({ seed: 3 });
    game.step(FRAME);
    const target = game.state.aloft.find((plane) => plane.uid === game.state.targetUid)!;
    const scene = createScene();
    scene.observe([{ type: 'destroyed', plane: target, sum: game.state.sum! }]);
    scene.update(FRAME, modelOf(game));
    const during = recordingContext();
    scene.render(during.ctx, SCREEN);
    expect(during.texts.some((text) => text.includes('='))).toBe(true);

    for (let i = 0; i < 180; i += 1) scene.update(FRAME, modelOf(game));
    const after = recordingContext();
    scene.render(after.ctx, SCREEN);
    expect(after.texts.some((text) => text.includes('='))).toBe(false);
  });

  it('announces a band and then puts the banner away', () => {
    const game = createRun({ seed: 4 });
    const scene = createScene();
    scene.observe([
      {
        type: 'band',
        band: { id: 'over-ten', title: 'Over Ten', from: 45, answers: { from: 11, to: 20 }, easyMix: 0.3, addMix: 1 },
      },
    ]);
    scene.update(FRAME, modelOf(game));
    const during = recordingContext();
    scene.render(during.ctx, SCREEN);
    expect(during.texts).toContain('Over Ten');

    for (let i = 0; i < 300; i += 1) scene.update(FRAME, modelOf(game));
    const after = recordingContext();
    scene.render(after.ctx, SCREEN);
    expect(after.texts).not.toContain('Over Ten');
  });

  it('paints scenery past the design rect, so an odd-shaped screen has no bars', () => {
    const scene = createScene();
    const game = createRun({ seed: 5 });
    scene.update(FRAME, modelOf(game));
    const { ctx, calls } = recordingContext();
    scene.render(ctx, { width: 2600, height: 1200 });
    expect(calls).toContain('fillRect');
    expect(depthOf(ctx)).toBe(0);
  });

  it('round-trips a screen point into the design space', () => {
    const scene = createScene();
    const screen = { width: 2304, height: 1536 };
    const point = scene.toDesign({ x: 1152, y: 768 }, screen);
    expect(point.x).toBeCloseTo(DESIGN.width / 2, 5);
    expect(point.y).toBeCloseTo(DESIGN.height / 2, 5);
  });

  it('covers the sky with the summary card when the run is over', () => {
    const game = createRun({ seed: 6 });
    const scene = createScene();
    scene.update(FRAME, modelOf(game, { summary: { score: 12, bestStreak: 5, seconds: 88, best: 12, beatenBest: true } }));
    const { ctx, texts } = recordingContext();
    scene.render(ctx, SCREEN);
    expect(texts.join(' ')).toContain('12');
    expect(texts.join(' ').toLowerCase()).toContain('tap');
  });

  it('draws nothing at all before it has been given a model', () => {
    const { ctx, calls } = recordingContext();
    createScene().render(ctx, SCREEN);
    expect(calls).toHaveLength(0);
  });
});
