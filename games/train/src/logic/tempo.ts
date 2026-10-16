/**
 * How the yard tightens with time. Everything here is a function of how long
 * the run has gone on, so a child who is doing well and one who is struggling
 * meet the same yard at the same minute: skill shows in how long a run lasts.
 */
export type BandId = 'little' | 'bigger' | 'heavy';

export interface Band {
  id: BandId;
  title: string;
  /** Seconds into the run it starts. */
  from: number;
  /** A new train's target is any whole number in this range. */
  targets: readonly [number, number];
  /** And a new crate's weight. */
  crates: readonly [number, number];
}

export const BANDS: readonly Band[] = [
  { id: 'little', title: 'Little Loads', from: 0, targets: [5, 10], crates: [1, 5] },
  { id: 'bigger', title: 'Bigger Loads', from: 60, targets: [5, 15], crates: [1, 7] },
  { id: 'heavy', title: 'Heavy Loads', from: 120, targets: [5, 20], crates: [1, 9] },
];

export const PACE = {
  /** Seconds between crates when the run opens. */
  startGap: 2,
  /** Every this many seconds, crates come faster, */
  stepSeconds: 15,
  /** by this much: the gap is divided by it. */
  speedUp: 1.1,
  /** And never closer together than this. */
  floorGap: 0.75,
} as const;

export const bandAt = (elapsed: number): Band => {
  let band = BANDS[0]!;
  for (const next of BANDS) if (elapsed >= next.from) band = next;
  return band;
};

export const bandById = (id: string | undefined): Band | undefined => BANDS.find((band) => band.id === id);

/** How many times the pace has stepped up. */
export const paceStep = (elapsed: number): number => Math.floor(Math.max(0, elapsed) / PACE.stepSeconds);

/** Seconds between one crate and the next, at this point in the run. */
export const arrivalGap = (elapsed: number): number =>
  Math.max(PACE.floorGap, PACE.startGap / PACE.speedUp ** paceStep(elapsed));
