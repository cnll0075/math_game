export const BALLOON_MIN = 1;
export const BALLOON_MAX = 10;
export const PUFF_MIN = 1;
export const PUFF_MAX = 5;
export const WEIGHT_MAX = 20;
export const DEFAULT_HOOKS = 6;

/**
 * The sideways half of a rescue. The ledge is `ledge` steps to the right; the
 * wind pushes `wind` steps by itself (negative blows away from the ledge), and
 * the puffs have to make up the rest.
 */
export interface WindDef {
  ledge: number;
  wind: number;
  puffs: readonly number[];
}

/** One rescue is one question. */
export interface RescueDef {
  id: string;
  /** What is happening, told as a story rather than as the mechanic. */
  line: string;
  weight: number;
  /** Balloons waiting to be clipped on. The tray is the level design. */
  tray: readonly number[];
  /** Balloons already on the harness when the rescue opens. Tapping one pops it. */
  tied?: readonly number[];
  hooks?: number;
  wind?: WindDef;
}

export interface ChapterDef {
  id: string;
  title: string;
  /** The weights this chapter's rescues may ask for. */
  targets: readonly [number, number];
  rescues: readonly RescueDef[];
}

export const hooksOf = (def: RescueDef): number => def.hooks ?? DEFAULT_HOOKS;
export const tiedOf = (def: RescueDef): readonly number[] => def.tied ?? [];
/** How many steps the puffs must supply. */
export const acrossNeed = (wind: WindDef): number => wind.ledge - wind.wind;

const whole = (value: number, low: number, high: number): boolean =>
  Number.isInteger(value) && value >= low && value <= high;

/** Everything wrong with a rescue's numbers; empty when it is sound. */
export function problemsWith(def: RescueDef): string[] {
  const problems: string[] = [];
  if (!whole(def.weight, 1, WEIGHT_MAX)) problems.push(`weight ${def.weight}`);
  for (const value of [...def.tray, ...tiedOf(def)]) {
    if (!whole(value, BALLOON_MIN, BALLOON_MAX)) problems.push(`balloon ${value}`);
  }
  if (!whole(hooksOf(def), 1, DEFAULT_HOOKS)) problems.push(`hooks ${hooksOf(def)}`);
  if (tiedOf(def).length > hooksOf(def)) problems.push('more tied balloons than hooks');
  if (def.wind) {
    for (const value of def.wind.puffs) {
      if (!whole(value, PUFF_MIN, PUFF_MAX)) problems.push(`puff ${value}`);
    }
    if (!whole(def.wind.ledge, 1, 10)) problems.push(`ledge ${def.wind.ledge}`);
    if (acrossNeed(def.wind) < 1) problems.push('the wind reaches the ledge by itself');
  }
  return problems;
}
