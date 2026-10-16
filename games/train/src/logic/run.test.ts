import { describe, it, expect } from 'vitest';
import { createRun, gapOf, loadOf, QUEUE_SLOTS, TIMES, type Run, type RunEvent } from './run.js';

const FRAME = 1 / 60;
const run = (startBand?: 'little' | 'bigger' | 'heavy', seed = 3): Run => createRun({ seed, startBand });
const steps = (target: Run, seconds: number): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += FRAME) events.push(...target.step(FRAME));
  return events;
};
const types = (events: readonly RunEvent[]) => events.map((event) => event.type);

/** Put crates of these weights straight into the queue, for a test that needs them. */
const queue = (target: Run, weights: number[]) => {
  let id = 900;
  target.state.queue.push(...weights.map((weight) => ({ id: id++, weight })));
};

describe('the opening', () => {
  it('has three trains waiting on three different targets, and a first crate within a second', () => {
    const yard = run();
    expect(yard.state.tracks.map((track) => track.phase)).toEqual(['waiting', 'waiting', 'waiting']);
    expect(new Set(yard.state.tracks.map((track) => track.target)).size).toBe(3);
    const events = steps(yard, 1);
    expect(types(events)).toContain('crate');
  });

  it('brings first the two crates that make one train exactly, in any band', () => {
    for (const band of ['little', 'bigger', 'heavy'] as const) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const yard = run(band, seed);
        steps(yard, 3);
        const [a, b] = yard.state.queue;
        expect(yard.state.tracks.some((track) => track.target === a!.weight + b!.weight)).toBe(true);
      }
    }
  });

  it('starts the clock at the band it was asked for', () => {
    expect(run('heavy').state.elapsed).toBe(120);
    expect(run().state.band).toBe('little');
  });
});

describe('the crates', () => {
  it('arrive every two seconds at first, each fitting some waiting train', () => {
    const yard = run();
    const events = steps(yard, 10.5);
    const crates = events.filter((event) => event.type === 'crate');
    expect(crates).toHaveLength(5);
    for (const event of crates) {
      if (event.type !== 'crate') continue;
      expect(yard.state.tracks.some((track) => track.phase === 'waiting' && event.crate.weight <= track.target)).toBe(true);
    }
  });

  it('end the run when one arrives with the queue full', () => {
    const yard = run();
    const events = steps(yard, 60);
    expect(yard.state.over).toBe(true);
    expect(yard.state.queue).toHaveLength(QUEUE_SLOTS);
    expect(events.filter((event) => event.type === 'over')).toHaveLength(1);
    expect(yard.step(1)).toEqual([]);
  });

  it('do not pour in past the end in one long frame', () => {
    const yard = run();
    const events = yard.step(120);
    expect(yard.state.over).toBe(true);
    expect(yard.state.queue).toHaveLength(QUEUE_SLOTS);
    expect(events.filter((event) => event.type === 'over')).toHaveLength(1);
  });
});

describe('loading', () => {
  it('puts a crate under the target on the train', () => {
    const yard = run();
    yard.state.tracks[0]!.target = 9;
    queue(yard, [4]);
    const events = yard.load(900, 0);
    expect(events).toEqual([{ type: 'loaded', track: 0, crate: { id: 900, weight: 4 }, load: 4, target: 9 }]);
    expect(yard.state.queue.find((crate) => crate.id === 900)).toBeUndefined();
    expect(gapOf(yard.state.tracks[0]!)).toBe(5);
  });

  it('sends a train loaded exactly, and rolls in a fresh one with a new target', () => {
    const yard = run();
    const track = yard.state.tracks[1]!;
    track.target = 7;
    queue(yard, [3, 4]);
    yard.load(900, 1);
    const events = yard.load(901, 1);
    expect(types(events)).toEqual(['loaded', 'sent']);
    expect(yard.state.sent).toBe(1);
    expect(track.phase).toBe('rolling');
    const arrival = steps(yard, TIMES.rollIn + 0.05).find((event) => event.type === 'arrived');
    expect(arrival).toMatchObject({ type: 'arrived', track: 1 });
    expect(track.phase).toBe('waiting');
    expect(loadOf(track)).toBe(0);
  });

  it('breaks a train loaded too heavy, keeps it out for the repair, and then rolls in a fresh one', () => {
    const yard = run();
    const track = yard.state.tracks[2]!;
    track.target = 5;
    queue(yard, [3, 4]);
    yard.load(900, 2);
    expect(types(yard.load(901, 2))).toEqual(['loaded', 'broke']);
    expect(track.phase).toBe('broken');
    expect(yard.state.broken).toBe(1);
    expect(types(steps(yard, TIMES.repair - 0.1))).not.toContain('repaired');
    expect(types(steps(yard, 0.2))).toContain('repaired');
    expect(track.phase).toBe('rolling');
    steps(yard, TIMES.rollIn);
    expect(track.phase).toBe('waiting');
  });

  it('refuses a crate for a train that is not waiting, or a crate that is not in the queue', () => {
    const yard = run();
    yard.state.tracks[0]!.phase = 'broken';
    queue(yard, [2]);
    expect(yard.load(900, 0)).toEqual([]);
    expect(yard.load(12345, 1)).toEqual([]);
    expect(yard.load(900, 7)).toEqual([]);
    expect(yard.state.queue.some((crate) => crate.id === 900)).toBe(true);
  });

  it('never gives two waiting trains the same target', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const yard = run('little', seed);
      for (let round = 0; round < 40; round += 1) {
        const waiting = yard.state.tracks.filter((track) => track.phase === 'waiting');
        const target = waiting[0];
        if (target) {
          queue(yard, [gapOf(target)]);
          yard.load(yard.state.queue.at(-1)!.id, yard.state.tracks.indexOf(target));
        }
        steps(yard, 0.5);
        const targets = yard.state.tracks.filter((track) => track.phase === 'waiting').map((track) => track.target);
        expect(new Set(targets).size).toBe(targets.length);
      }
    }
  });
});

describe('the clock', () => {
  it('announces each band once, and each speed-up while the pace still has room to rise', () => {
    const yard = run();
    yard.state.queue.length = 0;
    const events: RunEvent[] = [];
    for (let t = 0; t < 200; t += FRAME) {
      yard.state.queue.length = 0;
      events.push(...yard.step(FRAME));
    }
    expect(events.filter((event) => event.type === 'band').map((event) => (event.type === 'band' ? event.band.id : ''))).toEqual(['bigger', 'heavy']);
    const speeds = events.filter((event) => event.type === 'speed');
    expect(speeds.length).toBe(11);
  });

  it('announces a band even when a long frame jumps right over its start', () => {
    const yard = run();
    // Just short of 1:00, so ten seconds in one frame cross it without the queue filling.
    yard.state.elapsed = 55;
    yard.state.step = 3;
    const events = yard.step(10);
    expect(events.some((event) => event.type === 'band')).toBe(true);
  });
});
describe('star trains', () => {
  /** A run past 0:30 whose next train will be a star, given a queue that can make one. */
  const starRun = (seed = 5): Run => {
    const yard = createRun({ seed, startBand: 'bigger' });
    yard.state.queue.length = 0;
    queue(yard, [2, 3, 4, 1, 5, 2]);
    return yard;
  };

  /** Send track 0's train and step until a star train rolls in on some track. */
  const awaitStar = (yard: Run): number => {
    for (let tries = 0; tries < 400; tries += 1) {
      const index = yard.state.tracks.findIndex((track) => track.star > 0);
      if (index >= 0) return index;
      const track = yard.state.tracks.find((entry) => entry.phase === 'waiting' && entry.star === 0)!;
      const at = yard.state.tracks.indexOf(track);
      yard.state.queue.unshift({ id: 5000 + tries, weight: gapOf(track) });
      yard.load(5000 + tries, at);
      for (let t = 0; t < TIMES.rollIn + 0.1; t += FRAME) {
        yard.step(FRAME);
        yard.state.queue.splice(6);
      }
    }
    throw new Error('no star train in 400 trains');
  };

  it('come about one train in eight, never before 0:30, never two at once', () => {
    let stars = 0;
    let trains = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const yard = starRun(seed);
      for (let round = 0; round < 30; round += 1) {
        const track = yard.state.tracks.find((entry) => entry.phase === 'waiting')!;
        yard.state.queue.unshift({ id: 7000 + round, weight: gapOf(track) });
        yard.load(7000 + round, yard.state.tracks.indexOf(track));
        const events = steps(yard, TIMES.rollIn + 0.1);
        yard.state.queue.splice(6);
        for (const event of events) {
          if (event.type !== 'arrived') continue;
          trains += 1;
          if (event.star) stars += 1;
        }
        expect(yard.state.tracks.filter((entry) => entry.star > 0).length).toBeLessThanOrEqual(1);
      }
    }
    expect(stars / trains).toBeGreaterThan(0.06);
    expect(stars / trains).toBeLessThan(0.2);

    const early = createRun({ seed: 1 });
    const events = steps(early, 29);
    expect(events.some((event) => event.type === 'arrived' && event.star)).toBe(false);
  });

  it('want a sum of two or three crates in the queue', () => {
    const yard = starRun();
    const index = awaitStar(yard);
    const weights = yard.state.queue.map((crate) => crate.weight);
    const sums = new Set<number>();
    weights.forEach((a, i) => weights.forEach((b, j) => {
      if (j <= i) return;
      sums.add(a + b);
      weights.forEach((c, k) => { if (k > j) sums.add(a + b + c); });
    }));
    expect(sums.has(yard.state.tracks[index]!.target)).toBe(true);
  });

  it('tick down five seconds, then fade into an ordinary train with the same target', () => {
    const yard = starRun();
    const index = awaitStar(yard);
    const target = yard.state.tracks[index]!.target;
    const events: RunEvent[] = [];
    for (let t = 0; t < TIMES.star + 0.1; t += FRAME) {
      events.push(...yard.step(FRAME));
      yard.state.queue.splice(6);
    }
    expect(events.filter((event) => event.type === 'starTick' && event.track === index).map((event) => (event.type === 'starTick' ? event.seconds : 0))).toEqual([4, 3, 2, 1]);
    expect(events).toContainEqual({ type: 'starFaded', track: index });
    expect(yard.state.tracks[index]).toMatchObject({ phase: 'waiting', star: 0, target });
  });

  it('filled in time, clear the half of the queue nearest the line', () => {
    const yard = starRun();
    const index = awaitStar(yard);
    const track = yard.state.tracks[index]!;
    yard.state.queue.length = 0;
    queue(yard, [1, 1, 1, 1, 1, 1, track.target]);
    const filler = yard.state.queue.at(-1)!;
    const events = yard.load(filler.id, index);
    expect(events).toContainEqual(expect.objectContaining({ type: 'sent', bonus: true }));
    const cleared = events.find((event) => event.type === 'cleared');
    // Six left after the filler went; half of them, the three nearest the line, go.
    expect(cleared).toEqual({ type: 'cleared', crates: [{ id: 903, weight: 1 }, { id: 904, weight: 1 }, { id: 905, weight: 1 }] });
    expect(yard.state.queue.map((crate) => crate.id)).toEqual([900, 901, 902]);
  });

  it('too heavy, break like any other train, and leave no star behind', () => {
    const yard = starRun();
    const index = awaitStar(yard);
    const track = yard.state.tracks[index]!;
    yard.state.queue.length = 0;
    queue(yard, [track.target + 1]);
    const events = yard.load(yard.state.queue.at(-1)!.id, index);
    expect(events.map((event) => event.type)).toEqual(['loaded', 'broke']);
    expect(track.star).toBe(0);
  });
});
