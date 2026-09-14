import { describe, it, expect } from 'vitest';
import { createScene, type SceneModel } from './scene.js';
import { createVectorTheme } from './vector-theme.js';
import { recordingContext, depthOf } from './recording-context.js';
import { describeSeesaw, type PlacedAnimal } from '../logic/seesaw-state.js';
import { DESIGN } from './layout.js';
import { ROUND_DOTS_Y } from './hud.js';
import type { AnimalId } from '../logic/animals.js';

const modelFor = (placed: PlacedAnimal[], overrides: Partial<SceneModel> = {}): SceneModel => ({
  snapshot: describeSeesaw(placed),
  placed,
  targetBalance: null,
  celebrating: false,
  dancing: false,
  tray: [],
  selectedTrayIndex: null,
  caption: 'Make it level',
  won: false,
  goalToken: 'test:0',
  stages: 1,
  stagesCleared: 0,
  sectionFaces: ['chicken'],
  chapter: null,
  ...overrides,
});

const animal = (species: AnimalId, side: 'left' | 'right', index = 0): PlacedAnimal => ({
  uid: `${side}-${species}-${index}`,
  source: 'test',
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
    settle(scene, modelFor([animal('bear', 'left'), animal('chicken', 'right')]));
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
    const placed = Array.from({ length: 5 }, (_, i) => animal('chicken', 'left', i));
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
    const screen = { width: DESIGN.width * 2, height: DESIGN.height * 2 };
    expect(scene.toDesign({ x: 400, y: 300 }, screen)).toEqual({ x: 200, y: 150 });
  });

  it('paints scenery across the whole canvas, leaving no letterbox bars', () => {
    const scene = createScene(createVectorTheme());
    // A screen much wider than the design rect: the background has to reach
    // past the design edges or bars show.
    const screen = { width: DESIGN.width * 2, height: DESIGN.height };
    let widest = 0;
    const theme = {
      ...createVectorTheme(),
      drawBackground: (_ctx: CanvasRenderingContext2D, view: { bounds: { left: number; right: number } }) => {
        widest = view.bounds.right - view.bounds.left;
      },
    };
    const probe = createScene(theme as never);
    probe.update(1 / 60, modelFor([]));
    probe.render(recordingContext().ctx, screen);
    expect(widest).toBeGreaterThan(DESIGN.width);
    scene.update(1 / 60, modelFor([]));
  });

  it('draws the tray and the armed side targets', () => {
    const scene = createScene(createVectorTheme());
    const model = modelFor([animal('cat', 'left')], {
      tray: [
        { uid: 'tray-0', species: 'chicken', count: 1, used: false },
        { uid: 'tray-1', species: 'dog', count: 1, used: true },
      ],
      selectedTrayIndex: 0,
    });
    scene.update(1 / 60, model);
    expect(scene.traySlots()).toHaveLength(1);
    expect(scene.traySlots()[0]!.item.species).toBe('chicken');
    const { ctx, calls } = recordingContext();
    scene.render(ctx, { width: 1024, height: 768 });
    expect(calls).toContain('fillText');
    expect(depthOf(ctx)).toBe(0);
  });

  describe('finishing dance', () => {
    const dancers = [animal('chicken', 'left', 0), animal('cat', 'right', 0), animal('chicken', 'right', 1)];
    const dancing = () => modelFor(dancers, { dancing: true });
    const still = () => modelFor(dancers, { dancing: false });

    it('does not dance while the level is being played', () => {
      const scene = createScene(createVectorTheme());
      settle(scene, still(), 30);
      expect(scene.placements().every((placement) => placement.pose.dance === 0)).toBe(true);
      expect(scene.danceProgress).toBe(0);
    });

    it('starts every animal dancing when the level is finished', () => {
      const scene = createScene(createVectorTheme());
      for (let i = 0; i < 60; i++) scene.update(1 / 60, dancing());
      expect(scene.placements().every((placement) => placement.pose.dance > 0)).toBe(true);
      expect(scene.danceProgress).toBeGreaterThan(0);
    });

    it('staggers the dancers so they do not hop in unison', () => {
      const scene = createScene(createVectorTheme());
      for (let i = 0; i < 30; i++) scene.update(1 / 60, dancing());
      const dances = scene.placements().map((placement) => placement.pose.dance);
      expect(new Set(dances).size).toBe(dances.length);
    });

    it('switches the dancers to cheerful faces', () => {
      const scene = createScene(createVectorTheme());
      // A tilted plank would normally make these animals look surprised.
      for (let i = 0; i < 60; i++) scene.update(1 / 60, dancing());
      expect(scene.placements().every((placement) => placement.pose.expression === 'cheer')).toBe(true);
    });

    it('ends the dance and settles the animals again', () => {
      const scene = createScene(createVectorTheme());
      for (let i = 0; i < 60 * 4; i++) scene.update(1 / 60, dancing());
      expect(scene.placements().every((placement) => placement.pose.dance === 0)).toBe(true);
    });

    it('bobs the plank while dancing without touching the balance state', () => {
      const scene = createScene(createVectorTheme());
      settle(scene, still());
      const restingAngle = scene.plankAngle;
      const angles = new Set<number>();
      for (let i = 0; i < 40; i++) {
        scene.update(1 / 60, dancing());
        angles.add(Number(scene.plankAngle.toFixed(5)));
      }
      expect(angles.size).toBeGreaterThan(1);
      // The bob is small: the seesaw still reads as balanced where it was.
      for (const angle of angles) expect(Math.abs(angle - restingAngle)).toBeLessThan(0.03);
    });

    it('resets when a new level starts', () => {
      const scene = createScene(createVectorTheme());
      for (let i = 0; i < 30; i++) scene.update(1 / 60, dancing());
      scene.update(1 / 60, still());
      expect(scene.danceProgress).toBe(0);
      expect(scene.placements().every((placement) => placement.pose.dance === 0)).toBe(true);
    });

    it('renders the celebration without throwing', () => {
      const scene = createScene(createVectorTheme());
      for (let i = 0; i < 30; i++) scene.update(1 / 60, dancing());
      const { ctx } = recordingContext();
      expect(() => scene.render(ctx, { width: 800, height: 600 })).not.toThrow();
      expect(depthOf(ctx)).toBe(0);
    });
  });
});

describe('announcing the goal', () => {
  const goal = (token: string, overrides: Partial<SceneModel> = {}) =>
    modelFor([], { goalToken: token, ...overrides });

  it('announces the goal when a level opens', () => {
    const scene = createScene(createVectorTheme());
    scene.update(1 / 60, goal('level-1:0'));
    expect(scene.announcing).toBe(true);
  });

  it('settles once the announcement has played', () => {
    const scene = createScene(createVectorTheme());
    for (let i = 0; i < 60 * 3; i++) scene.update(1 / 60, goal('level-1:0'));
    expect(scene.announcing).toBe(false);
  });

  it('announces again when the next challenge begins', () => {
    const scene = createScene(createVectorTheme());
    for (let i = 0; i < 60 * 3; i++) scene.update(1 / 60, goal('level-5:0'));
    expect(scene.announcing).toBe(false);
    scene.update(1 / 60, goal('level-5:1'));
    expect(scene.announcing).toBe(true);
  });

  it('does not re-announce a goal that has not changed', () => {
    const scene = createScene(createVectorTheme());
    for (let i = 0; i < 60 * 3; i++) scene.update(1 / 60, goal('level-1:0'));
    for (let i = 0; i < 60; i++) scene.update(1 / 60, goal('level-1:0'));
    expect(scene.announcing).toBe(false);
  });

  it('draws the goal wherever it is in its arrival', () => {
    const scene = createScene(createVectorTheme());
    for (const frames of [1, 30, 80, 200]) {
      const fresh = createScene(createVectorTheme());
      for (let i = 0; i < frames; i++) fresh.update(1 / 60, goal('level-1:0'));
      const { ctx, texts } = recordingContext();
      fresh.render(ctx, { width: 1024, height: 768 });
      expect(texts.join(' ')).toContain('Make it level');
      expect(depthOf(ctx)).toBe(0);
    }
    scene.update(1 / 60, goal('x:0'));
  });
});

describe('showing a level with several challenges', () => {
  it('draws a dot for each challenge, ticked as they are cleared', () => {
    const scene = createScene(createVectorTheme());
    const model = modelFor([], { goalToken: 'level-5:1', stages: 3, stagesCleared: 1 });
    for (let i = 0; i < 200; i++) scene.update(1 / 60, model);
    const withDots = recordingContext();
    scene.render(withDots.ctx, { width: 1024, height: 768 });

    const plain = createScene(createVectorTheme());
    const single = modelFor([], { goalToken: 'level-1:0', stages: 1, stagesCleared: 0 });
    for (let i = 0; i < 200; i++) plain.update(1 / 60, single);
    const withoutDots = recordingContext();
    plain.render(withoutDots.ctx, { width: 1024, height: 768 });

    // A three-challenge level visibly carries more than a one-challenge level.
    expect(withDots.calls.length).toBeGreaterThan(withoutDots.calls.length);
  });
});

describe('the goal arriving does not disturb what is already there', () => {
  it('keeps the stage dots in one place throughout the announcement', () => {
    const model = modelFor([], { goalToken: 'level-5:1', stages: 3, stagesCleared: 1 });
    for (const frames of [2, 20, 60, 100, 200]) {
      const scene = createScene(createVectorTheme());
      for (let i = 0; i < frames; i++) scene.update(1 / 60, model);
      const { ctx, translations } = recordingContext();
      scene.render(ctx, { width: 1024, height: 768 });
      // Three dots, on the same row, every frame of the announcement.
      const onTheRow = translations.filter((point) => Math.abs(point.y - ROUND_DOTS_Y) < 0.5);
      expect(onTheRow, `frame ${frames}`).toHaveLength(3);
    }
  });
});
