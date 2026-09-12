import { describe, it, expect } from 'vitest';
import { createVectorTheme } from './vector-theme.js';
import { recordingContext, depthOf } from './recording-context.js';
import { ANIMAL_IDS } from '../logic/animals.js';
import type { Expression, SeesawView } from './theme.js';

const view = (overrides: Partial<SeesawView> = {}): SeesawView => ({
  plankAngle: 0.1,
  needle: 0.3,
  zone: 'yellow',
  flagHeight: 1,
  flagSide: 'left',
  gateOpen: 0.4,
  celebrate: 0,
  targetAngle: -0.1,
  time: 1.5,
  ...overrides,
});

describe('vector theme', () => {
  it('preloads without needing assets', async () => {
    await expect(createVectorTheme().preload()).resolves.toBeUndefined();
  });

  it('draws every scene element with balanced save/restore', () => {
    const theme = createVectorTheme();
    const parts = ['drawBackground', 'drawSeesaw', 'drawTarget', 'drawGauge', 'drawFlag', 'drawGate'] as const;
    for (const part of parts) {
      const { ctx, calls } = recordingContext();
      expect(() => theme[part](ctx, view()), part).not.toThrow();
      expect(calls.length, part).toBeGreaterThan(0);
      expect(depthOf(ctx), part).toBe(0);
    }
  });

  it('draws each animal species', () => {
    const theme = createVectorTheme();
    for (const species of ANIMAL_IDS) {
      const { ctx, calls } = recordingContext();
      theme.animals.draw(ctx, species, {
        x: 10,
        y: 20,
        scale: 1,
        tiltRad: 0.1,
        wobble: 0.5,
        slide: 4,
        expression: 'surprised',
      });
      expect(calls.length, species).toBeGreaterThan(0);
      expect(depthOf(ctx), species).toBe(0);
    }
  });

  it('draws each expression', () => {
    const theme = createVectorTheme();
    for (const expression of ['calm', 'surprised', 'alarmed'] as Expression[]) {
      const { ctx, calls } = recordingContext();
      theme.animals.draw(ctx, 'bear', {
        x: 0,
        y: 0,
        scale: 1,
        tiltRad: 0,
        wobble: 0,
        slide: 0,
        expression,
      });
      expect(calls.length, expression).toBeGreaterThan(0);
      expect(depthOf(ctx)).toBe(0);
    }
  });

  it('hides the flag when it has not risen', () => {
    const theme = createVectorTheme();
    const { ctx, calls } = recordingContext();
    theme.drawFlag(ctx, view({ flagHeight: 0, flagSide: null }));
    expect(calls).toHaveLength(0);
  });

  it('omits the target marker when a level has no tilt objective', () => {
    const theme = createVectorTheme();
    const withStar = recordingContext();
    const withoutStar = recordingContext();
    theme.drawTarget(withStar.ctx, view({ targetAngle: -0.2 }));
    theme.drawTarget(withoutStar.ctx, view({ targetAngle: null }));
    expect(withStar.calls.length).toBeGreaterThan(0);
    expect(withoutStar.calls).toHaveLength(0);
  });

  it('draws the ghost plank only when a target is set', () => {
    const theme = createVectorTheme();
    const withGhost = recordingContext();
    const withoutGhost = recordingContext();
    theme.drawSeesaw(withGhost.ctx, view({ targetAngle: -0.2 }));
    theme.drawSeesaw(withoutGhost.ctx, view({ targetAngle: null }));
    expect(withGhost.calls.length).toBeGreaterThan(withoutGhost.calls.length);
  });
});
