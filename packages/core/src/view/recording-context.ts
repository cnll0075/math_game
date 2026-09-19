/**
 * A canvas context stand-in that records which calls were made. Tests use it to
 * check that drawing code is well-behaved — every save matched by a restore, no
 * exceptions, something actually drawn — without asserting on pixels, which
 * would break every time the prototype art is touched.
 */
export interface RecordingContext {
  ctx: CanvasRenderingContext2D;
  calls: string[];
  /** Everything written with fillText/strokeText, so copy can be asserted. */
  texts: string[];
  /** Every translate, so positions can be asserted without reading pixels. */
  translations: Array<{ x: number; y: number }>;
}

const RETURNS_OBJECT = new Set(['createLinearGradient', 'createRadialGradient', 'createPattern']);

export function recordingContext(): RecordingContext {
  const calls: string[] = [];
  const texts: string[] = [];
  const translations: Array<{ x: number; y: number }> = [];
  let depth = 0;

  const target = {
    canvas: { width: 1024, height: 768 },
    get __depth() {
      return depth;
    },
    get __calls() {
      return calls;
    },
  };

  const ctx = new Proxy(target, {
    get(receiver: Record<string, unknown>, property: string) {
      if (property in receiver) return receiver[property];
      return (...args: unknown[]) => {
        calls.push(property);
        if (property === 'save') depth += 1;
        if (property === 'restore') depth -= 1;
        // Only what was filled. Lettering is written more than once - a rim
        // under it, then the letters - and counting the passes would make a
        // test about how many numbers are on screen a test about how they are
        // drawn.
        if (property === 'fillText') texts.push(String(args[0] ?? ''));
        if (property === 'translate') translations.push({ x: Number(args[0]), y: Number(args[1]) });
        if (RETURNS_OBJECT.has(property)) return { addColorStop: () => {} };
        if (property === 'measureText') return { width: String(args[0] ?? '').length * 7 };
        return undefined;
      };
    },
    set() {
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, calls, texts, translations };
}

export const depthOf = (ctx: CanvasRenderingContext2D): number =>
  (ctx as unknown as { __depth: number }).__depth;
