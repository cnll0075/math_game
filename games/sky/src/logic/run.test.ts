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
  for (let i = 0; i < 400; i += 1) {
    const live = game.state.aloft.find((entry) => entry.uid === plane.uid);
    if (!live) break;
    game.aim(planeX(live));
    // The fighter flies there rather than jumping, so wait until it has arrived.
    if (Math.abs(game.state.fighterX - planeX(live)) < 0.01) game.fire();
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
    if (Math.abs(game.state.fighterX - planeX(live)) < 0.01) game.fire();
    events.push(...game.step(FRAME));
  }
  return events;
};

describe('flying the fighter', () => {
  it('flies to where the finger is rather than jumping there', () => {
    const game = createRun({ seed: 20 });
    game.aim(1);
    game.step(FRAME);
    expect(game.state.fighterX).toBeGreaterThan(0.5);
    expect(game.state.fighterX).toBeLessThan(1);
    for (let i = 0; i < 60; i += 1) game.step(FRAME);
    expect(game.state.fighterX).toBeCloseTo(1, 2);
  });

  it('holds the shell until the fighter reaches where the player let go', () => {
    const game = createRun({ seed: 21 });
    game.aim(1);
    game.step(FRAME);
    game.fire();
    // Still on its way: nothing has left the gun yet.
    game.step(FRAME);
    expect(game.state.bullets).toHaveLength(0);

    for (let i = 0; i < 60 && game.state.bullets.length === 0; i += 1) game.step(FRAME);
    expect(game.state.bullets).toHaveLength(1);
    // And it leaves from the nose the player can see, up at the far edge.
    expect(game.state.bullets[0]!.x).toBe(game.state.fighterX);
    expect(game.state.bullets[0]!.x).toBeGreaterThan(0.98);
  });

  it('gives up waiting rather than swallowing the shot', () => {
    const game = createRun({ seed: 23 });
    game.aim(0.5);
    for (let i = 0; i < 60; i += 1) game.step(FRAME);
    // Somewhere it can never reach, because the playfield ends.
    game.aim(0.5);
    game.fire();
    for (let i = 0; i < 60 && game.state.bullets.length === 0; i += 1) game.step(FRAME);
    expect(game.state.bullets).toHaveLength(1);
  });

  it('will not queue a shell while the gun is overheating', () => {
    const game = createRun({ seed: 24 });
    run(game, 2);
    const wrong = game.state.aloft.find((plane) => plane.number !== game.state.sum!.answer)!;
    shoot(game, wrong);
    expect(game.state.jam).toBeGreaterThan(0);
    game.fire();
    expect(game.state.pendingFire).toBe(0);
  });

  it('never leaves the playfield, however far the finger goes', () => {
    const game = createRun({ seed: 22 });
    game.aim(5);
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    expect(game.state.fighterX).toBeLessThanOrEqual(1);
    game.aim(-5);
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    expect(game.state.fighterX).toBeGreaterThanOrEqual(0);
  });
});

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
    let changes = 0;
    let carriedOver = false;
    for (let t = 0; t < 3; t += FRAME) {
      const before = game.state.sum;
      const events = game.step(FRAME);
      if (!events.some((event) => event.type === 'band')) continue;
      changes += 1;
      // The band changing underneath a player must not rewrite the question in
      // front of them mid-thought.
      carriedOver = game.state.sum === before;
    }
    expect(changes).toBe(1);
    expect(carriedOver).toBe(true);
  });

  it('keeps the sky as full as the tempo wants', () => {
    const game = createRun({ seed: 12, hearts: 99 });
    run(game, 150);
    expect(game.state.aloft.length).toBeGreaterThanOrEqual(game.state.tempo.aloft - 2);
  });
});

describe('an impatient player', () => {
  it('is not punished for tapping again while a shell is waiting', () => {
    const game = createRun({ seed: 25 });
    game.aim(0.9);
    game.step(FRAME);
    game.fire();
    // Tapping away, as a child does when nothing has happened yet.
    for (let i = 0; i < 30 && game.state.bullets.length === 0; i += 1) {
      game.fire();
      game.step(FRAME);
    }
    expect(game.state.bullets.length).toBeGreaterThan(0);
  });
});
