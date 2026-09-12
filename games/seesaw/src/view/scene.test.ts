import { describe, it, expect } from 'vitest';
import { createScene, type SceneModel } from './scene.js';
import { createVectorTheme } from './vector-theme.js';
import { recordingContext, depthOf } from './recording-context.js';
import { describeSeesaw, type PlacedAnimal } from '../logic/seesaw-state.js';
import type { AnimalId } from '../logic/animals.js';

const modelFor = (placed: PlacedAnimal[], overrides: Partial<SceneModel> = {}): SceneModel => ({
  snapshot: describeSeesaw(placed),
  placed,
  targetBalance: null,
  gateOpen: false,
  celebrating: false,
  ...overrides,
});

const animal = (species: AnimalId, side: 'left' | 'right', index = 0): PlacedAnimal => ({
  uid: `${side}-${species}-${index}`,
  species,
  side,
});

const settle = (scene: ReturnType<typeof createScene>, model: SceneModel, frames = 240) => {
  for (let i = 0; i < frames; i++) scene.update(1 / 60, model);
};

describe('scene', () => {
  it('tips the right side down when the right is heavier', () => {
    const scene = createScene(createVectorTheme());
    settle(scene, modelFor([animal('bear', 'right')]));
    // Positive canvas rotation lowers the right end.
    expect(scene.plankAngle).toBeGreaterThan(0);
    expect(scene.tiltSettled).toBe(true);
  });

  it('tips the left side down when the left is heavier', () => {
    const scene = createScene(createVectorTheme());
    settle(scene, modelFor([animal('bear', 'left')]));
    expect(scene.plankAngle).toBeLessThan(0);
  });

  it('puts the heavy platform lower on screen', () => {
    const scene = createScene(createVectorTheme());
    settle(scene, modelFor([animal('bear', 'left'), animal('rabbit', 'right')]));
    const [left, right] = ['left', 'right'].map(
      (side) => scene.placements().find((placement) => placement.animal.side === side)!,
    );
    expect(left!.pose.y).toBeGreaterThan(right!.pose.y);
  });

  it('reports unsettled as soon as the balance changes', () => {
    const scene = createScene(createVectorTheme());
    scene.update(1 / 60, modelFor([]));
    scene.update(1 / 60, modelFor([animal('bear', 'left')]));
    expect(scene.tiltSettled).toBe(false);
  });

  it('settles level when the weights match', () => {
    const scene = createScene(createVectorTheme());
    settle(scene, modelFor([animal('cat', 'left'), animal('cat', 'right')]));
    expect(scene.plankAngle).toBeCloseTo(0, 3);
  });

  it('gives every placed animal a pose, without overlapping', () => {
    const scene = createScene(createVectorTheme());
    const placed = Array.from({ length: 5 }, (_, i) => animal('rabbit', 'left', i));
    settle(scene, modelFor(placed));
    const poses = scene.placements().filter((placement) => placement.animal.side === 'left');
    expect(poses).toHaveLength(5);
    const xs = poses.map((placement) => placement.pose.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(30);
  });

  it('shows calm animals when balanced and alarmed animals in the red', () => {
    const scene = createScene(createVectorTheme());
    settle(scene, modelFor([animal('cat', 'left'), animal('cat', 'right')]));
    expect(scene.placements()[0]!.pose.expression).toBe('calm');
    settle(scene, modelFor([animal('bear', 'left')]));
    expect(scene.placements()[0]!.pose.expression).toBe('alarmed');
  });

  it('renders without throwing and leaves the context balanced', () => {
    const scene = createScene(createVectorTheme());
    settle(scene, modelFor([animal('cat', 'right')]), 10);
    const { ctx, calls } = recordingContext();
    expect(() => scene.render(ctx, { width: 800, height: 600 })).not.toThrow();
    expect(calls).toContain('setTransform');
    expect(depthOf(ctx)).toBe(0);
  });

  it('maps a screen point back into design space', () => {
    const scene = createScene(createVectorTheme());
    const point = scene.toDesign({ x: 400, y: 300 }, { width: 2048, height: 1536 });
    expect(point).toEqual({ x: 200, y: 150 });
  });

  it('opens the gate gradually', () => {
    const scene = createScene(createVectorTheme());
    const opening = modelFor([], { gateOpen: true });
    scene.update(1 / 60, opening);
    const { ctx } = recordingContext();
    expect(() => scene.render(ctx, { width: 800, height: 600 })).not.toThrow();
    settle(scene, opening);
    expect(() => scene.render(ctx, { width: 800, height: 600 })).not.toThrow();
  });
});
