import { describe, it, expect } from 'vitest';
import { createRun, HEARTS, JAM_SECONDS, type Run, type RunEvent } from './run.js';
import { planeX, type Plane } from './sky-state.js';

const FRAME = 1 / 60;

/** Runs the clock, collecting everything that happened. */
const run = (game: Run, seconds: number): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let t = 0; t < seconds; t += FRAME) events.push(...game.step(FRAME));
  return events;
};

const target = (game: Run): Plane | undefined =>
  game.state.aloft.find((plane) => plane.uid === game.state.targetUid);

/** Lines the fighter up under a plane and shoots until something happens. */
const shoot = (game: Run, plane: Plane): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let i = 0; i < 200; i += 1) {
    const live = game.state.aloft.find((entry) => entry.uid === plane.uid);
    if (!live) break;
    game.aim(planeX(live));
    game.fire();
    const batch = game.step(FRAME);
    events.push(...batch);
    if (batch.some((event) => event.type === 'destroyed' || event.type === 'jammed')) break;
  }
  return events;
};

describe('a run opening', () => {
  it('starts with a sky already flying and a question already asked', () => {
    const game = createRun({ seed: 1 });
    game.step(FRAME);
    expect(game.state.aloft.length).toBeGreaterThanOrEqual(4);
    expect(game.state.sum).not.toBeNull();
    expect(game.state.hearts).toBe(HEARTS);
    expect(game.state.band.id).toBe('easy');
  });

  it('asks about a plane that is actually up there', () => {
    const game = createRun({ seed: 2 });
    run(game, 20);
    const chosen = target(game)!;
    expect(chosen).toBeDefined();
    expect(chosen.number).toBe(game.state.sum!.answer);
  });

  it('can open at a band, for ?game=sky&level=take-aways', () => {
    const game = createRun({ seed: 3, startBand: 'take-aways' });
    game.step(FRAME);
    expect(game.state.band.id).toBe('take-aways');
  });
});

/**
 * Keeps at a plane until it is gone, waiting out any jam from something that
 * flew into the shell's path on the way up.
 */
const shootThrough = (game: Run, plane: Plane, frames = 900): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let i = 0; i < frames; i += 1) {
    const live = game.state.aloft.find((entry) => entry.uid === plane.uid);
    if (!live) break;
    game.aim(planeX(live));
    game.fire();
    events.push(...game.step(FRAME));
  }
  return events;
};

describe('shooting', () => {
  it('scores the right plane and asks something new', () => {
    const game = createRun({ seed: 4 });
    run(game, 2);
    const chosen = target(game)!;
    const asked = game.state.sum!;
    const events = shoot(game, chosen);
    expect(events.some((event) => event.type === 'destroyed')).toBe(true);
    expect(game.state.score).toBe(1);
    expect(game.state.streak).toBe(1);
    expect(game.state.hearts).toBe(HEARTS);
    expect(game.state.sum).not.toBe(asked);
    expect(target(game)!.number).toBe(game.state.sum!.answer);
  });

  it('jams the gun on the wrong plane and costs no heart', () => {
    const game = createRun({ seed: 5 });
    run(game, 2);
    const wrong = game.state.aloft.find((plane) => plane.number !== game.state.sum!.answer)!;
    const events = shoot(game, wrong);
    expect(events.some((event) => event.type === 'jammed')).toBe(true);
    expect(game.state.hearts).toBe(HEARTS);
    expect(game.state.score).toBe(0);
    expect(game.state.jam).toBeCloseTo(JAM_SECONDS, 1);
    expect(game.state.aloft.some((plane) => plane.uid === wrong.uid)).toBe(true);
  });

  it('will not fire while the gun is overheating', () => {
    const game = createRun({ seed: 6 });
    run(game, 2);
    const wrong = game.state.aloft.find((plane) => plane.number !== game.state.sum!.answer)!;
    shoot(game, wrong);
    const before = game.state.bullets.length;
    game.fire();
    expect(game.state.bullets.length).toBe(before);
  });

  it('takes three shells to down a blimp, and the sum survives the first two', () => {
    // Hearts to spare: this waits for a blimp to be asked about without firing,
    // which would otherwise end the run on escapes long before one arrived.
    const game = createRun({ seed: 7, startBand: 'take-aways', hearts: 999 });
    let blimp: Plane | undefined;
    for (let i = 0; i < 4000 && !blimp; i += 1) {
      game.step(FRAME);
      const chosen = target(game);
      if (chosen?.type === 'blimp') blimp = chosen;
    }
    expect(blimp, 'no blimp was ever asked about').toBeDefined();
    const events = shootThrough(game, blimp!);
    // Two dents and then down: the blimp is the plane you cannot change your
    // mind about halfway through.
    expect(events.filter((event) => event.type === 'damaged')).toHaveLength(2);
    expect(events.some((event) => event.type === 'destroyed')).toBe(true);
  });
});

describe('escapes', () => {
  it('costs a heart when the plane being asked about gets away', () => {
    const game = createRun({ seed: 8 });
    run(game, 2);
    const chosen = target(game)!;
    const events = run(game, chosen.fallSeconds + 1);
    expect(events.some((event) => event.type === 'escaped')).toBe(true);
    expect(game.state.hearts).toBeLessThan(HEARTS);
  });

  it('costs nothing when any other plane leaves', () => {
    const game = createRun({ seed: 9, hearts: 99 });
    const events = run(game, 60);
    const escapes = events.filter((event) => event.type === 'escaped').length;
    const gone = events.filter((event) => event.type === 'spawned').length - game.state.aloft.length;
    expect(gone).toBeGreaterThan(escapes);
  });

  it('ends the run when the last heart goes, and stops dead', () => {
    const game = createRun({ seed: 10, hearts: 1 });
    run(game, 2);
    run(game, 40);
    expect(game.state.status).toBe('over');
    const after = run(game, 5);
    expect(after).toHaveLength(0);
  });
});

describe('the clock', () => {
  it('announces a band change once, without rewriting the live question', () => {
    const game = createRun({ seed: 11, hearts: 99 });
    run(game, 44);
    const asked = game.state.sum;
    const events = run(game, 3);
    const changes = events.filter((event) => event.type === 'band');
    expect(changes).toHaveLength(1);
    expect(game.state.sum === asked || game.state.score > 0).toBe(true);
  });

  it('keeps the sky as full as the tempo wants', () => {
    const game = createRun({ seed: 12, hearts: 99 });
    run(game, 150);
    expect(game.state.aloft.length).toBeGreaterThanOrEqual(game.state.tempo.aloft - 2);
  });
});
