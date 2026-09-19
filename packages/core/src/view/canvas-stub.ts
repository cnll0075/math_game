import { recordingContext } from './recording-context.js';

/**
 * jsdom has no canvas implementation, so `getContext` returns null and every
 * draw call is skipped — which would make DOM tests pass without ever
 * exercising the renderer. Installing a recording context makes the real
 * rendering path run under test.
 */
export function installCanvasStub(): () => void {
  const prototype = globalThis.HTMLCanvasElement?.prototype;
  if (!prototype) return () => {};
  const original = prototype.getContext;
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();

  prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    if (kind !== '2d') return null;
    let context = contexts.get(this);
    if (!context) {
      context = recordingContext().ctx;
      contexts.set(this, context);
    }
    return context;
  } as typeof prototype.getContext;

  return () => {
    prototype.getContext = original;
  };
}
