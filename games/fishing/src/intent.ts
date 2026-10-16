/** Everything a tap or a key can mean. Input produces these; the driver acts on them. */
export type Intent =
  /** Sail so the rod tip is over this x. */
  | { kind: 'sail'; x: number }
  /** Sail a step left or right: the arrow keys. */
  | { kind: 'nudge'; dir: 1 | -1 }
  | { kind: 'cast' }
  /** Move on: the next level, or another go at this one. */
  | { kind: 'next' };
