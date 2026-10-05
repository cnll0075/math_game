import pondUrl from '../../assets/pond.jpg';
import padUrl from '../../assets/lily-pad.png';
import frogUrl from '../../assets/frog.png';

/** The painted pieces, each null until it has loaded. */
export interface Sprites {
  pond: HTMLImageElement | null;
  pad: HTMLImageElement | null;
  frog: HTMLImageElement | null;
}

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

/**
 * Starts loading the painting's pieces. Each fills in as it arrives, so the game
 * can start at once with the drawn pond and pads standing in, and a missing
 * file only ever costs the picture, never the game.
 */
export function loadSprites(): { sprites: Sprites; ready: Promise<void> } {
  const sprites: Sprites = { pond: null, pad: null, frog: null };
  const ready = Promise.all([
    loadImage(pondUrl).then((image) => void (sprites.pond = image)),
    loadImage(padUrl).then((image) => void (sprites.pad = image)),
    loadImage(frogUrl).then((image) => void (sprites.frog = image)),
  ]).then(() => undefined);
  return { sprites, ready };
}
