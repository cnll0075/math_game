/** How many seconds of a round are counted out loud at the end. */
export const COUNTDOWN_FROM = 5;

export interface CountdownStep {
  /** Whether this frame should sound a tick. */
  tick: boolean;
  /** The whole second now showing, carried into the next frame. */
  whole: number;
}

/**
 * Decides when the closing seconds of a round are counted out loud: once per
 * second over the last few, and never twice for the same second. Kept apart
 * from the frame loop because "did this frame cross a second boundary" is a
 * rule worth testing on its own.
 */
export function countdownStep(previousWhole: number, remaining: number | null): CountdownStep {
  if (remaining === null) return { tick: false, whole: Number.POSITIVE_INFINITY };
  const whole = Math.ceil(remaining);
  const crossed = whole < previousWhole;
  const closing = whole <= COUNTDOWN_FROM && whole > 0;
  return { tick: crossed && closing, whole };
}
