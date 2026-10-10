import type { ItemId, SpeciesId } from './species.js';

export interface LevelDef {
  id: string;
  title: string;
  /** Under the title for the whole level: the story, or the new idea. */
  line: string;
  /** How much the bucket holds. The goal is exactly this. */
  capacity: number;
  seconds: number;
  /** Fish already in the bucket when the level opens. */
  start?: readonly number[];
  /** How many of each are in the water at once. A caught fish is replaced. */
  fish: readonly { species: SpeciesId; count: number }[];
  /** Items are not replaced: there are only ever this many. */
  items?: readonly { item: ItemId; count: number }[];
  /** Write the gap under the bucket — "3 more!" — so the early levels teach it. */
  showGap?: boolean;
  /** Coach the two verbs in the line under the title. */
  coach?: boolean;
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 'first-catch',
    title: 'First Catch',
    line: 'Fill the bucket to 3',
    capacity: 3,
    seconds: 30,
    fish: [{ species: 'clownfish', count: 3 }, { species: 'bluefish', count: 3 }],
    showGap: true,
    coach: true,
  },
  {
    id: 'just-right',
    title: 'Just Right',
    line: 'Not one fish too many!',
    capacity: 6,
    seconds: 30,
    fish: [{ species: 'clownfish', count: 3 }, { species: 'bluefish', count: 2 }, { species: 'yellowfish', count: 2 }],
    showGap: true,
  },
  {
    id: 'big-ones',
    title: 'Big Ones Are Quick',
    line: 'One big fish fills it faster',
    capacity: 10,
    seconds: 35,
    fish: [{ species: 'clownfish', count: 3 }, { species: 'bluefish', count: 2 }, { species: 'tuna', count: 2 }],
    showGap: true,
  },
  {
    id: 'speed-potion',
    title: 'Speed Potion',
    line: 'Catch the potion to reel faster',
    capacity: 12,
    seconds: 30,
    fish: [{ species: 'clownfish', count: 2 }, { species: 'yellowfish', count: 2 }, { species: 'ray', count: 2 }],
    items: [{ item: 'speed-potion', count: 1 }],
  },
  {
    id: 'no-little-ones',
    title: 'No Little Ones',
    line: 'No 1s today. Bonus Time gives more time!',
    capacity: 9,
    seconds: 30,
    fish: [{ species: 'bluefish', count: 3 }, { species: 'yellowfish', count: 2 }, { species: 'tuna', count: 2 }],
    items: [{ item: 'bonus-time', count: 1 }],
  },
  {
    id: 'crab-walk',
    title: 'Crab Walk',
    line: 'Crabs walk the sand. Treasure weighs nothing!',
    capacity: 14,
    seconds: 40,
    fish: [{ species: 'clownfish', count: 3 }, { species: 'crab', count: 3 }, { species: 'ray', count: 2 }],
    items: [{ item: 'treasure', count: 2 }],
  },
  {
    id: 'life-saver',
    title: 'Life Saver',
    line: 'A health potion stops the boat tipping once',
    capacity: 10,
    seconds: 25,
    fish: [{ species: 'bluefish', count: 2 }, { species: 'crab', count: 2 }, { species: 'ray', count: 2 }, { species: 'angler', count: 2 }],
    items: [{ item: 'health-potion', count: 1 }],
  },
  {
    id: 'puffer-party',
    title: 'Puffer Party',
    line: 'Threes, fours and nines',
    capacity: 15,
    seconds: 35,
    fish: [{ species: 'yellowfish', count: 3 }, { species: 'crab', count: 2 }, { species: 'puffer', count: 2 }],
    items: [{ item: 'bonus-time', count: 1 }],
  },
  {
    id: 'swordfish',
    title: 'Swordfish!',
    line: 'Swordfish are fast. The net helps!',
    capacity: 14,
    seconds: 45,
    fish: [{ species: 'clownfish', count: 3 }, { species: 'bluefish', count: 2 }, { species: 'swordfish', count: 2 }],
    items: [{ item: 'net', count: 1 }],
  },
  {
    id: 'half-full',
    title: 'Half Full',
    line: 'Some fish are in already',
    capacity: 16,
    seconds: 25,
    start: [5, 3],
    fish: [{ species: 'bluefish', count: 2 }, { species: 'yellowfish', count: 2 }, { species: 'tuna', count: 2 }, { species: 'ray', count: 1 }],
    items: [{ item: 'health-potion', count: 1 }],
  },
  {
    id: 'jellyfish',
    title: 'Jellyfish',
    line: 'Jellyfish are slow, but so heavy!',
    capacity: 20,
    seconds: 30,
    fish: [{ species: 'clownfish', count: 3 }, { species: 'bluefish', count: 2 }, { species: 'jellyfish', count: 2 }],
    items: [{ item: 'speed-potion', count: 1 }],
  },
  {
    id: 'busy-sea',
    title: 'Busy Sea',
    line: 'Everything at once!',
    capacity: 18,
    seconds: 40,
    fish: [{ species: 'clownfish', count: 2 }, { species: 'yellowfish', count: 2 }, { species: 'crab', count: 1 }, { species: 'ray', count: 2 }, { species: 'angler', count: 1 }],
    items: [{ item: 'speed-potion', count: 1 }, { item: 'bonus-time', count: 1 }, { item: 'net', count: 1 }, { item: 'treasure', count: 2 }],
  },
  {
    id: 'big-haul',
    title: 'Big Haul',
    line: 'The biggest bucket of all',
    capacity: 25,
    seconds: 50,
    fish: [{ species: 'clownfish', count: 2 }, { species: 'bluefish', count: 2 }, { species: 'tuna', count: 2 }, { species: 'swordfish', count: 1 }, { species: 'puffer', count: 1 }, { species: 'jellyfish', count: 1 }],
    items: [{ item: 'speed-potion', count: 1 }, { item: 'health-potion', count: 1 }, { item: 'bonus-time', count: 1 }, { item: 'net', count: 1 }, { item: 'treasure', count: 2 }],
  },
];

export const levelIndex = (id: string): number => LEVELS.findIndex((level) => level.id === id);
