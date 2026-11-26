/** Every picture cut from the asset sheet by `scripts/cut-train.py`. */
export type SpriteName =
  | 'backdrop'
  | 'sign'
  | 'train-red'
  | 'train-blue'
  | 'train-green'
  | 'train-broken'
  | 'train-leaving'
  | `cargo-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`
  | 'worker-wrench'
  | 'worker-carry'
  | 'worker-wheel'
  | 'worker-clipboard'
  | 'broken-track'
  | 'station'
  | 'crane'
  | 'crate-stack'
  | 'barrier'
  | 'signal'
  | 'lighthouse'
  | 'seagull'
  | 'pill'
  | 'stopwatch'
  | 'pause'
  | 'progress'
  | 'repair'
  | 'hazard'
  | 'tick'
  | 'cross'
  | 'warning'
  | 'star'
  | 'bolt';

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
