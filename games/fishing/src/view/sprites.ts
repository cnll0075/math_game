import type { ItemId, SpeciesId } from '../logic/species.js';

/** Every picture cut from the asset board by `scripts/cut-fishing.py`. */
export type SpriteName =
  | SpeciesId
  | ItemId
  | 'backdrop'
  | 'fisherman'
  | 'boat'
  | 'bucket'
  | 'timer'
  | 'buoy'
  | 'barrel'
  | 'rocks'
  | 'seaweed'
  | 'seagull';

/** The painted pieces, each null until it has loaded. */
export type Sprites = Record<SpriteName, HTMLImageElement | null>;

const URLS = import.meta.glob<string>('../../assets/*.{png,jpg}', { eager: true, query: '?url', import: 'default' });

const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.(png|jpg)$/, '');

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
 * Starts loading the board's pieces. Each fills in as it arrives, so the game
 * can start at once with drawn shapes standing in, and a missing file only
 * ever costs the picture, never the game.
 */
export function loadSprites(): { sprites: Sprites; ready: Promise<void> } {
  const sprites = {} as Sprites;
  const loads = Object.entries(URLS).map(([path, url]) => {
    const name = nameOf(path) as SpriteName;
    sprites[name] = null;
    return loadImage(url).then((image) => void (sprites[name] = image));
  });
  return { sprites, ready: Promise.all(loads).then(() => undefined) };
}

/** Nothing loaded: what tests and the first frames draw with. */
export const NO_SPRITES = new Proxy({} as Sprites, { get: () => null });
