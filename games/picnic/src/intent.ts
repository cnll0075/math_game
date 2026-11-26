import type { Point } from '@bundle/core';

/** Everything a tap or a swipe can mean. Input produces these; the driver acts on them. */
export type Intent =
  /** Give one treat to this plate. */
  | { kind: 'tap'; plate: number }
  /** Turn the dial up or down one. */
  | { kind: 'dial'; step: 1 | -1 }
  /** Bring a friend to the table, or send them back: their place in the round's list. */
  | { kind: 'invite'; friend: number }
  /** The Share button: share the dial's number, or everything among whoever came. */
  | { kind: 'share' }
  /** A swipe across the food, relative to its middle, in radii. */
  | { kind: 'cut'; from: Point; to: Point }
  /** Move on: the next round, or the first again. */
  | { kind: 'next' };
