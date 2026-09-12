/**
 * A canvas context stand-in that records which calls were made. Tests use it to
 * check that drawing code is well-behaved — every save matched by a restore, no
 * exceptions, something actually drawn — without asserting on pixels, which
 * would break every time the prototype art is touched.
 */
export interface RecordingContext {
  ctx: CanvasRenderingContext2D;
  calls: string[];
}

const RETURNS_OBJECT = new Set(['createLinearGradient', 'createRadialGradient', 'createPattern']);

export function recordingContext(): RecordingContext {
  const calls: string[] = [];
  let depth = 0;

  const target = {
    canvas: { width: 1024, height: 768 },
    get __depth() {
      return depth;
    },
  };

  const ctx = new Proxy(target, {
    get(receiver: Record<string, unknown>, property: string) {
      if (property in receiver) return receiver[property];
      return (...args: unknown[]) => {
        calls.push(property);
        if (property === 'save') depth += 1;
        if (property === 'restore') depth -= 1;
        if (RETURNS_OBJECT.has(property)) return { addColorStop: () => {} };
        if (property === 'measureText') return { width: String(args[0] ?? '').length * 7 };
        return undefined;
      };
    },
    set() {
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, calls };
}

export const depthOf = (ctx: CanvasRenderingContext2D): number =>
  (ctx as unknown as { __depth: number }).__depth;
