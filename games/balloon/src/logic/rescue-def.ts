export const BALLOON_MIN = 1;
export const BALLOON_MAX = 10;
export const WEIGHT_MAX = 20;
export const DEFAULT_HOOKS = 6;

/** One rescue is one question. */
export interface RescueDef {
  id: string;
  /** What is happening, told as a story rather than as the mechanic. */
  line: string;
  weight: number;
  /** Balloons waiting to be clipped on. The tray is the level design. */
  tray: readonly number[];
  /** Balloons already on the left kit's harness when the rescue opens. Tapping one pops it. */
  tied?: readonly number[];
  /** The hook limit, for each kit. */
  hooks?: number;
  /** Two at Once: a second kit, of this weight, sharing the tray. */
  friend?: number;
}

export interface ChapterDef {
  id: string;
  title: string;
  /** The weights this chapter's kits may have. */
  targets: readonly [number, number];
  rescues: readonly RescueDef[];
}

export const hooksOf = (def: RescueDef): number => def.hooks ?? DEFAULT_HOOKS;
export const tiedOf = (def: RescueDef): readonly number[] => def.tied ?? [];
/** Every kit's weight, left to right. */
export const weightsOf = (def: RescueDef): number[] => (def.friend === undefined ? [def.weight] : [def.weight, def.friend]);
export const kitsOf = (def: RescueDef): number => weightsOf(def).length;

const whole = (value: number, low: number, high: number): boolean =>
  Number.isInteger(value) && value >= low && value <= high;

/** Everything wrong with a rescue's numbers; empty when it is sound. */
export function problemsWith(def: RescueDef): string[] {
  const problems: string[] = [];
  for (const weight of weightsOf(def)) {
    if (!whole(weight, 1, WEIGHT_MAX)) problems.push(`weight ${weight}`);
  }
  for (const value of [...def.tray, ...tiedOf(def)]) {
    if (!whole(value, BALLOON_MIN, BALLOON_MAX)) problems.push(`balloon ${value}`);
  }
  if (!whole(hooksOf(def), 1, DEFAULT_HOOKS)) problems.push(`hooks ${hooksOf(def)}`);
  if (tiedOf(def).length > hooksOf(def)) problems.push('more tied balloons than hooks');
  return problems;
}
