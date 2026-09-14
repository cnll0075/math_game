import { describe, it, expect } from 'vitest';
import { createVectorTheme } from './vector-theme.js';
import { recordingContext, depthOf } from './recording-context.js';
import { ANIMAL_IDS, ANIMALS } from '../logic/animals.js';
import { DESIGN } from './layout.js';
import { SCENE, platformAnchor } from './geometry.js';
import { BADGE_FROM_SCALE } from './animals-art.js';
import type { Expression, SeesawView } from './theme.js';

const view = (overrides: Partial<SeesawView> = {}): SeesawView => ({
  plankAngle: 0.1,
  needle: 0.3,
  zone: 'yellow',
  flagHeight: 1,
  flagSide: 'left',
  celebrate: 0,
  targetAngle: -0.1,
  bounds: { left: 0, top: 0, right: DESIGN.width, bottom: DESIGN.height },
  time: 1.5,
  ...overrides,
});

describe('vector theme', () => {
  it('preloads without needing assets', async () => {
    await expect(createVectorTheme().preload()).resolves.toBeUndefined();
  });

  it('draws every scene element with balanced save/restore', () => {
    const theme = createVectorTheme();
    const parts = ['drawBackground', 'drawSeesaw', 'drawTarget', 'drawGauge', 'drawFlag'] as const;
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
        dance: 0,
        arriving: 1,
        clock: 0,
        expression: 'surprised',
      });
      expect(calls.length, species).toBeGreaterThan(0);
      expect(depthOf(ctx), species).toBe(0);
    }
  });

  it('draws each expression', () => {
    const theme = createVectorTheme();
    for (const expression of ['calm', 'surprised', 'alarmed', 'cheer'] as Expression[]) {
      const { ctx, calls } = recordingContext();
      theme.animals.draw(ctx, 'bear', {
        x: 0,
        y: 0,
        scale: 1,
        tiltRad: 0,
        wobble: 0,
        slide: 0,
        dance: 0,
        arriving: 1,
        clock: 0,
        expression,
      });
      expect(calls.length, expression).toBeGreaterThan(0);
      expect(depthOf(ctx)).toBe(0);
    }
  });

  it('shows each animal wearing its own weight', () => {
    const theme = createVectorTheme();
    for (const species of ANIMAL_IDS) {
      const { ctx, texts } = recordingContext();
      theme.animals.draw(ctx, species, {
        x: 0,
        y: 0,
        scale: 1,
        tiltRad: 0,
        wobble: 0,
        slide: 0,
        dance: 0,
        arriving: 1,
        clock: 0,
        expression: 'calm',
      });
      expect(texts, species).toContain(String(ANIMALS[species].weight));
    }
  });

  it('draws a dancing animal without throwing, at every point in the hop', () => {
    const theme = createVectorTheme();
    for (const dance of [0.01, 0.25, 0.5, 0.75, 0.99]) {
      const { ctx, calls } = recordingContext();
      theme.animals.draw(ctx, 'chicken', {
        x: 0,
        y: 0,
        scale: 1,
        tiltRad: 0,
        wobble: 0,
        slide: 0,
        dance,
        arriving: 1,
        clock: 0,
        expression: 'cheer',
      });
      expect(calls.length, String(dance)).toBeGreaterThan(0);
      expect(depthOf(ctx), String(dance)).toBe(0);
    }
  });

  it('draws petals only while celebrating', () => {
    const theme = createVectorTheme();
    const idle = recordingContext();
    const party = recordingContext();
    theme.drawCelebration(idle.ctx, view({ celebrate: 0 }));
    theme.drawCelebration(party.ctx, view({ celebrate: 1 }));
    expect(idle.calls).toHaveLength(0);
    expect(party.calls.length).toBeGreaterThan(0);
    expect(depthOf(party.ctx)).toBe(0);
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

describe('the target marker', () => {
  it('sits at the end of the ghost plank, not floating above it', () => {
    const theme = createVectorTheme();
    const targetAngle = -0.18;
    const { ctx, translations } = recordingContext();

    theme.drawTarget(ctx, view({ targetAngle, plankAngle: 0.2 }));
    const ghostEnd = platformAnchor('right', targetAngle);
    const star = translations[0]!;
    // Within a plank thickness of the ghost's end: they are one object.
    expect(Math.hypot(star.x - ghostEnd.x, star.y - ghostEnd.y)).toBeLessThan(SCENE.plankThickness);
  });

  it('celebrates once the plank reaches it', () => {
    const theme = createVectorTheme();
    const away = recordingContext();
    const arrived = recordingContext();
    theme.drawTarget(away.ctx, view({ targetAngle: -0.18, plankAngle: 0.2 }));
    theme.drawTarget(arrived.ctx, view({ targetAngle: -0.18, plankAngle: -0.18 }));
    // The reached star gains a halo, so arriving is unmistakable.
    expect(arrived.calls.length).toBeGreaterThan(away.calls.length);
  });
});

describe('animals drawn small', () => {
  it('wears no weight tag inside a group, so the child counts instead of reads', () => {
    const theme = createVectorTheme();
    const alone = recordingContext();
    const inAGroup = recordingContext();
    const pose = { x: 0, y: 0, tiltRad: 0, wobble: 0, slide: 0, dance: 0, arriving: 1, clock: 0 } as const;
    theme.animals.draw(alone.ctx, 'cat', { ...pose, scale: 1, expression: 'calm' });
    theme.animals.draw(inAGroup.ctx, 'cat', { ...pose, scale: BADGE_FROM_SCALE - 0.05, expression: 'calm' });
    expect(alone.texts).toContain('2');
    expect(inAGroup.texts).toHaveLength(0);
  });
});
