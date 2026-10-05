/**
 * Everything that lives in the bay. A fish's weight lives here and nowhere
 * else, including the number it wears. The weights are the ones the asset
 * board gives each fish.
 */
export type SpeciesId =
  | 'clownfish'
  | 'bluefish'
  | 'yellowfish'
  | 'crab'
  | 'tuna'
  | 'ray'
  | 'swordfish'
  | 'angler'
  | 'puffer'
  | 'jellyfish';

export type ItemId = 'speed-potion' | 'health-potion' | 'net' | 'bonus-time' | 'treasure';

/** How a thing moves: fish swim and bob, crabs walk the sand, jellyfish pulse up and down. */
export type Gait = 'swim' | 'walk' | 'drift' | 'rest';

export interface Species {
  id: SpeciesId;
  name: string;
  weight: number;
  gait: Gait;
  /** Speed range, design pixels per second. Not tied to weight. */
  speed: readonly [number, number];
  /** Depth band it keeps to, as a share of the water from just under the surface (0) to the sand (1). */
  depth: readonly [number, number];
  /** Height over length of its picture. */
  aspect: number;
}

export const SPECIES: Readonly<Record<SpeciesId, Species>> = {
  clownfish: { id: 'clownfish', name: 'Clownfish', weight: 1, gait: 'swim', speed: [50, 105], depth: [0.05, 0.7], aspect: 0.72 },
  bluefish: { id: 'bluefish', name: 'Blue Fish', weight: 2, gait: 'swim', speed: [85, 145], depth: [0.05, 0.7], aspect: 0.69 },
  yellowfish: { id: 'yellowfish', name: 'Yellow Fish', weight: 3, gait: 'swim', speed: [45, 95], depth: [0.15, 0.8], aspect: 0.72 },
  crab: { id: 'crab', name: 'Crab', weight: 4, gait: 'walk', speed: [22, 45], depth: [1, 1], aspect: 0.72 },
  tuna: { id: 'tuna', name: 'Tuna', weight: 5, gait: 'swim', speed: [90, 150], depth: [0.25, 0.85], aspect: 0.63 },
  ray: { id: 'ray', name: 'Ray', weight: 6, gait: 'swim', speed: [50, 90], depth: [0.35, 0.9], aspect: 0.77 },
  swordfish: { id: 'swordfish', name: 'Swordfish', weight: 7, gait: 'swim', speed: [130, 185], depth: [0.2, 0.8], aspect: 0.66 },
  angler: { id: 'angler', name: 'Angler', weight: 8, gait: 'swim', speed: [30, 60], depth: [0.6, 0.95], aspect: 0.93 },
  puffer: { id: 'puffer', name: 'Pufferfish', weight: 9, gait: 'swim', speed: [25, 50], depth: [0.3, 0.85], aspect: 0.91 },
  jellyfish: { id: 'jellyfish', name: 'Jellyfish', weight: 10, gait: 'drift', speed: [14, 28], depth: [0.25, 0.75], aspect: 1.22 },
};

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

/** The fish that weighs this much. There is one of each, 1 to 10. */
export const speciesOfWeight = (weight: number): SpeciesId | undefined =>
  SPECIES_IDS.find((id) => SPECIES[id].weight === weight);

export interface Item {
  id: ItemId;
  name: string;
  /** What it says over the boat when it lands. */
  says: string;
  /** How heavy it is to reel, in fish-weights. It never counts in the bucket. */
  drag: number;
  gait: Gait;
  speed: readonly [number, number];
  depth: readonly [number, number];
  aspect: number;
  /** Its picture's width, design pixels. */
  length: number;
}

export const ITEMS: Readonly<Record<ItemId, Item>> = {
  'speed-potion': {
    id: 'speed-potion', name: 'Speed Potion', says: 'Reel faster!', drag: 0, gait: 'drift',
    speed: [16, 28], depth: [0.15, 0.7], aspect: 1.39, length: 52,
  },
  'health-potion': {
    id: 'health-potion', name: 'Health Potion', says: 'Safe from tipping!', drag: 0, gait: 'drift',
    speed: [16, 28], depth: [0.15, 0.7], aspect: 1.42, length: 50,
  },
  net: { id: 'net', name: 'Net', says: 'Bigger catch!', drag: 0, gait: 'drift', speed: [16, 28], depth: [0.15, 0.7], aspect: 1.12, length: 62 },
  'bonus-time': {
    id: 'bonus-time', name: 'Bonus Time', says: '+10 seconds!', drag: 0, gait: 'drift',
    speed: [16, 28], depth: [0.15, 0.7], aspect: 1.08, length: 56,
  },
  // Treasure sits on the sand and weighs nothing in the bucket, but it is heavy
  // to wind up: shiny, and a waste of time, like the rocks in Gold Miner.
  treasure: { id: 'treasure', name: 'Treasure', says: 'Treasure! (It weighs nothing.)', drag: 7, gait: 'rest', speed: [0, 0], depth: [1, 1], aspect: 0.88, length: 78 },
};

/** One colour per weight, so a 5 is the same 5 wherever it appears. */
export const WEIGHT_COLOURS: Readonly<Record<number, string>> = {
  1: '#f08a3c',
  2: '#3f9fe0',
  3: '#e0b020',
  4: '#e0533f',
  5: '#4caf6a',
  6: '#3f5f9f',
  7: '#2a7fd0',
  8: '#9b59c6',
  9: '#c08a3a',
  10: '#8e7fe0',
};

export const weightColour = (weight: number): string => WEIGHT_COLOURS[weight] ?? '#1e2a38';

/** Ten more seconds from Bonus Time. */
export const BONUS_SECONDS = 10;
