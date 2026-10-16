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
