/**
 * Three lanes, and nothing else. The lane is the answer, so a second axis of
 * input would make this a dexterity game with sums attached.
 */
export const LANES = 3;

/** The middle of a lane, 0..1 across the path. */
export const laneCentre = (lane: number): number => (lane + 0.5) / LANES;

/**
 * Which lane a position is over. The rabbit moves continuously and this is what
 * decides where it counts as being when a row arrives — forgiving, because a
 * child steering with a finger should not lose a tenth of the tank to a pixel.
 */
export const laneAt = (x: number): number =>
  Math.min(LANES - 1, Math.max(0, Math.floor(x * LANES)));
