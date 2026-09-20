import { describe, it, expect } from 'vitest';
import { answerSet, BANDS } from './bands.data.js';
import { createRun, HEARTS, type Run } from './run.js';
import { hasTrap } from './spawner.js';
import { planeX, remaining, struck, type Plane } from './sky-state.js';

const FRAME = 1 / 60;
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

/** Every number any band would ever allow into the sky. */
const EVERY_ALLOWED_NUMBER = new Set(BANDS.flatMap((band) => [...answerSet(band)]));

/** The plane the live sum is asking about. */
const target = (game: Run): Plane | undefined =>
  game.state.aloft.find((plane) => plane.uid === game.state.targetUid);

describe('a long run never breaks its promises', () => {
  it('never puts a number in the sky that no sum could produce', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, hearts: 999 });
      for (let i = 0; i < 60 * 60 * 5; i += 1) {
        game.step(FRAME);
        for (const plane of game.state.aloft) {
          expect(EVERY_ALLOWED_NUMBER.has(plane.number), `plane wearing ${plane.number}`).toBe(true);
        }
      }
    }
  });

  it('always has a plane aloft wearing the answer to the live sum', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, hearts: 999 });
      for (let i = 0; i < 60 * 60 * 5; i += 1) {
        game.step(FRAME);
        const sum = game.state.sum;
        if (!sum) continue;
        const answering = game.state.aloft.filter((plane) => plane.number === sum.answer);
        expect(answering.length, `nothing aloft answers ${sum.answer}`).toBeGreaterThan(0);
      }
    }
  });

  it('never asks about a plane without its full fair window', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, hearts: 999 });
      let lastUid: string | null = null;
      for (let i = 0; i < 60 * 60 * 5; i += 1) {
        const events = game.step(FRAME);
        for (const event of events) {
          if (event.type !== 'asked') continue;
          expect(remaining(event.target)).toBeGreaterThanOrEqual(game.state.tempo.thinkSeconds - 1e-6);
          lastUid = event.target.uid;
        }
      }
      expect(lastUid).not.toBeNull();
    }
  });

  it('always keeps something plausible-but-wrong in the sky', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, hearts: 999 });
      let asked = false;
      for (let i = 0; i < 60 * 60 * 3; i += 1) {
        const events = game.step(FRAME);
        if (events.some((event) => event.type === 'asked')) {
          asked = true;
          continue;
        }
        const sum = game.state.sum;
        if (!asked || !sum) continue;
        expect(hasTrap(sum, game.state.aloft), `no trap for ${sum.answer}`).toBe(true);
      }
    }
  });

  it('keeps every plane inside the playfield', () => {
    const game = createRun({ seed: 42, hearts: 999 });
    for (let i = 0; i < 60 * 60 * 4; i += 1) {
      game.step(FRAME);
      for (const plane of game.state.aloft) {
        expect(planeX(plane)).toBeGreaterThanOrEqual(0);
        expect(planeX(plane)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never deadlocks: a question is always live, or a loss is being taken in', () => {
    const game = createRun({ seed: 77, hearts: 999 });
    for (let i = 0; i < 60 * 60 * 10; i += 1) {
      game.step(FRAME);
      // The only moment without a live question is the beat after a plane got
      // away, and that beat always ends.
      if (game.state.mourning > 0) {
        expect(game.state.missed).not.toBeNull();
        continue;
      }
      expect(game.state.sum).not.toBeNull();
      expect(target(game)).toBeDefined();
    }
    expect(game.state.mourning).toBe(0);
  });
});

describe('the maths is load-bearing', () => {
  /** Whether something is flying between the fighter's column and the target. */
  const blocked = (game: Run, chosen: Plane): boolean =>
    game.state.aloft.some(
      (plane) =>
        plane.uid !== chosen.uid &&
        plane.progress > chosen.progress &&
        struck(plane, planeX(chosen), plane.progress),
    );

  /**
   * A player who reads the sum, finds the plane wearing its answer, lines up,
   * waits for a clear line, and fires one shell at a time. Proof the game is
   * winnable at all: without this, the blind test below would pass for the
   * wrong reason.
   *
   * Checking what is in front of you and firing one shell rather than holding
   * the trigger are both part of flying, not part of the arithmetic — a player
   * who does neither loses hearts, and should.
   */
  /** Whether the fighter has finished flying to where it was sent. */
  const lined = (game: Run, chosen: Plane): boolean =>
    Math.abs(game.state.fighterX - planeX(chosen)) < 0.01;

  const playWell = (game: Run, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      const chosen = target(game);
      // One shell at a time: nothing in the air and nothing waiting to leave.
      if (chosen && game.state.bullets.length === 0 && game.state.pendingFire === 0) {
        game.aim(planeX(chosen));
        if (lined(game, chosen) && !blocked(game, chosen)) game.fire();
      }
      game.step(FRAME);
    }
  };

  /**
   * A player who never reads a number and simply shoots whatever is lowest —
   * but plays that strategy as well as it can be played, waiting to arrive
   * before firing. A weaker guesser would fail this test for the wrong reason:
   * missing, rather than being wrong.
   */
  const playBlind = (game: Run, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      const lowest = [...game.state.aloft].sort((a, b) => b.progress - a.progress)[0];
      if (lowest && game.state.bullets.length === 0 && game.state.pendingFire === 0) {
        game.aim(planeX(lowest));
        if (lined(game, lowest)) game.fire();
      }
      game.step(FRAME);
    }
  };

  it('is winnable: reading the sum flies two minutes and scores a hundred', () => {
    for (const seed of [1, 2, 3, 5]) {
      const game = createRun({ seed });
      playWell(game, 120);
      expect(game.state.status, `seed ${seed}`).toBe('flying');
      // A heart can still go to a scout in a crowded sky; two cannot.
      expect(game.state.hearts, `seed ${seed}`).toBeGreaterThanOrEqual(HEARTS - 1);
      expect(game.state.score, `seed ${seed}`).toBeGreaterThan(100);
    }
  });

  /**
   * The test this whole design exists to pass. Seesaw Park's arcade half was
   * built and cut because a player could win it without reading a number. If
   * this ever passes the game, the arithmetic has stopped mattering and the
   * design has regressed — fix the game, never the test.
   */
  it('cannot be played blind: guessing is dead inside the two minutes reading survives', () => {
    // The same window the reading bot gets above, so the two tests are a direct
    // contrast: in two minutes, reading scores a hundred and lives; guessing
    // dies. A gold plane can hand a guesser a heart back and buy them twenty
    // seconds, which is fine — it does not save them.
    for (const seed of [1, 2, 3, 5, 8, 13, 21]) {
      const game = createRun({ seed });
      playBlind(game, 120);
      expect(game.state.status, `seed ${seed} survived without reading a number`).toBe('over');
      expect(game.state.score, `seed ${seed} scored too well for a guesser`).toBeLessThan(60);
    }
  });

  it('cannot be sprayed: firing at everything loses every heart too', () => {
    const game = createRun({ seed: 4 });
    for (let t = 0; t < 90; t += FRAME) {
      game.aim((t * 0.37) % 1);
      game.fire();
      game.step(FRAME);
    }
    expect(game.state.status).toBe('over');
  });

  it('keeps one slip cheap and a habit expensive', () => {
    const game = createRun({ seed: 6, hearts: 999 });
    game.step(FRAME);
    const wrong = () => game.state.aloft.find((plane) => plane.number !== game.state.sum!.answer)!;
    const jamAfterShooting = (): number => {
      const plane = wrong();
      for (let i = 0; i < 200; i += 1) {
        game.aim(planeX(plane));
        game.fire();
        const events = game.step(FRAME);
        if (events.some((event) => event.type === 'jammed')) return game.state.jam;
      }
      return 0;
    };
    const first = jamAfterShooting();
    // Wait out the first jam, then do it again without ever getting one right.
    for (let i = 0; i < 200 && game.state.jam > 0; i += 1) game.step(FRAME);
    const second = jamAfterShooting();
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
  });
});
