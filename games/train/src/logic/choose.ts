import type { Rng } from '@bundle/core';
import type { Band } from './tempo.js';

/** Every whole number from `low` to `high`. */
const span = ([low, high]: readonly [number, number]): number[] =>
  Array.from({ length: high - low + 1 }, (_, index) => low + index);

/** Any target in band that no waiting train already has, so "which train?" always has a real answer. */
export function chooseTarget(rng: Rng, band: Band, taken: readonly number[]): number {
  const free = span(band.targets).filter((target) => !taken.includes(target));
  return rng.pick(free.length > 0 ? free : span(band.targets));
}

/**
 * A crate that fits at least one waiting train: never heavier than every gap.
 * With no train waiting, any crate in band.
 */
export function chooseCrate(rng: Rng, band: Band, gaps: readonly number[]): number {
  const all = span(band.crates);
  const fitting = all.filter((weight) => gaps.some((gap) => weight <= gap));
  return rng.pick(fitting.length > 0 ? fitting : all);
}

/** The first train's target: one the first two crates can make, whatever the band. */
export function openingTarget(rng: Rng, band: Band): number {
  const [low, high] = band.crates;
  return rng.pick(span(band.targets).filter((target) => target >= low * 2 && target <= high * 2));
}

/** The first two crates of a run, which make the first train's target between them. */
export function openingCrates(rng: Rng, band: Band, target: number): [number, number] {
  const [low, high] = band.crates;
  const first = rng.pick(span(band.crates).filter((weight) => target - weight >= low && target - weight <= high));
  return [first, target - first];
}

/**
 * A star train's target: the sum of two or three crates already queued, so a
 * child who spots them can make it in time. Null when the queue cannot.
 */
export function starTarget(rng: Rng, band: Band, queue: readonly number[], taken: readonly number[]): number | null {
  const sums = new Set<number>();
  for (let a = 0; a < queue.length; a += 1) {
    for (let b = a + 1; b < queue.length; b += 1) {
      sums.add(queue[a]! + queue[b]!);
      for (let c = b + 1; c < queue.length; c += 1) sums.add(queue[a]! + queue[b]! + queue[c]!);
    }
  }
  const [low, high] = band.targets;
  const allowed = [...sums].filter((sum) => sum >= low && sum <= high && !taken.includes(sum)).sort((x, y) => x - y);
  return allowed.length > 0 ? rng.pick(allowed) : null;
}
