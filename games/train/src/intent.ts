/** Everything a gesture or a key can mean. Input produces these; the driver acts on them. */
export type Intent =
  /** A crate from the queue dropped on a track. */
  | { kind: 'load'; crate: number; track: number }
  /** The pause button. */
  | { kind: 'pause' }
  /** Carry on: out of the pause, or another run after the summary. */
  | { kind: 'next' };
