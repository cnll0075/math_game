// Written by scripts/cut-sky.py: do not edit by hand.

/** Each cut picture's size in pixels. */
export const ART_SIZES = {
  'glider': { width: 389, height: 300 },
  'weaver': { width: 372, height: 295 },
  'blimp': { width: 323, height: 421 },
  'piece-1': { width: 239, height: 202 },
  'piece-2': { width: 249, height: 214 },
  'scout': { width: 363, height: 307 },
  'hider': { width: 374, height: 302 },
  'treasure': { width: 354, height: 273 },
  'cloud-1': { width: 417, height: 215 },
  'cloud-2': { width: 294, height: 177 },
  'cloud-3': { width: 227, height: 138 },
  'cloud-4': { width: 335, height: 195 },
  'fighter': { width: 260, height: 217 },
  'fighter-hot': { width: 216, height: 215 },
  'shell': { width: 40, height: 93 },
  'pop': { width: 153, height: 141 },
  'fuel': { width: 394, height: 82 },
  'score': { width: 238, height: 82 },
  'heart': { width: 88, height: 76 },
  'heart-empty': { width: 87, height: 77 },
  'heart-cracked': { width: 90, height: 78 },
  'ribbon': { width: 568, height: 108 },
  'plaque': { width: 508, height: 179 },
  'card': { width: 427, height: 316 },
} as const;

/** Where each plane's number spot is: its middle and radius, as shares of the picture (radius of its height). */
export const NUMBER_SPOTS = {
  'glider': { x: 0.499, y: 0.548, r: 0.186 },
  'weaver': { x: 0.498, y: 0.559, r: 0.179 },
  'blimp': { x: 0.505, y: 0.490, r: 0.147 },
  'piece-1': { x: 0.498, y: 0.513, r: 0.188 },
  'piece-2': { x: 0.498, y: 0.510, r: 0.184 },
  'scout': { x: 0.493, y: 0.582, r: 0.172 },
  'hider': { x: 0.497, y: 0.545, r: 0.174 },
  'treasure': { x: 0.496, y: 0.510, r: 0.187 },
} as const;
