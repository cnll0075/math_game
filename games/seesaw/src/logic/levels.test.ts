import { describe, it, expect } from 'vitest';
import { LEVELS, getLevel, levelsInSection, solutionsFor } from './levels.data.js';
import { createGame } from './game.js';
import { SECTION_TITLES, specCount, specOf, type LevelDef, type SectionId } from './level.js';
import { ANIMAL_IDS, weightOf, type AnimalId } from './animals.js';

const total = (animals: readonly AnimalId[]) => animals.reduce((sum, animal) => sum + weightOf(animal), 0);

const play = (level: LevelDef) => {
  const game = createGame(level);
  const solution = solutionsFor(level)[0];
  if (!solution) return game;
  for (const move of solution) {
    if (move.kind === 'place') game.place(move.trayIndex, move.side);
    else game.takeBack(move.uid);
  }
  return game;
};

describe('the curriculum', () => {
  it('is one question per level, with unique ids', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
  });

  it('groups the levels into sections that run in order', () => {
    const order = LEVELS.map((level) => level.section);
    const firstSeen = [...new Set(order)];
    // A section's levels are contiguous: chapters, not a shuffle.
    expect(order).toEqual(firstSeen.flatMap((section) => order.filter((entry) => entry === section)));
    for (const section of firstSeen) expect(SECTION_TITLES[section]).toBeTruthy();
  });

  it('gives every section several questions', () => {
    for (const section of new Set(LEVELS.map((level) => level.section))) {
      expect(levelsInSection(section as SectionId).length, section).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every sum within ten', () => {
    for (const level of LEVELS) {
      const heaviest = Math.max(total(level.initial.left), total(level.initial.right));
      expect(heaviest, level.id).toBeLessThanOrEqual(10);
    }
  });

  it('starts with chickens alone', () => {
    const first = LEVELS[0]!;
    expect(new Set([...first.initial.left, ...first.tray.map(specOf)])).toEqual(new Set(['chicken']));
  });
});

describe('solvability', () => {
  it.each(LEVELS.map((level) => [level.id, level] as const))('%s can be solved', (_id, level) => {
    expect(solutionsFor(level).length).toBeGreaterThan(0);
  });

  it.each(LEVELS.map((level) => [level.id, level] as const))('%s is won by its own solution', (_id, level) => {
    expect(play(level).state.status).toBe('won');
  });

  it('reports a question nothing can answer', () => {
    const impossible: LevelDef = {
      id: 'x',
      section: 'same',
      objective: { kind: 'balance' },
      initial: { left: ['bear'], right: [] },
      tray: ['chicken'],
    };
    expect(solutionsFor(impossible)).toEqual([]);
  });
});

describe('what each section is for', () => {
  const inSection = (section: SectionId) => levelsInSection(section);

  it('teaches taking animals off before it needs it', () => {
    const takeoff = inSection('takeoff');
    const first = takeoff[0]!;
    // The first question of the section is the gentlest possible version: an
    // empty tray, so lifting is the only thing to try, and one obvious animal.
    expect(first.allowRemoval).toBe(true);
    expect(first.tray).toHaveLength(0);
    expect(total(first.initial.left) - total(first.initial.right)).toBe(1);

    // And nothing before that section ever needs a removal.
    for (const level of LEVELS) {
      if (level.section === 'takeoff' || level.section === 'mixed') continue;
      const needsRemoval = solutionsFor(level).every((solution) =>
        solution.some((move) => move.kind === 'remove'),
      );
      expect(needsRemoval, level.id).toBe(false);
    }
  });

  it('every removal question really needs a removal', () => {
    for (const level of inSection('takeoff')) {
      const solutions = solutionsFor(level);
      expect(solutions.length, level.id).toBeGreaterThan(0);
      expect(solutions.every((solution) => solution.some((move) => move.kind === 'remove')), level.id).toBe(true);
    }
  });

  it('offers groups to choose between, not animals to drag one by one', () => {
    for (const level of inSection('groups')) {
      const groups = level.tray.filter((spec) => specCount(spec) > 1);
      // More than one group on offer, so choosing between them is the question.
      expect(groups.length, level.id).toBeGreaterThanOrEqual(2);
      // And it is answered in a tap or two, never by dragging animals one at a
      // time until the numbers happen to match.
      const shortest = solutionsFor(level).sort((a, b) => a.length - b.length)[0]!;
      expect(shortest.length, level.id).toBeLessThanOrEqual(2);
      const usesAGroup = shortest.some(
        (move) => move.kind === 'place' && specCount(level.tray[move.trayIndex]!) > 1,
      );
      expect(usesAGroup, level.id).toBe(true);
    }
  });

  it('keeps every group small enough to count at a glance', () => {
    for (const level of LEVELS) {
      for (const spec of level.tray) {
        // Five animals in a pen were an unreadable huddle; four is the cap.
        expect(specCount(spec), level.id).toBeLessThanOrEqual(4);
      }
    }
  });

  it('makes the group answer a different size from the decoys', () => {
    for (const level of inSection('groups')) {
      const sizes = level.tray.map((spec) => specCount(spec) * weightOf(specOf(spec)));
      expect(new Set(sizes).size, level.id).toBe(sizes.length);
    }
  });

  it('asks the sharing section to seat the whole pile', () => {
    for (const level of inSection('share')) {
      expect(level.requireEmptyTray, level.id).toBe(true);
      const pile = level.tray.reduce((sum, spec) => sum + specCount(spec) * weightOf(specOf(spec)), 0);
      expect(pile % 2, level.id).toBe(0);
    }
  });

  it('needs both sides in the build section, where no small animal is offered', () => {
    const both = getLevel('l14')!;
    for (const solution of solutionsFor(both)) {
      const sides = new Set(solution.map((move) => (move.kind === 'place' ? move.side : 'remove')));
      expect(sides.size).toBeGreaterThan(1);
    }
  });
});

describe('the stories the levels tell', () => {
  it('gives every question a line of its own', () => {
    for (const level of LEVELS) {
      expect(level.hint, level.id).toBeTruthy();
      // Short enough to fit on the card, and to be read aloud in one breath.
      expect(level.hint!.length, level.id).toBeLessThanOrEqual(34);
    }
  });

  it('says what it means rather than naming the mechanic', () => {
    for (const level of LEVELS) {
      // "No Four" told a child nothing; a line should be about the animals.
      expect(level.hint!, level.id).not.toMatch(/^(Tap|Drag|Press|Select)\b/);
    }
  });

  it('talks about animals, never about named individuals', () => {
    // Mixing "How many chickens match Mango?" muddled a species with a pet
    // name, and a level can hold three cats anyway.
    for (const level of LEVELS) {
      expect(level.hint!, level.id).not.toMatch(/\b(Pip|Mango|Scout|Bramble)\b/);
    }
  });

  it('gives every chapter a name a child would understand', () => {
    for (const section of new Set(LEVELS.map((level) => level.section))) {
      const title = SECTION_TITLES[section as SectionId];
      expect(title.length).toBeGreaterThan(4);
      expect(title).not.toMatch(/objective|level|mode/i);
    }
  });
});

describe('what the two sides look like', () => {
  it('does not let the same animal sit on both sides, once past the opening', () => {
    // Matching a bear against a bear is spotting a pair, not working out a sum.
    // The first chapter is exempt: matching identical animals is its lesson.
    for (const level of LEVELS) {
      if (level.section === 'same') continue;
      const shared = level.initial.left.filter((species) => level.initial.right.includes(species));
      expect(shared, level.id).toEqual([]);
    }
  });

  it('never repeats a question later in the game', () => {
    const shapes = LEVELS.map((level) =>
      JSON.stringify({
        left: [...level.initial.left].sort(),
        right: [...level.initial.right].sort(),
        tray: level.tray.map((spec) => `${specCount(spec)}x${specOf(spec)}`).sort(),
      }),
    );
    expect(new Set(shapes).size, 'every question is its own').toBe(shapes.length);
  });

  it('makes the last chapter need two ideas at once, not one again', () => {
    for (const level of levelsInSection('mixed')) {
      const shortest = solutionsFor(level).sort((a, b) => a.length - b.length)[0]!;
      const usesGroup = shortest.some(
        (move) => move.kind === 'place' && specCount(level.tray[move.trayIndex]!) > 1,
      );
      const usesRemoval = shortest.some((move) => move.kind === 'remove');
      const sharesOut = level.requireEmptyTray === true;
      const ideas = [usesGroup, usesRemoval, sharesOut, shortest.length > 1].filter(Boolean).length;
      expect(ideas, level.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('which side the answer goes on', () => {
  /** Which sides the shortest answer puts animals on. */
  const answerSides = (level: LevelDef) => {
    const shortest = solutionsFor(level).sort((a, b) => a.length - b.length)[0] ?? [];
    return new Set(shortest.filter((move) => move.kind === 'place').map((move) => move.side));
  };

  it('does not train the child that animals always go on the right', () => {
    // Every early question having its animals on the left teaches "drop on the
    // right", and then the both-sides question punishes what was taught.
    const early = LEVELS.slice(0, 20);
    const goesLeft = early.filter((level) => answerSides(level).has('left')).length;
    const goesRight = early.filter((level) => answerSides(level).has('right')).length;
    expect(goesLeft).toBeGreaterThanOrEqual(5);
    expect(goesRight).toBeGreaterThanOrEqual(5);
  });

  it('puts the animals on both sides across the opening chapters', () => {
    const startsOnLeft = LEVELS.filter((level) => level.initial.left.length > 0).length;
    const startsOnRight = LEVELS.filter((level) => level.initial.right.length > 0).length;
    expect(startsOnLeft).toBeGreaterThanOrEqual(8);
    expect(startsOnRight).toBeGreaterThanOrEqual(8);
  });
});

describe('matching pairs', () => {
  it('only lets the very first question be answered by copying the other side', () => {
    // The worry is a question a child can finish by building a copy of the pile
    // opposite, without touching a number. That means identical piles reached by
    // placing on one side only. Level 14 also ends up symmetric, but it gets
    // there by adding to BOTH sides — which is the arithmetic it teaches, not a
    // way around it.
    for (const level of LEVELS.slice(1)) {
      const answers = solutionsFor(level);
      const shortest = Math.min(...answers.map((answer) => answer.length));
      // Only the answers a child would actually find. A five-move strip-and-
      // rebuild that happens to end symmetric is not the tempting path when the
      // real answer is one tap.
      for (const solution of answers.filter((answer) => answer.length === shortest)) {
        const sidesUsed = new Set(solution.filter((move) => move.kind === 'place').map((move) => move.side));
        if (sidesUsed.size !== 1) continue;

        const game = createGame(level);
        for (const move of solution) {
          if (move.kind === 'place') game.place(move.trayIndex, move.side);
          else game.takeBack(move.uid);
        }
        const pile = (which: 'left' | 'right') =>
          game.state.placed
            .filter((animal) => animal.side === which)
            .map((animal) => animal.species)
            .sort()
            .join(',');
        expect(pile('left'), `${level.id} can be answered by copying`).not.toBe(pile('right'));
      }
    }
  });
});
