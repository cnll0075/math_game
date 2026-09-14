import { weightOf, type AnimalId } from './animals.js';

export type Side = 'left' | 'right';
export type Zone = 'green' | 'yellow' | 'red';

export interface PlacedAnimal {
  uid: string;
  /** What it came from: a tray item's uid, or the level's own layout. */
  source: string;
  species: AnimalId;
  side: Side;
}

export interface BalanceConfig {
  /** Weight difference treated as a full tilt for presentation purposes. */
  maxTiltDifference: number;
  /** Largest |difference| still considered balanced. */
  green: number;
  /** Largest |difference| still considered merely tilted. */
  yellow: number;
}

export const DEFAULT_BALANCE_CONFIG: BalanceConfig = { maxTiltDifference: 6, green: 1, yellow: 3 };

export interface SeesawSnapshot {
  leftWeight: number;
  rightWeight: number;
  /**
   * Animal weights plus any external force, in weight units. This is the one
   * number the tilt, gauge, zone, flag and danger meter all read.
   */
  balanceDifference: number;
  /** The animals alone, ignoring wind. */
  animalDifference: number;
  /** External force in weight units; positive presses the left side down. */
  bias: number;
  /** -1..+1, positive when the left side is heavier. For presentation only. */
  normalizedBalance: number;
  zone: Zone;
  heavySide: Side | null;
  totalAnimals: number;
  isPerfectlyBalanced: boolean;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const zoneFor = (difference: number, config: BalanceConfig): Zone => {
  const magnitude = Math.abs(difference);
  if (magnitude <= config.green) return 'green';
  if (magnitude <= config.yellow) return 'yellow';
  return 'red';
};

/**
 * The seesaw's exact mathematical state. This is the authority: the rendered
 * angle is derived from it and never feeds back, so smoothing can never move
 * the moment of perfect balance.
 */
export function describeSeesaw(
  placed: readonly PlacedAnimal[],
  config: BalanceConfig = DEFAULT_BALANCE_CONFIG,
  bias = 0,
): SeesawSnapshot {
  let leftWeight = 0;
  let rightWeight = 0;
  for (const animal of placed) {
    if (animal.side === 'left') leftWeight += weightOf(animal.species);
    else rightWeight += weightOf(animal.species);
  }

  const animalDifference = leftWeight - rightWeight;
  // Wind is modelled as a phantom weight rather than as a nudge to the drawing,
  // so every system that already reads the balance reacts to it correctly and
  // the bell still rings only when the plank is genuinely level.
  const balanceDifference = animalDifference + bias;
  const totalAnimals = placed.length;

  return {
    leftWeight,
    rightWeight,
    balanceDifference,
    animalDifference,
    bias,
    normalizedBalance: clamp(balanceDifference / config.maxTiltDifference, -1, 1),
    zone: zoneFor(balanceDifference, config),
    heavySide: balanceDifference === 0 ? null : balanceDifference > 0 ? 'left' : 'right',
    totalAnimals,
    isPerfectlyBalanced: totalAnimals > 0 && balanceDifference === 0,
  };
}
