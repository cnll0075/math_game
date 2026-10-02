export const BALLOON_MIN = 1;
export const BALLOON_MAX = 10;
export const WEIGHT_MAX = 20;
export const DEFAULT_HOOKS = 6;
/** Wind layers over Windy Ridge. Three, so a kit on the top one is still on screen. */
export const LAYERS = 3;

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
  /**
   * Windy Ridge: the ledge is this many wind layers up. The kit rises lift minus
   * weight layers, so the lift it needs is the weight plus this.
   */
  layer?: number;
}

export interface ChapterDef {
  id: string;
  title: string;
  /** The lift this chapter's rescues may ask for: weight, plus any layers. */
  targets: readonly [number, number];
  rescues: readonly RescueDef[];
}

export const hooksOf = (def: RescueDef): number => def.hooks ?? DEFAULT_HOOKS;
export const tiedOf = (def: RescueDef): readonly number[] => def.tied ?? [];
export const layerOf = (def: RescueDef): number => def.layer ?? 0;
/** The lift that rescues: the weight, plus one for every layer up. */
export const targetOf = (def: RescueDef): number => def.weight + layerOf(def);

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
  if (def.layer !== undefined && !whole(def.layer, 1, LAYERS)) problems.push(`layer ${def.layer}`);
  if (targetOf(def) > WEIGHT_MAX) problems.push(`target ${targetOf(def)}`);
  return problems;
}
